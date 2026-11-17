import {zoomEnabled,zoomError,zoomAPI} from './zoom-connection.mjs';
import {meetingDetails} from '../dist/zoom-model.mjs';
import {limitClassAction} from './classes.mjs';
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
export const weeklyMeeting=row=>row?{revision:row.revision,weekday:row.weekday,meetingId:row.meeting_id,joinURL:row.join_url,passcode:row.passcode,recordingURL:'',state:'scheduled',managed:false,autoRecap:!!row.auto_recap,autoQuiz:!!row.auto_quiz,recapStatus:row.auto_recap?'waiting':'off',recapSummary:'',inherited:true}:null;
export async function weeklyZoomMap(env,cid){return new Map((await env.DB.prepare('SELECT * FROM zoom_weekly_meetings WHERE class_id=?').bind(cid).all()).results.map(row=>[row.weekday,weeklyMeeting(row)]));}
export function weeklyMeetingFor(weekly,lesson){
 if(lesson.status==='cancelled'||!/^\d{4}-\d{2}-\d{2}$/.test(lesson.date||''))return null;
 // The course date is a calendar date in the class timezone, not an instant.
 const day=new Date(lesson.date+'T12:00:00Z').getUTCDay();return weekly.get(day)||null;
}
export async function handleWeeklyZoom(request,env,user,{readJSON}){try{
 if(!user?.emailVerified)zoomError('Please sign in.',401);if(user.requestedRole!=='teacher')zoomError('Teacher access required.',403);if(!zoomEnabled(env))zoomError('Zoom meeting setup is not enabled yet.',503);
 const match=new URL(request.url).pathname.match(/^\/api\/zoom\/classes\/([a-f0-9-]{36})\/weekly$/);if(!match)zoomError('Class not found.',404);const cid=match[1];
 const classroom=await env.DB.prepare('SELECT id FROM classes c WHERE c.id=? AND c.deleted_at IS NULL AND (c.owner_id=? OR EXISTS(SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?))').bind(cid,user.id,user.id).first();if(!classroom)zoomError('Class not found.',404);
 const result=async()=>json({userId:user.id,meetings:[...(await weeklyZoomMap(env,cid)).values()]});if(request.method==='GET')return result();if(request.method!=='POST')zoomError('Use GET or POST.',405);
 if(request.headers.get('Origin')!==env.APP_ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site')zoomError('Invalid origin.',403);
 const input=await readJSON(request,5000);if(input.expectedUserId!==user.id)zoomError('Your account changed. Reopen the meeting settings.',401);if(!Number.isInteger(input.weekday)||input.weekday<0||input.weekday>6||!Number.isInteger(input.revision)||input.revision<0)zoomError('Check the weekday and reload its meeting details.');
 if(!await limitClassAction(env,user.id,'zoom-weekly',60))zoomError('Please wait a moment before trying again.',429);
 let saved;if(input.action==='remove')saved=await env.DB.prepare('DELETE FROM zoom_weekly_meetings WHERE class_id=? AND weekday=? AND revision=? RETURNING revision').bind(cid,input.weekday,input.revision).first();
 else if(input.action==='save'){
  let details;try{details=meetingDetails(input);}catch(error){zoomError(error.message);}
  for(const field of ['autoRecap','autoQuiz'])if(input[field]!==undefined&&typeof input[field]!=='boolean')zoomError('Check the transcript and quiz options.');
  const recap=input.autoRecap===true,quiz=recap&&input.autoQuiz===true;let owner=null;
  if(recap){
   const connection=await env.DB.prepare('SELECT zoom_user_id FROM zoom_connections WHERE user_id=?').bind(user.id).first();if(!connection)zoomError('Connect the Zoom account that hosts this meeting before enabling transcripts.',409);
   const meeting=await zoomAPI(env,user.id,'/meetings/'+details.meetingId);
   if(String(meeting.id)!==details.meetingId||meeting.host_id!==connection.zoom_user_id)zoomError('This meeting is not hosted by your connected Zoom account.',409);
   owner=user.id;
  }
  saved=input.revision===0?await env.DB.prepare('INSERT INTO zoom_weekly_meetings(class_id,weekday,meeting_id,join_url,passcode,connection_user_id,auto_recap,auto_quiz,updated_by,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING RETURNING revision').bind(cid,input.weekday,details.meetingId,details.joinURL,details.passcode,owner,recap?1:0,quiz?1:0,user.id,Date.now()).first():await env.DB.prepare('UPDATE zoom_weekly_meetings SET meeting_id=?,join_url=?,passcode=?,connection_user_id=?,auto_recap=?,auto_quiz=?,updated_by=?,updated_at=?,revision=revision+1 WHERE class_id=? AND weekday=? AND revision=? RETURNING revision').bind(details.meetingId,details.joinURL,details.passcode,owner,recap?1:0,quiz?1:0,user.id,Date.now(),cid,input.weekday,input.revision).first();
 }else zoomError('Unknown weekly meeting action.');
 if(!saved)zoomError('These meeting details changed. Reopen the settings.',409);return result();
 }catch(error){return json({message:error.status?error.message:'The weekly Zoom settings could not be saved. Please try again.'},error.status||502);}}
