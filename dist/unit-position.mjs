import {lessonTiming} from './schedule-model.mjs';
import {lessonInstant} from './calendar-model.mjs';

// A position in the teaching schedule, never a score or a measure of mastery.
export function unitPosition(course,now=Date.now()) {
  const lessons=course?.lessons || [],active=lessons.filter(l=>l.status!=='cancelled');
  const end=lesson=>{
    if(Object.hasOwn(lesson,'endsAt'))return Number.isFinite(lesson.endsAt)?lesson.endsAt:null;
    try {const t=lessonTiming(course,lesson);return t.date?lessonInstant(t.date,t.startTime,course.timeZone)+t.lessonMinutes*60000:null;}catch{return null;}
  };
  const held=active.filter(l=>end(l)!==null && end(l)<=now).length;
  const upcoming=active.filter(l=>end(l)!==null && end(l)>now).sort((a,b)=>end(a)-end(b))[0] || active.find(l=>end(l)===null);
  return {held,total:active.length,percent:active.length?Math.round(held/active.length*100):0,current:lessons.indexOf(upcoming || active.at(-1)),undated:active.filter(l=>end(l)===null).length};
}

export function workspaceChoice(value){return value==='extended'?'extended':'essentials';}
