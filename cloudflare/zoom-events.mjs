import {zoomConfigured} from './zoom-connection.mjs';
import {readLessonSession} from './lesson-session-state.mjs';
import {generateLessonFeedback} from './lesson-feedback-ai.mjs';
import {planningAvailable,reserveRequest} from './planning-assistant.mjs';
import {zoomURL} from '../dist/zoom-model.mjs';
import {nextQuizLesson,quizContext,saveQuizDraft} from './quiz-assistant.mjs';
import {lessonStart} from '../dist/lesson-feedback-model.mjs';
import {findZoomOccurrence,zoomOccurrence} from './zoom-occurrences.mjs';
import {boundedText,fetchZoomTranscript} from './zoom-transcripts.mjs';
const encoder=new TextEncoder();
export async function zoomHMAC(secret,message){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(message)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
function equal(a,b){if(a.length!==b.length)return false;let result=0;for(let i=0;i<a.length;i++)result|=a.charCodeAt(i)^b.charCodeAt(i);return result===0;}
export async function handleZoomWebhook(request,env){
 if(!zoomConfigured(env)||!env.ZOOM_WEBHOOK_SECRET)return json({message:'Zoom webhook is not configured.'},503);
 if(request.method!=='POST')return json({message:'Use POST.'},405);
 try{
  const timestamp=request.headers.get('x-zm-request-timestamp')||'',signature=request.headers.get('x-zm-signature')||'';
  if(!/^\d{10}$/.test(timestamp)||Math.abs(Date.now()/1000-Number(timestamp))>300)return json({message:'Invalid Zoom signature.'},401);
  const raw=await boundedText(request,131072),expected='v0='+await zoomHMAC(env.ZOOM_WEBHOOK_SECRET,'v0:'+timestamp+':'+raw);if(!equal(signature,expected))return json({message:'Invalid Zoom signature.'},401);const event=JSON.parse(raw);
  if(event.event==='endpoint.url_validation'){
   const plainToken=event.payload?.plainToken;if(typeof plainToken!=='string'||plainToken.length>1024)return json({message:'Invalid challenge.'},400);return json({plainToken,encryptedToken:await zoomHMAC(env.ZOOM_WEBHOOK_SECRET,plainToken)});
  }
  if(!['meeting.started','meeting.ended','recording.completed','recording.transcript_completed','meeting.aic_transcript_completed'].includes(event.event))return new Response(null,{status:204});
  const occurrence=zoomOccurrence(event);if(!occurrence)return json({message:'Invalid meeting event.'},400);
  const row=await findZoomOccurrence(env,event);if(!row)return new Response(null,{status:204});
  const object={...event.payload.object,uuid:occurrence.uuid};
  if(event.event==='meeting.started')await env.DB.prepare("UPDATE zoom_lessons SET meeting_state='live' WHERE class_id=? AND lesson_id=? AND meeting_uuid=? AND meeting_state='scheduled'").bind(row.class_id,row.lesson_id,object.uuid).run();
  if(event.event==='meeting.ended')await env.DB.prepare("UPDATE zoom_lessons SET meeting_state='ended' WHERE class_id=? AND lesson_id=? AND meeting_uuid=?").bind(row.class_id,row.lesson_id,object.uuid).run();
  if(event.event==='recording.completed'){
   let share='';try{share=zoomURL(object.share_url||'',{recording:true});}catch{}if(share)await env.DB.prepare('UPDATE zoom_lessons SET recording_url=? WHERE class_id=? AND lesson_id=? AND meeting_uuid=?').bind(share,row.class_id,row.lesson_id,object.uuid).run();
  }
  const transcriptEvent=['recording.transcript_completed','meeting.aic_transcript_completed'].includes(event.event);
  if(row.auto_recap&&(transcriptEvent||event.event==='meeting.ended')){
   // Retained transcripts do not require a cloud recording event. Check after
   // meeting.ended too, and wait for the teacher's explicit End lesson state.
   await env.DB.prepare('INSERT OR IGNORE INTO zoom_recap_jobs(class_id,lesson_id,meeting_uuid,available_at) VALUES(?,?,?,?)').bind(row.class_id,row.lesson_id,object.uuid,Date.now()+(transcriptEvent?0:300000)).run();
   if(transcriptEvent)await env.DB.prepare("UPDATE zoom_recap_jobs SET status='pending',attempts=0,available_at=? WHERE class_id=? AND lesson_id=? AND meeting_uuid=? AND status!='done' AND lease_until<=?").bind(Date.now(),row.class_id,row.lesson_id,object.uuid,Date.now()).run();
  }
  // Persist before acknowledging; AI never runs in Zoom's short webhook window.
  return new Response(null,{status:204});
 }catch{return json({message:'The Zoom event could not be accepted. Zoom may retry.'},400);}
}
async function quizTarget(env,job,meeting,course){
 if(!meeting.auto_quiz)return {status:'off'};
 if(meeting.quiz_status!=='waiting')return {status:meeting.quiz_status,targetId:meeting.next_quiz_lesson_id};
 const next=nextQuizLesson(course,job.lesson_id);if(!next)return {status:'no_next_lesson'};
 const targetId=next.id,starts=lessonStart(course,next.lesson),session=(await readLessonSession(env,job.class_id,targetId))?.value;
 if(!Number.isFinite(starts)||starts<=Date.now()||['running','ending','ended'].includes(session?.phase))return {status:'no_upcoming_lesson',targetId};
 const existing=await env.DB.prepare('SELECT 1 AS found FROM lesson_quizzes WHERE class_id=? AND lesson_id=? UNION ALL SELECT 1 FROM quiz_drafts WHERE class_id=? AND lesson_id=? UNION ALL SELECT 1 FROM quiz_attempts WHERE class_id=? AND lesson_id=? LIMIT 1').bind(job.class_id,targetId,job.class_id,targetId,job.class_id,targetId).first();
 return existing?{status:'kept_existing',targetId}:{status:'waiting',targetId,lesson:next.lesson};
}
export async function processZoomRecaps(env){
 if(!zoomConfigured(env)||!planningAvailable(env))return;
 const jobs=(await env.DB.prepare("SELECT * FROM zoom_recap_jobs WHERE status='pending' AND available_at<=? AND lease_until<=? ORDER BY available_at LIMIT 1").bind(Date.now(),Date.now()).all()).results;
 for(const job of jobs){
  const key=[job.class_id,job.lesson_id,job.meeting_uuid],lease=Date.now()+600000;
  const claimed=await env.DB.prepare("UPDATE zoom_recap_jobs SET lease_until=?,attempts=attempts+1 WHERE class_id=? AND lesson_id=? AND meeting_uuid=? AND status='pending' AND lease_until<=? RETURNING attempts").bind(lease,...key,Date.now()).first();if(!claimed)continue;
  const done=()=>env.DB.prepare("UPDATE zoom_recap_jobs SET status='done',lease_until=0 WHERE class_id=? AND lesson_id=? AND meeting_uuid=? AND lease_until=?").bind(...key,lease).run();
  try{
   const meeting=await env.DB.prepare('SELECT z.*,c.zoom_user_id,c.account_id FROM zoom_lessons z JOIN zoom_connections c ON c.user_id=z.connection_user_id WHERE z.class_id=? AND z.lesson_id=?').bind(job.class_id,job.lesson_id).first();
   if(!meeting||!meeting.auto_recap||meeting.meeting_uuid!==job.meeting_uuid)throw Error('Meeting changed.');
   if(meeting.recap_status==='ready'&&(!meeting.auto_quiz||meeting.quiz_status!=='waiting')){await done();continue;}
   const courseRow=await env.DB.prepare('SELECT o.content,o.revision FROM course_overviews o JOIN classes c ON c.id=o.class_id WHERE o.class_id=? AND c.deleted_at IS NULL AND (c.owner_id=? OR EXISTS(SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?))').bind(job.class_id,meeting.connection_user_id,meeting.connection_user_id).first();
   const course=courseRow?JSON.parse(courseRow.content):null,lesson=course?.lessons?.find((l,i)=>(l.id||'legacy-'+(i+1))===job.lesson_id);if(!lesson||lesson.status==='cancelled')throw Error('Course or host access changed.');
   const session=(await readLessonSession(env,job.class_id,job.lesson_id))?.value;
   if(session?.phase!=='ended'){
    await env.DB.prepare('UPDATE zoom_recap_jobs SET attempts=attempts-1,available_at=?,lease_until=0 WHERE class_id=? AND lesson_id=? AND meeting_uuid=? AND lease_until=?').bind(Date.now()+300000,...key,lease).run();continue;
   }
   const next=await quizTarget(env,job,meeting,course);let result=null,transcript=null;
   if(meeting.recap_status!=='ready'||next.status==='waiting'){
    transcript=await fetchZoomTranscript(env,meeting);
    if(!await reserveRequest(env,meeting.connection_user_id))throw Error('AI request limit reached.');
    let binary='';for(const byte of encoder.encode(transcript.text))binary+=String.fromCharCode(byte);
    const roster=(await env.DB.prepare('SELECT l.id,l.display_name AS name FROM learners l JOIN class_students s ON s.learner_id=l.id WHERE s.class_id=?').bind(job.class_id).all()).results;
    result=await generateLessonFeedback(env,{filename:'zoom-lesson.vtt',fileData:'data:text/plain;base64,'+btoa(binary)},{teacherSpeaker:'',assessments:[]},roster,lesson,next.status==='waiting'?quizContext(course,next.lesson):null);
   }
   const latestCourse=await env.DB.prepare('SELECT content,revision FROM course_overviews WHERE class_id=?').bind(job.class_id).first();if(latestCourse?.content!==courseRow.content||latestCourse.revision!==courseRow.revision)throw Error('Course changed during processing.');
   if(next.status==='waiting'){
    if(!result.nextQuiz)next.status='needs_attention';
    else{
     // Recheck after AI latency. Never overwrite a draft, assigned quiz or
     // attempt. Revoking the option or changing Zoom accounts wins this race.
     const still=await quizTarget(env,job,meeting,course);
     if(still.status!=='waiting')next.status=still.status;
     else next.status=await saveQuizDraft(env,{id:meeting.connection_user_id},job.class_id,next.targetId,courseRow.revision,0,-1,result.nextQuiz,'Zoom class transcript',{lessonId:job.lesson_id,uuid:job.meeting_uuid,revision:meeting.revision,host:meeting.zoom_user_id,account:meeting.account_id})?'draft_ready':'kept_existing';
    }
   }
   // Only derived results are stored. A shared recap cannot overwrite teacher
   // corrections, grades, behaviour feedback or assigned homework.
   const saved=await env.DB.prepare(`UPDATE zoom_lessons SET recap_summary=CASE WHEN recap_status='ready' THEN recap_summary ELSE ? END,
    recap_status='ready',recap_updated_at=CASE WHEN recap_status='ready' THEN recap_updated_at ELSE ? END,
    quiz_status=?,next_quiz_lesson_id=?,transcript_source=CASE WHEN ?='' THEN transcript_source ELSE ? END,
    recording_url=CASE WHEN ?='' THEN recording_url ELSE ? END,revision=revision+1
    WHERE class_id=? AND lesson_id=? AND meeting_uuid=? AND revision=? AND auto_recap=1
    AND EXISTS(SELECT 1 FROM zoom_connections c WHERE c.user_id=zoom_lessons.connection_user_id AND c.zoom_user_id=? AND c.account_id=?)
    AND EXISTS(SELECT 1 FROM classes c WHERE c.id=zoom_lessons.class_id AND c.deleted_at IS NULL AND (c.owner_id=zoom_lessons.connection_user_id OR EXISTS(SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=zoom_lessons.connection_user_id))) RETURNING revision`)
    .bind(result?.summary||meeting.recap_summary,Date.now(),next.status,next.targetId||null,transcript?.source||'',transcript?.source||'',transcript?.recordingURL||'',transcript?.recordingURL||'',...key,meeting.revision,meeting.zoom_user_id,meeting.account_id).first();
   if(!saved)throw Error('Meeting recap changed during processing.');await done();
  }catch{
   const failed=claimed.attempts>=12;
   await env.DB.prepare('UPDATE zoom_recap_jobs SET status=?,available_at=?,lease_until=0 WHERE class_id=? AND lesson_id=? AND meeting_uuid=? AND lease_until=?').bind(failed?'failed':'pending',Date.now()+Math.min(3600000,60000*2**Math.min(claimed.attempts,6)),...key,lease).run();
   if(failed)await env.DB.prepare("UPDATE zoom_lessons SET recap_status=CASE WHEN recap_status='ready' THEN recap_status ELSE 'needs_attention' END,quiz_status=CASE WHEN quiz_status='waiting' THEN 'needs_attention' ELSE quiz_status END WHERE class_id=? AND lesson_id=? AND meeting_uuid=? AND auto_recap=1").bind(...key).run();
  }
 }
}
