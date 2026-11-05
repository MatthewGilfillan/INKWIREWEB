const {test}=require('node:test'),assert=require('node:assert/strict');
const {classSetupFixture,users,origin}=require('./helpers/class-setup-fixture.cjs');

test('demo installation is authenticated, account-scoped and idempotent across normal classes, courses, calendars and notebooks',async()=>{
 const f=await classSetupFixture();
 try{
  assert.equal((await f.api('/api/classes/demo-educade',{version:1},users.sa)).status,403);
  assert.equal((await f.api('/api/classes/demo-educade',{version:1},null)).status,401);
  assert.equal((await f.api('/api/classes/demo-educade',{version:1},users.t,{Origin:'https://other.invalid'})).status,403);
  assert.equal((await f.api('/api/classes/demo-educade',{version:1,ownerId:'u'})).status,400);
  const r=await f.api('/api/classes/demo-educade',{version:1});assert.equal(r.status,201);const {classes}=await r.json();assert.equal(classes.length,2);
  const rows=(await(await f.api('/api/classes')).json()).classes,other=(await(await f.api('/api/classes',undefined,users.u)).json()).classes;
  assert.equal(rows.filter(c=>c.demoKey).length,2);assert.equal(other.length,0);
  assert.equal(f.db.prepare("SELECT COUNT(*) n FROM learners WHERE id NOT IN('a','b')").get().n,9);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM learning_invites').get().n,0);
  for(const c of classes){
   const o=await(await f.api('/api/classes/'+c.id+'/overview')).json();assert.equal(o.course.lessons.length,8);assert.equal(o.course.billingMode,'none');assert.ok(o.course.lessons.every(l=>l.date&&!l.rescheduledFrom));
  }
  const {handleNotebooks}=await import('../cloudflare/notebooks.mjs');
  const notebooks=await(await handleNotebooks(new Request(origin+'/api/notebooks'),f.env,users.t)).json();assert.equal(notebooks.notebooks.filter(n=>!n.teacherBook&&classes.some(c=>c.id===n.classId)).length,9);
  const notebook=notebooks.notebooks.find(n=>!n.teacherBook&&n.classId===classes[0].id),path='/api/notebooks/'+notebook.classId+'/'+notebook.learnerId;
  const info=await(await handleNotebooks(new Request(origin+path),f.env,users.t)).json();assert.equal(info.pages.length,1);assert.equal(info.pages[0].title,'Reading journal');
  const page=await(await handleNotebooks(new Request(origin+path+'/pages/'+info.pages[0].id),f.env,users.t)).json();assert.ok(page.page.syncState);assert.match(JSON.stringify(page.page.document),/Fictional EDUCADE learner/);
  assert.equal((await handleNotebooks(new Request(origin+path),f.env,users.u)).status,404);
  const {addDays}=await import('../dist/course-model.mjs');
  const start=JSON.parse(f.db.prepare('SELECT content FROM course_overviews WHERE class_id=?').get(classes[0].id).content).startDate;
  const calendarResponse=await f.api('/api/classes/calendar?from='+start+'&to='+addDays(start,28));assert.equal(calendarResponse.status,200);
  const calendar=await calendarResponse.json();assert.equal(calendar.events.filter(event=>classes.some(c=>c.id===event.classId)).length,16);
  f.db.prepare('UPDATE notebook_pages SET title=? WHERE class_id=?').run('My edited journal',classes[0].id);
  f.db.prepare('DELETE FROM class_students WHERE class_id=? AND learner_id=?').run(notebook.classId,notebook.learnerId);
  assert.equal((await f.api('/api/classes/demo-educade',{version:1})).status,201);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM classes WHERE owner_id=?').get('t').n,3);
  assert.equal(f.db.prepare('SELECT title FROM notebook_pages WHERE class_id=? LIMIT 1').get(classes[0].id).title,'My edited journal');
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM class_students WHERE class_id=? AND learner_id=?').get(notebook.classId,notebook.learnerId).n,0);
 }finally{f.db.close();}
});

test('saved demo skill evidence follows the current class roster and stays private to its owning account',async()=>{
 const f=await classSetupFixture();
 try{
  const {classes}=await(await f.api('/api/classes/demo-educade',{version:1})).json(),c=classes.find(c=>c.demoKey==='5a');
  const {handleLessonFeedback}=await import('../cloudflare/lesson-feedback.mjs');
  const request=who=>handleLessonFeedback(new Request(origin+'/api/lesson-feedback/classes/'+c.id+'/timeline'),f.env,who,f.helpers);
  const data=await(await request(users.t)).json();assert.equal(data.demoSource,'educade-v1');assert.equal(data.skillEvidence.length,3240);
  const first=data.skillEvidence[0].learnerId;f.db.prepare('DELETE FROM class_students WHERE class_id=? AND learner_id=?').run(c.id,first);
  assert.equal((await(await request(users.t)).json()).skillEvidence.length,2700);
  assert.equal((await request(users.u)).status,404);assert.equal((await request(users.sa)).status,403);
 }finally{f.db.close();}
});
