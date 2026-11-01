import {defaults,validateCourse,addDays,validDate} from './course-model.mjs';
import {scheduleCandidates,slotKey,applySchedule} from './schedule-model.mjs';

export const sessionName=(index,frequency)=>`Week ${Math.floor(index/frequency)+1}${frequency>1?` Lesson ${index%frequency+1}`:''}`;
export function teachingWeek(date){
  if(!validDate(date))throw Error('Choose a valid date.');
  const day=new Date(date+'T12:00:00Z').getUTCDay();return addDays(date,-((day+6)%7));
}
export function scheduleSettings(value){
  const lessonCount=Number(value.lessonCount),lessonMinutes=Number(value.lessonMinutes);
  if(!Number.isInteger(lessonCount)||lessonCount<1||lessonCount>156)throw Error('Choose 1–156 classes.');
  if(!Number.isInteger(lessonMinutes)||lessonMinutes<15||lessonMinutes>240)throw Error('Choose a duration of 15–240 minutes.');
  if(!value.weeklySlots?.length)throw Error('Choose at least one teaching day.');
  if(!validDate(value.startDate)||!validDate(value.endDate))throw Error('Choose both a start date and a finish date.');
  const next={...value,pacing:'weekly',lessonCount,lessonMinutes,lessonsPerWeek:value.weeklySlots.length,weeks:Math.ceil(lessonCount/value.weeklySlots.length),startTime:value.weeklySlots[0].startTime};
  scheduleCandidates(next);return next;
}
export function buildScheduledCourse(value,previous=null){
  const settings=scheduleSettings(value),base=previous||{...defaults(value.title),preset:'blank',description:'',organization:''};
  const lessons=Array.from({length:settings.lessonCount},(_,i)=>{
    const old=base.lessons[i],wasDefault=old&&old.title===sessionName(i,base.lessonsPerWeek);
    return {...(old||{id:crypto.randomUUID(),date:'',goal:'',reading:'',homework:''}),week:Math.floor(i/settings.lessonsPerWeek)+1,slot:i%settings.lessonsPerWeek+1,title:!old||wasDefault?sessionName(i,settings.lessonsPerWeek):old.title};
  });
  return validateCourse(applySchedule({...base,...settings,lessons}));
}
export function scheduleSelection(value,skipped=[]){
  const settings=scheduleSettings(value),candidates=scheduleCandidates(settings),keys=new Set(skipped),chosen=candidates.filter(s=>!keys.has(slotKey(s)));
  return {candidates,chosen,extra:chosen.length-settings.lessonCount};
}
