import {buildSections} from '../src/notebook-organization.mjs';
import {notebookContext} from './notebook-organization.mjs';
import {seedState,appendState} from '../src/notebook-sync.mjs';
import {PRINT_SECTION} from '../src/notebook-model.mjs';

const indexKey=cid=>`class-boards/${cid}/index.json`;
const issue=(message,status=409)=>Object.assign(Error(message),{status});
async function readIndex(env,cid){const object=await env.WORKSHEETS.get(indexKey(cid));return object?{value:JSON.parse(new TextDecoder().decode(await object.arrayBuffer())),etag:object.etag}:null;}
function references(node,cid,id,snapshotId=''){return node?.type==='liveBoard'&&node.attrs?.classId===cid&&node.attrs?.boardId===id&&(node.attrs.snapshotId||'')===snapshotId||(node?.content||[]).some(child=>references(child,cid,id,snapshotId));}
async function stableId(value){const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),hex=[...bytes.slice(0,16)].map(v=>v.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}

// Publish only the shared activity reference. Never copy the teacher's page text,
// files, annotations, or private assessment into a student's notebook.
export async function sourceLocation(env,user,cid,board,sourcePageId=''){
 const ctx=await notebookContext(env,user,cid,'teacher');
 const pages=(await env.DB.prepare("SELECT id,section_id,document_json FROM teacher_notebook_pages WHERE class_id=? AND learner_id='teacher' AND kind='note' AND document_json LIKE '%liveBoard%' ORDER BY updated_at,id").bind(cid).all()).results;
 const eligible=pages.filter(p=>ctx.pages.some(row=>row.id===p.id)&&!ctx.locked(ctx.pages.find(row=>row.id===p.id).sectionId)&&references(JSON.parse(p.document_json),cid,board.id));
 const page=eligible.find(p=>p.id===(sourcePageId||board.sourcePageId))||(!sourcePageId?eligible[0]:null);
 if(sourcePageId&&!page)throw issue('Save the board on this teacher notebook page before opening it to the class.');
 const pageInfo=ctx.pages.find(row=>row.id===page?.id);
 const section=ctx.sections.find(s=>s.id===pageInfo?.sectionId)||ctx.sections.find(s=>s.id==='lesson-'+board.lessonId);
 return {placementVersion:2,sourcePageId:page?.id||'',boardId:board.id,boardTitle:board.title,title:pageInfo?.title||board.title,sectionId:section?.id||PRINT_SECTION,sectionTitle:section?.title||'Notes',lessonId:board.lessonId||(section?.id.startsWith('lesson-')?section.id.slice(7):''),snapshotId:board.closedSnapshotId||'',createdAt:board.createdAt};
}

async function placementContext(env,cid,owner,course){
 const [meta,custom,pages]=await Promise.all([
  env.DB.prepare("SELECT kind,item_id,metadata FROM notebook_item_meta WHERE class_id=? AND book_owner=?").bind(cid,owner).all(),
  env.DB.prepare('SELECT id,title FROM notebook_sections WHERE class_id=? AND learner_id=?').bind(cid,owner).all(),
  env.DB.prepare('SELECT id,section_id AS sectionId,title,kind FROM notebook_pages WHERE class_id=? AND learner_id=?').bind(cid,owner).all(),
 ]);
 const section={},page={};for(const r of meta.results)(r.kind==='section'?section:page)[r.item_id]=JSON.parse(r.metadata);
 const locked=id=>{const seen=new Set();while(id&&!seen.has(id)){seen.add(id);if(section[id]?.passwordHash)return true;id=section[id]?.parentId;}return false;};
 return {sections:buildSections(course,custom.results,section,true),metadata:{section,page},allPages:pages.results.map(p=>({...p,...page[p.id]})),locked};
}
async function courseFor(env,cid){const row=await env.DB.prepare('SELECT content FROM course_overviews WHERE class_id=?').bind(cid).first();return row?JSON.parse(row.content):null;}

