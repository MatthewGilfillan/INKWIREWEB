import {createLessonQuiz} from './lesson-quiz.js';
import {quizScoreHTML,teacherStudentHTML} from './quiz-results.js';
import {api,escape} from './workspace-shared.js';
import {renderLessonReport,assessmentHTML} from './lesson-feedback-view.js?v=20261103-skin';
import {renderSummary} from './summary-format.mjs';
import {createLessonFeedback} from './lesson-feedback.js';
import {learningWorkspace} from './learning-workspace.js?v=20261108-segments';

export function createMemberCourse({teacher=false,parent=false,root=null,onEditLesson}={}) {
  const titleId=root?(teacher?'teacher-timeline-title':'student-course-title'):'member-course-title';
  const dialog=document.createElement(root ? 'section' : 'dialog');dialog.className='member-course'+(!teacher?' learning-workspace':'');dialog.setAttribute('aria-labelledby',titleId);
  dialog.innerHTML=`<button type="button" class="teacher-close" aria-label="Close course timeline">×</button><p class="teacher-eyebrow" data-timeline-kind></p><h2 id="${titleId}">Course timeline</h2><p data-timeline-person></p><p data-timeline-status role="status"></p><button type="button" class="text-button" data-timeline-refresh>Refresh timeline</button><div data-timeline-body></div>`;
  (root || document.body).append(dialog); if(root) dialog.querySelector('.teacher-close').hidden=true;const $=s=>dialog.querySelector(s),feedback=teacher?createLessonFeedback():null,quizPlayer=createLessonQuiz();
  let route='',classId='',learner='',trigger,epoch=0,data,timer,loadedAt=0,selectedLesson=null;
  const isOpen=()=>root ? Boolean(classId) && !root.hidden : dialog.open;
  function clear(){if(!root && dialog.open)dialog.close();epoch++;clearTimeout(timer);data=null;classId='';$('[data-timeline-body]').replaceChildren();selectedLesson=null;}
  $('.teacher-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{epoch++;clearTimeout(timer);$('[data-timeline-body]').replaceChildren();trigger?.focus();});
  function updateButtons(){
    clearTimeout(timer);if(!data || !isOpen() || !data.teacher)return;
    let next=Infinity;
    for(const button of dialog.querySelectorAll('[data-timeline-feedback]')){
      const lesson=data.course.lessons.find(l=>l.id===button.dataset.timelineFeedback),left=lesson.endsAt===null?Infinity:lesson.endsAt-(data.serverNow+performance.now()-loadedAt);
      button.disabled=left>0;button.title=lesson.status==='cancelled'?'Cancelled lessons do not accept feedback.':lesson.endsAt===null?'Set a date and time in Edit course overview.':left>0?'Available at the scheduled end of class.':'Open Summary & Feedback';
      if(left>0)next=Math.min(next,left);
      const badge=button.closest('.timeline-lesson').querySelector('[data-lesson-status]');badge.textContent=lesson.status==='cancelled'?'Cancelled':lesson.report?'Published':lesson.endsAt===null?'Date to be set':left>0?'Upcoming':'Ready for feedback';
    }
    if(Number.isFinite(next))timer=setTimeout(updateButtons,Math.min(next+10,2147483647));
  }
  async function load(){
    const version=++epoch;status('Loading course timeline…');
    try{
      const response=await api(route);if(version!==epoch)return;data=response;if(parent || data.demo)data.canTakeQuiz=false;loadedAt=performance.now();dialog.classList.toggle('learning-workspace',!data.teacher);
      $('[data-timeline-kind]').textContent=!teacher?'YOUR LEARNING SPACE':data.demo?'DEMO PARENT DASHBOARD · TEACHER ONLY':data.teacher?'TEACHER COURSE TIMELINE':parent?'PARENT COURSE TIMELINE':'STUDENT COURSE TIMELINE';
      $('#'+titleId).textContent=data.course?.title || data.className;
      $('[data-timeline-person]').textContent=data.learnerName || data.className;
      if(!data.course){$('[data-timeline-body]').textContent='The teacher has not saved a course outline yet.';status('');return;}
      const course=data.course;
      if(data.teacher)$('[data-timeline-body]').innerHTML=`<p>${escape(course.description)}</p><p class="timeline-schedule">Lesson dates and times shown below · ${escape(course.timeZone)}</p><div class="lesson-timeline">${course.lessons.map(lesson=>`<article class="timeline-lesson ${lesson.status==='cancelled'?'is-cancelled':''}"><span class="timeline-number" aria-hidden="true">${lesson.number}</span><div class="timeline-content"><div class="timeline-heading"><span class="teacher-eyebrow">LESSON ${lesson.number}</span><span class="class-badge" data-lesson-status>${lesson.status==='cancelled'?'Cancelled':lesson.report?'Published':lesson.endsAt!==null && lesson.endsAt<=data.serverNow?'Awaiting feedback':lesson.date?'Upcoming':'Date to be set'}</span></div><h3>${escape(lesson.title)}</h3><p class="timeline-date">${escape(lesson.date || 'Date to be set')} · ${escape(lesson.startTime || course.startTime)} · ${lesson.lessonMinutes ?? course.lessonMinutes} min${lesson.section?' · '+escape(lesson.section):''}</p>${lesson.rescheduledFrom?`<p class="planner-hint">Rescheduled from ${escape(lesson.rescheduledFrom.date)} · ${escape(lesson.rescheduledFrom.startTime)}</p>`:''}${lesson.billing?`<p class="lesson-billing">${escape(lesson.billing)}</p>`:''}<p>${escape(lesson.goal)}</p>${data.teacher?`<button type="button" class="teacher-button secondary" data-timeline-feedback="${escape(lesson.id)}" disabled>Summary &amp; Feedback</button>${onEditLesson?`<button type="button" class="teacher-button secondary timeline-edit" data-timeline-edit="${lesson.number-1}">Reschedule / cancel</button>`:''}`:''}<section class="timeline-quiz" data-lesson-quiz-summary="${escape(lesson.id)}"></section><details class="timeline-details" ${lesson.report?'open':''}><summary>${lesson.report?'Class summary & feedback':'Reading & homework'}</summary><div data-timeline-lesson="${escape(lesson.id)}">${lesson.reading?`<h4>Reading before class</h4><p>${escape(lesson.reading)}</p>`:''}${!lesson.report?`<h4>Homework</h4><p>${escape(lesson.homework || 'No homework assigned.')}</p><p class="planner-hint">The lesson recap will appear here after the teacher publishes it.</p>`:''}</div></details></div></article>`).join('')}</div>`;
      if(!data.teacher){
        const notebookURL='/notebooks?'+new URLSearchParams({classId,...(learner?{notebookId:classId+'.'+learner}:{})});
        $('[data-timeline-body]').innerHTML=learningWorkspace(data,notebookURL);
        if(selectedLesson!==null)selectLesson(selectedLesson);
      }
      for(const lesson of course.lessons.filter(l=>l.report)){
        const root=$(`[data-timeline-lesson="${lesson.id}"]`);
        if(data.teacher){root.innerHTML=`<div data-teacher-recap></div><section class="timeline-assessments"><h4>Student assessments</h4>${teacherStudentHTML(lesson,assessmentHTML)}</section><h4>Homework</h4><p class="feedback-homework"></p>`;renderSummary(root.querySelector('[data-teacher-recap]'),lesson.report.summary);root.querySelector('.feedback-homework').textContent=lesson.homework || 'No homework assigned.';}
        else renderLessonReport(root,lesson.report,lesson.homework,lesson.report.assessment,{parent:parent || data.demo,includeHomework:false});
      }
      for(const lesson of course.lessons){
        const target=$(`[data-lesson-quiz-summary="${lesson.id}"]`),quiz=lesson.quiz;
        target.innerHTML=`<h4>Pre-lesson quiz</h4><p>${quiz?escape(quiz.title)+' · '+quiz.total+' questions':'Not assigned'}</p>${data.teacher?`<button type="button" class="teacher-button secondary timeline-quiz-action" data-open-quiz="${escape(lesson.id)}">${lesson.hasQuizDraft?'Review AI draft':quiz?'View / edit quiz':'Set up quiz'}</button>${quiz && !lesson.report?teacherStudentHTML(lesson,assessmentHTML):''}`:quiz?`${quizScoreHTML(quiz.result)}${data.canTakeQuiz?`<button type="button" class="teacher-button secondary" data-open-quiz="${escape(lesson.id)}">${lesson.status==='cancelled'?'Review quiz':quiz.result?.inProgress?'Continue quiz':quiz.result?.latest?'Review / retry quiz':'Take quiz'}</button>`:''}`:''}`;
      }
      status(data.demo?'Demo profile — no email or password. Only teachers of this class can open this preview.':'');updateButtons();
    }catch(error){if(version===epoch){status(error.message);$('[data-timeline-body]').replaceChildren();}}
  }
  function selectLesson(index,{focus=false}={}){
    if(!data?.course || !Number.isInteger(index) || index<0 || index>=data.course.lessons.length)return;
    selectedLesson=index;
    if($('[data-learning-picker]'))$('[data-learning-picker]').value=String(index);
    dialog.querySelectorAll('[data-learning-lesson]').forEach(el=>el.hidden=Number(el.dataset.learningLesson)!==index);
    dialog.querySelectorAll('.learning-step').forEach(el=>{if(Number(el.dataset.learningStep)===index)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
    if(focus)$(`[data-learning-lesson="${index}"] h3`)?.focus({preventScroll:true});
  }
  dialog.addEventListener('click',event=>{const b=event.target.closest('[data-learning-step]');if(b && !b.disabled)selectLesson(Number(b.dataset.learningStep),{focus:true});});
  dialog.addEventListener('change',event=>{if(event.target.matches('[data-learning-picker]'))selectLesson(Number(event.target.value),{focus:true});});
  function status(text){$('[data-timeline-status]').textContent=text;}
  $('[data-timeline-refresh]').onclick=load;
  dialog.addEventListener('click',event=>{const button=event.target.closest('[data-timeline-feedback]');if(button && !button.disabled)feedback.open(classId,button.dataset.timelineFeedback,button);});
  dialog.addEventListener('click',event=>{const button=event.target.closest('[data-timeline-edit]');if(button)onEditLesson?.(classId,button,Number(button.dataset.timelineEdit));});
  dialog.addEventListener('click',event=>{const button=event.target.closest('[data-open-quiz]');if(button)quizPlayer.open(classId,button.dataset.openQuiz,button);});
  document.addEventListener('inkwire:quiz-changed',async event=>{
    if(event.detail.classId!==classId)return;const restoreFocus=isOpen() && dialog.contains(document.activeElement);await load();
    if(restoreFocus && isOpen())$(`[data-open-quiz="${event.detail.lessonId}"]`)?.focus();
  });
  document.addEventListener('visibilitychange',()=>{if(isOpen())updateButtons();});
  document.addEventListener('inkwire:feedback-published',async event=>{
    if(!teacher || event.detail.classId!==classId)return;
    const restoreFocus=isOpen() && dialog.contains(document.activeElement);
    await load();
    if(restoreFocus && isOpen())$(`[data-timeline-feedback="${event.detail.lessonId}"]`)?.focus();
  });
  return {async open(id,learnerId,button,{demo=false}={}){
    trigger=button;if(classId!==id || learner!==(learnerId || '')){selectedLesson=null;$('[data-timeline-body]').replaceChildren();}classId=id;learner=learnerId || '';const query=new URLSearchParams();if(learnerId)query.set('learnerId',learnerId);if(demo)query.set('demo','1');
    route=`/api/lesson-feedback/classes/${id}/${teacher && !demo?'timeline':'overview'}?${query}`;if(!root)dialog.showModal();await load();
  }, clear, refresh:load};
}
