// Transparent prompts for teacher review, not stored grades or diagnoses.
import catalogue from './assessment-catalogue.mjs';
export const suggestionRules={days:42,minSkillResponses:10,minSkillSessions:2,low:60,high:90,minLessons:3,improvement:20};
const day=86400000,percentage=rows=>Math.round(rows.filter(row=>row.correct).length/rows.length*100);
const fingerprint=values=>{let hash=2166136261;for(const char of JSON.stringify(values))hash=Math.imul(hash^char.charCodeAt(0),16777619);return (hash>>>0).toString(16);};
function recentStamp(value,now){const stamp=typeof value==='number'?value:typeof value==='string'?Date.parse(value):NaN;return Number.isFinite(stamp)&&stamp>=now-suggestionRules.days*day&&stamp<=now?stamp:null;}
export function assessmentSuggestions({classroom,students,timeline,now=Date.now()}){
 const candidates=[],roster=new Map(students.map(s=>[s.id,s])),demo=timeline.demoSource==='educade-v1',lessons=timeline.course?.lessons||[];
 function add(learnerId,kind,focus,title,facts,source,priority,subject='overall'){
  const learner=roster.get(learnerId);if(!learner)return;
  const summary=facts.join(' '),key=[classroom.id,learnerId,kind,focus,fingerprint(source)].join(':');
  candidates.push({key,classId:classroom.id,className:classroom.name,learnerId,learnerName:learner.name,kind,title,facts,demo,priority,notes:summary+'\n\n'+(kind==='intervention'?'Plan: check this evidence with the learner and agree a short, targeted practice activity.':'Recognition: review the work and add your own reason for the award.'),href:'/teacher?'+new URLSearchParams({view:'assessment',class:classroom.id,learner:learnerId,subject})});
 }
 const skills=new Map(catalogue.groups.flatMap(group=>group.skills.map(skill=>[skill.id,{...skill,domain:group.domain,section:group.section}]))),buckets=new Map(),seen=new Set();
 for(const r of timeline.skillEvidence||[]){
  if(!roster.has(r.learnerId)||!skills.has(r.skillId)||typeof r.correct!=='boolean'||r.supported!==false||r.hint===true||typeof r.id!=='string'||seen.has(r.id))continue;
  const stamp=recentStamp(r.occurredAt??r.createdAt,now),sample=demo&&r.demo===true&&Number.isInteger(r.week)&&r.week>=1&&Number.isInteger(r.day)&&r.day>=1;
  if(stamp===null&&!sample)continue;seen.add(r.id);
  const row={...r,order:stamp??(r.week*7+r.day)*day,session:stamp!==null?Math.floor(stamp/day):r.week+':'+r.day},key=r.learnerId+'|'+r.skillId;
  if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(row);
 }
 for(const rows of buckets.values()){
  const recent=rows.sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id)).slice(-20),sessions=new Set(recent.map(r=>r.session)).size;
  if(recent.length<suggestionRules.minSkillResponses||sessions<suggestionRules.minSkillSessions)continue;
  const skill=skills.get(recent[0].skillId),score=percentage(recent),correct=recent.filter(r=>r.correct).length,learner=recent[0].learnerId,source=recent.map(r=>[r.id,r.correct]),subject=skill.domain==='reading'?(skill.section==='foundations'?'foundations':'literacy'):skill.domain;
  const facts=[`${correct}/${recent.length} independent responses correct (${score}%) across ${sessions} recorded days.`,demo?'Fictional demo responses; latest 20 available responses for this skill.':'Latest 20 available independent responses for this skill within 42 days.'];
  if(score<suggestionRules.low)add(learner,'intervention',skill.id,'Support with '+skill.name,[...facts,'Review criterion: below 60%, with at least 10 responses over two days.'],source,100-score,subject);
  if(score>=suggestionRules.high)add(learner,'award',skill.id,'Consistent practice: '+skill.name,[...facts,'Review criterion: at least 90%, with at least 10 responses over two days.'],source,score,subject);
  const before=percentage(recent.slice(0,5)),after=percentage(recent.slice(-5)),separateDays=recent.at(-6).order<recent.at(-5).order&&recent.at(-6).session!==recent.at(-5).session;
  if(separateDays&&after>=70&&after-before>=suggestionRules.improvement)add(learner,'award',skill.id+'-progress','Progress in '+skill.name,[...facts,`Earlier five: ${before}%; latest five: ${after}% (+${after-before} percentage points).`,'Review criterion: gain of at least 20 percentage points; latest five at least 70%, measured on later days.'],source,150+after-before,subject);
 }
 for(const student of students){
  const quizRows=[],ratings=[],lessonIds=new Set();
  for(const lesson of lessons){
   if(!lesson.id||lessonIds.has(lesson.id)||lesson.status==='cancelled')continue;lessonIds.add(lesson.id);
   const quiz=lesson.quiz?.results?.find(r=>r.learnerId===student.id),first=quiz?.first,stamp=recentStamp(first?.submittedAt,now);
   if(stamp!==null&&Number.isFinite(first.score)&&Number.isFinite(first.total)&&first.total>0&&first.score>=0&&first.score<=first.total)quizRows.push({id:lesson.id,title:lesson.title,score:first.score,total:first.total,stamp});
   const assessment=lesson.report?.assessments?.find(r=>r.learnerId===student.id),published=recentStamp(lesson.report?.publishedAt,now);
   if(published!==null&&assessment?.attendance==='present')ratings.push({id:lesson.id,stamp:published,ratings:assessment.ratings||{}});
  }
  const quizzes=quizRows.sort((a,b)=>a.stamp-b.stamp).slice(-3);
  if(quizzes.length===suggestionRules.minLessons){const total=quizzes.reduce((n,r)=>n+r.total,0),score=quizzes.reduce((n,r)=>n+r.score,0),accuracy=Math.round(score/total*100),facts=[`${score}/${total} correct (${accuracy}%) across the latest three first-attempt lesson quizzes within 42 days.`,...quizzes.map(q=>`${q.title}: ${q.score}/${q.total}.`),'Retakes and missing or unsubmitted quizzes are excluded.'],source=quizzes.map(q=>[q.id,q.stamp,q.score,q.total]);
   if(accuracy<suggestionRules.low)add(student.id,'intervention','quiz','Review recent quiz learning',[...facts,'Review criterion: combined first-attempt accuracy below 60% across three lessons.'],source,90-accuracy);
   if(accuracy>=suggestionRules.high)add(student.id,'award','quiz','Strong first-attempt quiz work',[...facts,'Review criterion: combined first-attempt accuracy at least 90% across three lessons.'],source,accuracy-10);
  }
  for(const [field,kind,title,qualifies]of [['learning','intervention','Follow up on lesson learning',n=>n<=2],['effort','award','Consistent effort',n=>n>=4]]){
   const valid=ratings.filter(r=>Number.isInteger(r.ratings[field])&&r.ratings[field]>=1&&r.ratings[field]<=5).sort((a,b)=>a.stamp-b.stamp).slice(-3);
   if(valid.length===3&&valid.every(r=>qualifies(r.ratings[field])))add(student.id,kind,'rating-'+field,title,[`Teacher-recorded ${field} ratings: ${valid.map(r=>r.ratings[field]+'/5').join(', ')} across three published lesson assessments within 42 days.`,'Absent lessons and missing ratings are excluded.',`Review criterion: three consecutive recorded ${field} ratings ${field==='learning'?'of 2/5 or below':'of 4/5 or above'}.`],valid.map(r=>[r.id,r.stamp,r.ratings[field]]),field==='learning'?95:110);
  }
 }
 // Keep the most relevant prompt for each learner and kind, without ranking learners against peers.
 const chosen=new Map();for(const row of candidates.sort((a,b)=>b.priority-a.priority||a.key.localeCompare(b.key))){const key=row.learnerId+':'+row.kind;if(!chosen.has(key))chosen.set(key,row);}
 return [...chosen.values()];
}
export function visibleSuggestions(suggestions,records,hidden=new Set()){
 return suggestions.filter(s=>!hidden.has(s.key)&&!records.some(r=>r.suggestionKey===s.key||s.kind==='intervention'&&r.kind==='intervention'&&r.status==='active'&&r.classId===s.classId&&r.learnerId===s.learnerId));
}
