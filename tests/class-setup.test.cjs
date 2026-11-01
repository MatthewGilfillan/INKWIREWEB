const {test}=require('node:test'),assert=require('node:assert/strict');
const {classSetupFixture,users,cid}=require('./helpers/class-setup-fixture.cjs');
const setup={title:'New literature course',startDate:'2027-01-04',endDate:'2027-04-26',lessonCount:15,lessonMinutes:120,timeZone:'Asia/Shanghai',weeklySlots:[{day:1,startTime:'18:00',lessonMinutes:120}],billingMode:'packs',billTo:'',format:'full'};
test('15 classes across 17 weeks require two breaks, with blank numbered sessions and calendar events',async()=>{
  const {buildScheduledCourse,scheduleSelection}=await import('../dist/class-setup-model.mjs');
  assert.equal(scheduleSelection(setup).extra,2);assert.throws(()=>buildScheduledCourse(setup),/Select exactly 15/);
  const course=buildScheduledCourse({...setup,skippedSlots:['2027-02-01|18:00','2027-02-08|18:00']});
  assert.equal(course.lessons.length,15);assert.equal(course.lessons[4].date,'2027-02-15');assert.equal(course.lessons[4].title,'Week 5');assert.equal(course.lessons.at(-1).title,'Week 15');assert.equal(course.lessons.at(-1).date,'2027-04-26');assert.ok(course.lessons.every(l=>!l.goal&&!l.homework));
  const {projectCalendar}=await import('../dist/calendar-model.mjs');assert.equal(projectCalendar([{id:'c',name:'Course',course}],'2027-01-01','2027-05-01','Asia/Shanghai').events.length,15);
  const edited=structuredClone(course);edited.lessons[0].title='About the author';edited.lessons[0].goal='Compare sources';const next=buildScheduledCourse({...setup,skippedSlots:course.skippedSlots,weeklySlots:[{day:1,startTime:'17:00',lessonMinutes:90}],skippedSlots:['2027-02-01|17:00','2027-02-08|17:00']},edited);
  assert.equal(next.lessons[0].id,edited.lessons[0].id);assert.equal(next.lessons[0].goal,'Compare sources');assert.equal(next.lessons[0].title,'About the author');assert.equal(next.lessons[0].rescheduledFrom.startTime,'18:00');
});
test('multiple weekly days use individual times and durations and number teaching weeks without gaps',async()=>{
  const {buildScheduledCourse}=await import('../dist/class-setup-model.mjs');
  const course=buildScheduledCourse({...setup,startDate:'2027-01-01',endDate:'2027-01-30',lessonCount:8,weeklySlots:[{day:5,startTime:'18:00',lessonMinutes:90},{day:6,startTime:'10:00',lessonMinutes:60}],skippedSlots:['2027-01-08|18:00','2027-01-09|10:00']});
  assert.deepEqual(course.lessons.slice(0,3).map(l=>l.title),['Week 1 Lesson 1','Week 1 Lesson 2','Week 2 Lesson 1']);assert.equal(course.lessons[2].date,'2027-01-15');assert.equal(course.lessons[1].lessonMinutes,60);
  const {applyPreparedPlan}=await import('../cloudflare/course-preparation.mjs');assert.throws(()=>applyPreparedPlan(course,{reviewNotes:'',lessons:[{}]},'source'),/lesson count/);
});
test('class creation saves its timetable atomically and a retry cannot overwrite the saved course',async()=>{
  const f=await classSetupFixture(),{buildScheduledCourse}=await import('../dist/class-setup-model.mjs');
  try{
    const course=buildScheduledCourse({...setup,skippedSlots:['2027-02-01|18:00','2027-02-08|18:00']}),body={name:'Trial class',subject:'Literature',requestId:crypto.randomUUID(),course};
    const result=await f.api('/api/classes',body);assert.equal(result.status,201,await result.clone().text());const id=(await result.json()).classroom.id;
    let saved=await(await f.api(`/api/classes/${id}/overview`)).json();assert.equal(saved.course.lessons.length,15);assert.equal(saved.revision,1);
    body.course.lessons[0].title='Must not overwrite';assert.equal((await f.api('/api/classes',body)).status,201);saved=await(await f.api(`/api/classes/${id}/overview`)).json();assert.equal(saved.course.lessons[0].title,'Week 1');
    const before=f.db.prepare('SELECT count(*) n FROM classes').get().n;assert.equal((await f.api('/api/classes',{...body,requestId:crypto.randomUUID(),course:{...course,lessonCount:99}})).status,400);assert.equal(f.db.prepare('SELECT count(*) n FROM classes').get().n,before);
  }finally{f.db.close();}
});
test('class files default to private, with independent AI and student permissions and authenticated downloads',async()=>{
  const f=await classSetupFixture(),previous=global.fetch;let uploads=0,deletes=0;
  Object.assign(f.env,{OPENAI_PLANNING_ENABLED:'true',OPENAI_API_KEY:'test-only'});
  global.fetch=async(url,init)=>{if(init.method==='DELETE'){deletes++;return Response.json({deleted:true});}uploads++;return Response.json({id:'file-test-'+uploads});};
  try{
    let response=await f.files(f.upload());assert.equal(response.status,201,await response.clone().text());let file=(await response.json()).files[0];assert.equal(uploads,0);assert.equal((await(await f.files(undefined,users.sa)).json()).files.length,0);assert.equal((await f.api(file.downloadURL,undefined,users.sa)).status,404);assert.equal((await f.api(file.downloadURL,undefined,users.t)).status,200);
    assert.equal((await f.files(undefined,users.u)).status,404);assert.equal((await f.files(undefined,null)).status,401);assert.equal((await f.files(f.upload(),users.t,{Origin:'https://other.invalid'})).status,403);
    response=await f.files({action:'sharing',id:file.id,revision:file.revision,aiEnabled:true,studentDownload:false});assert.equal(response.status,200,await response.clone().text());file=(await response.json()).files[0];assert.equal(file.aiEnabled,true);assert.equal(uploads,1);assert.equal((await(await f.files(undefined,users.pa)).json()).files.length,0);
    const {resourceRows}=await import('../cloudflare/course-resources.mjs');assert.equal((await resourceRows(f.env,cid)).length,1);
    response=await f.files({action:'sharing',id:file.id,revision:file.revision,aiEnabled:false,studentDownload:true});file=(await response.json()).files[0];assert.equal(deletes,1);assert.equal((await resourceRows(f.env,cid)).length,0);assert.equal(file.studentDownload,true);
    for(const user of [users.sa,users.pa]){const listing=await(await f.files(undefined,user)).json();assert.equal(listing.files.length,1);assert.equal(listing.files[0].aiEnabled,undefined);const download=await f.api(file.downloadURL,undefined,user);assert.equal(await download.text(),'Original teaching notes.');assert.equal(download.headers.get('Cache-Control'),'private, no-store');assert.match(download.headers.get('Content-Disposition'),/^attachment;/);}
    assert.equal((await f.files({action:'sharing',id:file.id,revision:1,aiEnabled:true,studentDownload:false})).status,409);
    f.db.prepare('DELETE FROM class_students WHERE learner_id=?').run('a');assert.equal((await f.api(file.downloadURL,undefined,users.pa)).status,404);
    assert.equal((await f.files({action:'remove',id:file.id,revision:file.revision})).status,200);assert.equal(f.objects.size,0);assert.equal((await f.api(file.downloadURL,undefined,users.sb)).status,404);
  }finally{global.fetch=previous;f.db.close();}
});
test('failed AI uploads roll back, class Trash revokes access, and file updates reject concurrent writes',async()=>{
  const f=await classSetupFixture(),previous=global.fetch;Object.assign(f.env,{OPENAI_PLANNING_ENABLED:'true',OPENAI_API_KEY:'test-only'});
  try{
    global.fetch=async()=>new Response('failed',{status:503});assert.equal((await f.files(f.upload('Notes.txt',true))).status,502);assert.equal(f.objects.size,0);assert.equal(f.db.prepare('SELECT count(*) n FROM class_files').get().n,0);
    const file=(await(await f.files(f.upload('Notes.txt',false,true))).json()).files[0];let release;global.fetch=async()=>{await new Promise(r=>release=r);return Response.json({id:'file-concurrent'});};
    const body={action:'sharing',id:file.id,revision:file.revision,aiEnabled:true,studentDownload:true},pending=f.files(body);while(!release)await new Promise(r=>setImmediate(r));assert.equal((await f.files(body)).status,409);release();assert.equal((await pending).status,200);
    f.db.prepare('UPDATE classes SET deleted_at=1 WHERE id=?').run(cid);assert.equal((await f.files()).status,404);assert.equal((await f.api(file.downloadURL,undefined,users.sa)).status,404);
  }finally{global.fetch=previous;f.db.close();}
});
