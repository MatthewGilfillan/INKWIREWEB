import {createResourceLibrary} from './course-resources.js';
import {api,escape,requestId} from './workspace-shared.js';
import {quizScoreHTML} from './quiz-results.js';
let shared;
export function createLessonQuiz(){
  if(shared)return shared;
  const dialog=document.createElement('dialog');dialog.className='lesson-quiz';dialog.setAttribute('aria-labelledby','lesson-quiz-title');
  dialog.innerHTML='<button type="button" class="teacher-close" aria-label="Close pre-lesson quiz">×</button><p class="teacher-eyebrow">BEFORE CLASS</p><h2 id="lesson-quiz-title">Pre-lesson quiz</h2><p data-quiz-lesson></p><p data-quiz-status role="status"></p><p data-quiz-error role="alert" hidden></p><div data-quiz-body></div>';
  document.body.append(dialog);const $=s=>dialog.querySelector(s);
  let route='',classId='',lessonId='',data=null,busy=false,dirty=false,changed=false,trigger,epoch=0,library=null,usingDraft=null;
  const blank=()=>({prompt:'',options:['',''],correctIndex:0,explanation:''});
  const questionEditor=(q,i)=>`<fieldset class="quiz-edit-question"><legend>Question ${i+1}</legend><label>Question<input data-question-prompt maxlength="1000" required value="${escape(q.prompt)}"></label><label>Answer choices <small>2–4 choices, one per line</small><textarea data-question-options rows="4" required>${escape(q.options.join('\n'))}</textarea></label><label>Correct choice<select data-question-correct>${[0,1,2,3].map(n=>`<option value="${n}" ${q.correctIndex===n?'selected':''}>Choice ${n+1}</option>`).join('')}</select></label><label>Answer explanation <small>(optional)</small><textarea data-question-explanation maxlength="1500" rows="2">${escape(q.explanation)}</textarea></label><button type="button" class="text-button" data-remove-question>Remove question</button></fieldset>`;
  function readQuiz(){return {title:$('#quiz-title').value,reflectionPrompt:$('#quiz-reflection-prompt').value,questions:[...dialog.querySelectorAll('.quiz-edit-question')].map(q=>({prompt:q.querySelector('[data-question-prompt]').value,options:q.querySelector('[data-question-options]').value.split('\n').map(x=>x.trim()).filter(Boolean),correctIndex:Number(q.querySelector('[data-question-correct]').value),explanation:q.querySelector('[data-question-explanation]').value}))};}
  function render(){
    $('[data-quiz-lesson]').textContent=data.lessonTitle;
    $('#lesson-quiz-title').textContent=data.teacher?'Set pre-lesson quiz':data.quiz?.title || 'Pre-lesson quiz';
    if(data.teacher){
      const stale=data.aiDraft && (data.aiDraft.courseRevision!==data.courseRevision || data.aiDraft.quizRevision!==data.revision);
      const quiz=usingDraft?.quiz || data.quiz || {title:'Pre-lesson reading check',reflectionPrompt:'What would you like to discuss in class?',questions:[blank()]};
      $('[data-quiz-body]').innerHTML=`<p>Write a short reading check for this lesson. Each correct answer is worth one point. Students can retry; the timeline shows their latest and best scores.</p>${!data.locked?`<section class="quiz-ai-tools"><h3>Draft with AI</h3><p>Use uploaded course resources, or paste source material below. Suggestions remain private until you review and assign them.</p><details class="planner-source"><summary>Upload / manage course resources</summary><div data-quiz-library></div></details><div class="planner-grid"><label>Questions<select data-ai-question-count>${[3,5,8,10].map(n=>`<option ${n===5?'selected':''}>${n}</option>`).join('')}</select></label></div><label>Quiz brief or pasted source text<textarea data-ai-quiz-brief rows="3" maxlength="3000" placeholder="Focus on the assigned reading, vocabulary and ideas to revisit before class."></textarea></label><button type="button" class="teacher-button secondary" data-draft-quiz ${data.aiAvailable?'':'disabled'}>Suggest questions with AI</button>${!data.aiAvailable?'<p>OpenAI is not connected.</p>':''}${data.aiDraft?`<div class="ai-review-notes"><h4>AI draft · teacher review</h4><p>${escape(data.aiDraft.source)}</p>${stale?'<p>The course or assigned quiz changed after this draft. Generate a fresh suggestion before assigning.</p>':usingDraft?'<p>Review and edit the questions below, then Save &amp; assign quiz.</p>':'<button type="button" class="text-button" data-use-ai-draft>Load AI draft into editor</button>'}<p>${escape(data.aiDraft.reviewNotes)}</p><details><summary>Source hints to check</summary><ol>${data.aiDraft.sources.map(source=>`<li>${escape(source)}</li>`).join('')}</ol></details></div>`:''}</section>`:''}${data.locked?'<p class="quiz-notice">A student has started this quiz. Its questions and answer key are locked to keep all saved scores comparable.</p>':''}<form data-quiz-editor><fieldset ${data.locked?'disabled':''}><label>Quiz title<input id="quiz-title" maxlength="160" required value="${escape(quiz.title)}"></label><div data-quiz-questions>${quiz.questions.map(questionEditor).join('')}</div><button type="button" class="teacher-button secondary" data-add-question>Add question</button><label>Reflection question <small>(optional; not scored)</small><input id="quiz-reflection-prompt" maxlength="500" value="${escape(quiz.reflectionPrompt)}"></label><p><button type="submit" class="teacher-button">Save &amp; assign quiz</button></p></fieldset></form>`;
      if(!data.locked){library=createResourceLibrary({root:$('[data-quiz-library]'),getClassId:()=>classId,onBusy:value=>{busy=value;$('.teacher-close').disabled=value;}});library.load();}
      return;
    }
    if(!data.quiz){$('[data-quiz-body]').textContent='No quiz has been assigned yet.';return;}
    const quiz=data.quiz;
    if(data.active && !data.cancelled){
      $('[data-quiz-body]').innerHTML=`<p>${quiz.questions.length} questions · One point per correct answer. Take your time and use your book.</p><form data-quiz-attempt>${quiz.questions.map((q,i)=>`<fieldset class="quiz-question"><legend>${i+1}. ${escape(q.prompt)}</legend>${q.options.map((o,n)=>`<label class="quiz-choice"><input required type="radio" name="quiz-answer-${i}" value="${n}"><span>${escape(o)}</span></label>`).join('')}</fieldset>`).join('')}${quiz.reflectionPrompt?`<label>${escape(quiz.reflectionPrompt)} <small>(optional; not scored)</small><textarea data-quiz-reflection maxlength="2000" rows="3"></textarea></label>`:''}<p class="planner-hint">Your answers are saved when you submit.</p><button type="submit" class="teacher-button">Submit quiz</button></form>`;
      return;
    }
    $('[data-quiz-body]').innerHTML=`<div class="quiz-result-panel">${data.result.latest?`<h3>Preparation complete</h3>${quizScoreHTML(data.result)}`:`<h3>Ready for your reading check?</h3><p>${quiz.questions.length} questions · Use your book and take your time.</p>`}${data.cancelled?'<p>This lesson is cancelled. Saved results are available below.</p>':data.result.attemptCount>=20?'<p>You have completed all 20 available attempts.</p>':`<button type="button" class="teacher-button" data-start-quiz>${data.result.latest?'Try again':'Start quiz'}</button>`}</div>${data.attempts.map((a,i)=>`<details class="quiz-attempt-review" ${i===0?'open':''}><summary>Attempt ${data.attempts.length-i} · ${a.score}/${a.total} · ${a.percentage}%</summary><ol>${quiz.questions.map((q,n)=>`<li><h4>${escape(q.prompt)}</h4><p>${a.answers[n]===data.review[n].correctIndex?'✓ Correct':'Review this answer'} · Your answer: ${escape(q.options[a.answers[n]])}</p>${a.answers[n]!==data.review[n].correctIndex?`<p>Correct answer: ${escape(q.options[data.review[n].correctIndex])}</p>`:''}${data.review[n].explanation?`<p>${escape(data.review[n].explanation)}</p>`:''}</li>`).join('')}</ol>${a.reflection?`<h4>Your question for class</h4><p class="feedback-homework">${escape(a.reflection)}</p>`:''}</details>`).join('')}`;
  }
  function error(message=''){$('[data-quiz-error]').textContent=message;$('[data-quiz-error]').hidden=!message;}
  async function save(body){
    if(busy)return;busy=true;error();const version=epoch,controls=[...dialog.querySelectorAll('button,input,select,textarea')],disabled=controls.map(el=>el.disabled);controls.forEach(el=>el.disabled=true);$('[data-quiz-status]').textContent='Saving…';
    try{
      const result=await api(route,{...body,revision:data.revision});if(version!==epoch)return;
      data=result;usingDraft=null;dirty=false;changed=true;render();$('[data-quiz-status]').textContent=body.action==='save'?'Quiz assigned to this lesson.':body.action==='submit'?'Quiz submitted. Your score is saved on the course timeline.':'';
    }catch(e){if(version===epoch){error(e.message);$('[data-quiz-status]').textContent='Your entries are still here. Try again when ready.';}}
    finally{if(version===epoch){busy=false;controls.forEach((el,i)=>el.disabled=disabled[i]);$('.teacher-close').disabled=false;}}
  }
  async function draftWithAI(){
    if(busy)return;
    if(readQuiz().questions.some(q=>q.prompt.trim()) && !confirm('Replace the question fields with a new AI draft? The assigned quiz stays unchanged until you save.'))return;
    const body={requestId:requestId(),courseRevision:data.courseRevision,lessonIds:[lessonId],questionCount:Number($('[data-ai-question-count]').value),brief:$('[data-ai-quiz-brief]').value};
    busy=true;error();const version=epoch,controls=[...dialog.querySelectorAll('button,input,select,textarea')],disabled=controls.map(el=>el.disabled);controls.forEach(el=>el.disabled=true);$('[data-quiz-status]').textContent='Drafting questions from your course resources… This may take up to 2½ minutes.';
    try{
      const result=await api(`/api/quiz-assistant/classes/${classId}`,body,{timeoutMs:155000});if(version!==epoch)return;
      if(!result.saved.includes(lessonId))throw Error(result.notes || 'No draft saved. The course changed, a student started the quiz, or more source material is needed.');
      data=await api(route);if(version!==epoch)return;usingDraft=data.aiDraft;dirty=false;changed=true;render();$('[data-quiz-status]').textContent='AI draft saved privately. Check the questions, source hints and correct answers, then assign when ready.';
    }catch(e){if(version===epoch){error(e.message);$('[data-quiz-status]').textContent='Your assigned quiz is unchanged. Reopen to check for a saved draft if the request timed out.';}}
    finally{if(version===epoch){busy=false;controls.forEach((el,i)=>el.disabled=disabled[i]);$('.teacher-close').disabled=false;}}
  }
  function close(){if(busy)return;if(dirty && !confirm('Close without submitting your unsaved quiz entries?'))return;dialog.close();}
  $('.teacher-close').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  dialog.addEventListener('close',()=>{epoch++;library?.reset();library=null;data=null;usingDraft=null;dirty=false;$('[data-quiz-body]').replaceChildren();trigger?.focus();if(changed){changed=false;document.dispatchEvent(new CustomEvent('inkwire:quiz-changed',{detail:{classId,lessonId}}));}});
  dialog.addEventListener('input',event=>{if(event.target.closest('[data-quiz-editor],[data-quiz-attempt]'))dirty=true;});
  dialog.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button || busy)return;
    if(button.hasAttribute('data-draft-quiz'))draftWithAI();
    if(button.hasAttribute('data-use-ai-draft')){if(dirty && !confirm('Replace unsaved question edits with the AI draft?'))return;usingDraft=data.aiDraft;dirty=false;render();}
    if(button.hasAttribute('data-add-question')){const count=dialog.querySelectorAll('.quiz-edit-question').length;if(count>=20){error('Use up to 20 questions.');return;}$('[data-quiz-questions]').insertAdjacentHTML('beforeend',questionEditor(blank(),count));dirty=true;}
    if(button.hasAttribute('data-remove-question')){if(dialog.querySelectorAll('.quiz-edit-question').length===1){error('Keep at least one question.');return;}button.closest('.quiz-edit-question').remove();dialog.querySelectorAll('.quiz-edit-question legend').forEach((el,i)=>el.textContent='Question '+(i+1));dirty=true;}
    if(button.hasAttribute('data-start-quiz'))save({action:'start',attemptId:requestId()});
  });
  dialog.addEventListener('submit',event=>{
    event.preventDefault();if(busy)return;
    if(event.target.hasAttribute('data-quiz-editor'))save({action:'save',quiz:readQuiz(),...(usingDraft?{draftRevision:usingDraft.revision}:{})});
    else{const values=new FormData(event.target);save({action:'submit',attemptId:data.active,answers:data.quiz.questions.map((_,i)=>Number(values.get('quiz-answer-'+i))),reflection:$('[data-quiz-reflection]')?.value || ''});}
  });
  window.addEventListener('beforeunload',event=>{if(dialog.open && (busy || dirty)){event.preventDefault();event.returnValue='';}});
  return shared={async open(id,lesson,button){
    if(dialog.open)return;classId=id;lessonId=lesson;trigger=button;changed=false;dirty=false;data=null;usingDraft=null;error();$('[data-quiz-status]').textContent='Loading quiz…';$('[data-quiz-body]').replaceChildren();route=`/api/lesson-quizzes/classes/${id}/lessons/${lesson}`;const version=++epoch;dialog.showModal();
    try{const result=await api(route);if(version!==epoch)return;data=result;if(data.teacher && !data.quiz && data.aiDraft?.courseRevision===data.courseRevision && data.aiDraft?.quizRevision===data.revision)usingDraft=data.aiDraft;render();$('[data-quiz-status]').textContent='';}catch(e){if(version===epoch){error(e.message);$('[data-quiz-status]').textContent='Close and reopen to try again.';}}
  }};
}
