import catalogue from './assessment-catalogue.mjs';
import curricula from './assessment-curricula.mjs';
import {achievementLevels,learnerEvidence,evidenceSummary} from './assessment-model.mjs';
import {api,escape} from './workspace-shared.js';
import {quizScoreHTML} from './quiz-results.js';
import {assessmentHTML} from './lesson-feedback-view.js';

export function createAssessmentWorkspace({root,getClasses,openTimeline}) {
  let classId='',learnerId='',view='evidence',framework='ccss',domain='all',search='',students=[],lessons=[],loading=false,error='',epoch=0;
  const $=selector=>root.querySelector(selector);
  root.innerHTML=`<div class="assessment-controls"><label>Class<select data-assessment-class></select></label><div class="assessment-views" role="group" aria-label="Assessment workspace"><button type="button" data-assessment-view="evidence" aria-pressed="true">Learning evidence</button><button type="button" data-assessment-view="catalogue" aria-pressed="false">Skills &amp; standards</button></div><button type="button" class="text-button" data-assessment-refresh>Refresh</button></div><p data-assessment-status role="status"></p><div data-assessment-body></div>`;
  function classOptions(){
    const classes=getClasses();
    if(!classes.some(c=>c.id===classId)){classId=classes[0]?.id || '';learnerId='';}
    $('[data-assessment-class]').innerHTML=classes.length?classes.map(c=>`<option value="${escape(c.id)}">${escape(c.name)}</option>`).join(''):'<option value="">No classes yet</option>';
    $('[data-assessment-class]').value=classId;$('[data-assessment-class]').disabled=!classes.length;
  }
  function render(){
    root.querySelectorAll('[data-assessment-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.assessmentView===view)));
    $('[data-assessment-status]').textContent=loading?'Loading learning evidence…':error;
    if(view==='catalogue'){renderCatalogue();return;}
    if(loading){$('[data-assessment-body]').innerHTML='<div class="assessment-empty">Getting the class ready…</div>';return;}
    if(error){$('[data-assessment-body]').innerHTML='<div class="assessment-empty"><h2>Evidence could not be loaded</h2><button type="button" class="teacher-button secondary" data-assessment-retry>Try again</button></div>';return;}
    const allRecords=students.flatMap(student=>learnerEvidence(lessons,student.id)),summary=evidenceSummary(allRecords);
    $('[data-assessment-body]').innerHTML=`<div class="assessment-stats"><div><strong>${students.length}</strong><span>students</span></div><div><strong>${summary.quizzes}</strong><span>quiz submissions</span></div><div><strong>${summary.feedback}</strong><span>published lesson assessments</span></div></div><div class="assessment-layout"><section class="assessment-card assessment-learners"><div class="assessment-card-heading"><h2>Learners</h2><span>Latest learning evidence</span></div>${students.length?students.map(student=>{
      const records=learnerEvidence(lessons,student.id),s=evidenceSummary(records);
      return `<button type="button" class="assessment-learner" data-assessment-learner="${escape(student.id)}" aria-pressed="${learnerId===student.id}"><span class="assessment-initial" aria-hidden="true">${escape(student.name.slice(0,1))}</span><span><strong>${escape(student.name)}</strong><small>${s.quizzes?s.quizzes+' quiz'+(s.quizzes===1?'':'zes'):'No quiz results'} · ${s.feedback?s.feedback+' lesson assessment'+(s.feedback===1?'':'s'):'No lesson assessments'}</small></span><span class="assessment-accuracy">${s.accuracy===null?'—':s.accuracy+'%'}<small>quiz accuracy</small></span></button>`;
    }).join(''):'<div class="assessment-empty"><p>Add students from Classes to begin.</p></div>'}</section><section class="assessment-card assessment-detail" data-assessment-detail>${detailHTML()}</section></div><p class="assessment-footnote">Quiz accuracy uses first submitted attempts. Published lesson ratings are teacher assessments; neither is a curriculum mastery score.</p>`;
  }
  function detailHTML(){
    const student=students.find(s=>s.id===learnerId);
    if(!student)return '<div class="assessment-empty"><h2>Choose a learner</h2><p>Review quiz results and published lesson feedback together.</p></div>';
    const records=learnerEvidence(lessons,learnerId);
    return `<div class="assessment-card-heading"><div><p class="assessment-eyebrow">LEARNER EVIDENCE</p><h2 tabindex="-1">${escape(student.name)}</h2></div><a class="assessment-notebook-link" href="/notebooks?${new URLSearchParams({classId,notebookId:classId+'.'+student.id})}">Open notebook ↗</a></div>${records.length?records.slice().reverse().map(({lesson,quiz,assessment})=>`<details class="assessment-lesson" ${records.at(-1).lesson.id===lesson.id?'open':''}><summary><span>${escape(lesson.title)}</span><small>${escape(lesson.date || 'Date not set')}</small></summary>${quiz?.latest?`<h3>Pre-lesson quiz</h3>${quizScoreHTML(quiz)}`:''}${assessment?`<h3>Lesson assessment</h3>${assessmentHTML(assessment)}`:''}</details>`).join(''):'<div class="assessment-empty"><p>No published evidence yet.</p><p>Quiz submissions and published lesson feedback will appear here.</p></div>'}<button type="button" class="teacher-button secondary" data-assessment-timeline>Open class timeline</button>`;
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
  async function load(){
    const token=++epoch;classOptions();students=[];lessons=[];error='';
    if(!classId){loading=false;render();return;}
    loading=true;render();
    try{
      const [roster,timeline]=await Promise.all([api('/api/enrollment/classes/'+classId+'/roster'),api('/api/lesson-feedback/classes/'+classId+'/timeline')]);
      if(token!==epoch)return;students=roster.students;lessons=timeline.course?.lessons || [];
      if(!students.some(s=>s.id===learnerId))learnerId=students[0]?.id || '';
    }catch(e){if(token!==epoch)return;error=e.message;}
    if(token===epoch){loading=false;render();}
  }
  root.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.assessmentView){view=button.dataset.assessmentView;render();}
    if(button.dataset.assessmentDomain){domain=button.dataset.assessmentDomain;renderCatalogue();}
    if(button.dataset.assessmentLearner){learnerId=button.dataset.assessmentLearner;render();$('[data-assessment-detail] h2')?.focus({preventScroll:true});}
    if(button.matches('[data-assessment-refresh],[data-assessment-retry]'))load();
    if(button.matches('[data-assessment-timeline]'))openTimeline(classId,button);
  });
  root.addEventListener('change',event=>{if(event.target.matches('[data-assessment-class]')){classId=event.target.value;learnerId='';load();}if(event.target.matches('[data-assessment-framework]')){framework=event.target.value;renderCatalogue();$('[data-assessment-framework]').focus({preventScroll:true});}});
  root.addEventListener('input',event=>{if(event.target.matches('[data-assessment-search]')){search=event.target.value;renderSkills();}});
  for(const type of ['inkwire:quiz-changed','inkwire:feedback-published'])document.addEventListener(type,event=>{if(event.detail?.classId===classId&&!root.hidden)load();});
  return {refresh:load,clear(){epoch++;students=[];lessons=[];learnerId='';$('[data-assessment-body]').replaceChildren();}};
}
