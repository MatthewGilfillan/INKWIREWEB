import {limitClassAction} from './classes.mjs';
import {notebookContext,originalDocument} from './notebook-organization.mjs';
import {handleNotebooks} from './notebooks.mjs';
import {emptyDocument,documentText,cleanDocument} from '../src/notebook-model.mjs';
import {seedState,encodeState,decodeState,mergeState} from '../src/notebook-sync.mjs';
import {assignmentCounts} from '../dist/assignment-model.mjs';
import {suggestAssignments} from './assignment-suggestions.mjs';

const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,ID=/^[a-zA-Z0-9-]{1,120}$/;
const json=(v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const issue=(message,status=400,code='INVALID_INPUT')=>Object.assign(Error(message),{status,code});
const text=(v,max)=>typeof v==='string'&&v.trim().length<=max?v.trim():null;
const indexKey=id=>'assignments/'+id+'/index.json';
const attemptKey=(cid,aid,lid,attempt)=>`assignments/${cid}/${aid}/${lid}/${attempt}`;
async function read(env,key){const object=await env.WORKSHEETS.get(key);return object?{value:JSON.parse(new TextDecoder().decode(await object.arrayBuffer())),etag:object.etag}:null;}
async function store(env,key,value,etag){const result=await env.WORKSHEETS.put(key,JSON.stringify(value),{onlyIf:etag?{etagMatches:etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});if(result===null)throw issue('This work changed in another window. Refresh and try again.',409,'CONFLICT');return result;}
async function classIndex(env,cid){return await read(env,indexKey(cid))||{value:{assignments:[]},etag:null};}
async function access(env,user,cid){
 const teacher=user.requestedRole==='teacher';
 const classroom=await env.DB.prepare(`SELECT c.id,c.name FROM classes c WHERE c.id=? AND c.deleted_at IS NULL AND ${teacher?'(c.owner_id=? OR EXISTS (SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?))':user.requestedRole==='parent'?'EXISTS (SELECT 1 FROM class_students s JOIN learner_parents p ON p.learner_id=s.learner_id WHERE s.class_id=c.id AND p.parent_id=?)':'EXISTS (SELECT 1 FROM class_students s JOIN learners l ON l.id=s.learner_id WHERE s.class_id=c.id AND l.user_id=?)'}`).bind(cid,user.id,...(teacher?[user.id]:[])).first();
 if(!classroom)throw issue('Class not found.',404,'NOT_FOUND');
 const roster=(await env.DB.prepare('SELECT l.id,l.display_name AS name,l.user_id AS userId FROM learners l JOIN class_students s ON s.learner_id=l.id WHERE s.class_id=? ORDER BY l.display_name,l.id').bind(cid).all()).results;
 let own=teacher?[]:user.requestedRole==='student'?roster.filter(s=>s.userId===user.id):roster.filter(s=>false);
 if(user.requestedRole==='parent'){const rows=(await env.DB.prepare('SELECT learner_id AS id FROM learner_parents WHERE parent_id=?').bind(user.id).all()).results;own=roster.filter(s=>rows.some(r=>r.id===s.id));}
 return {classroom,roster,own,teacher};
}
function recipient(a,scope,lid){const learner=scope.roster.find(r=>r.id===lid),row=a.recipients?.find(r=>r.learnerId===lid);if(!learner||!row||!scope.teacher&&!scope.own.some(r=>r.id===lid))throw issue('Assignment not found.',404,'NOT_FOUND');return {...row,name:learner.name};}
function latest(r){return r.attempts?.at(-1);}
function publicRecipient(r,teacher){const a=latest(r),published=a?.events?.at(-1);return {learnerId:r.learnerId,name:r.name,status:r.status,startedAt:r.startedAt||null,submittedAt:a?.submittedAt||null,workspacePages:r.workspacePages||[],attempt:a?.id||null,attempts:(r.attempts||[]).map(a=>({id:a.id,submittedAt:a.submittedAt,pages:a.pages,events:(a.events||[]).map(e=>({id:e.id,status:e.status,feedback:e.feedback,at:e.at}))})),feedback:published?.feedback||'',...(teacher?{reviewVersion:r.reviewVersion||0}:{})};}
function projection(a,scope){const {recipients,operations,...safe}=a;delete safe.createdBy;return {...safe,classId:scope.classroom.id,className:scope.classroom.name,...(scope.teacher?{counts:assignmentCounts(a,scope.roster)}:{recipients:scope.own.filter(s=>recipients?.some(r=>r.learnerId===s.id)).map(s=>publicRecipient({...recipients.find(r=>r.learnerId===s.id),name:s.name},false))})};}
function find(index,aid,scope){const a=index.assignments.find(r=>r.id===aid);if(!a||!scope.teacher&&(a.state!=='active'||!a.recipients.some(r=>scope.own.some(s=>s.id===r.learnerId))))throw issue('Assignment not found.',404,'NOT_FOUND');return a;}
async function uuidFor(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)),h=[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('').slice(0,32);return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);}
function assets(document){const found=new Map();function walk(n){if(n.type==='pdfPrintout'||n.type==='notebookFile')found.set(n.attrs.assetId,{id:n.attrs.assetId,pdf:n.type==='pdfPrintout',mime:n.type==='pdfPrintout'?'application/pdf':n.attrs.mime});for(const child of n.content||[])walk(child);}walk(document);return [...found.values()];}
async function snapshot(env,user,cid,lid,aid,attempt,selected){
 if(!Array.isArray(selected)||!selected.length||selected.length>10||new Set(selected.map(p=>p.id)).size!==selected.length)throw issue('Choose one to ten notebook pages.');
 const ctx=await notebookContext(env,user,cid,lid),pages=[],legacyStates=new Map();
 for(const choice of selected){
  const page=ctx.pageUnlocked(choice.id);if(!Number.isInteger(choice.version)||choice.version!==page.version)throw issue('A notebook page changed. Refresh the page list before submitting.',409,'CONFLICT');
  const original=await originalDocument(ctx,page),document=cleanDocument(original.document);if(page.kind!=='note')legacyStates.set(page.id,await uuidFor(JSON.stringify(document)));
  if(page.kind==='note'&&original.version!==choice.version)throw issue('A notebook page changed. Refresh before submitting.',409,'CONFLICT');
  if(!documentText(document).trim()&&!document.content.some(n=>['inkStroke','pdfPrintout','notebookFile'].includes(n.type)))throw issue('Add work to '+page.title+' before submitting it.');
  const base=attemptKey(cid,aid,lid,attempt)+'/pages/'+page.id,files=assets(document);
  for(const asset of files){
   const source=original.legacyPdf&&asset.id===original.legacyPdf.assetId?original.legacyPdf.key:`${asset.pdf?'notebook-pdfs':'notebook-files'}/${cid}/${lid}/${page.id}/${asset.id}${asset.pdf?'.pdf':''}`;
   const object=await env.WORKSHEETS.get(source);if(!object)throw issue('A file on '+page.title+' is unavailable. Your work has not been submitted.',409);
   await env.WORKSHEETS.put(base+'/assets/'+asset.id,await object.arrayBuffer(),{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:asset.mime}});
  }
  const state=encodeState(seedState(document));await store(env,base+'.json',{id:page.id,title:page.title,original:state,state,version:1,assets:files},null);
  pages.push({id:page.id,title:page.title,sourceVersion:choice.version,sectionId:page.sectionId});
 }
 // Submission is published only after all selected pages have stable source versions.
 const check=await notebookContext(env,user,cid,lid);for(const p of pages){const current=check.pageUnlocked(p.id);if(current.version!==p.sourceVersion||legacyStates.has(p.id)&&await uuidFor(JSON.stringify((await originalDocument(check,current)).document))!==legacyStates.get(p.id))throw issue('A notebook page changed while submitting. Refresh and try again.',409,'CONFLICT');}
 return pages;
}
async function startWork(env,user,cid,a,lid){
 const id=await uuidFor(a.id+':'+lid+':work'),ctx=await notebookContext(env,user,cid,lid);
 if(ctx.allPages.some(p=>p.id===id&&p.deletedAt))throw issue('The assignment page is in Deleted items. Restore it in the notebook, or submit another page.',409);
 const section=ctx.sections.find(s=>s.lessonId===a.lessonId&&!s.group&&!ctx.locked(s.id))||ctx.sections.find(s=>!s.group&&!ctx.locked(s.id));
 const sectionId=section?.id||'printouts',document=emptyDocument(),state=seedState(document);
 await env.DB.prepare(`INSERT OR IGNORE INTO notebook_pages SELECT ?,?,?,?,?,'note',?,?,1,? WHERE (SELECT COUNT(*) FROM notebook_pages WHERE class_id=? AND learner_id=?)<500 AND (SELECT COALESCE(SUM(length(y_state)),0) FROM notebook_pages WHERE class_id=? AND learner_id=?)+?<=4000000`).bind(cid,lid,id,sectionId,a.title.slice(0,120),JSON.stringify(document),state,Date.now(),cid,lid,cid,lid,state.length).run();
 if(!await env.DB.prepare('SELECT id FROM notebook_pages WHERE class_id=? AND learner_id=? AND id=?').bind(cid,lid,id).first())throw issue('This notebook is full. Open the notebook to make space.',413);
 if(!ctx.metadata.page[id])await ctx.setMeta('page',id,{createdAt:Date.now(),position:Date.now()});
 return id;
}
export async function handleAssignments(request,env,user,{readJSON}){
 try{
  if(!user?.emailVerified)throw issue('Please sign in.',401,'UNAUTHENTICATED');
  if(!['teacher','student','parent'].includes(user.requestedRole))throw issue('Assignment access is unavailable.',403);
  if(!env.WORKSHEETS)throw issue('Assignments are temporarily unavailable.',503);
  const url=new URL(request.url),parts=url.pathname.slice('/api/assignments'.length).split('/').filter(Boolean);
  if(!parts.length&&request.method==='GET'){
   const rows=(await env.DB.prepare(`SELECT c.id FROM classes c WHERE c.deleted_at IS NULL AND ${user.requestedRole==='teacher'?'(c.owner_id=? OR EXISTS (SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?))':user.requestedRole==='parent'?'EXISTS (SELECT 1 FROM class_students s JOIN learner_parents p ON p.learner_id=s.learner_id WHERE s.class_id=c.id AND p.parent_id=?)':'EXISTS (SELECT 1 FROM class_students s JOIN learners l ON l.id=s.learner_id WHERE s.class_id=c.id AND l.user_id=?)'}`).bind(user.id,...(user.requestedRole==='teacher'?[user.id]:[])).all()).results;
   const groups=await Promise.all(rows.map(async c=>{const scope=await access(env,user,c.id),index=await classIndex(env,c.id);return index.value.assignments.filter(a=>a.state==='active'&&(scope.teacher||a.recipients.some(r=>scope.own.some(s=>s.id===r.learnerId)))).map(a=>projection(a,scope));}));
   return json({assignments:groups.flat().sort((a,b)=>(a.dueAt||Infinity)-(b.dueAt||Infinity)),userId:user.id});
  }
  const [kind,cid,aid,sub,lid,attempt,area,pageId,assetKind,assetId]=parts;
  if(kind!=='classes'||!UUID.test(cid||''))throw issue('Not found.',404);
  const scope=await access(env,user,cid),stored=await classIndex(env,cid),index=stored.value;
  if(parts.length===2&&request.method==='GET'){
   const courseRow=await env.DB.prepare('SELECT content FROM course_overviews WHERE class_id=?').bind(cid).first(),course=courseRow?JSON.parse(courseRow.content):null;
   return json({assignments:index.assignments.filter(a=>scope.teacher||a.state==='active'&&a.recipients.some(r=>scope.own.some(s=>s.id===r.learnerId))).map(a=>projection(a,scope)),...(scope.teacher?{students:scope.roster.map(({id,name})=>({id,name})),lessons:(course?.lessons||[]).map((l,i)=>({id:l.id||'legacy-'+(i+1),title:l.title})),timeZone:course?.timeZone||'UTC',aiAvailable:env.OPENAI_PLANNING_ENABLED==='true'&&Boolean(env.OPENAI_API_KEY)}:{}),userId:user.id});
  }
  let a=aid?find(index,aid,scope):null;
  if(a&&sub==='submissions'){
   if(!ID.test(lid||'')||!UUID.test(attempt||'')||area!=='pages'||!ID.test(pageId||''))throw issue('Page not found.',404);
   const r=recipient(a,scope,lid),submission=r.attempts?.find(s=>s.id===attempt),page=submission?.pages.find(p=>p.id===pageId);if(!page)throw issue('Page not found.',404);
   const base=attemptKey(cid,aid,lid,attempt),record=await read(env,base+'/pages/'+pageId+'.json');if(!record)throw issue('Submitted page unavailable.',404);
   if(assetKind==='assets'&&ID.test(assetId||'')&&request.method==='GET'){
    if(!record.value.assets.some(v=>v.id===assetId))throw issue('File not found.',404);
    const object=await env.WORKSHEETS.get(base+'/pages/'+pageId+'/assets/'+assetId);if(!object)throw issue('File not found.',404);
    return new Response(object.body,{headers:{'Content-Type':record.value.assets.find(v=>v.id===assetId).mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}});
   }
   if(request.method==='GET'){
    const event=submission.events?.at(-1),published=event?await read(env,base+'/published/'+event.id+'/'+pageId+'.json'):null;
    const state=scope.teacher?record.value.state:published?.value.state||record.value.original;
    return json({page:{id:pageId,title:page.title,syncState:state,version:record.value.version},editable:scope.teacher&&r.status==='submitted'&&latest(r)?.id===attempt,userId:user.id});
   }
   if(request.method!=='POST'||!scope.teacher)throw issue('Only teachers can mark submissions.',403);
   if(r.status!=='submitted'||latest(r)?.id!==attempt)throw issue('This submission is no longer awaiting review. Refresh the assignment.',409);
   if(request.headers.get('Origin')!==env.APP_ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site')throw issue('Invalid origin.',403);
   if(!await limitClassAction(env,user.id,'assignment-mark',6000))throw issue('Please wait before saving again.',429);
   const input=await readJSON(request,1200000);if(input.expectedUserId&&input.expectedUserId!==user.id)throw issue('Your account changed. Reload this page.',401);
   let merged;try{merged=mergeState(decodeState(record.value.state),input.update);}catch{throw issue('This page update is invalid or too large.');}const value={...record.value,state:encodeState(merged.state),version:record.value.version+1};await store(env,base+'/pages/'+pageId+'.json',value,record.etag);
   return json({syncState:value.state,version:value.version,userId:user.id});
  }
  if(a&&sub==='work'&&parts.length===4&&request.method==='GET'){
   const target=url.searchParams.get('learnerId')||scope.own[0]?.id,r=recipient(a,scope,target),ctx=await notebookContext(env,user,cid,target);
   return json({pages:ctx.publicPages.map(p=>({id:p.id,title:p.title,kind:p.kind,version:p.version,sectionId:p.sectionId})),workspacePages:r.workspacePages||[],userId:user.id});
  }
  if(a&&sub==='work'&&lid==='pages'&&ID.test(attempt||'')){
   const target=url.searchParams.get('learnerId')||scope.own[0]?.id;recipient(a,scope,target);const ctx=await notebookContext(env,user,cid,target);ctx.pageUnlocked(attempt);
   const response=await handleNotebooks(new Request(new URL(`/api/notebooks/${cid}/${target}/pages/${attempt}`,env.APP_ORIGIN),request),env,user);if(response.ok){const result=await response.json();return json({...result,userId:user.id,readOnly:user.requestedRole==='parent'},response.status);}return response;
  }
  if(a&&request.method==='GET'&&parts.length===3){
   const recipients=scope.teacher?a.recipients.filter(r=>scope.roster.some(s=>s.id===r.learnerId)).map(r=>publicRecipient({...r,name:scope.roster.find(s=>s.id===r.learnerId).name},true)):scope.own.filter(s=>a.recipients.some(r=>r.learnerId===s.id)).map(s=>publicRecipient({...a.recipients.find(r=>r.learnerId===s.id),name:s.name},false));
   return json({assignment:projection(a,scope),recipients,userId:user.id});
  }
  if(request.method!=='POST')throw issue('Not found.',404);
  if(request.headers.get('Origin')!==env.APP_ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site')throw issue('Invalid origin.',403);
  if(!await limitClassAction(env,user.id,'assignments',120))throw issue('Please wait before trying again.',429);
  const input=await readJSON(request,24000);if(input.expectedUserId&&input.expectedUserId!==user.id)throw issue('Your account changed. Reload this page.',401);
  if(!UUID.test(input.requestId||''))throw issue('Refresh the assignment and try again.');
  if(a?.operations?.includes(input.requestId))return json({assignment:projection(a,scope),userId:user.id});
  if(input.action==='suggest'){
   if(!scope.teacher)throw issue('Only teachers can prepare assignments.',403);
   const suggestions=await suggestAssignments(env,user,cid);await access(env,user,cid);const fresh=await classIndex(env,cid);
   const existing=new Set(fresh.value.assignments.map(a=>a.sourceKey).filter(Boolean));for(const item of suggestions)if(!existing.has(item.sourceKey)&&fresh.value.assignments.length<150){fresh.value.assignments.push({...item,id:crypto.randomUUID(),state:'draft',revision:1,createdAt:Date.now(),createdBy:user.id,assignedAt:null,recipients:[],operations:[input.requestId]});existing.add(item.sourceKey);}
   await store(env,indexKey(cid),fresh.value,fresh.etag);return json({ok:true,userId:user.id});
  }
  if(input.action==='save'){
   if(!a&&index.assignments.some(row=>row.id===input.id)){a=find(index,input.id,scope);if(a.operations?.includes(input.requestId))return json({assignment:projection(a,scope),userId:user.id});throw issue('This assignment already exists. Refresh before editing.',409);}
   if(!scope.teacher||a&&a.state!=='draft')throw issue('Only draft assignments can be edited.',403);
   if(!a&&(!UUID.test(input.id||'')||index.assignments.length>=150))throw issue('Choose a valid assignment; each class supports 150 assignments.');
   if(a&&a.revision!==input.revision)throw issue('This draft changed. Refresh before saving.',409);
   const title=text(input.title,160),instructions=text(input.instructions,8000),lessonId=input.lessonId||'',dueAt=input.dueAt??null;
   if(!title||instructions===null||!['written','reading'].includes(input.type)||!ID.test(lessonId||'none')||dueAt!==null&&(!Number.isFinite(dueAt)||dueAt<0||dueAt>Date.now()+3*366*86400000))throw issue('Enter a title, instructions and valid due date.');
   const course=await env.DB.prepare('SELECT content FROM course_overviews WHERE class_id=?').bind(cid).first();if(lessonId&&!JSON.parse(course?.content||'{}').lessons?.some((l,i)=>(l.id||'legacy-'+(i+1))===lessonId))throw issue('Choose a lesson from this course.');
   if(!a){a={id:input.id,state:'draft',revision:0,createdAt:Date.now(),createdBy:user.id,assignedAt:null,recipients:[]};index.assignments.push(a);}
   Object.assign(a,{title,instructions,type:input.type,lessonId,dueAt,revision:a.revision+1});
  }else if(input.action==='activate'){
   if(!scope.teacher||a?.state!=='draft')throw issue('Choose a teacher draft.',403);
   if(a.revision!==input.revision)throw issue('This draft changed. Review it before assigning.',409);
   if(!Array.isArray(input.learners)||!input.learners.length||input.learners.length>100||new Set(input.learners).size!==input.learners.length||input.learners.some(id=>!scope.roster.some(s=>s.id===id)))throw issue('Choose current students from this class.');
   Object.assign(a,{state:'active',assignedAt:Date.now(),revision:a.revision+1,recipients:input.learners.map(learnerId=>({learnerId,status:'assigned',workspacePages:[],attempts:[],reviewVersion:0}))});
  }else if(input.action==='start'){
   if(user.requestedRole==='parent'||a?.state!=='active')throw issue('Assignment is read-only.',403);
   const target=input.learnerId||scope.own[0]?.id;recipient(a,scope,target);const row=a.recipients.find(r=>r.learnerId===target);
   if(a.type==='written'&&!row.workspacePages?.length)row.workspacePages=[await startWork(env,user,cid,a,target)];row.startedAt||=Date.now();
  }else if(input.action==='submit'){
   if(user.requestedRole!=='student'||a?.state!=='active')throw issue('Only the assigned student can submit work.',403);
   const target=scope.own[0]?.id;recipient(a,scope,target);const row=a.recipients.find(r=>r.learnerId===target);
   if(!['assigned','revision'].includes(row.status))throw issue('This work is already submitted. Your teacher can return it for revision.',409);
   if(row.attempts.length>=20)throw issue('Ask your teacher before creating another submission.');
   const pages=a.type==='reading'?[]:await snapshot(env,user,cid,target,aid,input.requestId,input.pages);
   if(a.type==='reading'&&input.confirmed!==true)throw issue('Confirm that you have completed the reading.');
   row.attempts.push({id:input.requestId,submittedAt:Date.now(),pages,events:[]});row.status='submitted';row.reviewVersion++;
  }else if(input.action==='review'){
   if(!scope.teacher||a?.state!=='active'||!['reviewed','revision'].includes(input.status))throw issue('Choose a valid review action.',403);
   recipient(a,scope,input.learnerId);const row=a.recipients.find(r=>r.learnerId===input.learnerId),submission=latest(row);
   if(!submission||submission.id!==input.attempt||row.reviewVersion!==input.reviewVersion||!['submitted','reviewed'].includes(row.status))throw issue('This submission changed. Refresh before publishing feedback.',409);
   const feedback=text(input.feedback||'',8000);if(feedback===null||input.status==='revision'&&!feedback)throw issue('Explain what the student should revise.');
   const base=attemptKey(cid,aid,row.learnerId,submission.id);
   for(const page of submission.pages){const record=await read(env,base+'/pages/'+page.id+'.json');if(!record||input.pageVersions?.[page.id]!==record.value.version)throw issue('Wait for every page to save, then review again.',409,'CONFLICT');await store(env,base+'/published/'+input.requestId+'/'+page.id+'.json',{state:record.value.state},null);}
   submission.events.push({id:input.requestId,status:input.status,feedback,at:Date.now(),teacherId:user.id});row.status=input.status;row.reviewVersion++;
  }else throw issue('Choose a valid assignment action.');
  const finalScope=await access(env,user,cid);if(!scope.teacher)recipient(a,finalScope,scope.own[0]?.id);if(input.action==='review')recipient(a,finalScope,input.learnerId);a.operations=[...(a.operations||[]),input.requestId].slice(-100);await store(env,indexKey(cid),index,stored.etag);
  return json({assignment:projection(a,scope),userId:user.id});
 }catch(e){return json({message:e.message||'Assignments are temporarily unavailable.',code:e.code||'REQUEST_FAILED'},e.status||500);}
}
