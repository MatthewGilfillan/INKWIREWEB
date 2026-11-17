import {zoomEnabled,zoomConfigured,zoomAPI,zoomError} from './zoom-connection.mjs';
import {meetingDetails} from '../dist/zoom-model.mjs';
import {lessonStart} from '../dist/lesson-feedback-model.mjs';
import {limitClassAction} from './classes.mjs';
import {formatSummaryText} from '../dist/summary-format.mjs';
import {weeklyZoomMap,weeklyMeetingFor} from './zoom-weekly.mjs';
export async function zoomLessonMap(env,classId,teacher=false,lessons=[]){
 if(!zoomEnabled(env))return new Map();const rows=(await env.DB.prepare('SELECT * FROM zoom_lessons WHERE class_id=?').bind(classId).all()).results;
 const map=new Map(rows.map(row=>[row.lesson_id,projectZoomMeeting(row,teacher)])),weekly=await weeklyZoomMap(env,classId);for(const [index,lesson] of lessons.entries()){const id=lesson.id||'legacy-'+(index+1);if(!map.has(id)){const meeting=weeklyMeetingFor(weekly,lesson);if(meeting)map.set(id,meeting);}}return map;
}
export function projectZoomMeeting(row,teacher=false){return row?{revision:row.revision,meetingId:row.meeting_id,joinURL:row.join_url,passcode:row.passcode,recordingURL:row.recording_url,state:row.meeting_state,managed:!!row.connection_user_id,autoRecap:!!row.auto_recap,recapStatus:row.recap_status,recapSummary:row.recap_status==='ready'?row.recap_summary:'',...(teacher?{recapDraft:row.recap_summary}:{})}:null;}
export async function endZoomForLesson(env,cid,lid){
 if(!zoomEnabled(env))return;const row=await env.DB.prepare('SELECT * FROM zoom_lessons WHERE class_id=? AND lesson_id=?').bind(cid,lid).first();if(!row?.connection_user_id||row.meeting_state==='ended')return;
 const meeting=await zoomAPI(env,row.connection_user_id,'/meetings/'+row.meeting_id);if(String(meeting.uuid)!==row.meeting_uuid)zoomError('The Zoom meeting instance changed. End it in Zoom and untick the Zoom end option here.',409);
 if(meeting.status==='started')await zoomAPI(env,row.connection_user_id,'/meetings/'+row.meeting_id+'/status',{method:'PUT',body:{action:'end'}});
 await env.DB.prepare("UPDATE zoom_lessons SET meeting_state='ended' WHERE class_id=? AND lesson_id=? AND meeting_uuid=?").bind(cid,lid,row.meeting_uuid).run();
}
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export async function handleZoomMeetings(request,env,user,{readJSON}){try{
 if(!user?.emailVerified)zoomError('Please sign in.',401);if(!zoomEnabled(env))zoomError('Zoom meeting setup is not enabled yet.',503);
 const match=new URL(request.url).pathname.match(/^\/api\/zoom\/classes\/([a-f0-9-]{36})\/lessons\/([a-zA-Z0-9-]{1,80})$/);if(!match)zoomError('Lesson not found.',404);const [,cid,lid]=match,teacher=user.requestedRole==='teacher';if(!['teacher','student','parent'].includes(user.requestedRole))zoomError('Class not found.',404);
 const row=await env.DB.prepare(`SELECT c.id,o.content FROM classes c LEFT JOIN course_overviews o ON o.class_id=c.id WHERE c.id=? AND c.deleted_at IS NULL AND ${teacher?'(c.owner_id=? OR EXISTS(SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?))':user.requestedRole==='student'?'EXISTS(SELECT 1 FROM class_students s JOIN learners l ON l.id=s.learner_id WHERE s.class_id=c.id AND l.user_id=?)':'EXISTS(SELECT 1 FROM class_students s JOIN learner_parents p ON p.learner_id=s.learner_id WHERE s.class_id=c.id AND p.parent_id=?)'}`).bind(cid,user.id,...(teacher?[user.id]:[])).first();
 const course=row?.content?JSON.parse(row.content):null,lesson=course?.lessons?.find((l,i)=>(l.id||'legacy-'+(i+1))===lid);if(!lesson)zoomError('Lesson not found.',404);
 const get=()=>env.DB.prepare('SELECT * FROM zoom_lessons WHERE class_id=? AND lesson_id=?').bind(cid,lid).first();let current=await get();
 if(request.method==='GET')return json({userId:user.id,meeting:projectZoomMeeting(current,teacher)||weeklyMeetingFor(await weeklyZoomMap(env,cid),lesson),configured:teacher&&zoomConfigured(env)});
 if(request.method!=='POST')zoomError('Use GET or POST.',405);if(!teacher)zoomError('Only teachers can change meeting details.',403);if(request.headers.get('Origin')!==env.APP_ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site')zoomError('Invalid origin.',403);
 const input=await readJSON(request,20000);if(input.expectedUserId!==user.id)zoomError('Your account changed. Reload the meeting settings.',401);if(!Number.isInteger(input.revision)||input.revision!==(current?.revision||0))zoomError('The meeting changed. Reopen its settings.',409);if(!await limitClassAction(env,user.id,'zoom-meeting',60))zoomError('Please wait a moment before trying again.',429);
 if(input.action==='save'){
  if(current?.connection_user_id)zoomError('This meeting is managed by Ink Wire. Remove it before attaching a different meeting.',409);
  if(current&&!current.meeting_id)zoomError('Review the incomplete setup in Zoom, then remove the lesson link before attaching its details.',409);
  let details;try{details=meetingDetails(input);}catch(error){zoomError(error.message);}
  const saved=input.revision===0?await env.DB.prepare('INSERT INTO zoom_lessons(class_id,lesson_id,meeting_id,join_url,passcode,recording_url,updated_by,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING RETURNING revision').bind(cid,lid,details.meetingId,details.joinURL,details.passcode,details.recordingURL,user.id,Date.now()).first():await env.DB.prepare('UPDATE zoom_lessons SET meeting_id=?,join_url=?,passcode=?,recording_url=?,revision=revision+1,updated_by=?,updated_at=? WHERE class_id=? AND lesson_id=? AND revision=? RETURNING revision').bind(details.meetingId,details.joinURL,details.passcode,details.recordingURL,user.id,Date.now(),cid,lid,input.revision).first();if(!saved)zoomError('The meeting changed. Reopen its settings.',409);
 }else if(input.action==='create'){
  if(current)zoomError('A meeting is already attached to this lesson.',409);if(lesson.status==='cancelled')zoomError('Restore this lesson before creating a meeting.',409);if(!zoomConfigured(env))zoomError('Configure the Zoom connection first.',503);
  if(!await env.DB.prepare('SELECT user_id FROM zoom_connections WHERE user_id=?').bind(user.id).first())zoomError('Connect your Zoom account before creating a meeting.',409);
  let startsAt;try{startsAt=lessonStart(course,lesson);}catch{}if(!Number.isFinite(startsAt))zoomError('Set a valid lesson date, time and time zone first.');
  // Claim before contacting Zoom, so double clicks cannot create two meetings.
  const claim=await env.DB.prepare("INSERT INTO zoom_lessons(class_id,lesson_id,meeting_id,join_url,meeting_state,updated_by,updated_at) VALUES(?,?,'','', 'creating',?,?) ON CONFLICT DO NOTHING RETURNING revision").bind(cid,lid,user.id,Date.now()).first();if(!claim)zoomError('Another teacher is creating this meeting. Refresh shortly.',409);
  let meeting;try{meeting=await zoomAPI(env,user.id,'/users/me/meetings',{method:'POST',body:{topic:lesson.title,type:2,start_time:new Date(startsAt).toISOString(),duration:lesson.lessonMinutes??course.lessonMinutes,timezone:course.timeZone,settings:{waiting_room:true,join_before_host:false,auto_recording:'none',host_video:false,participant_video:false}}});}catch(error){
   // An uncertain response may still have created a Zoom meeting. Keep the
   // claim for explicit reconciliation rather than silently creating duplicates.
   await env.DB.prepare("UPDATE zoom_lessons SET meeting_state='setup_failed' WHERE class_id=? AND lesson_id=? AND meeting_state='creating'").bind(cid,lid).run();throw error;
  }
  let details;try{details=meetingDetails({meetingId:meeting.id,joinURL:meeting.join_url,passcode:meeting.password});}catch{zoomError('Zoom created a meeting but its details need checking. Review it in Zoom before retrying.',502);}
  const connection=await env.DB.prepare('SELECT zoom_user_id FROM zoom_connections WHERE user_id=?').bind(user.id).first();if(!connection||meeting.host_id!==connection.zoom_user_id)zoomError('Zoom returned a meeting for a different host. Review it in Zoom.',502);
  await env.DB.prepare("UPDATE zoom_lessons SET connection_user_id=?,meeting_id=?,meeting_uuid=?,join_url=?,passcode=?,meeting_state='scheduled',auto_recap=?,recap_status=?,revision=revision+1 WHERE class_id=? AND lesson_id=? AND meeting_state='creating'").bind(user.id,details.meetingId,String(meeting.uuid||''),details.joinURL,details.passcode,input.autoRecap===true?1:0,input.autoRecap===true?'waiting':'off',cid,lid).run();
 }else if(input.action==='correct-recap'){
  if(current?.recap_status!=='ready'||typeof input.summary!=='string'||!input.summary.trim()||input.summary.length>14000)zoomError('Enter a corrected class recap, up to 14,000 characters.');
  const saved=await env.DB.prepare('UPDATE zoom_lessons SET recap_summary=?,recap_updated_at=?,revision=revision+1 WHERE class_id=? AND lesson_id=? AND revision=? RETURNING revision').bind(formatSummaryText(input.summary),Date.now(),cid,lid,input.revision).first();if(!saved)zoomError('The recap changed. Reopen its settings.',409);
 }else if(input.action==='recap-setting'){
  if(!current?.connection_user_id||typeof input.autoRecap!=='boolean')zoomError('Check the automatic recap setting.');
  const saved=await env.DB.prepare("UPDATE zoom_lessons SET auto_recap=?,recap_status=CASE WHEN recap_status='ready' THEN recap_status ELSE ? END,revision=revision+1 WHERE class_id=? AND lesson_id=? AND revision=? RETURNING revision").bind(input.autoRecap?1:0,input.autoRecap?'waiting':'off',cid,lid,input.revision).first();if(!saved)zoomError('The meeting changed. Reopen its settings.',409);
 }else if(input.action==='retry-recap'){
  if(!current?.connection_user_id||!current.auto_recap||current.recap_status==='ready')zoomError('No transcript processing is waiting for a retry.',409);
  await env.DB.prepare('INSERT OR IGNORE INTO zoom_recap_jobs(class_id,lesson_id,meeting_uuid,available_at) VALUES(?,?,?,?)').bind(cid,lid,current.meeting_uuid,Date.now()).run();
  await env.DB.prepare("UPDATE zoom_recap_jobs SET status='pending',attempts=0,available_at=?,lease_until=0 WHERE class_id=? AND lesson_id=? AND meeting_uuid=? AND lease_until<=?").bind(Date.now(),cid,lid,current.meeting_uuid,Date.now()).run();
  await env.DB.prepare("UPDATE zoom_lessons SET recap_status='waiting',revision=revision+1 WHERE class_id=? AND lesson_id=? AND revision=?").bind(cid,lid,input.revision).run();
 }else if(input.action==='remove'){
  if(current?.meeting_state==='live')zoomError('End the Zoom meeting before removing its lesson link.',409);
  if(current?.recap_status==='ready')zoomError('Keep this completed lesson’s recap. Attach a new meeting to a new lesson.',409);
  await env.DB.prepare('DELETE FROM zoom_lessons WHERE class_id=? AND lesson_id=? AND revision=?').bind(cid,lid,input.revision).run();
 }else zoomError('Unknown meeting action.');
 return json({meeting:projectZoomMeeting(await get(),true)});
 }catch(error){return json({message:error.status?error.message:'Zoom meeting setup could not complete. Please try again.'},error.status||502);}}
