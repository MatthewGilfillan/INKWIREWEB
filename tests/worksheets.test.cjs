const {test}=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {readFileSync,readdirSync}=require('node:fs');
const {randomUUID}=require('node:crypto');
const ORIGIN='https://inkwire-education.com';
const pages=[{width:612,height:792},{width:612,height:792}];
const text={kind:'text',page:0,color:'#7461ad',text:'⭐ Clear evidence',x:100,y:100,width:220,height:90,fontSize:16,bold:false};
async function fixture(){
  const {handleWorksheets,cleanMark}=await import('../cloudflare/worksheets.mjs');
  const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
  for(const name of readdirSync('cloudflare/migrations').filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync('cloudflare/migrations/'+name,'utf8'));
  const DB={prepare(sql){let args=[];return {bind(...a){args=a;return this;},execute(){const stmt=db.prepare(sql);if(/^\s*SELECT/i.test(sql))return {results:stmt.all(...args),meta:{changes:0}};return {results:[],meta:{changes:Number(stmt.run(...args).changes)}};},async run(){return this.execute();},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};}};},async batch(statements){db.exec('BEGIN');try{const result=statements.map(s=>s.execute());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};
  const objects=new Map();const WORKSHEETS={async put(key,value){objects.set(key,typeof value==='string'?new TextEncoder().encode(value):value.slice());},async get(key){const value=objects.get(key);return value?{body:value.slice(),async json(){return JSON.parse(new TextDecoder().decode(value));}}:null;},async delete(key){objects.delete(key);}};
  const env={DB,WORKSHEETS,APP_ORIGIN:ORIGIN};
  const users=Object.fromEntries(['teacher','teacher2','student','student2','parent','outsider'].map(name=>{const requestedRole=name.startsWith('teacher')?'teacher':name.startsWith('student')?'student':'parent';const u={id:name,emailVerified:true,requestedRole};db.prepare('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt,requestedRole) VALUES(?,?,?,1,0,0,?)').run(name,name,name+'@example.invalid',requestedRole);return [name,u];}));
  const classId=randomUUID(),otherClass=randomUUID(),learner=randomUUID(),otherLearner=randomUUID();
  for(const [id,owner] of [[classId,'teacher'],[otherClass,'teacher2']])db.prepare('INSERT INTO classes(id,owner_id,name,subject,request_id,created_at) VALUES(?,?,?,?,?,?)').run(id,owner,'Practice','English',randomUUID(),0);
  for(const [id,uid] of [[learner,'student'],[otherLearner,'student2']]){db.prepare('INSERT INTO learners VALUES(?,?,?,0)').run(id,uid,uid);db.prepare('INSERT INTO class_students VALUES(?,?,0)').run(classId,id);}
  db.prepare('INSERT INTO learner_parents VALUES(?,?,?,0)').run(learner,'parent','Sample parent');
  const call=(who,path='',body,method=body===undefined?'GET':'POST',headers={})=>handleWorksheets(new Request(ORIGIN+'/api/worksheets'+path,{method,headers:{Origin:ORIGIN,...headers},...(body===undefined?{}:{body:typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body)})}),env,users[who]);
  const upload=(who='teacher',id=randomUUID(),extra={})=>call(who,'?classId='+classId+'&title=Reading',readFileSync('dist/assets/worksheet-practice.pdf'),'POST',{'Content-Type':'application/pdf','X-Worksheet-Id':id,'X-PDF-Pages':JSON.stringify(pages),...extra});
  return {db,env,objects,users,classId,otherClass,learner,otherLearner,call,upload,cleanMark};
}
test('private PDF upload, idempotency, class membership and authentication',async()=>{
 const f=await fixture();try{
  const id=randomUUID();assert.equal((await f.upload('teacher',id)).status,201);assert.equal((await f.upload('teacher',id)).status,200);assert.equal(f.objects.size,1);
  const raceId=randomUUID();const race=await Promise.all([f.upload('teacher',raceId),f.upload('teacher',raceId)]);assert.deepEqual(race.map(r=>r.status).sort(),[200,201]);assert.equal(f.objects.size,2);
  assert.equal((await f.upload('student')).status,403);assert.equal((await f.upload('teacher2')).status,404);
  assert.equal((await f.call('student','/'+id+'/pdf')).status,200);assert.equal((await f.call('teacher2','/'+id+'/pdf')).status,404);
  assert.equal((await f.call('student','/'+id+'/state?learnerId='+f.otherLearner)).status,404);
  assert.equal((await f.call('parent','/'+id+'/pdf?learnerId='+f.learner)).status,404);
  f.users.student.emailVerified=false;assert.equal((await f.call('student','/'+id)).status,401);
 }finally{f.db.close();}
});
test('student and teacher marks synchronize without granting ownership of each other’s work',async()=>{
 const f=await fixture();try{
  const id=(await(await f.upload()).json()).id,studentId=randomUUID(),teacherId=randomUUID(),path='/'+id+'/marks?learnerId='+f.learner;
  const [a,b]=await Promise.all([f.call('student',path,{id:studentId,version:0,deleted:false,mark:{...text,ownerId:'teacher',layer:'teacher'}}),f.call('teacher',path,{id:teacherId,version:0,deleted:false,mark:{kind:'pen',page:0,color:'#7461ad',size:2,points:[[10,10],[20,20]]}})]);
  assert.equal(a.status,200);assert.equal(b.status,200);assert.equal((await a.json()).mark.ownerId,'student');
  assert.equal((await f.call('student',path,{id:teacherId,version:1,deleted:true,mark:text})).status,403);
  const state=await(await f.call('student','/'+id+'/state')).json();assert.equal(state.marks.length,2);assert.equal(state.revision,2);
  assert.equal((await(await f.call('student2','/'+id+'/state')).json()).marks.length,0);
  const same=await(await f.call('teacher','/'+id+'/state?learnerId='+f.learner+'&revision=2')).json();assert.equal(same.unchanged,true);
  const body={id:studentId,version:1,deleted:false,mark:{...text,text:'Revised'}};
  assert.equal((await f.call('student',path,body)).status,200);assert.equal((await f.call('student',path,body)).status,409);
  assert.equal((await f.call('teacher',path,{...body,version:2})).status,403);
  assert.equal((await f.call('student',path,{...body,version:2,deleted:true})).status,200);
  assert.equal((await f.call('student',path,{...body,version:3,deleted:false})).status,200);
  // Undo before the first autosave still creates an owned tombstone, which redo can restore.
  const earlyId=randomUUID();assert.equal((await f.call('student',path,{...body,id:earlyId,version:0,deleted:true})).status,200);
  assert.equal((await f.call('student',path,{...body,id:earlyId,version:1})).status,200);
 }finally{f.db.close();}
});
test('parents see only the linked learner’s immutable published copy',async()=>{
 const f=await fixture();try{
  const id=(await(await f.upload()).json()).id,markId=randomUUID(),suffix='?learnerId='+f.learner,path='/'+id;
  const body={id:markId,version:0,deleted:false,mark:text};await f.call('student',path+'/marks',body);
  assert.equal((await(await f.call('parent','?classId='+f.classId+'&learnerId='+f.learner)).json()).worksheets.length,0);
  assert.equal((await f.call('student',path+'/publish',{})).status,403);
  assert.equal((await f.call('teacher',path+'/publish'+suffix,{})).status,200);
  assert.equal((await f.call('parent',path+'/pdf'+suffix)).status,200);
  const published=await(await f.call('parent',path+'/state'+suffix)).json();assert.equal(published.marks[0].text,text.text);
  assert.equal((await f.call('parent',path+'/marks'+suffix,body)).status,403);
  assert.equal((await f.call('outsider',path+'/state'+suffix)).status,404);
  await f.call('student',path+'/marks',{...body,version:1,deleted:true});
  assert.equal((await(await f.call('parent',path+'/state'+suffix)).json()).marks.length,1);
  await f.call('teacher',path+'/publish'+suffix,{});
  const republished=await(await f.call('parent',path+'/state'+suffix)).json();assert.equal(republished.marks.length,0);assert.notEqual(republished.revision,published.revision);
  f.db.prepare('DELETE FROM learner_parents').run();assert.equal((await f.call('parent',path+'/pdf'+suffix)).status,404);
 }finally{f.db.close();}
});
test('input limits, locked original, CSRF, and invalid coordinates are enforced',async()=>{
 const f=await fixture();try{
  assert.equal((await f.upload('teacher',randomUUID(),{'X-PDF-Pages':'null'})).status,400);
  assert.equal((await f.upload('teacher',randomUUID(),{'X-PDF-Pages':JSON.stringify(Array(61).fill(pages[0]))})).status,400);
  assert.equal((await f.upload('teacher',randomUUID(),{Origin:'https://evil.invalid'})).status,403);
  assert.equal((await f.upload('teacher',randomUUID(),{'Content-Length':String(11*1024*1024)})).status,400);
  const id=(await(await f.upload()).json()).id,path='/'+id+'/marks';
  assert.equal((await f.call('student',path,'null')).status,400);
  for(const mark of [{...text,x:-1},{...text,page:2},{...text,text:'x'.repeat(4001)},{...text,fontSize:100},{...text,x:600},{kind:'pen',page:0,color:'#000000',size:2,points:[[0,0],[Infinity,0]]}])assert.equal((await f.call('student',path,{id:randomUUID(),version:0,deleted:false,mark})).status,400);
  assert.throws(()=>f.cleanMark({...text,x:NaN},pages));
  assert.equal((await f.call('student','/'+id+'/pdf','replacement','POST')).status,404);
  const original=await f.call('student','/'+id+'/pdf');assert.equal(original.headers.get('cache-control'),'no-store');assert.ok(new TextDecoder().decode(await original.arrayBuffer()).startsWith('%PDF-'));
  f.db.prepare('DELETE FROM class_students WHERE learner_id=?').run(f.learner);assert.equal((await f.call('student','/'+id+'/pdf')).status,404);
 }finally{f.db.close();}
});
test('linked parent notebook view reads live annotations while published worksheet snapshots remain separate',async()=>{
 const f=await fixture();try{
  const id=(await(await f.upload()).json()).id,suffix='?learnerId='+f.learner+'&notebook=1',path='/'+id;
  assert.equal((await f.call('parent',path+suffix)).status,200);
  assert.equal((await f.call('parent',path)).status,404);
  const markId=randomUUID();await f.call('student',path+'/marks',{id:markId,version:0,deleted:false,mark:text});
  const live=await(await f.call('parent',path+'/state'+suffix)).json();assert.equal(live.marks[0].text,text.text);
  assert.equal((await f.call('parent',path+'/marks'+suffix,{id:markId,version:1,deleted:true,mark:text})).status,403);
  await f.call('student',path+'/marks',{id:markId,version:1,deleted:false,mark:{...text,text:'Updated answer'}});
  assert.equal((await(await f.call('parent',path+'/state'+suffix)).json()).marks[0].text,'Updated answer');
  assert.equal((await f.call('outsider',path+'/state'+suffix)).status,404);
 }finally{f.db.close();}
});
