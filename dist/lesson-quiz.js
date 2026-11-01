import {createQuizWorkbench} from './quiz-workbench.js';
import {createQuizPlayer,createFlashcards} from './quiz-player.js';
import {api,escape,requestId} from './workspace-shared.js';
import {quizScoreHTML} from './quiz-results.js';
let shared;
export function createLessonQuiz(){
  if(shared)return shared;
  const dialog=document.createElement('dialog');dialog.className='lesson-quiz';dialog.setAttribute('aria-labelledby','lesson-quiz-title');
  dialog.innerHTML='<button type="button" class="teacher-close" aria-label="Close pre-lesson quiz">×</button><p class="teacher-eyebrow">BEFORE CLASS</p><h2 id="lesson-quiz-title">Pre-lesson quiz</h2><p data-quiz-lesson></p><p data-quiz-status role="status"></p><p data-quiz-error role="alert" hidden></p><div data-quiz-body></div>';
  document.body.append(dialog);const $=s=>dialog.querySelector(s);
  let route='',classId='',lessonId='',data=null,busy=false,dirty=false,changed=false,trigger,epoch=0,workbench=null,player=null;
  function render(){
    $('[data-quiz-lesson]').textContent=data.lessonTitle;
    $('#lesson-quiz-title').textContent=data.teacher?'Set pre-lesson quiz':data.quiz?.title || 'Pre-lesson quiz';
    dialog.classList.toggle('quiz-studio-dialog',Boolean(data.teacher));
    dialog.classList.toggle('quiz-player-dialog',!data.teacher && Boolean(data.active));
    workbench?.destroy();workbench=null;player?.destroy();player=null;
    if(data.teacher){
      $('#lesson-quiz-title').textContent='Quiz studio';
      workbench=createQuizWorkbench({root:$('[data-quiz-body]'),classId,lessonId,data,onBusy:value=>{busy=value;$('.teacher-close').disabled=value;},onDirty:value=>dirty=value,onChanged:()=>changed=true,onStatus:message=>$('[data-quiz-status]').textContent=message,onError:error});
      return;
    }
    if(!data.quiz){$('[data-quiz-body]').textContent='No quiz has been assigned yet.';return;}
    const quiz=data.quiz;
    if(data.active && !data.cancelled){
      $('[data-quiz-body]').replaceChildren();const holder=document.createElement('div');$('[data-quiz-body]').append(holder);
      player=createQuizPlayer({root:holder,quiz,onDirty:()=>dirty=true,onSubmit:async({answers,reflection})=>save({action:'submit',attemptId:data.active,answers,reflection},true)});
      return;
    }
    $('[data-quiz-body]').innerHTML=`<div class="quiz-result-panel">${data.result.latest?`<h3 class="quiz-completion">✦ Preparation complete</h3>${quizScoreHTML(data.result)}`:`<h3>Ready for your reading check?</h3><p>${quiz.questions.length} questions · Use your book and take your time.</p>`}${data.cancelled?'<p>This lesson is cancelled. Saved results are available below.</p>':data.result.attemptCount>=20?'<p>You have completed all 20 available attempts.</p>':`<button type="button" class="teacher-button" data-start-quiz>${data.result.latest?'Try again':'Start quiz'}</button>`}</div>${data.review?'<button type="button" class="teacher-button secondary" data-student-flashcards>Practise flashcards</button><div data-flashcard-practice></div>':''}${data.attempts.map((a,i)=>`<details class="quiz-attempt-review" ${i===0?'open':''}><summary>Attempt ${data.attempts.length-i} · ${a.score}/${a.total} · ${a.percentage}%</summary><ol>${quiz.questions.map((q,n)=>`<li><h4>${escape(q.prompt)}</h4><p>${a.answers[n]===data.review[n].correctIndex?'✓ Correct':'Review this answer'} · Your answer: ${escape(q.options[a.answers[n]])}</p>${a.answers[n]!==data.review[n].correctIndex?`<p>Correct answer: ${escape(q.options[data.review[n].correctIndex])}</p>`:''}${data.review[n].explanation?`<p>${escape(data.review[n].explanation)}</p>`:''}</li>`).join('')}</ol>${a.reflection?`<h4>Your question for class</h4><p class="feedback-homework">${escape(a.reflection)}</p>`:''}</details>`).join('')}`;
  }
  function error(message=''){$('[data-quiz-error]').textContent=message;$('[data-quiz-error]').hidden=!message;}
  async function save(body,rethrow=false){
    if(busy)return;busy=true;error();const version=epoch,controls=[...dialog.querySelectorAll('button,input,select,textarea')],disabled=controls.map(el=>el.disabled);controls.forEach(el=>el.disabled=true);$('[data-quiz-status]').textContent='Saving…';
    try{
      const result=await api(route,{...body,revision:data.revision});if(version!==epoch)return;
      data=result;dirty=false;changed=true;render();$('[data-quiz-status]').textContent=body.action==='save'?'Quiz assigned to this lesson.':body.action==='submit'?'Quiz submitted. Your score is saved on the course timeline.':'';
    }catch(e){if(version===epoch){error(e.message);$('[data-quiz-status]').textContent='Your entries are still here. Try again when ready.';}if(rethrow)throw e;}
    finally{if(version===epoch){busy=false;controls.forEach((el,i)=>el.disabled=disabled[i]);$('.teacher-close').disabled=false;}}
  }
  function close(){if(busy)return;if(dirty && !confirm('Close without submitting your unsaved quiz entries?'))return;dialog.close();}
  $('.teacher-close').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  dialog.addEventListener('close',()=>{epoch++;workbench?.destroy();workbench=null;player?.destroy();player=null;data=null;dirty=false;$('[data-quiz-body]').replaceChildren();trigger?.focus();if(changed){changed=false;document.dispatchEvent(new CustomEvent('inkwire:quiz-changed',{detail:{classId,lessonId}}));}});
  dialog.addEventListener('input',event=>{if(event.target.closest('[data-quiz-editor],[data-quiz-attempt]'))dirty=true;});
  dialog.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button || busy)return;
    if(button.hasAttribute('data-student-flashcards')){
      const holder=document.createElement('div');$('[data-flashcard-practice]').replaceChildren(holder);createFlashcards({root:holder,quiz:{...data.quiz,questions:data.quiz.questions.map((q,i)=>({...q,...data.review[i]}))}});holder.scrollIntoView({block:'start'});
    }
    if(button.hasAttribute('data-start-quiz'))save({action:'start',attemptId:requestId()});
  });
  window.addEventListener('beforeunload',event=>{if(dialog.open && (busy || dirty)){event.preventDefault();event.returnValue='';}});
  return shared={async open(id,lesson,button){
    if(dialog.open)return;classId=id;lessonId=lesson;trigger=button;changed=false;dirty=false;data=null;error();$('[data-quiz-status]').textContent='Loading quiz…';$('[data-quiz-body]').replaceChildren();route=`/api/lesson-quizzes/classes/${id}/lessons/${lesson}`;const version=++epoch;dialog.showModal();
    try{const result=await api(route);if(version!==epoch)return;data=result;render();$('[data-quiz-status]').textContent='';}catch(e){if(version===epoch){error(e.message);$('[data-quiz-status]').textContent='Close and reopen to try again.';}}
  }};
}
