import {validDate,addDays} from './course-model.mjs';
export const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export const validTime=value=>typeof value==='string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const validMinutes=value=>Number.isInteger(value) && value>=15 && value<=240;
export const slotKey=slot=>`${slot.date}|${slot.startTime}`;
export function lessonTiming(course,lesson){return {date:lesson.date,startTime:lesson.startTime || course.startTime,lessonMinutes:lesson.lessonMinutes ?? course.lessonMinutes};}
export function validateScheduleFields(value){
  const result={};
  if(value.endDate!==undefined){if(value.endDate!=='' && (!validDate(value.endDate) || !value.startDate || value.endDate<value.startDate))throw Error('Choose an end date on or after the start date.');result.endDate=value.endDate;}
  if(value.weeklySlots!==undefined){
    if(!Array.isArray(value.weeklySlots) || value.weeklySlots.length>7)throw Error('Choose up to seven weekly lesson times.');
    const seen=new Set();result.weeklySlots=value.weeklySlots.map(s=>{
      if(!Number.isInteger(s.day) || s.day<0 || s.day>6 || !validTime(s.startTime) || !validMinutes(s.lessonMinutes))throw Error('Check the weekly lesson day, time and duration.');
      const key=`${s.day}|${s.startTime}`;if(seen.has(key))throw Error('Each weekly lesson needs a different day or start time.');seen.add(key);
      return {day:s.day,startTime:s.startTime,lessonMinutes:s.lessonMinutes};
    });
  }
  if(value.skippedSlots!==undefined){if(!Array.isArray(value.skippedSlots) || value.skippedSlots.length>520 || value.skippedSlots.some(key=>typeof key!=='string' || !validDate(key.split('|')[0]) || !validTime(key.split('|')[1]) || key.split('|').length!==2))throw Error('Check the crossed-out schedule dates.');result.skippedSlots=[...new Set(value.skippedSlots)];}
  if(value.billingMode!==undefined){if(!['none','monthly','packs'].includes(value.billingMode))throw Error('Choose a billing option.');result.billingMode=value.billingMode;}
  if(value.billTo!==undefined){if(typeof value.billTo!=='string' || value.billTo.length>120)throw Error('Keep the billing client name under 120 characters.');result.billTo=value.billTo.trim();}
  return result;
}
export function validateLessonSchedule(lesson){
  const result={};
  if(lesson.startTime!==undefined){if(!validTime(lesson.startTime))throw Error('Choose a valid time for each lesson.');result.startTime=lesson.startTime;}
  if(lesson.lessonMinutes!==undefined){if(!validMinutes(lesson.lessonMinutes))throw Error('Lesson duration must be 15–240 minutes.');result.lessonMinutes=lesson.lessonMinutes;}
  if(lesson.status!==undefined){if(!['scheduled','cancelled'].includes(lesson.status))throw Error('Check the lesson status.');result.status=lesson.status;}
  if(lesson.chargeCancelled!==undefined){if(typeof lesson.chargeCancelled!=='boolean')throw Error('Check whether the cancellation is chargeable.');result.chargeCancelled=lesson.chargeCancelled;}
  if(lesson.rescheduledFrom!==undefined){const from=lesson.rescheduledFrom;if(!from || !validDate(from.date) || !validTime(from.startTime) || !validMinutes(from.lessonMinutes))throw Error('Check the original lesson schedule.');result.rescheduledFrom={date:from.date,startTime:from.startTime,lessonMinutes:from.lessonMinutes};}
  return result;
}
// Build a date checklist separately from lesson content. Skipping a holiday must
// move the teaching sequence to the next selected date, never delete its topic.
export function scheduleCandidates(course){
  validateScheduleFields(course);
  if(!validDate(course.startDate))throw Error('Choose a start date before previewing lesson dates.');
  if(!course.weeklySlots?.length)throw Error('Add at least one weekly lesson day and time.');
  const target=course.lessonCount ?? course.lessons.length,slots=course.weeklySlots.slice().sort((a,b)=>a.startTime.localeCompare(b.startTime)),rows=[];
  let date=course.startDate;
  for(let n=0;n<1092;n++,date=addDays(date,1)){
    if(course.endDate && date>course.endDate)return rows;
    const day=new Date(date+'T12:00:00Z').getUTCDay();
    for(const slot of slots.filter(s=>s.day===day)){
      rows.push({...slot,date});if(rows.length>520)throw Error('This date range contains more than 520 lessons. Use a shorter date range.');
      if(!course.endDate && rows.length>=target)return rows;
    }
  }
  throw Error('Choose a date range shorter than three years.');
}
export function applySchedule(course,skipped=course.skippedSlots || []){
  const rows=scheduleCandidates(course),skip=new Set(skipped),chosen=rows.filter(s=>!skip.has(slotKey(s)));
  if(chosen.length!==course.lessons.length)throw Error(`Select exactly ${course.lessons.length} lesson dates (${chosen.length} selected). Cross out extra dates or extend the end date.`);
  return {...course,skippedSlots:rows.filter(s=>skip.has(slotKey(s))).map(slotKey),lessons:course.lessons.map((lesson,i)=>{
    const next=chosen[i],previous=lessonTiming(course,lesson),changed=previous.date && (previous.date!==next.date || previous.startTime!==next.startTime || previous.lessonMinutes!==next.lessonMinutes);
    return {...lesson,date:next.date,startTime:next.startTime,lessonMinutes:next.lessonMinutes,...(changed && !lesson.rescheduledFrom?{rescheduledFrom:previous}:{})};
  })};
}
export function billingSchedule(course){
  let counted=0;
  const result=new Map();
  const ordered=course.lessons.map((lesson,index)=>({lesson,index})).sort((a,b)=>(a.lesson.date||'9999').localeCompare(b.lesson.date||'9999') || lessonTiming(course,a.lesson).startTime.localeCompare(lessonTiming(course,b.lesson).startTime) || a.index-b.index);
  for(const {lesson,index} of ordered){
    const timing=lessonTiming(course,lesson),chargeable=lesson.status!=='cancelled' || lesson.chargeCancelled===true,scheduled=Boolean(lesson.date);
    if(chargeable && scheduled)counted++;
    const pack=chargeable && scheduled?Math.ceil(counted/8):null,number=pack?(counted-1)%8+1:null;
    const label=course.billingMode==='packs'?(number?`Pack ${pack} · lesson ${number} of 8${number===8?' · renew before the next lesson':''}`:scheduled?'Cancelled · no pack credit used':'Schedule to assign a pack number'):course.billingMode==='monthly'?(chargeable?`${Number((timing.lessonMinutes/60).toFixed(2))} billable hours${lesson.status==='cancelled'?' · chargeable cancellation':''}`:'Cancelled · not billable'):'';
    result.set(lesson.id || `legacy-${index+1}`,{pack,number,label,chargeable,minutes:chargeable && scheduled?timing.lessonMinutes:0,...timing,status:lesson.status || 'scheduled'});
  }
  return result;
}
export function billingMonths(course){
  const months=new Map();for(const row of billingSchedule(course).values()){
    if(!row.date)continue;const key=row.date.slice(0,7),month=months.get(key)||{month:key,minutes:0,lessons:0};month.minutes+=row.minutes;if(row.minutes)month.lessons++;months.set(key,month);
  }return [...months.values()].sort((a,b)=>a.month.localeCompare(b.month));
}
