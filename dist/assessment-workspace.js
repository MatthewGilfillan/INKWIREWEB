import {assessmentDemoClasses,isAssessmentDemo,loadAssessmentDemo} from './assessment-demo.mjs';
import {learningTabs,classAxes,axisStats,classOverviewHTML,classRowsHTML,practiceRadarHTML} from './educade-assessment-view.js?v=20261103-demo';
import catalogue from './assessment-catalogue.mjs?v=20261103-class-view';
import {standardsPacks,packById,schoolProgressScale} from './standards-registry.mjs';
import curricula from './assessment-curricula.mjs';
import {achievementLevels,learnerEvidence,evidenceSummary} from './assessment-model.mjs';
import {api,escape} from './workspace-shared.js';
import {quizScoreHTML} from './quiz-results.js';
import {assessmentHTML} from './lesson-feedback-view.js';

export function createAssessmentWorkspace({root,getClasses,openTimeline,openStandards}) {
  let classId=assessmentDemoClasses.find(c=>c.id===new URLSearchParams(location.search).get('demo'))?.id || (new URLSearchParams(location.search).get('demo')==='1'?assessmentDemoClasses[0].id:''),learnerId='',view='evidence',framework='ccss',domain='all',search='',students=[],lessons=[],courseAssessment=null,libraryPack='ccss-ela',librarySearch='',loading=false,error='',epoch=0,classScope='overall',expandedAxis='',classMode='bars',learnerSearch='',learnerSort='name',portrait='photos',skillRecords=[],enduringTargets='',profileOpener=null;
  const $=selector=>root.querySelector(selector);
  root.innerHTML=`<div class="assessment-controls"><label><strong>Class</strong><select data-assessment-class aria-label="Class"></select></label><div class="assessment-views" role="group" aria-label="Assessment workspace"><button type="button" data-assessment-view="evidence" aria-pressed="true">Learning evidence</button><button type="button" data-assessment-view="standards" aria-pressed="false">Standards library</button><button type="button" data-assessment-view="catalogue" aria-pressed="false">Skill catalogue</button></div><button type="button" class="text-button" data-assessment-refresh>Refresh</button></div><p data-assessment-status role="status"></p><div data-assessment-body></div>`;
  function classOptions(){
    const classes=[...getClasses(),...assessmentDemoClasses];
    if(!classes.some(c=>c.id===classId)){classId=getClasses()[0]?.id || '';learnerId='';}
    $('[data-assessment-class]').innerHTML=classes.length?(classId?'':'<option value="">Choose a class…</option>')+classes.filter(c=>!isAssessmentDemo(c.id)).map(c=>`<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('')+`<optgroup label="Fictional demo classes">${assessmentDemoClasses.map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</optgroup>`:'<option value="">No classes yet</option>';
    $('[data-assessment-class]').value=classId;$('[data-assessment-class]').disabled=!classes.length;
  }
  function render(){
    root.querySelectorAll('[data-assessment-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.assessmentView===view)));
    $('[data-assessment-status]').textContent=loading?'Loading learning evidence…':error;
    if(view==='standards'){renderStandards();return;}
    if(view==='catalogue'){renderCatalogue();return;}
    if(loading){$('[data-assessment-body]').innerHTML='<div class="assessment-empty">Getting the class ready…</div>';return;}
    if(error){$('[data-assessment-body]').innerHTML='<div class="assessment-empty"><h2>Evidence could not be loaded</h2><button type="button" class="teacher-button secondary" data-assessment-retry>Try again</button></div>';return;}
    const demo=isAssessmentDemo(classId);
    $('[data-assessment-body]').innerHTML=(demo?`<div class="assessment-demo-notice"><span><strong>Demo class</strong> · Fictional students and sample responses from EDUCADE.</span>${getClasses().length?'<button type="button" class="text-button" data-exit-assessment-demo>View your classes</button>':''}</div>`:'')+classOverviewHTML(classData())+courseStandardsHTML();
  }
  function classData(){return {students,lessons,catalogue,scope:classScope,mode:classMode,search:learnerSearch,sort:learnerSort,portrait,records:skillRecords,expandedAxis};}
  function refreshRows(){if($('[data-class-rows]'))$('[data-class-rows]').innerHTML=classRowsHTML(classData());}
  const profile=document.createElement('dialog');profile.className='assessment-learner-dialog';profile.setAttribute('aria-label','Learner evidence');profile.innerHTML='<button type="button" class="teacher-close" data-close-assessment-profile aria-label="Close learner evidence">×</button><div class="assessment-detail" data-assessment-detail></div>';root.append(profile);
  profile.querySelector('[data-close-assessment-profile]').onclick=()=>profile.close();profile.addEventListener('close',()=>{if(profileOpener?.isConnected)profileOpener.focus({preventScroll:true});});
  function openProfile(id,opener,axisId=''){
    learnerId=id;profileOpener=opener;const axes=classAxes(catalogue,classScope),selected=axes.find(axis=>axis.id===axisId),records=skillRecords.filter(r=>r.learnerId===id);
    const stats=axes.map(axis=>axisStats(catalogue,records,axis));
    const specific=selected?`<details class="assessment-linked-skill"><summary>${escape(selected.label)} · ${axisStats(catalogue,records,selected).attempts} linked responses</summary>${records.filter(record=>selected.domain?catalogue.groups.some(group=>group.domain===selected.domain&&group.skills.some(skill=>skill.id===record.skillId)):record.skillId===selected.id).map(record=>`<p>${escape(record.response || 'Recorded response')} · ${record.correct?'Correct':'Review response'} · ${record.supported?'Supported':'Independent'}</p>`).join('')}</details>`:'';
    $('[data-assessment-detail]').innerHTML=detailHTML()+`<details class="assessment-profile-skills" ${selected||isAssessmentDemo(classId)?'open':''}><summary>Skill evidence profile</summary>${practiceRadarHTML(axes,stats.map(s=>s.score))}${isAssessmentDemo(classId)?`<div class="assessment-demo-scores">${axes.map((axis,i)=>`<div><span>${escape(axis.label)}</span><strong>${stats[i].score===null?'No evidence yet':stats[i].score+'%'}</strong></div>`).join('')}</div>`:''}${specific}<p class="assessment-footnote">This profile describes linked practice evidence, not a measure of understanding or an official attainment grade.</p></details>${enduringTargets?`<section class="assessment-understanding-targets"><h3>Enduring understandings</h3><p>${escape(enduringTargets)}</p><small>Planned learning to revisit through explanation, connections, application and later recall.</small></section>`:''}`;
    if(!profile.open)profile.showModal();$('[data-assessment-detail] h2')?.focus({preventScroll:true});
  }

  function detailHTML(){
    const student=students.find(s=>s.id===learnerId);
    if(!student)return '<div class="assessment-empty"><h2>Choose a learner</h2><p>Review quiz results and published lesson feedback together.</p></div>';
    const records=learnerEvidence(lessons,learnerId);
    return `<div class="assessment-card-heading"><div><p class="assessment-eyebrow">LEARNER EVIDENCE</p><h2 tabindex="-1">${escape(student.name)}</h2></div>${isAssessmentDemo(classId)?'<span class="assessment-tag">Fictional learner</span>':`<a class="assessment-notebook-link" href="/notebooks?${new URLSearchParams({classId,notebookId:classId+'.'+student.id})}">Open notebook ↗</a>`}</div>${records.length?records.slice().reverse().map(({lesson,quiz,assessment})=>`<details class="assessment-lesson" ${records.at(-1).lesson.id===lesson.id?'open':''}><summary><span>${escape(lesson.title)}</span><small>${escape(lesson.date || 'Date not set')}</small></summary>${quiz?.latest?`<h3>Pre-lesson quiz</h3>${quizScoreHTML(quiz)}`:''}${assessment?`<h3>Lesson assessment</h3>${assessmentHTML(assessment)}`:''}</details>`).join(''):isAssessmentDemo(classId)?'<p class="assessment-demo-profile-note">Explore this learner’s sample skill profile below. Select a subject or score in the class table to see the linked responses.</p>':'<div class="assessment-empty"><p>No published evidence yet.</p><p>Quiz submissions and published lesson feedback will appear here.</p></div>'}${isAssessmentDemo(classId)?'':'<button type="button" class="teacher-button secondary" data-assessment-timeline>Open class timeline</button>'}`;
  }
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
  function syncDemoURL(){const url=new URL(location.href);if(isAssessmentDemo(classId))url.searchParams.set('demo',classId);else url.searchParams.delete('demo');history.replaceState(null,'',url);}
  async function load(){
    const token=++epoch;classOptions();students=[];lessons=[];courseAssessment=null;enduringTargets='';skillRecords=[];error='';
    if(!classId){loading=false;render();return;}
    loading=true;render();
    try{
      const [roster,timeline]=isAssessmentDemo(classId)?await loadAssessmentDemo(classId).then(data=>[{students:data.students},data]):await Promise.all([api('/api/enrollment/classes/'+classId+'/roster'),api('/api/lesson-feedback/classes/'+classId+'/timeline')]);
      if(token!==epoch)return;students=roster.students;lessons=timeline.course?.lessons || [];courseAssessment=timeline.course?.assessment || null;enduringTargets=timeline.course?.enduringUnderstandings || '';skillRecords=Array.isArray(timeline.skillEvidence)?timeline.skillEvidence.filter(record=>students.some(student=>student.id===record.learnerId)&&catalogue.groups.some(group=>group.skills.some(skill=>skill.id===record.skillId))&&typeof record.correct==='boolean'):[];
      const preferred=courseAssessment?.frameworks?.[0]?.id;if(preferred)libraryPack=preferred;
      if(!students.some(s=>s.id===learnerId))learnerId=students[0]?.id || '';
    }catch(e){if(token!==epoch)return;error=e.message;}
    if(token===epoch){loading=false;render();}
  }
  root.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.assessmentView){view=button.dataset.assessmentView;render();}
    if(button.dataset.assessmentDomain){domain=button.dataset.assessmentDomain;renderCatalogue();}
    if(button.dataset.assessmentLearner)openProfile(button.dataset.assessmentLearner,button);
    if(button.dataset.classLearner)openProfile(button.dataset.classLearner,button,button.dataset.classEvidence);
    if(button.dataset.classScope){classScope=button.dataset.classScope;render();$(`[data-class-scope="${classScope}"]`)?.focus({preventScroll:true});}
    if(button.dataset.classMode){classMode=button.dataset.classMode;render();}
    if(button.dataset.classAxis){expandedAxis=expandedAxis===button.dataset.classAxis?'':button.dataset.classAxis;render();}
    if(button.matches('[data-assessment-refresh],[data-assessment-retry]'))load();
    if(button.matches('[data-assessment-standards]')&&!isAssessmentDemo(classId))openStandards?.(classId,button);
    if(button.matches('[data-exit-assessment-demo]')){classId=getClasses()[0]?.id || '';syncDemoURL();load();}
    if(button.matches('[data-assessment-timeline]')){profile.close();openTimeline(classId,button);}
  });
  root.addEventListener('change',event=>{if(event.target.matches('[data-class-sort]')){learnerSort=event.target.value;refreshRows();}if(event.target.matches('[data-class-portrait]')){portrait=event.target.value;refreshRows();}if(event.target.matches('[data-assessment-class]')){classId=event.target.value;learnerId='';profile.close();syncDemoURL();load();}if(event.target.matches('[data-library-pack]')){libraryPack=event.target.value;renderStandards();}
    if(event.target.matches('[data-assessment-framework]')){framework=event.target.value;renderCatalogue();$('[data-assessment-framework]').focus({preventScroll:true});}});
  root.addEventListener('input',event=>{if(event.target.matches('[data-class-search]')){learnerSearch=event.target.value;refreshRows();}if(event.target.matches('[data-library-search]')){librarySearch=event.target.value;renderStandardsCriteria();}if(event.target.matches('[data-assessment-search]')){search=event.target.value;renderSkills();}});
  for(const type of ['inkwire:quiz-changed','inkwire:feedback-published'])document.addEventListener(type,event=>{if(event.detail?.classId===classId&&!root.hidden)load();});
  root.addEventListener('error',event=>{if(event.target.matches('.educade-avatar img'))event.target.hidden=true;},true);
  root.addEventListener('keydown',event=>{const tab=event.target.closest('[data-class-scope]');if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const ids=Object.keys(learningTabs),index=ids.indexOf(classScope);classScope=ids[event.key==='Home'?0:event.key==='End'?ids.length-1:(index+(event.key==='ArrowRight'?1:-1)+ids.length)%ids.length];render();$(`[data-class-scope="${classScope}"]`).focus({preventScroll:true});});
  return {refresh:load,clear(){profile.close();epoch++;students=[];lessons=[];learnerId='';$('[data-assessment-body]').replaceChildren();}};
}
