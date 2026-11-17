import {handleClassBoards} from './class-boards.mjs';
import {endZoomForLesson} from './zoom-meetings.mjs';
import {limitClassAction} from './classes.mjs';
import {sessionKey,readLessonSession,publicLessonSession} from './lesson-session-state.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const json=(value,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function write(env,cid,lid,value,etag){return env.WORKSHEETS.put(sessionKey(cid,lid),JSON.stringify(value),{onlyIf:etag?{etagMatches:etag}:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}});}
async function snapshotId(token,boardId){const hex=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token+':'+boardId)))].slice(0,16).map(v=>v.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}
async function readJSON(env,key){const object=await env.WORKSHEETS.get(key);return object?JSON.parse(new TextDecoder().decode(await object.arrayBuffer())):null;}
export async function handleLessonSessions(request,env,user){try{
 if(!user?.emailVerified)fail('Please sign in.',401);
 const match=new URL(request.url).pathname.match(/^\/api\/lesson-sessions\/classes\/([a-f0-9-]{36})\/lessons\/([a-zA-Z0-9-]{1,80})$/);if(!match||!UUID.test(match[1]))fail('Lesson not found.',404);
 const [,cid,lid]=match,teacher=user.requestedRole==='teacher';
 if(!['teacher','student','parent'].includes(user.requestedRole))fail('Lesson not found.',404);
 const row=await env.DB.prepare(`SELECT c.id,o.content FROM classes c LEFT JOIN course_overviews o ON o.class_id=c.id WHERE c.id=? AND c.deleted_at IS NULL AND ${teacher?'(c.owner_id=? OR EXISTS(SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?))':user.requestedRole==='student'?'EXISTS(SELECT 1 FROM class_students s JOIN learners l ON l.id=s.learner_id WHERE s.class_id=c.id AND l.user_id=?)':'EXISTS(SELECT 1 FROM class_students s JOIN learner_parents p ON p.learner_id=s.learner_id WHERE s.class_id=c.id AND p.parent_id=?)'}`).bind(cid,user.id,...(teacher?[user.id]:[])).first();
 const course=row?.content?JSON.parse(row.content):null,lesson=course?.lessons?.find((l,i)=>(l.id||'legacy-'+(i+1))===lid);if(!lesson)fail('Lesson not found.',404);
 if(!env.WORKSHEETS)fail('Lesson storage is temporarily unavailable.',503);
 let stored=await readLessonSession(env,cid,lid),value=stored?.value;
 const result=(status=200)=>json({userId:user.id,session:publicLessonSession(value),...(teacher?{pendingIssues:value?.pendingIssues||[]}:{}),serverNow:Date.now()},status);
 if(request.method==='GET')return result();
 if(request.method!=='POST')fail('Use GET or POST.',405);if(!teacher)fail('Only teachers can start or end lessons.',403);
 if(request.headers.get('Origin')!==env.APP_ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site')fail('Invalid origin.',403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))fail('Expected JSON.');
 const reader=request.body?.getReader();if(!reader)fail('Missing request.');let bytes=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>3000){await reader.cancel();fail('Request too large.',413);}chunks.push(value);}const buffer=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}const raw=new TextDecoder().decode(buffer);let input;try{input=JSON.parse(raw);}catch{fail('Invalid JSON.');}
 if(!input||typeof input!=='object'||Array.isArray(input))fail('Invalid request.');
 if(input.expectedUserId!==user.id)fail('Your account changed. Reload the lesson.',401);
 if(!UUID.test(input.requestId||'')||!['start','end'].includes(input.action)||!Number.isInteger(input.revision)||input.revision<0)fail('Reload the lesson controls.');
 if(!await limitClassAction(env,user.id,'lesson-session',120))fail('Please wait a moment before trying again.',429);
 if(value?.operations?.includes(input.requestId)&&value.phase!=='ending')return result();
 if(input.revision!==(value?.revision||0)&&!(value?.phase==='ending'&&value.endToken===input.requestId))fail('This lesson changed. Refresh before trying again.',409);
 if(input.action==='start'){
  if(lesson.status==='cancelled')fail('Restore this cancelled lesson before starting it.',409);
  if(value?.phase==='running')return result();if(value?.phase==='ending')fail('Finish saving this lesson before starting it again.',409);
  value={phase:'running',revision:(value?.revision||0)+1,startedAt:Date.now(),endedAt:null,snapshots:[],pending:0,operations:[...(value?.operations||[]),input.requestId].slice(-100),history:[...(value?.history||[]),...(value?[publicLessonSession(value)]:[])].slice(-30)};
  if(!await write(env,cid,lid,value,stored?.etag))fail('Another teacher changed this lesson. Refresh.',409);return result();
 }
 if(!value||!['running','ending','ended'].includes(value.phase))fail('Start this lesson before ending it.',409);
 if(value.phase==='ended')return result();
 if(value.phase==='running'){
  if(input.endZoom===true)await endZoomForLesson(env,cid,lid);
  const manifest=await readJSON(env,`class-boards/${cid}/index.json`),boards=[];
  for(const id of manifest?.ids||[]){const b=await readJSON(env,`class-boards/${cid}/${id}/board.json`),placement=manifest.shared?.find(p=>p.boardId===id);if(b?.published&&!b.archived&&b.audience!=='teachers'&&(b.lessonId===lid||!b.lessonId&&placement?.sectionId==='lesson-'+lid))boards.push({id,title:b.title});}
  value={...value,phase:'ending',revision:value.revision+1,endToken:input.requestId,endedAt:Date.now(),boards,pending:boards.length,snapshots:[]};
  if(!await write(env,cid,lid,value,stored.etag))fail('Another teacher changed this lesson. Refresh.',409);
 }
 // Each board closes with an idempotent snapshot. Retry partial delivery without
 // accepting new student posts or replacing any earlier saved activity.
 const snapshots=[],pending=[],pendingIssues=[];
 for(const board of value.boards){try{
  const sid=await snapshotId(value.endToken,board.id),response=await handleClassBoards(new Request(env.APP_ORIGIN+`/api/class-boards/classes/${cid}/${board.id}`,{method:'POST',headers:{Origin:env.APP_ORIGIN,'Content-Type':'application/json'},body:JSON.stringify({action:'snapshot',expectedUserId:user.id,requestId:sid})}),env,user),data=await response.json();
  if(!response.ok)throw Error(data.message||'Board could not be saved.');if(data.placement?.pending)throw Error('Some student notebooks still need the final page. Check notebook storage and retry.');const saved=data.board.snapshots.find(s=>s.id===sid);snapshots.push({boardId:board.id,snapshotId:sid,title:board.title,count:saved?.count||0});
 }catch(error){pending.push(board.id);pendingIssues.push({boardId:board.id,title:board.title,message:error.message});}}
 stored=await readLessonSession(env,cid,lid);if(stored.value.endToken!==value.endToken)return json({message:'Lesson state changed. Refresh.'},409);
 value={...stored.value,phase:pending.length?'ending':'ended',revision:stored.value.revision+1,snapshots,pending:pending.length,pendingIssues,operations:pending.length?stored.value.operations:[...stored.value.operations,value.endToken].slice(-100)};
 if(!await write(env,cid,lid,value,stored.etag))fail('Another teacher is saving the final lesson. Refresh to check its status.',409);
 return result(pending.length?202:200);
}catch(error){return json({message:error.message||'Lesson state is unavailable.'},error.status||500);}}