const sameTitle=(a,b)=>a?.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase()===b?.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
function boardNode(cid,placement,document={content:[]}){
 let bottom=0;for(const node of document.content||[]){const a=node.attrs||{};bottom=Math.max(bottom,Number(a.y||0)+Number(a.height||0));if(node.type==='paragraph'&&node.content?.length)bottom+=80;}
 return {type:'liveBoard',attrs:{classId:cid,boardId:placement.boardId,snapshotId:placement.snapshotId||'',title:placement.boardTitle||placement.title,x:24,y:Math.max(24,bottom+24),width:880,height:720}};
}
export async function placeBoardInNotebook(env,user,cid,owner,placement,context=null,course=null){
 const ctx=context||await placementContext(env,cid,owner,course);
 const rows=(await env.DB.prepare("SELECT id,document_json FROM notebook_pages WHERE class_id=? AND learner_id=? AND kind='note' AND document_json LIKE '%liveBoard%'").bind(cid,owner).all()).results;
 const placed=rows.filter(p=>references(JSON.parse(p.document_json),cid,placement.boardId,placement.snapshotId||''));
 // Do not silently resurrect a deliberately deleted shared activity.
 if(placed.some(p=>ctx.metadata.page[p.id]?.deletedAt))return {existing:true};
 let sectionId=placement.sectionId,existing=ctx.sections.find(s=>s.id===sectionId);
 if(!existing&&!ctx.metadata.section[sectionId]?.deletedAt){existing=ctx.sections.find(s=>!s.group&&!ctx.locked(s.id)&&sameTitle(s.title,placement.sectionTitle));if(existing)sectionId=existing.id;}
 if(ctx.metadata.section[sectionId]?.deletedAt||existing?.group||ctx.locked(sectionId)){sectionId=await stableId(`board-section:${cid}:${owner}:${placement.sectionId}`);existing=ctx.sections.find(s=>s.id===sectionId);}
 if(ctx.metadata.section[sectionId]?.deletedAt||ctx.locked(sectionId)||existing?.group)return {skipped:true};
 if(!existing&&sectionId!==PRINT_SECTION){
  await env.DB.prepare('INSERT OR IGNORE INTO notebook_sections(class_id,learner_id,id,title,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM notebook_sections WHERE class_id=? AND learner_id=?)<50').bind(cid,owner,sectionId,placement.sectionTitle,Date.now(),cid,owner).run();
  if(!await env.DB.prepare('SELECT id FROM notebook_sections WHERE class_id=? AND learner_id=? AND id=?').bind(cid,owner,sectionId).first())throw issue('A student notebook has reached its section limit.',413);
 }
 const matching=ctx.allPages.filter(p=>!p.deletedAt&&p.kind==='note'&&p.sectionId===sectionId&&sameTitle(p.title,placement.title));
 if(matching.some(p=>placed.some(row=>row.id===p.id))||!placement.sourcePageId&&placed.length)return {existing:true};
 if(matching.length){
  const pageId=matching[0].id;
  for(let attempt=0;attempt<5;attempt++){
   const latest=await env.DB.prepare('SELECT * FROM notebook_pages WHERE class_id=? AND learner_id=? AND id=?').bind(cid,owner,pageId).first();
   if(!latest)throw issue('The destination notebook page changed. Retry sharing.');
   const document=JSON.parse(latest.document_json);
   if(references(document,cid,placement.boardId,placement.snapshotId||''))return {existing:true,pageId};
   const merged=appendState(latest.y_state||seedState(document),[boardNode(cid,placement,document)]);
   const changed=await env.DB.prepare('UPDATE notebook_pages SET document_json=?,y_state=?,version=version+1,updated_at=? WHERE class_id=? AND learner_id=? AND id=? AND version=? AND EXISTS(SELECT 1 FROM class_students WHERE class_id=? AND learner_id=?) AND (SELECT COALESCE(SUM(length(y_state)),0) FROM notebook_pages WHERE class_id=? AND learner_id=?)-COALESCE(length(y_state),0)+?<=4000000').bind(JSON.stringify(merged.document),merged.state,Date.now(),cid,owner,pageId,latest.version,cid,owner,cid,owner,merged.state.length).run();
   if(changed.meta.changes)return {created:true,pageId};
  }
  throw issue('A student notebook is still saving or full. Retry sharing.',409);
 }
 const pageId=await stableId(`class-board:${cid}:${owner}:${placement.boardId}${placement.snapshotId?':'+placement.snapshotId:''}:${sectionId}:${placement.sourcePageId||''}`);
 if(ctx.allPages.some(p=>p.id===pageId))return {existing:true};
 const document={type:'doc',content:[{type:'paragraph'},boardNode(cid,placement)]},state=seedState(document);
 await env.DB.prepare("INSERT OR IGNORE INTO notebook_pages SELECT ?,?,?,?,?,'note',?,?,1,? WHERE EXISTS(SELECT 1 FROM class_students WHERE class_id=? AND learner_id=?) AND (SELECT COUNT(*) FROM notebook_pages WHERE class_id=? AND learner_id=?)<500 AND (SELECT COALESCE(SUM(length(y_state)),0) FROM notebook_pages WHERE class_id=? AND learner_id=?)+?<=4000000").bind(cid,owner,pageId,sectionId,placement.title,JSON.stringify(document),state,Date.now(),cid,owner,cid,owner,cid,owner,state.length).run();
 if(!await env.DB.prepare('SELECT id FROM notebook_pages WHERE class_id=? AND learner_id=? AND id=?').bind(cid,owner,pageId).first())throw issue('A student notebook could not receive this board. Check enrolment and notebook storage, then retry.',413);
 await env.DB.prepare("INSERT INTO notebook_item_meta(class_id,book_owner,kind,item_id,metadata,updated_at) VALUES(?,?,'page',?,?,?) ON CONFLICT DO NOTHING").bind(cid,owner,pageId,JSON.stringify({createdAt:placement.createdAt,position:Date.now(),sharedBoardId:placement.boardId}),Date.now()).run();
 return {created:true,pageId};
}

