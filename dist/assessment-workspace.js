import {createReportingGradebook} from './reporting-gradebook.js?v=20261111-reporting';
import {createGradebook} from './gradebook.js?v=20261111-unified';
import {createStandardsProgress} from './standards-progress.mjs?v=20261111-unified';
import {connectEvidencePanels} from './evidence-expansion.js';
import {gradeLabel,standardsLevels} from './gradebook-model.mjs';
import {liveBoardEvidenceHTML} from './live-board-evidence.mjs?v=20261110-library';
import {studentPageHTML} from './educade-student-view.js?v=20261111-unified';
import {assessmentDemoClasses,isAssessmentDemo,loadAssessmentDemo} from './assessment-demo.mjs';
import {learningTabs,classAxes,axisStats,classOverviewHTML,classRowsHTML,practiceRadarHTML} from './educade-assessment-view.js?v=20261111-unified';
import catalogue from './assessment-catalogue.mjs?v=20261103-class-view';
import {standardsPacks,packById,schoolProgressScale} from './standards-registry.mjs';
import curricula from './assessment-curricula.mjs';
import {achievementLevels,learnerEvidence,evidenceSummary} from './assessment-model.mjs';
import {api,escape} from './workspace-shared.js';

export function createAssessmentWorkspace({root,getClasses,openTimeline,openStandards,onDemoInstalled,getClassId,openReporting}) {
  const entry=new URLSearchParams(location.search);
  let reportingGradebook=null,pendingReportingCell=null;
  let boardEvidence=[],boardEvidenceUnavailable=false,gradebook=null,gradebookData={activities:[]},teacherUnavailable=false,disconnectEvidence=()=>{},standardsWorkspace=null,source='both',layout=new URLSearchParams(location.search).get('assessment')==='gradebook'?'reporting':'students',pendingStandard=null,pendingLearner='';
  let classId=entry.get('class') || assessmentDemoClasses.find(c=>c.id===new URLSearchParams(location.search).get('demo'))?.id || (new URLSearchParams(location.search).get('demo')==='1'?assessmentDemoClasses[0].id:''),learnerId=entry.get('learner') || '',view=['standards','catalogue','skills'].includes(entry.get('assessment'))?'standards':entry.get('assessment')==='gradebook'?'gradebook':'evidence',framework='ccss',domain='all',search='',students=[],lessons=[],courseAssessment=null,libraryPack='ccss-ela',librarySearch='',loading=false,error='',epoch=0,classScope='overall',expandedAxis='',expandedLearner='',classMode='bars',learnerSearch='',learnerSort='name',portrait='photos',skillRecords=[],enduringTargets='',profileScope=Object.hasOwn(learningTabs,entry.get('subject'))?entry.get('subject'):'overall',studentMode='radar',selectedSkill='';
  const $=selector=>root.querySelector(selector),expandedDetails=new Set();
  root.innerHTML=`<div class="assessment-controls"><label ${getClassId?'hidden':''}><strong>Class</strong><select data-assessment-class aria-label="Assessment class"></select></label><div class="assessment-views" role="group" aria-label="Assessment workspace"><button type="button" data-assessment-view="evidence" aria-pressed="true">Learning evidence</button><button type="button" data-assessment-view="standards" aria-pressed="false">Standards progress</button><button type="button" data-assessment-view="gradebook" aria-pressed="false">Gradebook</button></div><button type="button" class="text-button" data-assessment-refresh>Refresh</button></div><p data-assessment-status role="status"></p><div data-assessment-body></div>`;
  const previewRequested=new URLSearchParams(location.search).has('demo');
  const currentDemo=()=>isAssessmentDemo(classId) || Boolean(getClasses().find(c=>c.id===classId)?.demoKey);
  function classOptions(){
    if(getClassId)classId=getClassId()||'';
    const saved=getClasses(),preview=saved.some(c=>c.demoKey)?[]:previewRequested?assessmentDemoClasses:[],classes=[...saved,...preview];
    if(isAssessmentDemo(classId)){const installed=saved.find(c=>c.demoKey===classId.replace('demo-educade-',''));if(installed){classId=installed.id;syncDemoURL();}}
    if(!classes.some(c=>c.id===classId)&&!(entry.get('class')===classId&&!saved.length)){classId=saved[0]?.id || '';learnerId='';}
    $('[data-assessment-class]').innerHTML=(classId?'':'<option value="">Choose a class…</option>')+saved.map(c=>`<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('')+(preview.length?`<optgroup label="Fictional demo classes">${preview.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</optgroup>`:'');
    $('[data-assessment-class]').value=classId;$('[data-assessment-class]').disabled=!classes.length;
  }
  function rememberClassDetails(){
    root.querySelectorAll('[data-class-detail]').forEach(detail=>{if(detail.open)expandedDetails.add(detail.dataset.classDetail);else expandedDetails.delete(detail.dataset.classDetail);});
  }
  function render(){
    reportingGradebook?.clear();reportingGradebook=null;disconnectEvidence();disconnectEvidence=()=>{};standardsWorkspace?.clear();standardsWorkspace=null;gradebook?.clear();gradebook=null;
    rememberClassDetails();
    root.querySelectorAll('[data-assessment-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.assessmentView===view)));
    if(!learnerId)document.title='Assessment | Ink Wire';
    $('[data-assessment-status]').textContent=loading?'Loading learning evidence…':error;
    if(loading){$('[data-assessment-body]').innerHTML='<div class="assessment-empty">Getting the class ready…</div>';return;}
    if(error){$('[data-assessment-body]').innerHTML='<div class="assessment-empty"><h2>Evidence could not be loaded</h2><button type="button" class="teacher-button secondary" data-assessment-retry>Try again</button></div>';return;}
    if(view==='standards'){renderStandards();return;}
    if(view==='gradebook'){
      const target=$('[data-assessment-body]');
      if(!classId){target.innerHTML='<p>Choose a class to open its Gradebook.</p>';return;}
      if(isAssessmentDemo(classId)){target.innerHTML='<p>Install the fictional demo class to enter or publish grades.</p>';return;}
      if(layout!=='activities'){
        reportingGradebook=createReportingGradebook({root:target,classId,students,initialCell:pendingReportingCell,onConfigure:planId=>{if(planId){const url=new URL(location.href);url.searchParams.set('reportingPlan',planId);history.replaceState(null,'',url);}openReporting?.(classId);},onActivities:()=>{layout='activities';render();},onData:a=>{gradebookData.activities=gradebookData.activities.filter(v=>v.id!==a.id);gradebookData.activities.push(a);}});pendingReportingCell=null;return;
      }
      target.innerHTML='<button type="button" class="teacher-button secondary" data-back-reporting>← Unit reporting Gradebook</button><div data-gradebook-activities></div>';
      gradebook=createGradebook({root:target.querySelector('[data-gradebook-activities]'),classId,students,lessons,boardEvidence,boardEvidenceUnavailable,initialData:teacherUnavailable?null:gradebookData,initialSource:source,onData:next=>{gradebookData=next;},compact:false});
      target.querySelector('[data-back-reporting]').onclick=()=>{layout='reporting';render();};
      if(pendingStandard){const standard=pendingStandard,person=pendingLearner;pendingStandard=null;pendingLearner='';gradebook.createActivityForStandard(standard,person);}return;
    }
    if(learnerId){renderStudent();return;}
    const target=$('[data-assessment-body]'),demo=currentDemo();
    target.innerHTML=(demo?`<div class="assessment-demo-notice"><span><strong>Demo class</strong> · Fictional learners and sample evidence.</span>${isAssessmentDemo(classId)?'<button type="button" class="text-button" data-install-assessment-demo>Add demo classes to my workspace</button>':''}</div>`:'')+`<div class="assessment-evidence-toolbar"><div class="gb-toggle" role="group" aria-label="Evidence source">${[['both','Both'],['teacher','Teacher'],['automatic','Automatic / AI']].map(([id,label])=>`<button type="button" data-evidence-source="${id}" aria-pressed="${source===id}">${label}</button>`).join('')}</div><div class="assessment-evidence-layout" role="group" aria-label="Evidence layout">${[['students','By student'],['activities','By activity']].map(([id,label])=>`<button type="button" data-evidence-layout="${id}" aria-pressed="${layout===id}">${label}</button>`).join('')}</div>${!isAssessmentDemo(classId)?'<button type="button" class="teacher-button" data-new-assessment>+ Record assessment</button>':''}</div>${teacherUnavailable?'<p role="status">Teacher records are unavailable. Refresh to retry; the view below may be incomplete.</p>':''}<div data-learning-content></div>`;
    const content=$('[data-learning-content]');
    if(layout==='activities'){
      if(!classId){content.innerHTML='<p>Choose a class to see learning evidence.</p>';return;}
      if(isAssessmentDemo(classId)){content.innerHTML='<p>Install this fictional class to create assessment activities. Practice evidence is available under By student.</p>';return;}
      gradebook=createGradebook({root:content,classId,students,lessons,boardEvidence,boardEvidenceUnavailable,initialData:teacherUnavailable?null:gradebookData,initialSource:source,onSource:next=>{source=next;},onData:next=>{gradebookData=next;},compact:true});
      if(pendingStandard){const standard=pendingStandard,person=pendingLearner;pendingStandard=null;pendingLearner='';gradebook.createActivityForStandard(standard,person);}
    }else{
      content.className='assessment-source-'+source;content.innerHTML=classOverviewHTML(classData())+(source!=='automatic'?liveBoardEvidenceHTML(boardEvidence,{classId,students,unavailable:boardEvidenceUnavailable}):'');disconnectEvidence=connectEvidencePanels(content);
    }
  }

  function classData(){return {students,lessons,catalogue,source,activities:gradebookData.activities,scope:classScope,mode:classMode,search:learnerSearch,sort:learnerSort,portrait,records:skillRecords,expandedAxis,expandedLearner,expandedDetails};}
  function refreshRows(){rememberClassDetails();disconnectEvidence();if($('[data-class-rows]'))$('[data-class-rows]').innerHTML=classRowsHTML(classData());disconnectEvidence=connectEvidencePanels(root);}
  function renderStudent(){
    const student=students.find(s=>s.id===learnerId),className=getClasses().find(c=>c.id===classId)?.name || assessmentDemoClasses.find(c=>c.id===classId)?.name || 'Class';
    if(source==='teacher'){const target=$('[data-assessment-body]');target.innerHTML=`<div class="educade-student-heading"><div><p>${escape(className)}</p><h2>${escape(student?.name||'Student')}</h2></div><button type="button" class="teacher-button secondary" data-back-class>← Back to class</button></div>`+teacherEvidenceHTML(learnerId)+liveBoardEvidenceHTML(boardEvidence,{classId,learnerId,students,unavailable:boardEvidenceUnavailable});return;}
    $('[data-assessment-body]').innerHTML=studentPageHTML({classId,className,student,students,catalogue,lessons,records:skillRecords,scope:profileScope,mode:studentMode,selectedSkill,demo:currentDemo(),virtual:isAssessmentDemo(classId),enduringTargets,boardEvidence:source==='automatic'?[]:boardEvidence,boardEvidenceUnavailable});
    const heading=$('[data-assessment-body] .educade-student-heading');if(source!=='automatic'&&heading)heading.insertAdjacentHTML('afterend',teacherEvidenceHTML(learnerId));
    document.title=student?student.name+' · Assessment | Ink Wire':'Assessment | Ink Wire';
  }
  function writeRoute(push=false){
    const url=new URL(location.href);url.searchParams.set('class',classId);url.searchParams.set('assessment',view==='standards'?'standards':view==='gradebook'?'gradebook':'evidence');if(getClassId){url.searchParams.set('view','classes');url.searchParams.set('tab','assessment');}
    if(learnerId){url.searchParams.set('learner',learnerId);url.searchParams.set('subject',profileScope);}else{url.searchParams.delete('learner');url.searchParams.delete('subject');}
    if(isAssessmentDemo(classId))url.searchParams.set('demo',classId);else url.searchParams.delete('demo');
    history[push?'pushState':'replaceState'](null,'',url);
  }
  function openProfile(id,opener,axisId=''){
    learnerId=id;profileScope=axisId?classScope:'overall';selectedSkill='';
    const axis=classAxes(catalogue,classScope).find(a=>a.id===axisId);
    if(axis?.domain)profileScope=axis.domain==='reading'?'literacy':axis.domain;else if(axisId)selectedSkill=axisId;
    view='evidence';writeRoute(true);render();window.scrollTo({top:0,behavior:'instant'});$('[data-student-page-title]')?.focus({preventScroll:true});
  }
  function backToClass(){learnerId='';selectedSkill='';view='evidence';writeRoute(true);document.title='Assessment | Ink Wire';render();window.scrollTo({top:0,behavior:'instant'});$('[data-assessment-class]').focus({preventScroll:true});}
  function courseStandardsHTML(){
    const selected=courseAssessment?.frameworks || [];
    if(!selected.length)return `<div class="assessment-course-standards"><span>${courseAssessment?.deferred?'Standards: decide later':'Course standards not selected yet'}</span><button type="button" class="text-button" data-assessment-standards>Choose in course setup</button></div>`;
    return `<div class="assessment-course-standards">${selected.map(row=>{const pack=packById(row.id);return `<span>${escape(pack.name)} · ${escape(pack.scopes.find(s=>s.id===row.scope)?.label || row.scope)}</span>`;}).join('')}${courseAssessment.judgmentScale==='b-m-plus'?'<span>B → M+ · school scale</span>':''}${selected.some(row=>['ib-pyp','ipc'].includes(row.id))?'<small>Knowledge &amp; Skills · Understanding: evidence profile</small>':''}</div>`;
  }
  function renderStandards(){
    standardsWorkspace=createStandardsProgress({root:$('[data-assessment-body]'),students,assessment:courseAssessment,activities:gradebookData.activities||[],records:skillRecords,catalogue,boards:boardEvidence,unavailable:teacherUnavailable,onStudent:id=>openProfile(id),onAssess:(standard,person)=>startAssessment(standard,person)});
  }
  function startAssessment(standard,person=''){
    if(isAssessmentDemo(classId)){view='evidence';layout='students';render();$('[data-assessment-status]').textContent='Install the demo class to record assessments.';return;}
    view='gradebook';learnerId='';layout='activities';pendingStandard=standard||{code:'',description:''};pendingLearner=person;writeRoute();render();
  }
  function teacherEvidenceHTML(person){
    const rows=(gradebookData.activities||[]).flatMap(a=>(a.entries||[]).filter(r=>r.learnerId===person).map(r=>({a,...r}))).sort((a,b)=>(b.published?.at||b.draft?.at||0)-(a.published?.at||a.draft?.at||0));
    return `<section class="assessment-card unified-teacher-evidence"><h2>Teacher assessments</h2>${rows.map(r=>`<details><summary>${escape(r.a.title)} · ${r.published?escape(gradeLabel(r.published,r.published.activity)):'Private draft'}</summary>${r.published?`<p>Published ${escape(new Date(r.published.at).toLocaleDateString())}</p><p>${escape(r.published.evidenceNote)}</p><p>${escape(r.published.feedback)}</p>${r.published.nextStep?`<p><strong>Next step:</strong> ${escape(r.published.nextStep)}</p>`:''}`:''}${r.draft&&r.draft.at!==r.published?.at?`<p class="gb-draft">Private draft · ${escape(gradeLabel(r.draft,r.draft.activity))}</p>`:''}<button type="button" class="teacher-button secondary" data-open-assessment="${escape(r.a.id)}" data-assessment-person="${escape(person)}">Record / review</button></details>`).join('')||'<p>No teacher assessments recorded yet.</p>'}</section>`;
  }
  async function installDemo(button){
    button.disabled=true;const originalKey=classId.replace('demo-educade-','');
    try{const result=await api('/api/classes/demo-educade',{version:1});classId=(result.classes.find(c=>c.demoKey===originalKey)||result.classes[0]).id;syncDemoURL();await onDemoInstalled?.();await load();}
    catch(error){$('[data-assessment-status]').textContent=error.message;button.disabled=false;}
  }
  function syncDemoURL(){writeRoute();}
  async function load(){
    const token=++epoch;classOptions();students=[];lessons=[];courseAssessment=null;enduringTargets='';skillRecords=[];boardEvidence=[];boardEvidenceUnavailable=false;error='';
    if(!classId){loading=false;render();return;}
    loading=true;render();
    try{
      const [roster,timeline,boards,grades]=isAssessmentDemo(classId)?await loadAssessmentDemo(classId).then(data=>[{students:data.students},data,{records:[]},{activities:[]}]):await Promise.all([api('/api/enrollment/classes/'+classId+'/roster'),api('/api/lesson-feedback/classes/'+classId+'/timeline'),api('/api/class-boards/classes/'+classId+'/evidence').catch(()=>({records:[],unavailable:true})),api('/api/gradebook/classes/'+classId).catch(()=>({activities:[],unavailable:true}))]);
      if(token!==epoch)return;gradebookData=grades;teacherUnavailable=!!grades.unavailable;boardEvidence=boards.records||[];boardEvidenceUnavailable=!!boards.unavailable;students=timeline.demoSource==='educade-v1'?roster.students.map(student=>({...student,demo:true,initials:student.name.split(' ').map(word=>word[0]).join('')})):roster.students;lessons=timeline.course?.lessons || [];courseAssessment=timeline.course?.assessment || null;enduringTargets=timeline.course?.enduringUnderstandings || '';skillRecords=Array.isArray(timeline.skillEvidence)?timeline.skillEvidence.filter(record=>students.some(student=>student.id===record.learnerId)&&catalogue.groups.some(group=>group.skills.some(skill=>skill.id===record.skillId))&&typeof record.correct==='boolean'):[];
      const preferred=courseAssessment?.frameworks?.[0]?.id;if(preferred)libraryPack=preferred;

    }catch(e){if(token!==epoch)return;error=e.message;}
    if(token===epoch){loading=false;render();}
  }
  root.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.assessmentView){if(reportingGradebook&&!reportingGradebook.canLeave())return;view=button.dataset.assessmentView;layout=view==='gradebook'?'reporting':'students';learnerId='';writeRoute();render();}
    if(button.dataset.evidenceSource){source=button.dataset.evidenceSource;render();}
    if(button.dataset.evidenceLayout){layout=button.dataset.evidenceLayout;writeRoute();render();}
    if(button.matches('[data-new-assessment]'))startAssessment();
    if(button.dataset.assessLearner){const skill=catalogue.groups.flatMap(g=>g.skills).find(s=>s.id===button.dataset.assessSkill);startAssessment({code:button.dataset.assessCode||skill?.id||'',description:skill?.name||'Learning evidence'},button.dataset.assessLearner);}
    if(button.dataset.openAssessment){const id=button.dataset.openAssessment,person=button.dataset.assessmentPerson,a=gradebookData.activities.find(a=>a.id===id);learnerId='';view='gradebook';if(a?.reporting){layout='reporting';pendingReportingCell={learner:person,code:a.reporting.code};const url=new URL(location.href);url.searchParams.set('reportingPlan',a.reporting.planId);history.replaceState(null,'',url);writeRoute();render();}else{layout='activities';render();gradebook?.openRecord(id,person);}}
    if(button.dataset.expandLearner){const id=button.dataset.expandLearner;expandedLearner=expandedLearner===id?'':id;refreshRows();Array.from(root.querySelectorAll('[data-expand-learner]')).find(toggle=>toggle.dataset.expandLearner===id)?.focus({preventScroll:true});}
    if(button.dataset.assessmentLearner)openProfile(button.dataset.assessmentLearner,button);
    if(button.dataset.classLearner)openProfile(button.dataset.classLearner,button,button.dataset.classEvidence);
    if(button.dataset.classScope){classScope=button.dataset.classScope;render();$(`[data-class-scope="${classScope}"]`)?.focus({preventScroll:true});}
    if(button.dataset.classMode){classMode=button.dataset.classMode;render();}
    if(button.dataset.classAxis){const id=button.dataset.classAxis;expandedAxis=expandedAxis===id?'':id;refreshRows();root.querySelectorAll('[data-class-axis]').forEach(toggle=>{const open=expandedAxis===toggle.dataset.classAxis;toggle.setAttribute('aria-expanded',String(open));toggle.querySelector('span').textContent=open?'− Hide evidence':'+ Show evidence';});}
    if(button.matches('[data-assessment-refresh],[data-assessment-retry]')&&(!reportingGradebook||reportingGradebook.canLeave()))load();
    if(button.matches('[data-assessment-standards]')&&!isAssessmentDemo(classId))openStandards?.(classId,button);
    if(button.matches('[data-install-assessment-demo]'))installDemo(button);
    if(button.matches('[data-assessment-timeline]'))openTimeline(classId,button);
    if(button.matches('[data-back-class]'))backToClass();
    if(button.dataset.profileScope){profileScope=button.dataset.profileScope;selectedSkill='';writeRoute(true);renderStudent();$(`[data-profile-scope="${profileScope}"]`)?.focus({preventScroll:true});}
    if(button.dataset.studentMode){studentMode=button.dataset.studentMode;renderStudent();}
    if(button.dataset.profileEvidence){selectedSkill=button.dataset.profileEvidence;renderStudent();$('#student-response-evidence')?.focus();}
  });
  root.addEventListener('change',event=>{if(event.target.matches('[data-switch-learner]')){learnerId=event.target.value;selectedSkill='';writeRoute(true);renderStudent();$('[data-switch-learner]')?.focus({preventScroll:true});}if(event.target.matches('[data-class-sort]')){learnerSort=event.target.value;refreshRows();}if(event.target.matches('[data-class-portrait]')){portrait=event.target.value;refreshRows();}if(event.target.matches('[data-assessment-class]')){if(reportingGradebook&&!reportingGradebook.canLeave()){event.target.value=classId;return;}classId=event.target.value;learnerId='';expandedLearner='';expandedAxis='';expandedDetails.clear();syncDemoURL();load();}
});
  root.addEventListener('input',event=>{if(event.target.matches('[data-class-search]')){learnerSearch=event.target.value;refreshRows();}});
  for(const type of ['inkwire:quiz-changed','inkwire:feedback-published','inkwire:board-assessment-published'])document.addEventListener(type,event=>{if(event.detail?.classId===classId&&!root.hidden)load();});
  root.addEventListener('error',event=>{if(event.target.matches('.educade-avatar img'))event.target.hidden=true;},true);
  root.addEventListener('keydown',event=>{const tab=event.target.closest('[data-class-scope],[data-profile-scope][role="tab"]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const profile=Boolean(tab.dataset.profileScope),ids=Object.keys(learningTabs),index=ids.indexOf(profile?profileScope:classScope),next=ids[event.key==='Home'?0:event.key==='End'?ids.length-1:(index+(event.key==='ArrowRight'?1:-1)+ids.length)%ids.length];if(profile){profileScope=next;selectedSkill='';writeRoute();renderStudent();$(`[data-profile-scope="${next}"]`).focus({preventScroll:true});}else{classScope=next;render();$(`[data-class-scope="${next}"]`).focus({preventScroll:true});}});
  window.addEventListener('popstate',()=>{const query=new URLSearchParams(location.search);if(query.get('view')!=='assessment')return;const next=query.get('class')||classId,changed=next!==classId;classId=next;learnerId=query.get('learner')||'';profileScope=Object.hasOwn(learningTabs,query.get('subject'))?query.get('subject'):'overall';selectedSkill='';view=['standards','catalogue','skills'].includes(query.get('assessment'))?'standards':query.get('assessment')==='gradebook'?'gradebook':'evidence';layout=query.get('assessment')==='gradebook'?'reporting':'students';if(changed)load();else render();});
  window.addEventListener('beforeunload',event=>{if(reportingGradebook?.hasChanges()){event.preventDefault();event.returnValue='';}});
  return {canLeave:()=>!reportingGradebook||reportingGradebook.canLeave(),refresh:load,clear(){reportingGradebook?.clear();reportingGradebook=null;disconnectEvidence();standardsWorkspace?.clear();standardsWorkspace=null;gradebook?.clear();gradebook=null;epoch++;students=[];lessons=[];$('[data-assessment-body]').replaceChildren();}};
}
