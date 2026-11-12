import {buildSections} from '../src/notebook-organization.mjs';
import {notebookContext} from './notebook-organization.mjs';
import {seedState} from '../src/notebook-sync.mjs';
import {PRINT_SECTION} from '../src/notebook-model.mjs';

const indexKey=cid=>`class-boards/${cid}/index.json`;
const issue=(message,status=409)=>Object.assign(Error(message),{status});
async function readIndex(env,cid){const object=await env.WORKSHEETS.get(indexKey(cid));return object?{value:JSON.parse(new TextDecoder().decode(await object.arrayBuffer())),etag:object.etag}:null;}
function references(node,cid,id){return node?.type==='liveBoard'&&node.attrs?.classId===cid&&node.attrs?.boardId===id&&!node.attrs.snapshotId||(node?.content||[]).some(child=>references(child,cid,id));}
async function stableId(value){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),hex=[...bytes.slice(0,16)].map(v=>v.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}

// Publish only the shared activity reference. Never copy the teacher's page text,
// files, annotations, or private assessment into a student's notebook.
async function sourceLocation(env,user,cid,board){
 const ctx=await notebookContext(env,user,cid,'teacher');
 const pages=(await env.DB.prepare("SELECT id,section_id,document_json FROM teacher_notebook_pages WHERE class_id=? AND learner_id='teacher' AND kind='note' AND document_json LIKE '%liveBoard%' ORDER BY updated_at,id").bind(cid).all()).results;
 const page=pages.find(p=>ctx.pages.some(row=>row.id===p.id)&&references(JSON.parse(p.document_json),cid,board.id));
 const section=ctx.sections.find(s=>s.id===page?.section_id)||ctx.sections.find(s=>s.id==='lesson-'+board.lessonId);
 return {boardId:board.id,title:board.title,sectionId:section?.id||PRINT_SECTION,sectionTitle:section?.title||'Notes',createdAt:board.createdAt};
}

async function placementContext(env,cid,owner,course){
 const [meta,custom,pages]=await Promise.all([
  env.DB.prepare("SELECT item_id,metadata FROM notebook_item_meta WHERE class_id=? AND book_owner=? AND kind='section'").bind(cid,owner).all(),
  env.DB.prepare('SELECT id,title FROM notebook_sections WHERE class_id=? AND learner_id=?').bind(cid,owner).all(),
  env.DB.prepare('SELECT id FROM notebook_pages WHERE class_id=? AND learner_id=?').bind(cid,owner).all(),
 ]);
 const section=Object.fromEntries(meta.results.map(r=>[r.item_id,JSON.parse(r.metadata)]));
 const locked=id=>{const seen=new Set();while(id&&!seen.has(id)){seen.add(id);if(section[id]?.passwordHash)return true;id=section[id]?.parentId;}return false;};
 return {sections:buildSections(course,custom.results,section,true),metadata:{section},allPages:pages.results,locked};
}
async function courseFor(env,cid){const row=await env.DB.prepare('SELECT content FROM course_overviews WHERE class_id=?').bind(cid).first();return row?JSON.parse(row.content):null;}

