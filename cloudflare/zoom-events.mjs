import {zoomConfigured,zoomAPI} from './zoom-connection.mjs';
import {readLessonSession} from './lesson-session-state.mjs';
import {generateLessonFeedback} from './lesson-feedback-ai.mjs';
import {planningAvailable,reserveRequest} from './planning-assistant.mjs';
import {zoomURL} from '../dist/zoom-model.mjs';
const encoder=new TextEncoder();
export async function zoomHMAC(secret,message){const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await crypto.subtle.sign('HMAC',key,encoder.encode(message)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
async function bodyText(request,max){const reader=request.body?.getReader();if(!reader)throw Error();const parts=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max){await reader.cancel();throw Error();}parts.push(value);}const bytes=new Uint8Array(size);let at=0;for(const part of parts){bytes.set(part,at);at+=part.length;}return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
function equal(a,b){if(a.length!==b.length)return false;let result=0;for(let i=0;i<a.length;i++)result|=a.charCodeAt(i)^b.charCodeAt(i);return result===0;}
export async function handleZoomWebhook(request,env){
 if(!zoomConfigured(env)||!env.ZOOM_WEBHOOK_SECRET)return json({message:'Zoom webhook is not configured.'},503);
 if(request.method!=='POST')return json({message:'Use POST.'},405);
 try{
  const timestamp=request.headers.get('x-zm-request-timestamp')||'',signature=request.headers.get('x-zm-signature')||'';
  if(!/^\d{10}$/.test(timestamp)||Math.abs(Date.now()/1000-Number(timestamp))>300)return json({message:'Invalid Zoom signature.'},401);
  const raw=await bodyText(request,131072),expected='v0='+await zoomHMAC(env.ZOOM_WEBHOOK_SECRET,'v0:'+timestamp+':'+raw);if(!equal(signature,expected))return json({message:'Invalid Zoom signature.'},401);const event=JSON.parse(raw);
  if(event.event==='endpoint.url_validation'){
   const plainToken=event.payload?.plainToken;if(typeof plainToken!=='string'||plainToken.length>1024)return json({message:'Invalid challenge.'},400);return json({plainToken,encryptedToken:await zoomHMAC(env.ZOOM_WEBHOOK_SECRET,plainToken)});
  }
  if(!['meeting.started','meeting.ended','recording.completed','recording.transcript_completed'].includes(event.event))return new Response(null,{status:204});
  const object=event.payload?.object;if(!object||!/^\d{9,11}$/.test(String(object.id))||typeof object.uuid!=='string'||object.uuid.length>200)return json({message:'Invalid meeting event.'},400);
  const row=await env.DB.prepare('SELECT z.*,c.zoom_user_id,c.account_id FROM zoom_lessons z JOIN zoom_connections c ON c.user_id=z.connection_user_id WHERE z.meeting_id=?').bind(String(object.id)).first();
  if(!row||object.host_id!==row.zoom_user_id||event.payload.account_id!==row.account_id||object.uuid!==row.meeting_uuid)return new Response(null,{status:204});
  if(event.event==='meeting.started')await env.DB.prepare("UPDATE zoom_lessons SET meeting_state='live' WHERE class_id=? AND lesson_id=? AND meeting_uuid=? AND meeting_state='scheduled'").bind(row.class_id,row.lesson_id,object.uuid).run();
  if(event.event==='meeting.ended')await env.DB.prepare("UPDATE zoom_lessons SET meeting_state='ended' WHERE class_id=? AND lesson_id=? AND meeting_uuid=?").bind(row.class_id,row.lesson_id,object.uuid).run();
  if(event.event==='recording.completed'){
   let share='';try{share=zoomURL(object.share_url||'',{recording:true});}catch{}if(share)await env.DB.prepare('UPDATE zoom_lessons SET recording_url=? WHERE class_id=? AND lesson_id=? AND meeting_uuid=?').bind(share,row.class_id,row.lesson_id,object.uuid).run();
  }
  if(event.event==='recording.transcript_completed'&&row.auto_recap){
   await env.DB.prepare('INSERT OR IGNORE INTO zoom_recap_jobs(class_id,lesson_id,meeting_uuid,available_at) VALUES(?,?,?,?)').bind(row.class_id,row.lesson_id,object.uuid,Date.now()).run();
  }
  // Persist before acknowledging; AI never runs in Zoom's short webhook window.
  return new Response(null,{status:204});
 }catch{return json({message:'The Zoom event could not be accepted. Zoom may retry.'},400);}
}
function encodedMeetingUUID(uuid){const encoded=encodeURIComponent(uuid);return uuid.startsWith('/')||uuid.includes('//')?encodeURIComponent(encoded):encoded;}
async function downloadTranscript(url,token){
 const target=new URL(url);if(target.protocol!=='https:'||target.username||target.password||target.port||!/(^|\.)zoom\.(us|com)$/.test(target.hostname))throw Error('Invalid transcript download host.');
 const response=await fetch(target.href,{redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+token}});if(!response.ok)throw Error('Transcript download unavailable.');const text=await bodyText(response,524288);if(encoder.encode(text).length<30)throw Error('Transcript is incomplete.');return text;
}
export async function processZoomRecaps(env){
 if(!zoomConfigured(env)||!planningAvailable(env))return;
 const jobs=(await env.DB.prepare("SELECT * FROM zoom_recap_jobs WHERE status='pending' AND available_at<=? AND lease_until<=? ORDER BY available_at LIMIT 1").bind(Date.now(),Date.now()).all()).results;
 for(const job of jobs){
  const lease=Date.now()+600000,claimed=await env.DB.prepare("UPDATE zoom_recap_jobs SET lease_until=?,attempts=attempts+1 WHERE class_id=? AND lesson_id=? AND meeting_uuid=? AND status='pending' AND lease_until<=? RETURNING attempts").bind(lease,job.class_id,job.lesson_id,job.meeting_uuid,Date.now()).first();if(!claimed)continue;
  try{
   const meeting=await env.DB.prepare('SELECT * FROM zoom_lessons WHERE class_id=? AND lesson_id=?').bind(job.class_id,job.lesson_id).first();if(!meeting||!meeting.auto_recap||meeting.meeting_uuid!==job.meeting_uuid)throw Error('Meeting changed.');
   if(meeting.recap_status==='ready'){await env.DB.prepare("UPDATE zoom_recap_jobs SET status='done',lease_until=0 WHERE class_id=? AND lesson_id=? AND meeting_uuid=? AND lease_until=?").bind(job.class_id,job.lesson_id,job.meeting_uuid,lease).run();continue;}
   const courseRow=await env.DB.prepare('SELECT o.content FROM course_overviews o JOIN classes c ON c.id=o.class_id WHERE o.class_id=? AND c.deleted_at IS NULL AND (c.owner_id=? OR EXISTS(SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?))').bind(job.class_id,meeting.connection_user_id,meeting.connection_user_id).first();const course=courseRow?JSON.parse(courseRow.content):null,lesson=course?.lessons?.find((l,i)=>(l.id||'legacy-'+(i+1))===job.lesson_id);if(!lesson)throw Error('Course or host access changed.');
   const session=(await readLessonSession(env,job.class_id,job.lesson_id))?.value;if(session?.phase!=='ended'){await env.DB.prepare('UPDATE zoom_recap_jobs SET attempts=attempts-1,available_at=?,lease_until=0 WHERE class_id=? AND lesson_id=? AND meeting_uuid=? AND lease_until=?').bind(Date.now()+300000,job.class_id,job.lesson_id,job.meeting_uuid,lease).run();continue;}
   const recordings=await zoomAPI(env,meeting.connection_user_id,'/meetings/'+encodedMeetingUUID(job.meeting_uuid)+'/recordings');if(recordings.uuid!==job.meeting_uuid)throw Error('Recording instance mismatch.');const files=(recordings.recording_files||[]).filter(f=>f.recording_type==='audio_transcript'&&f.status==='completed'&&f.download_url);if(!files.length)throw Error('Transcript not ready.');
   let share='';try{share=zoomURL(recordings.share_url||'',{recording:true});}catch{}if(share)await env.DB.prepare('UPDATE zoom_lessons SET recording_url=? WHERE class_id=? AND lesson_id=? AND meeting_uuid=?').bind(share,job.class_id,job.lesson_id,job.meeting_uuid).run();
   // Multiple recording segments are concatenated; never silently omit one.
   if(files.length>20)throw Error('Too many transcript segments.');const {zoomAccessToken}=await import('./zoom-connection.mjs'),token=await zoomAccessToken(env,meeting.connection_user_id),parts=[];let size=0;
   for(const file of files){const text=await downloadTranscript(file.download_url,token);size+=encoder.encode(text).length+2;if(size>524288)throw Error('Transcript exceeds 512 KiB.');parts.push(text);}
   if(!await reserveRequest(env,meeting.connection_user_id))throw Error('AI request limit reached.');const bytes=encoder.encode(parts.join('\n\n'));let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
   const roster=(await env.DB.prepare('SELECT l.id,l.display_name AS name FROM learners l JOIN class_students s ON s.learner_id=l.id WHERE s.class_id=?').bind(job.class_id).all()).results;
   const result=await generateLessonFeedback(env,{filename:'zoom-lesson.vtt',fileData:'data:text/plain;base64,'+btoa(binary)},{teacherSpeaker:'',assessments:[]},roster,lesson);
   const latestCourse=await env.DB.prepare('SELECT content FROM course_overviews WHERE class_id=?').bind(job.class_id).first();if(latestCourse?.content!==courseRow.content)throw Error('Course changed during processing.');
   // A separate shared recap cannot overwrite teacher grades, behaviour ratings,
   // feedback, homework or a manual correction in lesson_feedback.
   const saved=await env.DB.prepare("UPDATE zoom_lessons SET recap_summary=?,recap_status='ready',recap_updated_at=?,revision=revision+1 WHERE class_id=? AND lesson_id=? AND meeting_uuid=? AND auto_recap=1 AND recap_status!='ready' RETURNING revision").bind(result.summary,Date.now(),job.class_id,job.lesson_id,job.meeting_uuid).first();if(!saved)throw Error('Meeting recap changed during processing.');
   await env.DB.prepare("UPDATE zoom_recap_jobs SET status='done',lease_until=0 WHERE class_id=? AND lesson_id=? AND meeting_uuid=? AND lease_until=?").bind(job.class_id,job.lesson_id,job.meeting_uuid,lease).run();
  }catch{
   const failed=claimed.attempts>=12;await env.DB.prepare('UPDATE zoom_recap_jobs SET status=?,available_at=?,lease_until=0 WHERE class_id=? AND lesson_id=? AND meeting_uuid=? AND lease_until=?').bind(failed?'failed':'pending',Date.now()+Math.min(3600000,60000*2**Math.min(claimed.attempts,6)),job.class_id,job.lesson_id,job.meeting_uuid,lease).run();
   if(failed)await env.DB.prepare("UPDATE zoom_lessons SET recap_status='needs_attention' WHERE class_id=? AND lesson_id=? AND recap_status!='ready'").bind(job.class_id,job.lesson_id).run();
  }
 }
}
