import {zoomLessonMap} from './zoom-meetings.mjs';
import { projectCalendar, zonedClock } from '../dist/calendar-model.mjs';

export async function handleCalendar(request, env, user, { json, fail }) {
  if (request.method !== 'GET') return fail('Use GET.', 405);
  const query = new URL(request.url).searchParams, from = query.get('from'), to = query.get('to'), timeZone = query.get('timeZone') || 'Asia/Bangkok';
  const dateOK = value => typeof value === 'string' && /^\d{4}-\d\d-\d\d$/.test(value) && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
  if (!dateOK(from) || !dateOK(to) || from >= to || Date.parse(to) - Date.parse(from) > 62 * 86400000) return fail('Choose a calendar range of up to 62 days.', 400, 'INVALID_RANGE');
  try { zonedClock(Date.now(), timeZone); } catch { return fail('Choose a valid calendar time zone.', 400, 'INVALID_TIME_ZONE'); }
  const rows = (await env.DB.prepare(`SELECT c.id, c.name, o.content FROM classes c LEFT JOIN course_overviews o ON o.class_id = c.id
    WHERE c.deleted_at IS NULL AND (c.owner_id = ? OR EXISTS (SELECT 1 FROM class_teachers t WHERE t.class_id = c.id AND t.user_id = ?))
    ORDER BY c.name, c.id`).bind(user.id, user.id).all()).results;
  const classrooms=rows.map(c=>({...c,course:c.content?JSON.parse(c.content):null})),result=projectCalendar(classrooms,from,to,timeZone);
  const meetings=new Map(await Promise.all(classrooms.map(async c=>[c.id,await zoomLessonMap(env,c.id,false,c.course?.lessons||[])])));
  for(const event of result.events){const classroom=classrooms.find(c=>c.id===event.classId),lesson=classroom.course.lessons[event.lessonIndex],meeting=meetings.get(event.classId)?.get(lesson.id||'legacy-'+(event.lessonIndex+1));if(event.status!=='cancelled'&&meeting?.joinURL)event.zoom={joinURL:meeting.joinURL,meetingId:meeting.meetingId,passcode:meeting.passcode};}
  return json(result);
}
