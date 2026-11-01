import {lessonInstant,zonedClock} from './calendar-model.mjs';
import {lessonTiming} from './schedule-model.mjs';

export function nextDashboardLesson(course,now=Date.now()) {
  if(!course)return null;
  const next=[];
  (course.lessons||[]).forEach((lesson,index)=>{
    if(lesson.status==='cancelled'||!lesson.date)return;
    try {
      const timing=lessonTiming(course,lesson),start=lessonInstant(timing.date,timing.startTime,course.timeZone),end=start+timing.lessonMinutes*60000;
      if(end>now)next.push({index,title:lesson.title,startsAt:start,endsAt:end,timeZone:course.timeZone});
    } catch {/* Ambiguous or invalid times must be corrected in the course plan. */}
  });
  return next.sort((a,b)=>a.startsAt-b.startsAt||a.index-b.index)[0]||null;
}
export function dashboardTime(lesson,now=Date.now(),zone='Asia/Bangkok') {
  const clock=zonedClock(lesson.startsAt,zone),today=zonedClock(now,zone).date;
  const tomorrow=new Date(today+'T12:00:00Z');tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
  const day=clock.date===today?'Today':clock.date===tomorrow.toISOString().slice(0,10)?'Tomorrow':new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',...(clock.date.slice(0,4)!==today.slice(0,4)?{year:'numeric'}:{}),timeZone:zone}).format(new Date(lesson.startsAt));
  return (lesson.startsAt<=now&&lesson.endsAt>now?'In progress · ':'')+day+', '+clock.time;
}
