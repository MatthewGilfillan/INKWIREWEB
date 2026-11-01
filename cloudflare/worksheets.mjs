import {limitClassAction} from './classes.mjs';

const ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const MAX_PDF = 10 * 1024 * 1024;
const MAX_MARKS = 2000;
const MAX_WORK = 1500000;
const headers = {'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const json = (body,status=200) => Response.json(body,{status,headers});
const fail = (message,status=400,code='INVALID_INPUT',extra={}) => json({message,code,...extra},status);
const teacherAccess = (env,user,classId) => env.DB.prepare(`SELECT id,name FROM classes c WHERE id=? AND
  (owner_id=? OR EXISTS (SELECT 1 FROM class_teachers t WHERE t.class_id=c.id AND t.user_id=?))`).bind(classId,user.id,user.id).first();

async function access(env,user,classId,learnerId) {
  if(!await env.DB.prepare('SELECT id FROM classes WHERE id=? AND deleted_at IS NULL').bind(classId).first())return null;
  if(user.requestedRole==='teacher') {
    if(!await teacherAccess(env,user,classId))return null;
    if(!learnerId)return {role:'teacher',learnerId:null};
    const learner=await env.DB.prepare(`SELECT l.id,l.display_name AS name FROM learners l JOIN class_students s ON s.learner_id=l.id WHERE s.class_id=? AND l.id=?`).bind(classId,learnerId).first();
    return learner?{role:'teacher',learnerId:learner.id,learnerName:learner.name}:null;
  }
  if(user.requestedRole==='student') {
    const learner=await env.DB.prepare(`SELECT l.id,l.display_name AS name FROM learners l JOIN class_students s ON s.learner_id=l.id WHERE s.class_id=? AND l.user_id=?`).bind(classId,user.id).first();
    return learner&&(!learnerId||learnerId===learner.id)?{role:'student',learnerId:learner.id,learnerName:learner.name}:null;
  }
  if(user.requestedRole==='parent'&&learnerId) {
    const learner=await env.DB.prepare(`SELECT l.id,l.display_name AS name FROM learners l JOIN class_students s ON s.learner_id=l.id JOIN learner_parents p ON p.learner_id=l.id WHERE s.class_id=? AND l.id=? AND p.parent_id=?`).bind(classId,learnerId,user.id).first();
    return learner?{role:'parent',learnerId:learner.id,learnerName:learner.name}:null;
  }
  return null;
}
async function boundedBody(request,limit) {
  if(Number(request.headers.get('Content-Length'))>limit)throw Error('TOO_LARGE');
  const reader=request.body?.getReader();if(!reader)throw Error('EMPTY');
  const parts=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw Error('TOO_LARGE');}parts.push(value);}
  const result=new Uint8Array(size);let offset=0;for(const p of parts){result.set(p,offset);offset+=p.length;}return result;
}
const unpack = row => ({id:row.id,ownerId:row.owner_id,layer:row.layer,version:row.version,deleted:!!row.deleted,...JSON.parse(row.data_json)});
const finite = (n,min,max) => typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
export function cleanMark(value,pages) {
  if(!value||!Number.isInteger(value.page)||!pages[value.page]||!/^#[a-fA-F0-9]{6}$/.test(value.color||''))throw Error('INVALID_MARK');
  const page=pages[value.page],base={page:value.page,kind:value.kind,color:value.color};
  if(value.kind==='text') {
    if(typeof value.text!=='string'||value.text.length>4000||!finite(value.x,0,page.width)||!finite(value.y,0,page.height)||!finite(value.width,20,page.width)||!finite(value.height,20,page.height)||value.x+value.width>page.width+1||value.y+value.height>page.height+1||!finite(value.fontSize,8,60))throw Error('INVALID_TEXT');
    return {...base,text:value.text,x:value.x,y:value.y,width:value.width,height:value.height,fontSize:value.fontSize,bold:value.bold===true};
  }
  if(!['pen','highlight'].includes(value.kind)||!finite(value.size,0.5,30)||!Array.isArray(value.points)||value.points.length<2||value.points.length>1500||!value.points.every(p=>Array.isArray(p)&&p.length===2&&finite(p[0],0,page.width)&&finite(p[1],0,page.height)))throw Error('INVALID_STROKE');
  return {...base,size:value.size,points:value.points.map(p=>[p[0],p[1]])};
}
async function state(env,id,learnerId) {
  const results=await env.DB.batch([
    env.DB.prepare('SELECT revision FROM worksheet_states WHERE worksheet_id=? AND learner_id=?').bind(id,learnerId),
    env.DB.prepare('SELECT * FROM worksheet_marks WHERE worksheet_id=? AND learner_id=?').bind(id,learnerId),
  ]);
  return {revision:results[0].results[0]?.revision||0,marks:results[1].results.map(unpack)};
}

export async function handleWorksheets(request,env,user) {
  if(!user?.emailVerified)return fail('Please sign in.',401,'UNAUTHENTICATED');
  if(!env.WORKSHEETS)return fail('Worksheet file storage is being connected. Please try again shortly.',503,'STORAGE_UNAVAILABLE');
  const url=new URL(request.url),classId=url.searchParams.get('classId'),learnerId=url.searchParams.get('learnerId');
  if(request.method!=='GET'&&(request.headers.get('Origin')!==env.APP_ORIGIN||request.headers.get('Sec-Fetch-Site')==='cross-site'))return fail('Invalid origin.',403,'INVALID_ORIGIN');
  if(url.pathname==='/api/worksheets') {
    if(!ID.test(classId||''))return fail('Choose a class.');
    const scope=await access(env,user,classId,learnerId);if(!scope)return fail('Class not found.',404,'NOT_FOUND');
    if(request.method==='GET') {
      const classroom=await env.DB.prepare('SELECT name FROM classes WHERE id=?').bind(classId).first();
      const rows=scope.role==='parent'&&url.searchParams.get('notebook')!=='1'
        ?await env.DB.prepare(`SELECT w.id,w.title,w.pages_json,p.published_at FROM worksheets w JOIN worksheet_publications p ON p.worksheet_id=w.id WHERE w.class_id=? AND p.learner_id=? ORDER BY w.created_at DESC`).bind(classId,scope.learnerId).all()
        :await env.DB.prepare('SELECT id,title,pages_json,created_at FROM worksheets WHERE class_id=? ORDER BY created_at DESC').bind(classId).all();
      const students=scope.role==='teacher'?(await env.DB.prepare(`SELECT l.id,l.display_name AS name FROM learners l JOIN class_students s ON s.learner_id=l.id WHERE s.class_id=? ORDER BY l.display_name,l.id`).bind(classId).all()).results:[];
      return json({userId:user.id,...scope,className:classroom.name,students,worksheets:rows.results.map(r=>({id:r.id,title:r.title,pageCount:JSON.parse(r.pages_json).length,publishedAt:r.published_at||null}))});
    }
    if(request.method!=='POST')return fail('Use GET or POST.',405);
    if(scope.role!=='teacher')return fail('Only a class teacher can upload worksheets.',403,'FORBIDDEN');
    const id=request.headers.get('X-Worksheet-Id'),title=(url.searchParams.get('title')||'').trim();
    if(!ID.test(id||'')||!title||title.length>120||request.headers.get('Content-Type')!=='application/pdf')return fail('Choose a PDF and a title of up to 120 characters.');
    const existing=await env.DB.prepare('SELECT id,class_id,created_by FROM worksheets WHERE id=?').bind(id).first();
    if(existing)return existing.class_id===classId&&existing.created_by===user.id?json({id},200):fail('This upload ID is already used.',409);
    if(!await limitClassAction(env,user.id,'worksheet-upload',10))return fail('Please wait before uploading more worksheets.',429,'RATE_LIMITED');
    let pages,bytes;
    try {
      pages=JSON.parse(request.headers.get('X-PDF-Pages')||'null');
      if(!Array.isArray(pages)||!pages.length||pages.length>60||!pages.every(p=>finite(p.width,50,2000)&&finite(p.height,50,2000)))throw Error();
      pages=pages.map(p=>({width:p.width,height:p.height}));
      bytes=await boundedBody(request,MAX_PDF);
      if(new TextDecoder().decode(bytes.slice(0,5))!=='%PDF-')throw Error();
    }catch{return fail('Use a valid PDF of up to 10 MB and 60 pages.',400,'INVALID_PDF');}
    const key='worksheets/'+id+'/'+crypto.randomUUID()+'.pdf';
    await env.WORKSHEETS.put(key,bytes,{httpMetadata:{contentType:'application/pdf'}});
    try {await env.DB.prepare('INSERT INTO worksheets (id,class_id,title,pdf_key,pages_json,created_by,created_at) VALUES (?,?,?,?,?,?,?)').bind(id,classId,title,key,JSON.stringify(pages),user.id,Date.now()).run();}
    catch(error){await env.WORKSHEETS.delete(key);const winner=await env.DB.prepare('SELECT class_id,created_by FROM worksheets WHERE id=?').bind(id).first();if(winner)return winner.class_id===classId&&winner.created_by===user.id?json({id},200):fail('This upload ID is already used.',409);throw error;}
    return json({id},201);
  }
  const match=url.pathname.match(/^\/api\/worksheets\/([a-f0-9-]{36})(?:\/(pdf|state|marks|publish))?$/);
  if(!match)return fail('Not found.',404,'NOT_FOUND');
  const [,id,action]=match;
  const worksheet=await env.DB.prepare('SELECT * FROM worksheets WHERE id=?').bind(id).first();
  if(!worksheet)return fail('Worksheet not found.',404,'NOT_FOUND');
  const scope=await access(env,user,worksheet.class_id,learnerId);if(!scope)return fail('Worksheet not found.',404,'NOT_FOUND');
  const publication=scope.learnerId?await env.DB.prepare('SELECT snapshot_key,published_at FROM worksheet_publications WHERE worksheet_id=? AND learner_id=?').bind(id,scope.learnerId).first():null;
  const liveParent=scope.role==='parent'&&url.searchParams.get('notebook')==='1';
  if(scope.role==='parent'&&!publication&&!liveParent)return fail('This worksheet has not been shared with you yet.',404,'NOT_FOUND');
  if(!action&&request.method==='GET')return json({id,title:worksheet.title,classId:worksheet.class_id,pages:JSON.parse(worksheet.pages_json),userId:user.id,...scope,publishedAt:publication?.published_at||null});
  if(action==='pdf'&&request.method==='GET') {
    const pdf=await env.WORKSHEETS.get(worksheet.pdf_key);if(!pdf)return fail('PDF unavailable.',404);
    return new Response(pdf.body,{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':`inline; filename="worksheet-${id}.pdf"`,'Content-Security-Policy':"sandbox; default-src 'none'"}});
  }
  if(!scope.learnerId)return fail('Choose a student to open their copy.',400,'LEARNER_REQUIRED');
  if(action==='state'&&request.method==='GET') {
    if(scope.role==='parent'&&!liveParent) {
      if(url.searchParams.get('revision')===publication.snapshot_key)return json({unchanged:true,revision:publication.snapshot_key});
      const snapshot=await env.WORKSHEETS.get(publication.snapshot_key);if(!snapshot)return fail('Published copy unavailable.',503);
      return json({...await snapshot.json(),revision:publication.snapshot_key,publishedAt:publication.published_at});
    }
    const revision=(await env.DB.prepare('SELECT revision FROM worksheet_states WHERE worksheet_id=? AND learner_id=?').bind(id,scope.learnerId).first())?.revision||0;
    if(url.searchParams.get('revision')===String(revision))return json({unchanged:true,revision});
    return json(await state(env,id,scope.learnerId));
  }
  if(request.method!=='POST')return fail('Use POST.',405);
  if(scope.role==='parent')return fail('Parent copies are read-only.',403,'FORBIDDEN');
  if(action==='publish') {
    if(scope.role!=='teacher')return fail('Only a class teacher can share work with parents.',403,'FORBIDDEN');
    if(!await limitClassAction(env,user.id,'worksheet-publish',60))return fail('Please wait before sharing more copies.',429,'RATE_LIMITED');
    const snapshot=await state(env,id,scope.learnerId),key=`worksheets/${id}/published/${scope.learnerId}/${crypto.randomUUID()}.json`,publishedAt=Date.now();
    await env.WORKSHEETS.put(key,JSON.stringify({...snapshot,marks:snapshot.marks.filter(m=>!m.deleted)}),{httpMetadata:{contentType:'application/json'}});
    try {await env.DB.prepare(`INSERT INTO worksheet_publications (worksheet_id,learner_id,snapshot_key,published_at) VALUES (?,?,?,?) ON CONFLICT(worksheet_id,learner_id) DO UPDATE SET snapshot_key=excluded.snapshot_key,published_at=excluded.published_at`).bind(id,scope.learnerId,key,publishedAt).run();}
    catch(error){await env.WORKSHEETS.delete(key);throw error;}
    // Keep immutable private snapshots so concurrent readers never lose their copy.
    return json({publishedAt});
  }
  if(action!=='marks')return fail('Not found.',404);
  let input;try{input=JSON.parse(new TextDecoder().decode(await boundedBody(request,65536)));}catch{return fail('This annotation is too large or invalid.');}
  if(!input||!ID.test(input.id||'')||!Number.isInteger(input.version)||input.version<0||typeof input.deleted!=='boolean')return fail('Invalid annotation.');
  const previous=await env.DB.prepare('SELECT * FROM worksheet_marks WHERE worksheet_id=? AND learner_id=? AND id=?').bind(id,scope.learnerId,input.id).first();
  if(previous&&(previous.owner_id!==user.id||previous.layer!==scope.role))return fail('You can change only your own annotations.',403,'FORBIDDEN');
  if((previous?.version||0)!==input.version)return fail('This annotation changed in another tab. Reload to review the latest copy.',409,'EDIT_CONFLICT',{current:previous?unpack(previous):null});
  let mark;try{mark=cleanMark(input.mark,JSON.parse(worksheet.pages_json));}catch{return fail('Invalid annotation.');}
  const encoded=JSON.stringify(mark),usage=await env.DB.prepare('SELECT COUNT(*) AS count,COALESCE(SUM(length(data_json)),0) AS bytes FROM worksheet_marks WHERE worksheet_id=? AND learner_id=?').bind(id,scope.learnerId).first();
  if((!previous&&usage.count>=MAX_MARKS)||usage.bytes-(previous?.data_json.length||0)+encoded.length>MAX_WORK)return fail('This notebook copy is full. Print a copy and start a new worksheet.',413,'WORK_LIMIT');
  const mutation=previous?env.DB.prepare(`UPDATE worksheet_marks SET data_json=?,deleted=?,version=version+1 WHERE worksheet_id=? AND learner_id=? AND id=? AND version=? AND owner_id=?`).bind(encoded,input.deleted?1:0,id,scope.learnerId,input.id,input.version,user.id)
    :env.DB.prepare('INSERT OR IGNORE INTO worksheet_marks (worksheet_id,learner_id,id,owner_id,layer,data_json,version,deleted) VALUES (?,?,?,?,?,?,1,?)').bind(id,scope.learnerId,input.id,user.id,scope.role,encoded,input.deleted?1:0);
  const results=await env.DB.batch([
    env.DB.prepare('INSERT OR IGNORE INTO worksheet_states (worksheet_id,learner_id,revision) VALUES (?,?,0)').bind(id,scope.learnerId),mutation,
    env.DB.prepare('UPDATE worksheet_states SET revision=revision+1 WHERE worksheet_id=? AND learner_id=?').bind(id,scope.learnerId),
  ]);
  const saved=await env.DB.prepare('SELECT * FROM worksheet_marks WHERE worksheet_id=? AND learner_id=? AND id=?').bind(id,scope.learnerId,input.id).first();
  if(!(results[1].meta?.changes??results[1].changes))return fail('This annotation changed in another tab. Reload to review the latest copy.',409,'EDIT_CONFLICT',{current:saved?unpack(saved):null});
  return json({mark:unpack(saved)});
}
