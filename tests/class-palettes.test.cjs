const {test}=require('node:test'),assert=require('node:assert/strict');
const {fixture,origin}=require('./helpers/assignment-fixture.cjs');
const helpers={json:(v,s=200)=>Response.json(v,{status:s}),fail:(message,s=400)=>Response.json({message},{status:s}),readJSON:r=>r.json()};
test('class palettes persist through course edits, validate colours and derive distinct cover colours',async()=>{
 const {classPalette,cleanClassPalette,paletteFromPixels}=await import('../dist/class-palettes.mjs'),{defaults,generateLessons,validateCourse}=await import('../dist/course-model.mjs');
 const course={...defaults('Reading'),classPalette:{id:'rose'}};course.lessons=generateLessons(course);assert.deepEqual(validateCourse(course).classPalette,{id:'rose'});
 assert.throws(()=>cleanClassPalette({id:'cover',colors:['red','url(evil)','#ffffff']}));
 assert.deepEqual(paletteFromPixels(Uint8ClampedArray.from([225,64,64,255,225,64,64,255,64,128,225,255,255,255,255,255,0,0,0,0])).colors.slice(0,2),['#e04040','#4080e0']);
 assert.deepEqual(classPalette({id:'ocean'}),classPalette({id:'ocean'},'other class'));
 assert.notEqual(classPalette(null,'first').accent,classPalette(null,'second').accent);
});
test('class palette updates are scoped to teachers and revisions preserve the rest of the unit plan',async()=>{
 const f=await fixture();try{
  const {handleClasses}=await import('../cloudflare/classes.mjs'),{defaults,generateLessons}=await import('../dist/course-model.mjs');
  const course={...defaults('Reading'),weeks:1};course.lessons=generateLessons(course);f.db.prepare('INSERT INTO course_overviews VALUES(?,1,?,?,0)').run(f.classId,JSON.stringify(course),'teacher');
  const call=(who,body,headers={})=>handleClasses(new Request(origin+'/api/classes/'+f.classId+'/palette',{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify({expectedUserId:who,...body})}:{})}),f.env,f.users[who],helpers);
  assert.equal((await call('student')).status,403);assert.equal((await call('otherTeacher')).status,404);
  assert.equal((await call('teacher',{revision:1,classPalette:{id:'mint'}},{Origin:'https://evil.invalid'})).status,403);
  const saved=await call('teacher',{revision:1,classPalette:{id:'periwinkle'}});assert.equal(saved.status,200);assert.equal((await saved.json()).revision,2);
  assert.equal((await call('teacher',{revision:1,classPalette:{id:'rose'}})).status,409);
  assert.deepEqual(JSON.parse(f.db.prepare('SELECT content FROM course_overviews WHERE class_id=?').get(f.classId).content).lessons,course.lessons);
  const list=await (await handleClasses(new Request(origin+'/api/classes'),f.env,f.users.teacher,helpers)).json();assert.equal(list.classes[0].classPalette.id,'periwinkle');
 }finally{f.db.close();}
});
test('calendar joins use the same weekly and lesson-specific Zoom details as the timeline and exclude cancelled lessons',async()=>{
 const f=await fixture();try{
  const {handleCalendar}=await import('../cloudflare/calendar.mjs'),{defaults,generateLessons}=await import('../dist/course-model.mjs');
  const course={...defaults('Reading'),weeks:2,startDate:'2026-11-20',classPalette:{id:'ocean'}};course.lessons=generateLessons(course);course.lessons[0].id='friday';course.lessons[0].date='2026-11-20';course.lessons[1].id='saturday';course.lessons[1].date='2026-11-21';
  f.db.prepare('INSERT INTO course_overviews VALUES(?,1,?,?,0)').run(f.classId,JSON.stringify(course),'teacher');f.env.ZOOM_ENABLED='true';
  f.db.prepare('INSERT INTO zoom_weekly_meetings(class_id,weekday,meeting_id,join_url,passcode,updated_by,updated_at) VALUES(?,?,?,?,?,?,0)').run(f.classId,5,'12345678901','https://zoom.us/j/12345678901','friday-pass','teacher');
  f.db.prepare('INSERT INTO zoom_lessons(class_id,lesson_id,meeting_id,join_url,passcode,updated_by,updated_at) VALUES(?,?,?,?,?,?,0)').run(f.classId,'saturday','98765432100','https://zoom.us/j/98765432100','lesson-pass','teacher');
  const calendar=async()=> (await handleCalendar(new Request(origin+'/api/classes/calendar?from=2026-11-01&to=2026-12-01&timeZone=Asia/Bangkok'),f.env,f.users.teacher,helpers)).json();
  let value=await calendar();assert.deepEqual(value.events.map(e=>e.zoom.meetingId),['12345678901','98765432100']);assert.equal(value.events[0].classPalette.id,'ocean');
  course.lessons[0].status='cancelled';f.db.prepare('UPDATE course_overviews SET content=? WHERE class_id=?').run(JSON.stringify(course),f.classId);value=await calendar();assert.equal(value.events[0].zoom,undefined);
  const foreign=await handleCalendar(new Request(origin+'/api/classes/calendar?from=2026-11-01&to=2026-12-01'),f.env,f.users.otherTeacher,helpers);assert.equal((await foreign.json()).events.length,0);
 }finally{f.db.close();}
});
