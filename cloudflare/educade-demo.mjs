import {digest} from './auth.mjs';
import {defaults,generateLessons,validateCourse,addDays} from '../dist/course-model.mjs';
import {applySchedule} from '../dist/schedule-model.mjs';
import {seedState} from '../src/notebook-sync.mjs';
import {PRINT_SECTION} from '../src/notebook-model.mjs';

const prefix='educade-demo-v1:';
export const demoKey=requestId=>typeof requestId==='string'&&['5a','5b'].includes(requestId.slice(prefix.length))&&requestId.startsWith(prefix)?requestId.slice(prefix.length):null;
const learnerKey=(owner,id)=>digest(`educade-demo-v1:learner:${owner}:${id}`).then(s=>s.slice(0,32));
async function stableUUID(key){const s=await digest(key);return `${s.slice(0,8)}-${s.slice(8,12)}-4${s.slice(13,16)}-8${s.slice(17,20)}-${s.slice(20,32)}`;}
const text=value=>({type:'paragraph',content:value?[{type:'text',text:value}]:[]});
export function demoCourse(key,now=Date.now()){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const monday=addDays(today,-((new Date(today+'T12:00:00Z').getUTCDay()+6)%7)-14),startTime=key==='5a'?'16:00':'17:00';
 const course={...defaults('Viking Quest · Grade 5 English'),organization:'EDUCADE demo',preset:'blank',description:'Fictional demonstration class: close reading, discussion and writing through the Viking Quest sample passages.',gradeBand:'Grade 5',weeks:4,lessonsPerWeek:2,lessonCount:8,lessonMinutes:50,startDate:monday,endDate:addDays(monday,24),startTime,timeZone:'Asia/Bangkok',pacing:'weekly',weeklySlots:[{day:2,startTime,lessonMinutes:50},{day:4,startTime,lessonMinutes:50}],billingMode:'none',assessment:{version:1,deferred:false,frameworks:[{id:'ccss-ela',scope:'g5'}],judgmentScale:'framework',notes:''},enduringUnderstandings:'Readers connect details to make and revise interpretations. Clear explanations connect a claim with relevant evidence.'};
 const titles=['Ready to sail','Inference · The rising tide','Vocabulary · Harbour supplies','Character · Two ways to help','Figurative language · Wind and water','Writing · Explain with evidence','Compare perspectives','Review and reflection'];
 course.lessons=generateLessons(course).map((lesson,i)=>({...lesson,id:`educade-${i+1}`,date:'',title:titles[i],goal:'Explain an idea using relevant details from a short text.',reading:'Viking Quest · EDUCADE sample passages',homework:'Add a response to your reading journal.'}));
 return validateCourse(applySchedule(course));
}
export async function installEducadeDemo(env,user){
 const {default:source}=await import('../dist/educade-demo-data.mjs'),now=Date.now(),statements=[],installed=[];
 for(const originalClass of source.classes){
  const classId=await stableUUID(`educade-demo-v1:class:${user.id}:${originalClass.id}`),requestId=prefix+originalClass.id;
  statements.push(env.DB.prepare('INSERT INTO classes(id,owner_id,name,subject,request_id,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(owner_id,request_id) DO NOTHING').bind(classId,user.id,originalClass.name+' · Demo','Grade 5 English · Viking Quest · Fictional demo',requestId,now));
  const learners=source.students.filter(s=>originalClass.studentIds.includes(s.id));
  for(const student of learners){
   const learnerId=await learnerKey(user.id,student.id),pageId=await stableUUID(`educade-demo-v1:page:${user.id}:${originalClass.id}:${student.id}`),sample=source.samples[student.evidence[0].skillId];
   const document={type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'Viking Quest · Reading journal'}]},text('Fictional EDUCADE learner · '+student.name),text(sample.prompt),text('Sample response: '+student.evidence[0].response),text('My ideas'),text('')]};
   statements.push(env.DB.prepare('INSERT INTO learners(id,display_name,created_at) VALUES(?,?,?) ON CONFLICT(id) DO NOTHING').bind(learnerId,student.name,now));
   statements.push(env.DB.prepare('INSERT INTO class_students(class_id,learner_id,joined_at) SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM course_overviews WHERE class_id=?) ON CONFLICT(class_id,learner_id) DO NOTHING').bind(classId,learnerId,now,classId));
   statements.push(env.DB.prepare("INSERT INTO notebook_pages(class_id,learner_id,id,section_id,title,kind,document_json,y_state,version,updated_at) SELECT ?,?,?,?,?,'note',?,?,1,? WHERE NOT EXISTS(SELECT 1 FROM course_overviews WHERE class_id=?) ON CONFLICT(class_id,learner_id,id) DO NOTHING").bind(classId,learnerId,pageId,PRINT_SECTION,'Reading journal',JSON.stringify(document),seedState(document),now,classId));
  }
  statements.push(env.DB.prepare('INSERT INTO course_overviews(class_id,revision,content,updated_by,updated_at) VALUES(?,1,?,?,?) ON CONFLICT(class_id) DO NOTHING').bind(classId,JSON.stringify(demoCourse(originalClass.id,now)),user.id,now));
  installed.push({id:classId,name:originalClass.name+' · Demo',demoKey:originalClass.id});
 }
 await env.DB.batch(statements);
 return installed;
}
// Called only after the normal class-access check on the teacher timeline.
export async function educadeSkillEvidence(env,classId,roster){
 const row=await env.DB.prepare('SELECT owner_id AS ownerId,request_id AS requestId FROM classes WHERE id=? AND deleted_at IS NULL').bind(classId).first(),key=demoKey(row?.requestId);
 if(!key)return null;
 const {default:source}=await import('../dist/educade-demo-data.mjs'),memberIds=new Set(source.classes.find(c=>c.id===key).studentIds),currentIds=new Set(roster.map(s=>s.id));
 const records=await Promise.all(source.students.filter(s=>memberIds.has(s.id)).map(async student=>{const learnerId=await learnerKey(row.ownerId,student.id);return currentIds.has(learnerId)?student.evidence.map(record=>({...record,id:`${classId}:${record.id}`,learnerId,demo:true})):[];}));
 return {demoSource:'educade-v1',skillEvidence:records.flat()};
}
