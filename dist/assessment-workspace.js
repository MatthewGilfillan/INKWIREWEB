import {createGradebook} from './gradebook.js?v=20261110-gradebook';
import {liveBoardEvidenceHTML} from './live-board-evidence.mjs?v=20261110-library';
import {studentPageHTML} from './educade-student-view.js?v=20261110-live-library';
import {assessmentDemoClasses,isAssessmentDemo,loadAssessmentDemo} from './assessment-demo.mjs';
import {learningTabs,classAxes,axisStats,classOverviewHTML,classRowsHTML,practiceRadarHTML} from './educade-assessment-view.js?v=20261103-progress-estimates';
import catalogue from './assessment-catalogue.mjs?v=20261103-class-view';
import {standardsPacks,packById,schoolProgressScale} from './standards-registry.mjs';
import curricula from './assessment-curricula.mjs';
import {achievementLevels,learnerEvidence,evidenceSummary} from './assessment-model.mjs';
import {api,escape} from './workspace-shared.js';

export function createAssessmentWorkspace({root,getClasses,openTimeline,openStandards,onDemoInstalled}) {
  const entry=new URLSearchParams(location.search);
  let boardEvidence=[],boardEvidenceUnavailable=false,gradebook=null;
  let classId=entry.get('class') || assessmentDemoClasses.find(c=>c.id===new URLSearchParams(location.search).get('demo'))?.id || (new URLSearchParams(location.search).get('demo')==='1'?assessmentDemoClasses[0].id:''),learnerId=entry.get('learner') || '',view=entry.get('assessment')==='gradebook'||!entry.get('learner')?'gradebook':'evidence',framework='ccss',domain='all',search='',students=[],lessons=[],courseAssessment=null,libraryPack='ccss-ela',librarySearch='',loading=false,error='',epoch=0,classScope='overall',expandedAxis='',expandedLearner='',classMode='bars',learnerSearch='',learnerSort='name',portrait='photos',skillRecords=[],enduringTargets='',profileScope=Object.hasOwn(learningTabs,entry.get('subject'))?entry.get('subject'):'overall',studentMode='radar',selectedSkill='';
  const $=selector=>root.querySelector(selector),expandedDetails=new Set();
  root.innerHTML=`<div class="assessment-controls"><label><strong>Class</strong><select data-assessment-class aria-label="Class"></select></label><div class="assessment-views" role="group" aria-label="Assessment workspace"><button type="button" data-assessment-view="gradebook" aria-pressed="false">Gradebook</button><button type="button" data-assessment-view="evidence" aria-pressed="true">Learning evidence</button><button type="button" data-assessment-view="standards" aria-pressed="false">Standards library</button><button type="button" data-assessment-view="catalogue" aria-pressed="false">Skill catalogue</button></div><button type="button" class="text-button" data-assessment-refresh>Refresh</button></div><p data-assessment-status role="status"></p><div data-assessment-body></div>`;
  const previewRequested=new URLSearchParams(location.search).has('demo');
  const currentDemo=()=>isAssessmentDemo(classId) || Boolean(getClasses().find(c=>c.id===classId)?.demoKey);
  function classOptions(){
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
    gradebook?.clear();gradebook=null;
    rememberClassDetails();
    root.querySelectorAll('[data-assessment-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.assessmentView===view)));
    if(!learnerId)document.title='Assessment | Ink Wire';
    $('[data-assessment-status]').textContent=loading?'Loading learning evidence…':error;
    if(view==='standards'){renderStandards();return;}
    if(view==='catalogue'){renderCatalogue();return;}
    if(loading){$('[data-assessment-body]').innerHTML='<div class="assessment-empty">Getting the class ready…</div>';return;}
    if(error){$('[data-assessment-body]').innerHTML='<div class="assessment-empty"><h2>Evidence could not be loaded</h2><button type="button" class="teacher-button secondary" data-assessment-retry>Try again</button></div>';return;}
    if(view==='gradebook'){
      const target=$('[data-assessment-body]');target.replaceChildren();
      if(isAssessmentDemo(classId)){target.innerHTML='<p>Install this fictional demo class to try the gradebook.</p><button type="button" class="teacher-button secondary" data-install-assessment-demo>Add demo classes to my workspace</button>';return;}
      if(!classId){target.innerHTML='<p>Choose a class to open its gradebook.</p>';return;}
      gradebook=createGradebook({root:target,classId,students,lessons,boardEvidence,boardEvidenceUnavailable});return;
    }
    if(learnerId){renderStudent();return;}
    document.title='Assessment | Ink Wire';
    const demo=currentDemo();
    $('[data-assessment-body]').innerHTML=(demo?`<div class="assessment-demo-notice"><span><strong>Demo class</strong> · Fictional students and sample responses from EDUCADE.</span>${isAssessmentDemo(classId)?'<button type="button" class="text-button" data-install-assessment-demo>Add demo classes to my workspace</button>':''}</div>`:'')+classOverviewHTML(classData())+courseStandardsHTML()+liveBoardEvidenceHTML(boardEvidence,{classId,students,unavailable:boardEvidenceUnavailable});
  }
  function classData(){return {students,lessons,catalogue,scope:classScope,mode:classMode,search:learnerSearch,sort:learnerSort,portrait,records:skillRecords,expandedAxis,expandedLearner,expandedDetails};}
  function refreshRows(){rememberClassDetails();if($('[data-class-rows]'))$('[data-class-rows]').innerHTML=classRowsHTML(classData());}
  function renderStudent(){
    const student=students.find(s=>s.id===learnerId),className=getClasses().find(c=>c.id===classId)?.name || assessmentDemoClasses.find(c=>c.id===classId)?.name || 'Class';
    $('[data-assessment-body]').innerHTML=studentPageHTML({classId,className,student,students,catalogue,lessons,records:skillRecords,scope:profileScope,mode:studentMode,selectedSkill,demo:currentDemo(),virtual:isAssessmentDemo(classId),enduringTargets,boardEvidence,boardEvidenceUnavailable});
    document.title=student?student.name+' · Assessment | Ink Wire':'Assessment | Ink Wire';
  }
  function writeRoute(push=false){
    const url=new URL(location.href);url.searchParams.set('class',classId);if(view==='gradebook')url.searchParams.set('assessment','gradebook');else url.searchParams.delete('assessment');
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
    const pack=packById(libraryPack) || standardsPacks[0];
    $('[data-assessment-body]').innerHTML=`${courseStandardsHTML()}<section class="assessment-card assessment-library"><div class="assessment-card-heading"><div><p class="assessment-eyebrow">STANDARDS LIBRARY</p><h2>${escape(pack.name)}</h2><p>${escape(pack.publisher)} · ${escape(pack.edition)}</p></div><label class="assessment-framework">Framework<select data-library-pack>${standardsPacks.map(p=>`<option value="${p.id}" ${p.id===pack.id?'selected':''}>${escape(p.name)}</option>`).join('')}</select></label></div><p class="assessment-library-coverage">${escape(pack.coverage)}</p><div class="assessment-library-tools"><a href="${escape(pack.source)}" target="_blank" rel="noopener noreferrer">Open source ↗</a><label class="assessment-search">Find a criterion<input type="search" data-library-search value="${escape(librarySearch)}" placeholder="Search reference areas or codes"></label></div><div class="assessment-reference-grid" data-library-criteria></div>${pack.notice?`<p class="assessment-library-notice">${escape(pack.notice)}</p>`:''}${['ib-pyp','ipc'].includes(pack.id)?`<div class="assessment-school-scale"><h3>School progress scale · Knowledge &amp; Skills</h3><div>${schoolProgressScale.map(level=>`<span><strong>${level.code}</strong>${escape(level.label)}</span>`).join('')}</div><p>Understanding is documented through evidence and reflection against planned enduring understandings, not converted into this scale.</p></div>`:''}<details class="assessment-reference-notes"><summary>Reference details</summary><p>${escape(pack.codeType)}. Checked ${pack.checked}. ${escape(pack.license || 'Public overview summaries; publisher task descriptors remain in the source materials.')}</p><p>Selections and school criteria are saved with the course. Selecting a framework does not create a validated mapping from existing quiz results.</p></details></section>`;
    renderStandardsCriteria();
  }
  function renderStandardsCriteria(){
    const pack=packById(libraryPack) || standardsPacks[0],query=librarySearch.trim().toLocaleLowerCase();
    const criteria=pack.criteria.filter(c=>!query||[c.code,c.title,c.description].join(' ').toLocaleLowerCase().includes(query));
    $('[data-library-criteria]').innerHTML=criteria.length?criteria.map(c=>`<article><span class="assessment-reference-code">${escape(c.code)}</span><h3>${escape(c.title)}</h3><p>${escape(c.description)}</p></article>`).join(''):'<p>No criteria match this search.</p>';
  }
  function renderCatalogue(){
    $('[data-assessment-body]').innerHTML=`<section class="assessment-card assessment-catalogue"><div class="assessment-card-heading"><div><p class="assessment-eyebrow">EDUCADE CATALOGUE</p><h2>${escape(catalogue.title)}</h2><p>${catalogue.groups.flatMap(group=>group.skills).length} skills · Reading, writing, grammar and vocabulary</p></div><label class="assessment-framework">Curriculum<select data-assessment-framework>${Object.entries(curricula.frameworks).map(([id,f])=>`<option value="${id}" ${id===framework?'selected':''}>${escape(f.name)}</option>`).join('')}</select></label></div><div class="assessment-catalogue-tools"><div class="assessment-domains" role="group" aria-label="Skill area">${[['all','All skills'],...Object.entries(catalogue.domains).map(([id,d])=>[id,d.name])].map(([id,name])=>`<button type="button" data-assessment-domain="${id}" aria-pressed="${id===domain}">${escape(name)}</button>`).join('')}</div><label class="assessment-search">Find a skill or standard<input type="search" data-assessment-search placeholder="Search skills or curriculum codes" value="${escape(search)}"></label></div><p class="assessment-catalogue-note">${escape(curricula.frameworks[framework].band)} · ${Object.keys(curricula.alignments[framework]).length} candidate links. Open a skill to see its reference and review status.</p><div data-assessment-skills></div><details class="assessment-levels"><summary>Teacher achievement descriptors</summary><p>EDUCADE’s teacher-review scale. Practice percentages do not assign these levels.</p>${Object.values(achievementLevels).map(level=>`<div><strong>${level.name}</strong><p>${escape(level.description)}</p></div>`).join('')}</details></section>`;
    renderSkills();
  }
  function renderSkills(){
    const query=search.trim().toLocaleLowerCase();
    const groups=catalogue.groups.filter(group=>domain==='all'||group.domain===domain).map(group=>({...group,skills:group.skills.filter(skill=>!query||[group.name,skill.name,skill.id,curricula.alignments[framework][skill.id]?.code].filter(Boolean).join(' ').toLocaleLowerCase().includes(query))})).filter(group=>group.skills.length);
    $('[data-assessment-skills]').innerHTML=groups.length?groups.map(group=>`<div class="assessment-skill-group"><h3>${escape(group.name)} <small>${escape(catalogue.domains[group.domain].name)}</small></h3>${group.skills.map(skill=>{
      const mapping=curricula.alignments[framework][skill.id],reference=curricula.frameworks[framework];
      return `<details class="assessment-skill"><summary><span>${escape(skill.name)}</span><small>${mapping?escape(mapping.code?.replace('CCSS.ELA-LITERACY.','') || mapping.area):'No alignment reviewed'}</small></summary><p class="assessment-skill-id">${escape(skill.id)}</p>${mapping?`<p>${escape(mapping.objective)}</p><a href="${escape(framework==='ccss'?catalogue.mappings[skill.id].source:reference.source)}" target="_blank" rel="noopener noreferrer">${escape(mapping.code || reference.name)} ↗</a><p class="assessment-mapping-status">${escape(mapping.status)}${framework==='ccss'?' · Reference mirror checked '+escape(catalogue.mappings[skill.id].checked):''}. Covers part of the objective; no mastery judgment is implied.</p>`:'<p>No curriculum alignment has been reviewed for this skill.</p>'}</details>`;
    }).join('')}</div>`).join(''):'<p class="assessment-empty">No skills match this search.</p>';
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
      const [roster,timeline,boards]=isAssessmentDemo(classId)?await loadAssessmentDemo(classId).then(data=>[{students:data.students},data,{records:[]}]):await Promise.all([api('/api/enrollment/classes/'+classId+'/roster'),api('/api/lesson-feedback/classes/'+classId+'/timeline'),api('/api/class-boards/classes/'+classId+'/evidence').catch(()=>({records:[],unavailable:true}))]);
      if(token!==epoch)return;boardEvidence=boards.records||[];boardEvidenceUnavailable=!!boards.unavailable;students=timeline.demoSource==='educade-v1'?roster.students.map(student=>({...student,demo:true,initials:student.name.split(' ').map(word=>word[0]).join('')})):roster.students;lessons=timeline.course?.lessons || [];courseAssessment=timeline.course?.assessment || null;enduringTargets=timeline.course?.enduringUnderstandings || '';skillRecords=Array.isArray(timeline.skillEvidence)?timeline.skillEvidence.filter(record=>students.some(student=>student.id===record.learnerId)&&catalogue.groups.some(group=>group.skills.some(skill=>skill.id===record.skillId))&&typeof record.correct==='boolean'):[];
      const preferred=courseAssessment?.frameworks?.[0]?.id;if(preferred)libraryPack=preferred;

    }catch(e){if(token!==epoch)return;error=e.message;}
    if(token===epoch){loading=false;render();}
  }
  root.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.assessmentView){view=button.dataset.assessmentView;learnerId='';writeRoute();render();}
    if(button.dataset.assessmentDomain){domain=button.dataset.assessmentDomain;renderCatalogue();}
    if(button.dataset.expandLearner){const id=button.dataset.expandLearner;expandedLearner=expandedLearner===id?'':id;refreshRows();Array.from(root.querySelectorAll('[data-expand-learner]')).find(toggle=>toggle.dataset.expandLearner===id)?.focus({preventScroll:true});}
    if(button.dataset.assessmentLearner)openProfile(button.dataset.assessmentLearner,button);
    if(button.dataset.classLearner)openProfile(button.dataset.classLearner,button,button.dataset.classEvidence);
    if(button.dataset.classScope){classScope=button.dataset.classScope;render();$(`[data-class-scope="${classScope}"]`)?.focus({preventScroll:true});}
    if(button.dataset.classMode){classMode=button.dataset.classMode;render();}
    if(button.dataset.classAxis){const id=button.dataset.classAxis;expandedAxis=expandedAxis===id?'':id;refreshRows();root.querySelectorAll('[data-class-axis]').forEach(toggle=>{const open=expandedAxis===toggle.dataset.classAxis;toggle.setAttribute('aria-expanded',String(open));toggle.querySelector('span').textContent=open?'− Hide evidence':'+ Show evidence';});}
    if(button.matches('[data-assessment-refresh],[data-assessment-retry]'))load();
    if(button.matches('[data-assessment-standards]')&&!isAssessmentDemo(classId))openStandards?.(classId,button);
    if(button.matches('[data-install-assessment-demo]'))installDemo(button);
    if(button.matches('[data-assessment-timeline]'))openTimeline(classId,button);
    if(button.matches('[data-back-class]'))backToClass();
    if(button.dataset.profileScope){profileScope=button.dataset.profileScope;selectedSkill='';writeRoute(true);renderStudent();$(`[data-profile-scope="${profileScope}"]`)?.focus({preventScroll:true});}
    if(button.dataset.studentMode){studentMode=button.dataset.studentMode;renderStudent();}
    if(button.dataset.profileEvidence){selectedSkill=button.dataset.profileEvidence;renderStudent();$('#student-response-evidence')?.focus();}
  });
  root.addEventListener('change',event=>{if(event.target.matches('[data-switch-learner]')){learnerId=event.target.value;selectedSkill='';writeRoute(true);renderStudent();$('[data-switch-learner]')?.focus({preventScroll:true});}if(event.target.matches('[data-class-sort]')){learnerSort=event.target.value;refreshRows();}if(event.target.matches('[data-class-portrait]')){portrait=event.target.value;refreshRows();}if(event.target.matches('[data-assessment-class]')){classId=event.target.value;learnerId='';expandedLearner='';expandedAxis='';expandedDetails.clear();syncDemoURL();load();}if(event.target.matches('[data-library-pack]')){libraryPack=event.target.value;renderStandards();}
    if(event.target.matches('[data-assessment-framework]')){framework=event.target.value;renderCatalogue();$('[data-assessment-framework]').focus({preventScroll:true});}});
  root.addEventListener('input',event=>{if(event.target.matches('[data-class-search]')){learnerSearch=event.target.value;refreshRows();}if(event.target.matches('[data-library-search]')){librarySearch=event.target.value;renderStandardsCriteria();}if(event.target.matches('[data-assessment-search]')){search=event.target.value;renderSkills();}});
  for(const type of ['inkwire:quiz-changed','inkwire:feedback-published','inkwire:board-assessment-published'])document.addEventListener(type,event=>{if(event.detail?.classId===classId&&!root.hidden)load();});
  root.addEventListener('error',event=>{if(event.target.matches('.educade-avatar img'))event.target.hidden=true;},true);
  root.addEventListener('keydown',event=>{const tab=event.target.closest('[data-class-scope],[data-profile-scope][role="tab"]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const profile=Boolean(tab.dataset.profileScope),ids=Object.keys(learningTabs),index=ids.indexOf(profile?profileScope:classScope),next=ids[event.key==='Home'?0:event.key==='End'?ids.length-1:(index+(event.key==='ArrowRight'?1:-1)+ids.length)%ids.length];if(profile){profileScope=next;selectedSkill='';writeRoute();renderStudent();$(`[data-profile-scope="${next}"]`).focus({preventScroll:true});}else{classScope=next;render();$(`[data-class-scope="${next}"]`).focus({preventScroll:true});}});
  window.addEventListener('popstate',()=>{const query=new URLSearchParams(location.search);if(query.get('view')!=='assessment')return;const next=query.get('class')||classId,changed=next!==classId;classId=next;learnerId=query.get('learner')||'';profileScope=Object.hasOwn(learningTabs,query.get('subject'))?query.get('subject'):'overall';selectedSkill='';view=query.get('assessment')==='gradebook'?'gradebook':'evidence';if(changed)load();else render();});
  return {refresh:load,clear(){gradebook?.clear();gradebook=null;epoch++;students=[];lessons=[];$('[data-assessment-body]').replaceChildren();}};
}
