const {test}=require('node:test');
const assert=require('node:assert/strict');
const {DatabaseSync}=require('node:sqlite');
const {readFileSync,readdirSync}=require('node:fs');
const {randomUUID}=require('node:crypto');
const origin='https://inkwire-education.com';
async function fixture(){
  const {handleNotebooks}=await import('../cloudflare/notebooks.mjs');
  const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const f of readdirSync('cloudflare/migrations').filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync('cloudflare/migrations/'+f,'utf8'));
  const DB={prepare(sql){let args=[];return {bind(...a){args=a;return this;},async first(){return db.prepare(sql).get(...args)||null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}};}};
  const users=Object.fromEntries(['teacher','otherTeacher','invitedTeacher','student','otherStudent','parent','otherParent'].map(id=>{const role=id.toLowerCase().includes('teacher')?'teacher':id.toLowerCase().includes('student')?'student':'parent';db.prepare('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt,requestedRole) VALUES(?,?,?,1,0,0,?)').run(id,id,id+'@example.invalid',role);return [id,{id,emailVerified:true,requestedRole:role}];}));
  const classId=randomUUID(),otherClass=randomUUID(),learnerId=randomUUID().replace(/-/g,''),otherLearner=randomUUID();
  db.prepare('INSERT INTO classes(id,owner_id,name,subject,request_id,created_at) VALUES(?,?,?,?,?,0)').run(classId,'teacher','Literature','English',randomUUID());db.prepare('INSERT INTO classes(id,owner_id,name,subject,request_id,created_at) VALUES(?,?,?,?,?,0)').run(otherClass,'otherTeacher','Writing','English',randomUUID());
  db.prepare('INSERT INTO class_teachers VALUES(?,?,0)').run(classId,'invitedTeacher');
  for(const [id,user]of[[learnerId,'student'],[otherLearner,'otherStudent']]){db.prepare('INSERT INTO learners VALUES(?,?,?,0)').run(id,user,user);db.prepare('INSERT INTO class_students VALUES(?,?,0)').run(classId,id);}
  db.prepare('INSERT INTO learner_parents VALUES(?,?,?,0)').run(learnerId,'parent','Parent');
  const env={DB,APP_ORIGIN:origin};const base='/'+classId+'/'+learnerId;
  const call=(who,path='',body,headers={})=>handleNotebooks(new Request(origin+'/api/notebooks'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),env,users[who]);
  return {db,env,users,classId,otherClass,learnerId,otherLearner,base,call};
}
test('master and class notebooks share stable identity; account, family and current class membership limit access',async()=>{
  const f=await fixture();try{
    const all=await(await f.call('teacher')).json(),filtered=await(await f.call('teacher','?classId='+f.classId)).json();assert.equal(all.notebooks.length,2);assert.deepEqual(filtered.notebooks,all.notebooks);
    assert.equal((await(await f.call('student')).json()).notebooks.length,1);assert.equal((await(await f.call('parent')).json()).notebooks.length,1);assert.equal((await(await f.call('otherParent')).json()).notebooks.length,0);
    for(const who of ['otherTeacher','otherStudent','otherParent'])assert.equal((await f.call(who,f.base)).status,404);
    assert.equal((await f.call('invitedTeacher',f.base)).status,200);
    assert.equal((await f.call('parent',f.base+'/sections',{id:randomUUID(),title:'Not allowed'})).status,403);
    f.users.student.emailVerified=false;assert.equal((await f.call('student',f.base)).status,401);f.users.student.emailVerified=true;
    f.db.prepare('UPDATE classes SET deleted_at=1 WHERE id=?').run(f.classId);
    for(const who of ['teacher','student','parent']){assert.equal((await f.call(who,f.base)).status,404);assert.equal((await(await f.call(who)).json()).notebooks.length,0);}
    f.db.prepare('UPDATE classes SET deleted_at=NULL WHERE id=?').run(f.classId);
    f.db.prepare('DELETE FROM learner_parents').run();assert.equal((await f.call('parent',f.base)).status,404);
    f.db.prepare('DELETE FROM class_students WHERE learner_id=?').run(f.learnerId);assert.equal((await f.call('student',f.base)).status,404);
  }finally{f.db.close();}
});
test('one Yjs page merges simultaneous teacher/student edits and gives parents the current read-only content',async()=>{
  const f=await fixture();const Y=await import('yjs'),{decodeState,encodeState}=await import('../src/notebook-sync.mjs');
  try{
    const section=randomUUID(),page=randomUUID();assert.equal((await f.call('teacher',f.base+'/sections',{id:section,title:'Week 1'})).status,201);
    assert.equal((await f.call('teacher',f.base+'/pages',{id:page,sectionId:section,title:'Shared notes'})).status,201);
    const route=f.base+'/pages/'+page,initial=(await(await f.call('student',route)).json()).page;
    const a=new Y.Doc(),b=new Y.Doc();Y.applyUpdate(a,decodeState(initial.syncState));Y.applyUpdate(b,decodeState(initial.syncState));
    const at=new Y.XmlText(),bt=new Y.XmlText();at.insert(0,'Teacher feedback. ');bt.insert(0,'Student answer. ');a.getXmlFragment('document').get(0).insert(0,[at]);b.getXmlFragment('document').get(0).insert(0,[bt]);
    const saves=await Promise.all([f.call('teacher',route,{update:encodeState(Y.encodeStateAsUpdate(a))}),f.call('student',route,{update:encodeState(Y.encodeStateAsUpdate(b))})]);for(const r of saves)assert.equal(r.status,200);
    const parent=(await(await f.call('parent',route)).json()).page;const text=JSON.stringify(parent.document);assert.match(text,/Teacher feedback/);assert.match(text,/Student answer/);
    assert.equal((await f.call('parent',route,{update:encodeState(Y.encodeStateAsUpdate(a))})).status,403);
    assert.equal((await f.call('teacher',route,{update:'!!!'})).status,400);
    assert.equal((await f.call('teacher',route,{update:encodeState(Y.encodeStateAsUpdate(a))},{Origin:'https://evil.invalid'})).status,403);
    const bad=new Y.Doc();Y.applyUpdate(bad,decodeState(parent.syncState));bad.getXmlFragment('document').get(0).setAttribute('extra','a'.repeat(150000));assert.equal((await f.call('student',route,{update:encodeState(Y.encodeStateAsUpdate(bad))})).status,400);
    assert.equal((await f.call('teacher',route,{expectedUserId:'student',update:encodeState(Y.encodeStateAsUpdate(a))})).status,401);
    a.destroy();b.destroy();bad.destroy();
  }finally{f.db.close();}
});
test('organization moves references to existing PDF copies without duplicating their content',async()=>{
  const f=await fixture();try{
    const w=randomUUID(),s=randomUUID();f.db.prepare('INSERT INTO worksheets VALUES(?,?,?,?,?,?,0)').run(w,f.classId,'Reading','private.pdf','[{"width":612,"height":792}]','teacher');
    const before=await(await f.call('teacher',f.base)).json();assert.equal(before.pages[0].sectionId,'printouts');
    await f.call('teacher',f.base+'/sections',{id:s,title:'Homework'});assert.equal((await f.call('teacher',f.base+'/pages/'+w,{action:'move',sectionId:s})).status,200);
    const after=await(await f.call('parent',f.base)).json();assert.equal(after.pages.length,1);assert.equal(after.pages[0].id,w);assert.equal(after.pages[0].sectionId,s);
    assert.ok([403,404].includes((await f.call('student',f.base+'/pages/'+w,{action:'move',sectionId:'printouts'})).status));
    assert.equal((await f.call('teacher',f.base+'/pages',{id:randomUUID(),title:'Bad',sectionId:randomUUID()})).status,404);
  }finally{f.db.close();}
});

test('notebook limits and CRDT formatting validation reject oversized or unsupported work',async()=>{
 const f=await fixture();try{
  for(let i=0;i<50;i++)f.db.prepare('INSERT INTO notebook_sections VALUES(?,?,?,?,0)').run(f.classId,f.learnerId,randomUUID(),'Section');
  assert.equal((await f.call('teacher',f.base+'/sections',{id:randomUUID(),title:'Overflow'})).status,413);
  const {mergeState,seedState,encodeState}=await import('../src/notebook-sync.mjs');const Y=await import('yjs');
  const state=seedState({type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'Title'}]}]});
  const d=new Y.Doc();Y.applyUpdate(d,state);d.getXmlFragment('document').get(0).setAttribute('level',1);
  assert.throws(()=>mergeState(state,encodeState(Y.encodeStateAsUpdate(d))),/heading/);d.destroy();
 }finally{f.db.close();}
});
