import {api,escape,requestId} from './workspace-shared.js';
import {ratingFields,validateAssessment} from './lesson-feedback-model.mjs';
import {renderLessonReport} from './lesson-feedback-view.js';

let sharedFeedback;
export function createLessonFeedback() {
  if(sharedFeedback)return sharedFeedback;
  const dialog=document.createElement('dialog');dialog.className='lesson-feedback';dialog.setAttribute('aria-labelledby','lesson-feedback-title');
  dialog.innerHTML=`<button type="button" class="teacher-close" aria-label="Close Summary & Feedback">×</button><p class="teacher-eyebrow">AFTER CLASS</p><h2 id="lesson-feedback-title">Summary &amp; Feedback</h2><p data-feedback-lesson></p><p data-feedback-status role="status" aria-live="polite"></p><p data-feedback-error role="alert" hidden></p><form hidden><div data-feedback-roster></div><section class="feedback-upload"><h3>Lesson transcript</h3><label for="feedback-teacher-speaker">Your speaker label in the transcript <span>(optional)</span></label><input id="feedback-teacher-speaker" maxlength="80" placeholder="For example: Matthew"><p class="planner-hint">Use the exact label to identify your homework instructions and comments for parents. Leave it blank if speakers are unclear; the saved homework will stay in place.</p><label for="feedback-transcript">Upload transcript (.txt or .vtt, up to 512 KiB)</label><input id="feedback-transcript" type="file" accept=".txt,.vtt,text/plain,text/vtt"><p>The full transcript and the speaker labels you enter are sent to OpenAI. The transcript is not stored in Ink Wire. Your ratings are saved exactly as entered.</p></section><div class="teacher-actions"><button type="button" class="teacher-button secondary" data-feedback-save>Save ratings draft</button><button type="submit" class="teacher-button">Generate &amp; publish feedback</button></div><p class="planner-hint">Publishes the recap, each student’s own assessment and any explicit homework update to their connected student and parent dashboards. Optional parent comments appear only to that student’s parents.</p><section data-feedback-published hidden><h3>Published lesson report</h3><label for="feedback-preview-student">Preview a student’s report</label><select id="feedback-preview-student"></select><div data-feedback-preview></div><details class="feedback-corrections"><summary>Correct the published summary or homework</summary><label for="feedback-correct-summary">Shared class summary</label><textarea id="feedback-correct-summary" rows="12" maxlength="14000"></textarea><label for="feedback-correct-homework">Homework</label><textarea id="feedback-correct-homework" rows="4" maxlength="4000"></textarea><div data-feedback-correct-students></div><p>Corrections publish the ratings above and the quotes and parent notes in this section. No new AI request is made.</p><button type="button" class="teacher-button secondary" data-feedback-correct>Publish corrections</button></details></section></form>`;
  document.body.append(dialog);const $=selector=>dialog.querySelector(selector),form=$('form');
  let route='',data=null,trigger=null,busy=false,dirty=false,epoch=0,attemptId='',timer;
  function setError(message=''){$('[data-feedback-error]').textContent=message;$('[data-feedback-error]').hidden=!message;}
  function readDraft(){return {teacherSpeaker:$('#feedback-teacher-speaker').value,assessments:[...dialog.querySelectorAll('[data-feedback-student]')].map(row=>({learnerId:row.dataset.feedbackStudent,attendance:row.querySelector('[data-attendance]').value,speaker:row.querySelector('[data-speaker]').value,parentNote:row.querySelector('[data-parent-note]').value,ratings:Object.fromEntries(Object.keys(ratingFields).map(key=>[key,Number(row.querySelector(`input[name="${row.dataset.feedbackStudent}-${key}"]:checked`)?.value) || null]))}))};}
  function status(text){$('[data-feedback-status]').textContent=text;}
  function rosterHTML(){return data.roster.map((student,index)=>{
    const saved=data.draft?.assessments.find(a=>a.learnerId===student.id);
    return `<section class="feedback-student" data-feedback-student="${escape(student.id)}"><div class="feedback-student-heading"><h3>${escape(student.name)}</h3><label>Attendance<select data-attendance><option value="present">Present</option><option value="absent" ${saved?.attendance==='absent'?'selected':''}>Absent</option></select></label></div><div class="feedback-ratings">${Object.entries(ratingFields).map(([key,label])=>`<fieldset class="star-rating" ${saved?.attendance==='absent'?'disabled':''}><legend>${label}</legend><div>${[1,2,3,4,5].map(score=>`<label><input type="radio" name="${escape(student.id)}-${key}" value="${score}" ${saved?.ratings[key]===score?'checked':''} aria-label="${label}: ${score} out of 5"><span aria-hidden="true">★</span><small>${score}</small></label>`).join('')}</div></fieldset>`).join('')}</div><details><summary>Optional quote &amp; parent note</summary><label for="feedback-speaker-${index}">Student’s exact transcript speaker label</label><input id="feedback-speaker-${index}" data-speaker maxlength="80" value="${escape(saved?.speaker || '')}" placeholder="Leave blank if unsure"><p class="planner-hint">A quote is included only when this speaker has a clear, relevant contribution.</p><label for="feedback-parent-${index}">Your question or comment for this student’s parent</label><textarea id="feedback-parent-${index}" data-parent-note rows="2" maxlength="1500" placeholder="Optional. Visible only to this student’s parents.">${escape(saved?.parentNote || '')}</textarea></details></section>`;
  }).join('') || '<p>Add students to the class roster before publishing feedback.</p>';}
  function updateAvailability(){
    clearTimeout(timer);if(!data || !dialog.open)return;
    const wait=data.endsAt===null?Infinity:data.endsAt-(data.serverNow+(performance.now()-data.loadedAt));
    const blocked=busy || data.busy || wait>0;
    $('[data-feedback-save]').disabled=blocked;
    $('button[type=submit]').disabled=blocked || !data.aiAvailable || !data.roster.length;
    $('[data-feedback-correct]').disabled=blocked;
    if(wait>0 && Number.isFinite(wait))timer=setTimeout(()=>{updateAvailability();if(!busy)status('This lesson has ended. Complete the ratings and upload the transcript.');},Math.min(wait+20,2147483647));
  }
  function showPublished(){
    const report=data.published;$('[data-feedback-published]').hidden=!report;if(!report)return;
    $('#feedback-correct-summary').value=report.summary;$('#feedback-correct-homework').value=report.homework ?? data.lesson.homework;
    const select=$('#feedback-preview-student'),selected=select.value;select.innerHTML=data.roster.map(s=>`<option value="${escape(s.id)}">${escape(s.name)}</option>`).join('');if([...select.options].some(o=>o.value===selected))select.value=selected;
    $('[data-feedback-correct-students]').innerHTML=data.roster.map((student,i)=>`<section data-correct-student="${escape(student.id)}"><h4>${escape(student.name)}</h4><label for="correct-quote-${i}">Student quote (optional)</label><textarea id="correct-quote-${i}" data-correct-quote maxlength="500" rows="2">${escape(report.students[student.id]?.quote || '')}</textarea><label for="correct-parent-${i}">Parent-only question or comment (optional)</label><textarea id="correct-parent-${i}" data-correct-parent maxlength="1500" rows="2">${escape(report.students[student.id]?.parentComment || '')}</textarea></section>`).join('');
    preview();
  }
  function preview(){if(data.published)renderLessonReport($('[data-feedback-preview]'),data.published,data.published.homework ?? data.lesson.homework,data.published.students[$('#feedback-preview-student').value],{parent:true});}
  $('#feedback-preview-student').onchange=preview;
  function close(){if(busy)return;if(dirty && !confirm('Close without saving your latest ratings?'))return;dialog.close();}
  $('.teacher-close').onclick=close;dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.addEventListener('close',()=>{epoch++;clearTimeout(timer);data=null;dirty=false;form.reset();$('[data-feedback-roster]').replaceChildren();$('[data-feedback-preview]').replaceChildren();trigger?.focus();});
  form.addEventListener('input',event=>{if(event.target.id==='feedback-preview-student')return;dirty=true;attemptId='';const row=event.target.closest('[data-feedback-student]');if(row && event.target.matches('[data-attendance]'))for(const field of row.querySelectorAll('fieldset'))field.disabled=event.target.value==='absent';});
  async function submit(action){
    if(busy || !data)return;busy=true;setError();const version=epoch;let draft;
    try{
      draft=validateAssessment(readDraft(),data.roster,action!=='save');
      const body={action,draft,revision:data.revision,courseRevision:data.courseRevision};
      if(action==='publish'){
        const file=$('#feedback-transcript').files[0];if(!file || file.size<30 || file.size>524288)throw Error('Choose a transcript between 30 bytes and 512 KiB.');
        if(!draft.assessments.length)throw Error('Add students to the class before publishing feedback.');
        const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(Error('Could not read this file.'));reader.readAsDataURL(file);});
        Object.assign(body,{filename:file.name,fileData:'data:text/plain;base64,'+encoded,requestId:attemptId ||= requestId()});
      }
      if(action==='correct')Object.assign(body,{summary:$('#feedback-correct-summary').value,homework:$('#feedback-correct-homework').value,extras:[...dialog.querySelectorAll('[data-correct-student]')].map(row=>({learnerId:row.dataset.correctStudent,quote:row.querySelector('[data-correct-quote]').value,parentComment:row.querySelector('[data-correct-parent]').value}))});
      if(version!==epoch)return;busy=true;const controls=[...form.querySelectorAll('input,select,textarea,button')],disabled=controls.map(el=>el.disabled);controls.forEach(el=>el.disabled=true);$('.teacher-close').disabled=true;
      status(action==='publish'?'Creating and publishing the lesson report… This may take up to 90 seconds.':'Saving…');
      try{
        const result=await api(route,body,{timeoutMs:110000});if(version!==epoch)return;
        Object.assign(data,result);dirty=false;showPublished();status(action==='save'?'Ratings draft saved. Students and parents cannot see this draft.':'Published to the connected student and parent dashboards.');
        if(action!=='save')$('[data-feedback-published]').scrollIntoView({block:'start'});
      }catch(error){
        if(version!==epoch)return;
        // Recover the server revision after a provider failure or lost response.
        // Never advance past someone else’s edits silently.
        try{const current=await api(route);if(JSON.stringify(current.draft)===JSON.stringify(draft)){Object.assign(data,current,{loadedAt:performance.now()});if(current.published?.requestToken===attemptId){dirty=false;showPublished();status('Published to the connected student and parent dashboards.');return;}}}catch{}
        setError(error.message);status(data.busy?'A report is still being generated. Close and reopen shortly to check the result.':'Your form is still here. Resolve the problem and try again.');
      }finally{if(version===epoch){busy=false;controls.forEach((el,i)=>el.disabled=disabled[i]);$('.teacher-close').disabled=false;updateAvailability();}}
    }catch(error){setError(error.message);}
    finally{if(version===epoch){busy=false;updateAvailability();}}
  }
  form.onsubmit=event=>{event.preventDefault();submit('publish');};$('[data-feedback-save]').onclick=()=>submit('save');$('[data-feedback-correct]').onclick=()=>submit('correct');
  window.addEventListener('beforeunload',event=>{if(dialog.open && (dirty || busy)){event.preventDefault();event.returnValue='';}});
  return sharedFeedback={async open(classId,lessonId,button){
    trigger=button;const version=++epoch;route=`/api/lesson-feedback/classes/${classId}/lessons/${lessonId}`;data=null;dirty=false;attemptId='';form.hidden=true;setError();status('Loading lesson feedback…');dialog.showModal();
    try{
      const result=await api(route);if(version!==epoch)return;data={...result,loadedAt:performance.now()};
      $('[data-feedback-lesson]').textContent=data.lesson.title;
      $('[data-feedback-roster]').innerHTML=rosterHTML();$('#feedback-teacher-speaker').value=data.draft?.teacherSpeaker || '';form.hidden=false;showPublished();updateAvailability();
      status(data.busy?'A report is being generated. Reopen shortly to see it.':data.endsAt===null?'Set and save a lesson date and time in the course overview first.':data.serverNow<data.endsAt?'Available after '+new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:data.timeZone}).format(data.endsAt)+' · '+data.timeZone:data.published?'This lesson report is published. You can correct it below.':'Complete the ratings, then upload the transcript.');
    }catch(error){setError(error.message);status('Close and reopen to try again.');}
  }};
}
