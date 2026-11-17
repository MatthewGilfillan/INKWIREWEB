import {api,escape,requestId} from './workspace-shared.js';
import {ratingFields,homeworkStatuses,validateAssessment} from './lesson-feedback-model.mjs';
import {renderLessonReport} from './lesson-feedback-view.js';

let sharedFeedback;
export function createLessonFeedback() {
  if(sharedFeedback)return sharedFeedback;
  const dialog=document.createElement('dialog');dialog.className='lesson-feedback';dialog.setAttribute('aria-labelledby','lesson-feedback-title');
  dialog.innerHTML=`<button type="button" class="teacher-close" aria-label="Close Summary & Feedback">×</button><p class="teacher-eyebrow">LESSON FEEDBACK</p><h2 id="lesson-feedback-title">Student assessment &amp; lesson recap</h2><p data-feedback-lesson></p><nav class="feedback-tabs" role="tablist" aria-label="Lesson feedback tools"><button type="button" role="tab" data-feedback-tab="assessment" id="feedback-assessment-tab" aria-controls="feedback-assessment-panel" aria-selected="true">Student assessment</button><button type="button" role="tab" data-feedback-tab="transcript" id="feedback-transcript-tab" aria-controls="feedback-transcript-panel" aria-selected="false">Transcript &amp; recap</button></nav><p data-feedback-status role="status" aria-live="polite"></p><p data-feedback-error role="alert" hidden></p><form hidden><section id="feedback-assessment-panel" role="tabpanel" aria-labelledby="feedback-assessment-tab"><p class="planner-hint">Record observations during or after class. No transcript or AI is needed. Leave categories you have not assessed blank.</p><div data-feedback-roster></div><div class="teacher-actions"><button type="button" class="teacher-button secondary" data-feedback-save>Save assessment draft</button><button type="button" class="teacher-button" data-feedback-publish-assessment>Publish student assessments</button></div><p class="planner-hint">Drafts are private. Publish when ready to share each student’s own assessment with their connected student and parent dashboards.</p></section><section id="feedback-transcript-panel" role="tabpanel" aria-labelledby="feedback-transcript-tab" hidden><section class="feedback-upload"><h3>Optional transcript &amp; AI recap</h3><p>Use this separately after class to generate a lesson recap. You can assess students without using this tool.</p><label for="feedback-teacher-speaker">Your speaker label in the transcript <span>(optional)</span></label><input id="feedback-teacher-speaker" maxlength="80" placeholder="For example: Matthew"><p class="planner-hint">Use the exact label to identify homework instructions. Leave it blank if speakers are unclear; saved homework will stay in place.</p><details><summary>Optional student speaker labels for quotations</summary><div data-feedback-speakers></div></details><label for="feedback-transcript">Upload transcript (.txt or .vtt, up to 512 KiB)</label><input id="feedback-transcript" type="file" accept=".txt,.vtt,text/plain,text/vtt"><p>The full transcript and the speaker labels you enter are sent to OpenAI. The transcript is not stored in Ink Wire. Your ratings are saved exactly as entered.</p><label class="planner-checkbox" data-next-quiz-option><input type="checkbox" data-next-quiz checked> Also draft a quiz for the next lesson</label><p class="planner-hint" data-next-quiz-hint>Review the draft on the timeline before assigning it.</p></section><div class="teacher-actions"><button type="submit" class="teacher-button">Generate &amp; publish lesson report</button></div><p class="planner-hint">Publishes the recap and current student assessments, with supported quotations and any explicit homework update. Complete the assessed categories first; this action never invents ratings.</p></section><section data-feedback-published hidden><h3>Published lesson feedback</h3><label for="feedback-preview-student">Preview a student’s report</label><select id="feedback-preview-student"></select><div data-feedback-preview></div><details class="feedback-corrections"><summary>Correct the published summary or homework</summary><label for="feedback-correct-summary">Shared class summary</label><textarea id="feedback-correct-summary" rows="12" maxlength="14000"></textarea><label for="feedback-correct-homework">Homework</label><textarea id="feedback-correct-homework" rows="4" maxlength="4000"></textarea><div data-feedback-correct-students></div><p>Corrections publish the ratings above and the quotes and parent notes in this section. No new AI request is made.</p><button type="button" class="teacher-button secondary" data-feedback-correct>Publish corrections</button></details></section></form>`;
  document.body.append(dialog);const $=selector=>dialog.querySelector(selector),form=$('form');
  let route='',data=null,trigger=null,busy=false,dirty=false,epoch=0,attemptId='',timer,publishedChange=false,activeClassId='',activeLessonId='',activeTab='assessment';
  function setError(message=''){$('[data-feedback-error]').textContent=message;$('[data-feedback-error]').hidden=!message;}
  function readDraft(){return {teacherSpeaker:$('#feedback-teacher-speaker').value,assessments:[...dialog.querySelectorAll('[data-feedback-student]')].map(row=>({learnerId:row.dataset.feedbackStudent,attendance:row.querySelector('[data-attendance]').value,speaker:dialog.querySelector('[data-speaker-for="'+CSS.escape(row.dataset.feedbackStudent)+'"]').value,homeworkStatus:row.querySelector('[data-homework-status]').value,parentNote:row.querySelector('[data-parent-note]').value,ratings:Object.fromEntries(Object.keys(ratingFields).map(key=>[key,Number(row.querySelector(`input[name="${row.dataset.feedbackStudent}-${key}"]:checked`)?.value) || null]))}))};}
  function status(text){$('[data-feedback-status]').textContent=text;}
  function rosterHTML(){return data.roster.map((student,index)=>{
    const saved=data.draft?.assessments.find(a=>a.learnerId===student.id);
    return `<section class="feedback-student" data-feedback-student="${escape(student.id)}"><div class="feedback-student-heading"><h3>${escape(student.name)}</h3><label>Attendance<select data-attendance><option value="present">Present</option><option value="absent" ${saved?.attendance==='absent'?'selected':''}>Absent</option></select></label><label>Homework completed<select data-homework-status><option value="">Not recorded</option>${Object.entries(homeworkStatuses).map(([value,label])=>`<option value="${value}" ${saved?.homeworkStatus===value?'selected':''}>${label}</option>`).join('')}</select></label></div><div class="feedback-ratings">${Object.entries(ratingFields).map(([key,label])=>`<fieldset class="star-rating" ${saved?.attendance==='absent'?'disabled':''}><legend>${label}</legend><div>${[1,2,3,4,5].map(score=>`<label><input type="radio" name="${escape(student.id)}-${key}" value="${score}" ${saved?.ratings[key]===score?'checked':''} aria-label="${label}: ${score} out of 5"><span aria-hidden="true">★</span><small>${score}</small></label>`).join('')}</div></fieldset>`).join('')}</div><details><summary>Optional parent note</summary><label for="feedback-parent-${index}">Your question or comment for this student’s parent</label><textarea id="feedback-parent-${index}" data-parent-note rows="2" maxlength="1500" placeholder="Optional. Visible only to this student’s parents.">${escape(saved?.parentNote || '')}</textarea></details></section>`;
  }).join('') || '<p>Add students to the class roster before publishing feedback.</p>';}
  function updateAvailability(){
    clearTimeout(timer);if(!data || !dialog.open)return;
    const now=data.serverNow+(performance.now()-data.loadedAt),start=data.startsAt??data.endsAt;
    const wait=data.session?0:start===null?Infinity:start-now,endWait=data.session?(data.session.phase==='ended'?0:Infinity):data.endsAt===null?Infinity:data.endsAt-now;
    const blocked=busy||data.busy||wait>0;
    $('[data-feedback-save]').disabled=blocked;
    $('[data-feedback-publish-assessment]').disabled=blocked||!data.roster.length;
    $('button[type=submit]').disabled=busy||data.busy||endWait>0||!data.aiAvailable||!data.roster.length;
    $('[data-feedback-correct]').disabled=busy||data.busy||endWait>0;
    const waits=[wait,endWait].filter(n=>n>0&&Number.isFinite(n));
    if(waits.length)timer=setTimeout(()=>{updateAvailability();if(!busy)status('Student assessments are available from the start of class. Transcript recaps are available after class.');},Math.min(Math.min(...waits)+20,2147483647));
  }
  function selectTab(tab){activeTab=tab;for(const button of dialog.querySelectorAll('[data-feedback-tab]')){const selected=button.dataset.feedbackTab===tab;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;document.getElementById(button.getAttribute('aria-controls')).hidden=!selected;}}
  for(const button of dialog.querySelectorAll('[data-feedback-tab]')){button.onclick=()=>selectTab(button.dataset.feedbackTab);button.onkeydown=event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();const next=dialog.querySelector('[data-feedback-tab="'+(activeTab==='assessment'?'transcript':'assessment')+'"]');selectTab(next.dataset.feedbackTab);next.focus();}};}

  function showPublished(){
    const report=data.published;$('[data-feedback-published]').hidden=!report;if(!report)return;
    dialog.querySelector('.feedback-corrections').hidden=!report.summary;$('#feedback-correct-summary').value=report.summary||'';$('#feedback-correct-homework').value=report.homework ?? data.lesson.homework;
    const select=$('#feedback-preview-student'),selected=select.value;select.innerHTML=data.roster.map(s=>`<option value="${escape(s.id)}">${escape(s.name)}</option>`).join('');if([...select.options].some(o=>o.value===selected))select.value=selected;
    $('[data-feedback-correct-students]').innerHTML=data.roster.map((student,i)=>`<section data-correct-student="${escape(student.id)}"><h4>${escape(student.name)}</h4><label for="correct-quote-${i}">Student quote (optional)</label><textarea id="correct-quote-${i}" data-correct-quote maxlength="500" rows="2">${escape(report.students[student.id]?.quote || '')}</textarea><label for="correct-parent-${i}">Parent-only question or comment (optional)</label><textarea id="correct-parent-${i}" data-correct-parent maxlength="1500" rows="2">${escape(report.students[student.id]?.parentComment || '')}</textarea></section>`).join('');
    preview();
  }
  function preview(){if(data.published)renderLessonReport($('[data-feedback-preview]'),data.published,data.published.homework ?? data.lesson.homework,data.published.students[$('#feedback-preview-student').value],{parent:true});}
  $('#feedback-preview-student').onchange=preview;
  function close(){if(busy)return;if(dirty && !confirm('Close without saving your latest ratings?'))return;dialog.close();}
  $('.teacher-close').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('close',()=>{epoch++;clearTimeout(timer);data=null;dirty=false;form.reset();$('[data-feedback-roster]').replaceChildren();$('[data-feedback-preview]').replaceChildren();trigger?.focus();if(publishedChange){publishedChange=false;document.dispatchEvent(new CustomEvent('inkwire:feedback-published',{detail:{classId:activeClassId,lessonId:activeLessonId}}));}});
  form.addEventListener('input',event=>{if(event.target.id==='feedback-preview-student')return;dirty=true;attemptId='';const row=event.target.closest('[data-feedback-student]');if(row && event.target.matches('[data-attendance]'))for(const field of row.querySelectorAll('fieldset'))field.disabled=event.target.value==='absent';});
  async function submit(action){
    if(busy || !data)return;busy=true;setError();const version=epoch;let draft;
    try{
      draft=validateAssessment(readDraft(),data.roster,false);
      const body={action,draft,revision:data.revision,courseRevision:data.courseRevision};if(action==='publish-assessment')body.requestId=attemptId ||= requestId();
      if(action==='publish'){
        const file=$('#feedback-transcript').files[0];if(!file || file.size<30 || file.size>524288)throw Error('Choose a transcript between 30 bytes and 512 KiB.');
        if(!draft.assessments.length)throw Error('Add students to the class before publishing feedback.');
        const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(Error('Could not read this file.'));reader.readAsDataURL(file);});
        Object.assign(body,{draftNextQuiz:$('[data-next-quiz]').checked && Boolean(data.nextQuizLesson),filename:file.name,fileData:'data:text/plain;base64,'+encoded,requestId:attemptId ||= requestId()});
      }
      if(action==='correct')Object.assign(body,{summary:$('#feedback-correct-summary').value,homework:$('#feedback-correct-homework').value,extras:[...dialog.querySelectorAll('[data-correct-student]')].map(row=>({learnerId:row.dataset.correctStudent,quote:row.querySelector('[data-correct-quote]').value,parentComment:row.querySelector('[data-correct-parent]').value}))});
      if(version!==epoch)return;busy=true;const controls=[...form.querySelectorAll('input,select,textarea,button')],disabled=controls.map(el=>el.disabled);controls.forEach(el=>el.disabled=true);$('.teacher-close').disabled=true;
      status(action==='publish'?'Creating and publishing the lesson report… This may take up to 90 seconds.':'Saving…');
      try{
        const result=await api(route,body,{timeoutMs:110000});if(version!==epoch)return;
        Object.assign(data,result);dirty=false;showPublished();status(action==='save'?'Assessment draft saved. Students and parents cannot see this draft.':'Published to the connected student and parent dashboards.'+(result.nextQuiz?' '+result.nextQuiz.message:''));
        if(action!=='save'){publishedChange=true;$('[data-feedback-published]').scrollIntoView({block:'start'});}
      }catch(error){
        if(version!==epoch)return;
        // Recover the server revision after a provider failure or lost response.
        // Never advance past someone else’s edits silently.
        try{const current=await api(route);if(JSON.stringify(current.draft)===JSON.stringify(draft)){Object.assign(data,current,{loadedAt:performance.now()});if((action==='publish-assessment'?current.published?.assessmentRequestToken:current.published?.requestToken)===attemptId){dirty=false;publishedChange=true;showPublished();status('Published to the connected student and parent dashboards.');return;}}}catch{}
        setError(error.message);status(data.busy?'A report is still being generated. Close and reopen shortly to check the result.':'Your form is still here. Resolve the problem and try again.');
      }finally{if(version===epoch){busy=false;controls.forEach((el,i)=>el.disabled=disabled[i]);$('.teacher-close').disabled=false;updateAvailability();}}
    }catch(error){setError(error.message);}
    finally{if(version===epoch){busy=false;updateAvailability();}}
  }
  form.onsubmit=event=>{event.preventDefault();submit('publish');};$('[data-feedback-save]').onclick=()=>submit('save');$('[data-feedback-publish-assessment]').onclick=()=>submit('publish-assessment');$('[data-feedback-correct]').onclick=()=>submit('correct');
  window.addEventListener('beforeunload',event=>{if(dialog.open && (dirty || busy)){event.preventDefault();event.returnValue='';}});
  return sharedFeedback={async open(classId,lessonId,button,options={}){
    trigger=button;activeClassId=classId;activeLessonId=lessonId;publishedChange=false;const version=++epoch;route=`/api/lesson-feedback/classes/${classId}/lessons/${lessonId}`;data=null;dirty=false;attemptId='';form.hidden=true;selectTab(options.tab||'assessment');setError();status('Loading lesson feedback…');dialog.showModal();
    try{
      const result=await api(route);if(version!==epoch)return;data={...result,loadedAt:performance.now()};
      $('[data-feedback-lesson]').textContent=data.lesson.title;
      $('[data-next-quiz-option]').hidden=!data.nextQuizLesson;$('[data-next-quiz-hint]').hidden=!data.nextQuizLesson;$('[data-next-quiz]').checked=true;
      if(data.nextQuizLesson)$('[data-next-quiz-hint]').textContent='Next lesson: '+data.nextQuizLesson.title+'. Questions use this transcript and the next lesson’s topic. Review the draft on the timeline before assigning it.';
      const speakers=new Map((data.draft?.assessments||[]).map(a=>[a.learnerId,a.speaker]));$('[data-feedback-speakers]').innerHTML=data.roster.map((student,index)=>`<label for="feedback-speaker-${index}">${escape(student.name)}<input id="feedback-speaker-${index}" data-speaker-for="${escape(student.id)}" maxlength="80" value="${escape(speakers.get(student.id)||'')}" placeholder="Exact label, or leave blank"></label>`).join('');$('[data-feedback-roster]').innerHTML=rosterHTML();$('#feedback-teacher-speaker').value=data.draft?.teacherSpeaker || '';form.hidden=false;showPublished();updateAvailability();
      status(data.busy?'A report is being generated. Reopen shortly to see it.':(data.startsAt??data.endsAt)===null?'Set and save a lesson date and time first.':data.serverNow<(data.startsAt??data.endsAt)?'Student assessment opens at the start of class.':data.published?'Published feedback is available below. You can update student assessments independently.':'Record observations now. Save privately or publish without a transcript.');
    }catch(error){setError(error.message);status('Close and reopen to try again.');}
  }};
}
