import {cleanActivity,cleanEntry} from '../dist/gradebook-model.mjs';
import {quizTimeline} from './lesson-quizzes.mjs';
import {limitClassAction} from './classes.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const issue=(message,status=400)=>Object.assign(Error(message),{status});
const validate=(fn,...args)=>{try{return fn(...args);}catch(error){throw issue(error.message);}};
const prefix=cid=>`gradebook/${cid}/activities/`,key=(cid,id)=>prefix(cid)+id+'.json';
async function read(env,k){const o=await env.WORKSHEETS.get(k);return o?{value:JSON.parse(new TextDecoder().decode(await o.arrayBuffer())),etag:o.etag}:null;}
async function scopeFor(env,user,cid){
 const teacher=user.requestedRole==='teacher';
 const c=await env.DB.prepare(`SELECT c.id,c.name FROM classes c WHERE c.id=? AND c.deleted_at IS NULL AND ${teacher?'(c.owner_id=? OR EXISTS (SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?))':user.requestedRole==='parent'?'EXISTS (SELECT 1 FROM class_students s JOIN learner_parents p ON p.learner_id=s.learner_id WHERE s.class_id=c.id AND p.parent_id=?)':'EXISTS (SELECT 1 FROM class_students s JOIN learners l ON l.id=s.learner_id WHERE s.class_id=c.id AND l.user_id=?)'}`).bind(cid,user.id,...(teacher?[user.id]:[])).first();
 if(!c)throw issue('Class not found.',404);
 const roster=(await env.DB.prepare('SELECT l.id,l.display_name AS name,l.user_id AS userId FROM learners l JOIN class_students s ON s.learner_id=l.id WHERE s.class_id=? ORDER BY l.display_name,l.id').bind(cid).all()).results;
 const parents=user.requestedRole==='parent'?(await env.DB.prepare('SELECT learner_id AS id FROM learner_parents WHERE parent_id=?').bind(user.id).all()).results:[];
 return {teacher,classroom:c,roster:teacher?roster:roster.filter(l=>user.requestedRole==='student'?l.userId===user.id:parents.some(p=>p.id===l.id))};
}
function familyEntry(p){const {privateNote,sourceEvidence,by,...entry}=p;return entry;}
function projection(a,scope,detail=false){
 const entries=a.entries.filter(e=>scope.roster.some(l=>l.id===e.learnerId)).map(e=>scope.teacher?{...e,...(!detail?{history:undefined}:{})}:{learnerId:e.learnerId,published:e.published?{...familyEntry(e.published),activity:e.published.activity}:null}).filter(e=>scope.teacher||e.published);
 if(!scope.teacher)return entries.length?{id:a.id,entries}:null;
 const {operations,...safe}=a;return {...safe,entries};
}
async function validateSource(env,cid,source){
 if(source.kind==='manual')return;
 if(source.kind==='quiz'){if(!await env.DB.prepare('SELECT lesson_id FROM lesson_quizzes WHERE class_id=? AND lesson_id=?').bind(cid,source.id).first())throw issue('Quiz not found in this class.');return;}
 if(source.kind==='lesson'){const r=await env.DB.prepare('SELECT content FROM course_overviews WHERE class_id=?').bind(cid).first();if(!r||!JSON.parse(r.content).lessons?.some((l,i)=>(l.id||'legacy-'+(i+1))===source.id))throw issue('Lesson not found in this class.');return;}
 if(source.kind==='assignment'){const row=await read(env,`assignments/${cid}/index.json`);if(!row?.value.assignments?.some(a=>a.id===source.id))throw issue('Assignment not found in this class.');return;}
 if(source.kind==='notebook'&&!await env.DB.prepare('SELECT id FROM notebook_pages WHERE class_id=? AND id=? UNION SELECT id FROM teacher_notebook_pages WHERE class_id=? AND id=?').bind(cid,source.id,cid,source.id).first())throw issue('Notebook page not found in this class.');
}
export async function handleGradebook(request,env,user,{readJSON}){
 try{
  if(!user?.emailVerified)throw issue('Please sign in.',401);
  if(!['teacher','student','parent'].includes(user.requestedRole))throw issue('Class membership required.',403);
  if(!env.WORKSHEETS)throw issue('Gradebook is temporarily unavailable.',503);
  const m=new URL(request.url).pathname.match(/^\/api\/gradebook\/classes\/([a-f0-9-]{36})(?:\/([a-f0-9-]{36}))?$/);if(!m||!UUID.test(m[1])||m[2]&&!UUID.test(m[2]))throw issue('Not found.',404);
  const [,cid,id]=m,scope=await scopeFor(env,user,cid);
  if(request.method==='GET'){
   if(id){const r=await read(env,key(cid,id));if(!r)throw issue('Activity not found.',404);const activity=projection(r.value,scope,true);if(!activity)throw issue('Activity not found.',404);return json({activity,teacher:scope.teacher,userId:user.id});}
   const activities=[];let cursor;
   do{const page=await env.WORKSHEETS.list({prefix:prefix(cid),limit:100,cursor});for(const item of page.objects){const r=await read(env,item.key);if(r){const a=projection(r.value,scope);if(a)activities.push(a);}}cursor=page.truncated?page.cursor:undefined;}while(cursor);
   return json({classId:cid,className:scope.classroom.name,teacher:scope.teacher,userId:user.id,students:scope.roster.map(({id,name})=>({id,name})),activities:activities.sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.updatedAt||0)-(a.updatedAt||0))});
  }
  if(request.method!=='POST')throw issue('Use GET or POST.',405);
  if(!scope.teacher)throw issue('Only class teachers can record or publish grades.',403);
  if(request.headers.get('Origin')!==env.APP_ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site')throw issue('Invalid origin.',403);
  let input;try{input=await readJSON(request,40000);}catch{throw issue('Check the gradebook request.');}if(!input||typeof input!=='object')throw issue('Check the gradebook request.');if(input.expectedUserId!==user.id)throw issue('Your account changed. Reload the gradebook.',401);
  if(!UUID.test(input.requestId||''))throw issue('Refresh and try again.');
  if(!await limitClassAction(env,user.id,'gradebook',240))throw issue('Please wait before saving again.',429);
  const aid=id||input.requestId,stored=await read(env,key(cid,aid));let a=stored?.value;
  if(a?.operations.includes(input.requestId))return json({activity:projection(a,scope,true)});
  const now=Date.now();
  if(input.action==='create'&&!id){
   if(a)throw issue('This activity already exists.',409);const activity=validate(cleanActivity,input.activity);await validateSource(env,cid,activity.source);
   a={...activity,id:aid,classId:cid,revision:1,createdAt:now,createdBy:user.id,entries:[],operations:[]};
  }else{
   if(!a||!id)throw issue('Activity not found.',404);
   if(input.revision!==a.revision)throw issue('Another teacher changed this activity. Close and reopen it before saving.',409);
   if(input.action==='update'){
    const updated=validate(cleanActivity,input.activity);
    if(a.entries.length&&['format','max','standards','source'].some(k=>JSON.stringify(updated[k])!==JSON.stringify(a[k])))throw issue('This activity has evidence. Create a follow-up activity to change its scale, source or standards.');
    await validateSource(env,cid,updated.source);Object.assign(a,updated);
   }else if(input.action==='entry'){
    if(!scope.roster.some(l=>l.id===input.learnerId))throw issue('Student no longer belongs to this class.',404);
    if(!['draft','publish','withdraw'].includes(input.mode))throw issue('Choose save draft or publish.');
    let row=a.entries.find(e=>e.learnerId===input.learnerId);if(!row){row={learnerId:input.learnerId,draft:null,published:null,history:[]};a.entries.push(row);}
    if(row.history.length>=200)throw issue('This record has 200 revisions. Create a follow-up assessment to continue.');
    if(input.mode==='withdraw'){if(!row.published)throw issue('No published result to withdraw.');row.published=null;}
    else{
     const entry=validate(cleanEntry,input.entry,a);let sourceEvidence=null;
     if(a.source.kind==='quiz'){const q=(await quizTimeline(env,cid,{learnerId:row.learnerId})).get(a.source.id);sourceEvidence=q?{type:'automatic-quiz',title:q.title,quizRevision:q.revision,result:q.result,capturedAt:now}:null;}
     row.draft={...entry,sourceEvidence,by:user.id,at:now,activity:{title:a.title,date:a.date,purpose:a.purpose,format:a.format,max:a.max,standards:a.standards,successCriteria:a.successCriteria}};
     if(input.mode==='publish')row.published=structuredClone(row.draft);
    }
    row.history.push({id:input.requestId,action:input.mode,by:user.id,at:now,entry:structuredClone(input.mode==='withdraw'?null:row.draft)});
   }else throw issue('Choose a supported gradebook action.');
   a.revision++;
  }
  a.updatedAt=now;a.operations=[...a.operations.slice(-99),input.requestId];
  const bytes=JSON.stringify(a);if(new TextEncoder().encode(bytes).length>8*1024*1024)throw issue('This activity has reached its record limit. Create a follow-up assessment.');
  const saved=await env.WORKSHEETS.put(key(cid,aid),bytes,{onlyIf:stored?{etagMatches:stored.etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});
  if(saved===null)throw issue('Another teacher saved at the same time. Close and reopen before saving.',409);
  return json({activity:projection(a,scope,true)},input.action==='create'?201:200);
 }catch(error){return json({message:error.status?error.message:'Gradebook is temporarily unavailable. Please try again.'},error.status||503);}
}
