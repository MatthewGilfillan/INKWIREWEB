import {lessonKey,lessonStart} from '../dist/lesson-feedback-model.mjs';

// Webhook payloads differ between cloud-recording and retained AI Companion
// transcripts. Never resolve a historical occurrence using only its meeting ID.
export function zoomOccurrence(event){
 const object=event.payload?.object;if(!object)return null;
 const retained=event.event==='meeting.aic_transcript_completed';
 const id=String(retained?object.meeting_id:object.id),uuid=retained?object.meeting_uuid:object.uuid;
 if(!/^\d{9,11}$/.test(id)||typeof uuid!=='string'||!uuid||uuid.length>200)return null;
 return {id,uuid,host:object.host_id,account:event.payload.account_id,start:retained?object.meeting_start_time:object.start_time};
}

export async function findZoomOccurrence(env,event){
 const occurrence=zoomOccurrence(event);if(!occurrence)return null;
 const {id,uuid,host,account,start}=occurrence;
 const exact=(await env.DB.prepare('SELECT z.*,c.zoom_user_id,c.account_id FROM zoom_lessons z JOIN zoom_connections c ON c.user_id=z.connection_user_id WHERE z.meeting_id=? AND z.meeting_uuid=? AND c.zoom_user_id=? AND c.account_id=?').bind(id,uuid,host||'',account||'').all()).results;
 if(exact.length)return exact.length===1?exact[0]:null;
 const started=Date.parse(start);if(!Number.isFinite(started))return null;
 const weekly=(await env.DB.prepare(`SELECT w.*,c.zoom_user_id,c.account_id,o.content FROM zoom_weekly_meetings w
 JOIN zoom_connections c ON c.user_id=w.connection_user_id
 JOIN classes cl ON cl.id=w.class_id JOIN course_overviews o ON o.class_id=cl.id
 WHERE w.meeting_id=? AND c.zoom_user_id=? AND c.account_id=? AND w.auto_recap=1 AND cl.deleted_at IS NULL
 AND (cl.owner_id=w.connection_user_id OR EXISTS(SELECT 1 FROM class_teachers t WHERE t.class_id=cl.id AND t.user_id=w.connection_user_id))`).bind(id,host||'',account||'').all()).results;
 const candidates=[];
 for(const row of weekly){
  let course;try{course=JSON.parse(row.content);}catch{continue;}
  for(const [index,lesson] of (course.lessons||[]).entries()){
   if(lesson.status==='cancelled'||!/^\d{4}-\d{2}-\d{2}$/.test(lesson.date||'')||new Date(lesson.date+'T12:00:00Z').getUTCDay()!==row.weekday)continue;
   let planned;try{planned=lessonStart(course,lesson);}catch{continue;}
   // A timetable mismatch or two nearby lessons requires teacher reconciliation.
   // Being in the past is never evidence that an Ink Wire lesson was taught.
   if(!Number.isFinite(planned)||Math.abs(planned-started)>90*60000)continue;
   candidates.push({row,lid:lessonKey(lesson,index)});
  }
 }
 // Count occupied/overridden lessons as ambiguous too; excluding them could
 // silently attach a neighbouring lesson's transcript to the wrong class.
 if(candidates.length!==1)return null;
 const {row,lid}=candidates[0];
 await env.DB.prepare(`INSERT INTO zoom_lessons(class_id,lesson_id,connection_user_id,meeting_id,meeting_uuid,join_url,passcode,auto_recap,auto_quiz,recap_status,quiz_status,weekly_weekday,occurrence_started_at,updated_by,updated_at)
 SELECT ?,?,?,?,?,?,?,1,?,'waiting',?,?,?, ?,? WHERE EXISTS(SELECT 1 FROM zoom_weekly_meetings WHERE class_id=? AND weekday=? AND revision=? AND connection_user_id=? AND auto_recap=1)
 ON CONFLICT DO NOTHING`).bind(row.class_id,lid,row.connection_user_id,id,uuid,row.join_url,row.passcode,row.auto_quiz,row.auto_quiz?'waiting':'off',row.weekday,new Date(started).toISOString(),row.updated_by,Date.now(),row.class_id,row.weekday,row.revision,row.connection_user_id).run();
 return env.DB.prepare('SELECT z.*,c.zoom_user_id,c.account_id FROM zoom_lessons z JOIN zoom_connections c ON c.user_id=z.connection_user_id WHERE z.class_id=? AND z.lesson_id=? AND z.meeting_id=? AND z.meeting_uuid=? AND c.zoom_user_id=? AND c.account_id=?').bind(row.class_id,lid,id,uuid,host,account).first();
}
