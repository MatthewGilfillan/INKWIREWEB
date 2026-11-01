import {cleanDocument,emptyDocument,PRINT_SECTION,catalogPages,notebookKey} from '../src/notebook-model.mjs';
import {seedState,mergeState,encodeState} from '../src/notebook-sync.mjs';
import {limitClassAction} from './classes.mjs';
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
const json=(body,status=200)=>Response.json(body,{status,headers});
const fail=(message,status=400,code='INVALID_INPUT')=>json({message,code},status);
const title=v=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=120?v.trim():null;
const canTeach=(env,user,id)=>env.DB.prepare(`SELECT id FROM classes c WHERE id=? AND c.deleted_at IS NULL AND (owner_id=? OR EXISTS (SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?))`).bind(id,user.id,user.id).first();
async function readBody(request) {
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw Error('Expected JSON.');
  const reader=request.body?.getReader();if(!reader)throw Error('Missing request.');let size=0;const chunks=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>1200000){await reader.cancel();throw Error('Page is too large.');}chunks.push(value);}
  const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}return JSON.parse(new TextDecoder().decode(bytes));
}
export async function handleNotebooks(request,env,user) {
  if(!user?.emailVerified)return fail('Please sign in to open your notebooks.',401,'UNAUTHENTICATED');
  const teacher=user.requestedRole==='teacher',student=user.requestedRole==='student',parent=user.requestedRole==='parent';
  if(!teacher&&!student&&!parent)return fail('Notebooks are available to teachers and their assigned students.',403,'FORBIDDEN');
  const url=new URL(request.url),parts=url.pathname.slice('/api/notebooks'.length).split('/').filter(Boolean);
  if(!parts.length&&request.method==='GET') {
    const classId=url.searchParams.get('classId');if(classId&&!ID.test(classId))return fail('Invalid class.');
    const rows=await env.DB.prepare(`SELECT c.id AS classId,c.name AS className,c.subject,l.id AS learnerId,l.display_name AS learnerName
      FROM classes c JOIN class_students s ON s.class_id=c.id JOIN learners l ON l.id=s.learner_id
      WHERE c.deleted_at IS NULL AND ${teacher?'(c.owner_id=? OR EXISTS (SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?))':parent?'EXISTS (SELECT 1 FROM learner_parents p WHERE p.learner_id=l.id AND p.parent_id=?)':'l.user_id=?'}
      ${classId?'AND c.id=?':''} ORDER BY c.name,l.display_name,l.id`).bind(...(teacher?[user.id,user.id]:[user.id]),...(classId?[classId]:[])).all();
    return json({userId:user.id,role:user.requestedRole,notebooks:rows.results.map(r=>({...r,id:notebookKey(r.classId,r.learnerId),title:r.learnerName})),classes:teacher?(await env.DB.prepare(`SELECT c.id,c.name FROM classes c WHERE c.deleted_at IS NULL AND (c.owner_id=? OR EXISTS (SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?)) ORDER BY c.name`).bind(user.id,user.id).all()).results:[]});
  }
  const [classId,learnerId,kind,id]=parts;
  if(!ID.test(classId||'')||!(ID.test(learnerId||'')||/^[a-f0-9]{32}$/.test(learnerId||'')))return fail('Notebook not found.',404,'NOT_FOUND');
  if(teacher&&!await canTeach(env,user,classId))return fail('Notebook not found.',404,'NOT_FOUND');
  const learner=await env.DB.prepare(`SELECT l.id,l.display_name AS name FROM learners l JOIN class_students s ON s.learner_id=l.id WHERE s.class_id=? AND l.id=? ${student?'AND l.user_id=?':parent?'AND EXISTS (SELECT 1 FROM learner_parents p WHERE p.learner_id=l.id AND p.parent_id=?)':''}`).bind(classId,learnerId,...(!teacher?[user.id]:[])).first();
  if(!learner)return fail('Notebook not found.',404,'NOT_FOUND');
  if(!await env.DB.prepare('SELECT id FROM classes WHERE id=? AND deleted_at IS NULL').bind(classId).first())return fail('Notebook not found.',404,'NOT_FOUND');
  const scope=[classId,learnerId];
  const sections=async()=>[{id:PRINT_SECTION,title:'PDF printouts'},...(await env.DB.prepare('SELECT id,title FROM notebook_sections WHERE class_id=? AND learner_id=? ORDER BY created_at,id').bind(...scope).all()).results];
  if(parts.length===2&&request.method==='GET') {
    const worksheets=(await env.DB.prepare('SELECT id,title,display_mode AS displayMode,created_at AS createdAt FROM worksheets WHERE class_id=? ORDER BY created_at,id').bind(classId).all()).results;
    const pages=(await env.DB.prepare('SELECT id,section_id AS sectionId,title,kind,version,updated_at AS updatedAt FROM notebook_pages WHERE class_id=? AND learner_id=? ORDER BY updated_at,id').bind(...scope).all()).results;
    return json({userId:user.id,learnerName:learner.name,role:user.requestedRole,sections:await sections(),pages:catalogPages(worksheets,pages)});
  }
  if(kind==='pages'&&ID.test(id||'')&&request.method==='GET'&&parts.length===4) {
    const page=await env.DB.prepare('SELECT id,title,kind,section_id AS sectionId,document_json AS document,y_state AS state,version,updated_at AS updatedAt FROM notebook_pages WHERE class_id=? AND learner_id=? AND id=?').bind(...scope,id).first();
    if(!page)return fail('Page not found.',404,'NOT_FOUND');
    if(page.document)page.document=JSON.parse(page.document);if(page.state){page.syncState=encodeState(new Uint8Array(page.state));delete page.state;}return json({page,userId:user.id});
  }
  if(parent)return fail('Parent notebooks are read-only.',403,'FORBIDDEN');
  if(request.method!=='POST')return fail('Not found.',404,'NOT_FOUND');
  if(request.headers.get('Origin')!==env.APP_ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site')return fail('Invalid origin.',403,'INVALID_ORIGIN');
  if(!await limitClassAction(env,user.id,'notebooks',6000))return fail('Please wait a moment before trying again.',429,'RATE_LIMITED');
  let input;try{input=await readBody(request);}catch(e){return fail(e.message);}
  if(!input||typeof input!=='object'||Array.isArray(input))return fail('Invalid request.');
  if(input.expectedUserId&&input.expectedUserId!==user.id)return fail('Your signed-in account changed. Reload to open its notebooks.',401,'ACCOUNT_CHANGED');
  if(kind==='sections'&&parts.length===3&&teacher) {
    if(!ID.test(input.id||'')||!title(input.title))return fail('Enter a section name of up to 120 characters.');
    await env.DB.prepare('INSERT OR IGNORE INTO notebook_sections SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM notebook_sections WHERE class_id=? AND learner_id=?)<50').bind(...scope,input.id,title(input.title),Date.now(),...scope).run();if(!(await sections()).some(s=>s.id===input.id))return fail('This notebook has reached its 50-section limit.',413,'NOTEBOOK_LIMIT');return json({sections:await sections()},201);
  }
  if(kind==='pages'&&parts.length===3&&teacher) {
    if(!ID.test(input.id||'')||!title(input.title)||(input.kind&&input.kind!=='note'))return fail('Enter a page name of up to 120 characters.');
    if(!(await sections()).some(s=>s.id===input.sectionId))return fail('Section not found.',404,'NOT_FOUND');
    await env.DB.prepare(`INSERT OR IGNORE INTO notebook_pages SELECT ?,?,?,?,?,'note',?,?,1,? WHERE (SELECT COUNT(*) FROM notebook_pages WHERE class_id=? AND learner_id=?)<500`).bind(...scope,input.id,input.sectionId,title(input.title),JSON.stringify(emptyDocument()),seedState(emptyDocument()),Date.now(),...scope).run();if(!await env.DB.prepare('SELECT id FROM notebook_pages WHERE class_id=? AND learner_id=? AND id=?').bind(...scope,input.id).first())return fail('This notebook has reached its 500-page limit.',413,'NOTEBOOK_LIMIT');return json({id:input.id},201);
  }
  if(kind==='pages'&&parts.length===4&&ID.test(id||'')) {
    const current=await env.DB.prepare('SELECT * FROM notebook_pages WHERE class_id=? AND learner_id=? AND id=?').bind(...scope,id).first();
    if(input.action==='move'&&teacher) {
      if(!(await sections()).some(s=>s.id===input.sectionId))return fail('Section not found.',404,'NOT_FOUND');
      if(current)await env.DB.prepare('UPDATE notebook_pages SET section_id=?,updated_at=? WHERE class_id=? AND learner_id=? AND id=?').bind(input.sectionId,Date.now(),...scope,id).run();
      else {
        if((await env.DB.prepare('SELECT COUNT(*) AS count FROM notebook_pages WHERE class_id=? AND learner_id=?').bind(...scope).first()).count>=500)return fail('This notebook has reached its page limit.',413,'NOTEBOOK_LIMIT');
        const w=await env.DB.prepare('SELECT title FROM worksheets WHERE class_id=? AND id=?').bind(classId,id).first();if(!w)return fail('Page not found.',404,'NOT_FOUND');
        await env.DB.prepare(`INSERT INTO notebook_pages VALUES(?,?,?,?,?,'worksheet',NULL,NULL,1,?) ON CONFLICT(class_id,learner_id,id) DO UPDATE SET section_id=excluded.section_id,updated_at=excluded.updated_at`).bind(...scope,id,input.sectionId,w.title,Date.now()).run();
      }
      return json({ok:true});
    }
    if(!current||current.kind!=='note')return fail('Page not found.',404,'NOT_FOUND');
    for(let attempt=0;attempt<4;attempt++) {
      const latest=attempt?await env.DB.prepare('SELECT * FROM notebook_pages WHERE class_id=? AND learner_id=? AND id=?').bind(...scope,id).first():current;
      let merged;try{merged=mergeState(latest.y_state,input.update);}catch(e){return fail(e.message);}
      const usage=await env.DB.prepare('SELECT COALESCE(SUM(length(y_state)),0) AS bytes FROM notebook_pages WHERE class_id=? AND learner_id=?').bind(...scope).first();if(usage.bytes-(latest.y_state?.byteLength||0)+merged.state.length>4000000)return fail('This notebook is full. Download your draft and start a new notebook.',413,'NOTEBOOK_LIMIT');
      const updatedAt=Date.now();const changed=await env.DB.prepare('UPDATE notebook_pages SET document_json=?,y_state=?,version=version+1,updated_at=? WHERE class_id=? AND learner_id=? AND id=? AND version=? AND (SELECT COALESCE(SUM(length(y_state)),0) FROM notebook_pages WHERE class_id=? AND learner_id=?)-COALESCE(length(y_state),0)+?<=4000000').bind(JSON.stringify(merged.document),merged.state,updatedAt,...scope,id,latest.version,...scope,merged.state.length).run();
      if(changed.meta.changes)return json({version:latest.version+1,updatedAt,syncState:encodeState(merged.state)});
    }
    return fail('Another edit is saving. Your changes remain on this device; retrying will merge them.',409,'RETRY');
  }
  return fail('You cannot change this notebook structure.',403,'FORBIDDEN');
}