export async function publishBoardPlacement(env,user,cid,board,roster,{onlyIfMissing=false}={}){
 if(board.audience==='teachers')return null;
 const before=await readIndex(env,cid);
 if(onlyIfMissing&&before?.value.shared?.some(p=>p.placementVersion===2&&p.boardId===board.id&&(p.snapshotId||'')===(board.closedSnapshotId||'')))return null;
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
 for(let i=0;i<roster.length;i+=5)await Promise.all(roster.slice(i,i+5).map(async person=>{try{const live=await placeBoardInNotebook(env,user,cid,person.id,{...placement,snapshotId:''},null,course);const saved=placement.snapshotId?await placeBoardInNotebook(env,user,cid,person.id,{...placement,title:placement.title+' · Final'},null,course):null;if(live.skipped||saved?.skipped)result.pending++;else result.ready++;}catch{result.pending++;}}));
 return result;
}

export async function reconcileNotebookBoards(env,user,cid,owner){
 if(!env.WORKSHEETS||owner==='teacher')return;
 const manifest=await readIndex(env,cid);
 if(!manifest?.value.shared?.length)return;
 const refs=new Set(),stored=(await env.DB.prepare("SELECT document_json FROM notebook_pages WHERE class_id=? AND learner_id=? AND kind='note' AND document_json LIKE '%liveBoard%'").bind(cid,owner).all()).results;function collect(node){if(node?.type==='liveBoard'&&node.attrs?.classId===cid)refs.add(node.attrs.boardId+':'+(node.attrs.snapshotId||''));for(const child of node?.content||[])collect(child);}for(const row of stored)collect(JSON.parse(row.document_json));const placements=manifest.value.shared.flatMap(p=>[{...p,snapshotId:''},...(p.snapshotId?[{...p,title:p.title+' · Final'}]:[])]);const missing=placements.filter(p=>!refs.has(p.boardId+':'+(p.snapshotId||'')));if(!missing.length)return;
 const ctx=await placementContext(env,cid,owner,await courseFor(env,cid));
 let pending=0;for(const placement of missing){try{const value=await placeBoardInNotebook(env,user,cid,owner,placement,ctx);if(value.skipped)pending++;}catch{pending++;}}return {pending};
}