export async function placeBoardInNotebook(env,user,cid,owner,placement,context=null,course=null){
 const ctx=context||await placementContext(env,cid,owner,course);
 const rows=(await env.DB.prepare("SELECT id,document_json FROM notebook_pages WHERE class_id=? AND learner_id=? AND kind='note' AND document_json LIKE '%liveBoard%'").bind(cid,owner).all()).results;
 // A manually distributed copy already containing the shared reference is enough.
 // Deleted pages also count: silently resurrecting work a teacher deleted is unsafe.
 if(rows.some(p=>references(JSON.parse(p.document_json),cid,placement.boardId)))return {existing:true};
 const pageId=await stableId(`class-board:${cid}:${owner}:${placement.boardId}`);
 if(ctx.allPages.some(p=>p.id===pageId))return {existing:true};
 let sectionId=placement.sectionId;
 let existing=ctx.sections.find(s=>s.id===sectionId);
 if(ctx.metadata.section[sectionId]?.deletedAt||existing?.group||ctx.locked(sectionId)){sectionId=await stableId(`board-section:${cid}:${owner}:${placement.sectionId}`);existing=ctx.sections.find(s=>s.id===sectionId);}
 if(ctx.metadata.section[sectionId]?.deletedAt||ctx.locked(sectionId)||existing?.group)return {skipped:true};
 if(!existing&&sectionId!==PRINT_SECTION){
  // A student may protect or remove their section. Use an explicit shared section
  // rather than bypassing that lock or modifying the existing section metadata.
  await env.DB.prepare('INSERT OR IGNORE INTO notebook_sections(class_id,learner_id,id,title,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM notebook_sections WHERE class_id=? AND learner_id=?)<50').bind(cid,owner,sectionId,placement.sectionTitle,Date.now(),cid,owner).run();
  if(!await env.DB.prepare('SELECT id FROM notebook_sections WHERE class_id=? AND learner_id=? AND id=?').bind(cid,owner,sectionId).first())throw issue('A student notebook has reached its section limit.',413);
 }
 const document={type:'doc',content:[{type:'paragraph'},{type:'liveBoard',attrs:{classId:cid,boardId:placement.boardId,snapshotId:'',title:placement.title,x:24,y:24,width:880,height:720}}]},state=seedState(document);
 await env.DB.prepare("INSERT OR IGNORE INTO notebook_pages SELECT ?,?,?,?,?,'note',?,?,1,? WHERE EXISTS(SELECT 1 FROM class_students WHERE class_id=? AND learner_id=?) AND (SELECT COUNT(*) FROM notebook_pages WHERE class_id=? AND learner_id=?)<500 AND (SELECT COALESCE(SUM(length(y_state)),0) FROM notebook_pages WHERE class_id=? AND learner_id=?)+?<=4000000").bind(cid,owner,pageId,sectionId,placement.title,JSON.stringify(document),state,Date.now(),cid,owner,cid,owner,cid,owner,state.length).run();
 if(!await env.DB.prepare('SELECT id FROM notebook_pages WHERE class_id=? AND learner_id=? AND id=?').bind(cid,owner,pageId).first())throw issue('A student notebook could not receive this board. Check enrolment and notebook storage, then retry.',413);
 await env.DB.prepare("INSERT INTO notebook_item_meta(class_id,book_owner,kind,item_id,metadata,updated_at) VALUES(?,?,'page',?,?,?) ON CONFLICT DO NOTHING").bind(cid,owner,pageId,JSON.stringify({createdAt:placement.createdAt,position:Date.now(),sharedBoardId:placement.boardId}),Date.now()).run();
 return {created:true,pageId};
}

export async function publishBoardPlacement(env,user,cid,board,roster,{onlyIfMissing=false}={}){
 if(board.audience==='teachers')return null;
 const before=await readIndex(env,cid);
 if(onlyIfMissing&&before?.value.shared?.some(p=>p.boardId===board.id))return null;
 const placement=board.published&&!board.archived?await sourceLocation(env,user,cid,board):null;
 for(let n=0;n<5;n++){
  const index=await readIndex(env,cid);if(!index)throw issue('The board library is unavailable. Try again.');
  index.value.shared=(index.value.shared||[]).filter(p=>p.boardId!==board.id);
  if(placement)index.value.shared.push(placement);
  if(await env.WORKSHEETS.put(indexKey(cid),JSON.stringify(index.value),{onlyIf:{etagMatches:index.etag},httpMetadata:{contentType:'application/json'}})!==null)break;
  if(n===4)throw issue('Another board is opening. Retry sharing in a moment.');
 }
 if(!placement)return null;
 const result={total:roster.length,ready:0,pending:0},course=await courseFor(env,cid);
 // Bound concurrent D1 work for larger classes; deterministic IDs make retries safe.
 for(let i=0;i<roster.length;i+=5)await Promise.all(roster.slice(i,i+5).map(async person=>{try{const value=await placeBoardInNotebook(env,user,cid,person.id,placement,null,course);if(value.skipped)result.pending++;else result.ready++;}catch{result.pending++;}}));
 return result;
}

export async function reconcileNotebookBoards(env,user,cid,owner){
 if(!env.WORKSHEETS||owner==='teacher')return;
 const manifest=await readIndex(env,cid);
 if(!manifest?.value.shared?.length)return;
 const refs=new Set(),stored=(await env.DB.prepare("SELECT document_json FROM notebook_pages WHERE class_id=? AND learner_id=? AND kind='note' AND document_json LIKE '%liveBoard%'").bind(cid,owner).all()).results;function collect(node){if(node?.type==='liveBoard'&&node.attrs?.classId===cid&&!node.attrs.snapshotId)refs.add(node.attrs.boardId);for(const child of node?.content||[])collect(child);}for(const row of stored)collect(JSON.parse(row.document_json));const missing=manifest.value.shared.filter(p=>!refs.has(p.boardId));if(!missing.length)return;
 const ctx=await placementContext(env,cid,owner,await courseFor(env,cid));
 let pending=0;for(const placement of missing){try{const value=await placeBoardInNotebook(env,user,cid,owner,placement,ctx);if(value.skipped)pending++;}catch{pending++;}}return {pending};
}
