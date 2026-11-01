const {test}=require('node:test');const assert=require('node:assert/strict');
const {fixture,users,definition,cid,origin}=require('./helpers/quiz-fixture.cjs');
test('quizzes are server graded, retry-safe, persisted per lesson and projected privately to family timelines',async()=>{
 const f=await fixture(),clock=Date.now;let now=1000;Date.now=()=>now;
 try{
  assert.equal((await f.assign()).status,200);
  let quiz=await(await f.request(users.sa)).json();assert.equal(quiz.quiz.questions[0].correctIndex,undefined);assert.equal(quiz.review,undefined);assert.equal(quiz.result.status,'not_submitted');
  const attemptId=crypto.randomUUID(),start={action:'start',revision:1,attemptId};assert.equal((await f.request(users.sa,start)).status,200);
  assert.equal((await(await f.request(users.sa,{...start,attemptId:crypto.randomUUID()})).json()).active,attemptId,'reopening resumes the active attempt');
  assert.equal((await f.request(users.t,{action:'save',revision:1,quiz:{...definition,title:'Changed'}})).status,409,'answer key locks when an attempt starts');
  assert.equal((await f.request(users.sb,{action:'submit',revision:1,attemptId,answers:[0,0],reflection:''})).status,404);
  now=3000;const submit={action:'submit',revision:1,attemptId,answers:[1,1],reflection:'Why is the narrator unreliable?',score:999,total:1};
  quiz=await(await f.request(users.sa,submit)).json();assert.equal(quiz.result.latest.score,0);assert.equal(quiz.result.latest.total,2);assert.equal(quiz.result.latest.percentage,0);assert.equal(quiz.result.latest.durationSeconds,2);assert.equal(quiz.review[0].correctIndex,0);
  await f.request(users.sa,{...submit,answers:[0,0]});assert.equal(f.db.prepare('SELECT count(*) n FROM quiz_attempts').get().n,1);assert.equal(f.db.prepare('SELECT score FROM quiz_attempts').get().score,0,'repeated submission cannot overwrite the result');
  now=4000;const second=crypto.randomUUID();await f.request(users.sa,{...start,attemptId:second});now=5000;await f.request(users.sa,{...submit,attemptId:second,answers:[0,1]});
  const teacher=await(await f.timeline()).json(),family=await(await f.timeline(users.pa,'overview?learnerId=a')).json(),student=await(await f.timeline(users.sa,'overview?learnerId=b')).json();
  const results=teacher.course.lessons[0].quiz.results;assert.equal(results[0].latest.score,1);assert.equal(results[0].best.score,1);assert.equal(results[0].attemptCount,2);assert.equal(results[1].status,'not_submitted');assert.equal(results[1].latest,null);assert.equal(teacher.course.lessons[1].quiz,null);
  assert.equal(family.course.lessons[0].quiz.result.latest.score,1);assert.equal(family.course.lessons[0].quiz.results,undefined);assert.ok(!JSON.stringify(family).includes('Bob'));assert.ok(!JSON.stringify(family).includes('correctIndex'));assert.equal(student.course.lessons[0].quiz.result.latest.score,1);assert.equal(student.canTakeQuiz,true);assert.equal(family.canTakeQuiz,false);
  assert.equal((await f.timeline(users.pa,'overview?learnerId=b')).status,404);
  // A later lower score remains the latest result; best is kept separately.
  now=6000;const third=crypto.randomUUID();await f.request(users.sa,{...start,attemptId:third});now=7000;quiz=await(await f.request(users.sa,{...submit,attemptId:third,answers:[1,1]})).json();assert.equal(quiz.result.latest.score,0);assert.equal(quiz.result.best.score,1);assert.equal(quiz.attempts.length,3);
 }finally{Date.now=clock;f.db.close();}
});
test('quiz authoring enforces teacher ownership, valid questions and revisions; attempts require own enrolment and origin',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request(null)).status,401);assert.equal((await f.request(users.u)).status,404);assert.equal((await f.request(users.pa)).status,403);assert.equal((await f.request(users.t,undefined,'unknown')).status,404);
  const save={action:'save',revision:0,quiz:definition};assert.equal((await f.request(users.sa,save)).status,404);assert.equal((await f.request(users.t,save,'legacy-1',{Origin:'https://evil.invalid'})).status,403);
  const bad=structuredClone(definition);bad.questions[0].correctIndex=3;assert.equal((await f.request(users.t,{...save,quiz:bad})).status,400);assert.equal((await f.assign()).status,200);assert.equal((await f.assign()).status,409);
  assert.equal((await f.request(users.t,{...save,revision:1,quiz:{...definition,title:'Updated check'}})).status,200);
  const start={action:'start',revision:1,attemptId:crypto.randomUUID()};assert.equal((await f.request(users.sa,start)).status,409);start.revision=2;assert.equal((await f.request(users.sa,start)).status,200);
  assert.equal((await f.request(users.sa,{action:'submit',revision:2,attemptId:start.attemptId,answers:[0],reflection:''})).status,400);
  assert.equal((await f.request(users.sa,{...start,action:'submit',answers:[99,0],reflection:''})).status,400);
  f.db.prepare('DELETE FROM class_students WHERE learner_id=?').run('a');assert.equal((await f.request(users.sa)).status,404);
 }finally{f.db.close();}
});
test('quiz assignments protect lesson identity, survive rescheduling and refuse new attempts on cancelled lessons',async()=>{
 const f=await fixture();try{
  await f.assign();const {handleCourseOverview}=await import('../cloudflare/course-overviews.mjs');
  const save=course=>handleCourseOverview(new Request(`${origin}/api/classes/${cid}/overview`,{method:'POST',headers:{Origin:origin},body:JSON.stringify({course,revision:1})}),f.env,users.t,cid,f.helpers);
  const removed=structuredClone(f.course);removed.lessons[0].id='new';assert.equal((await save(removed)).status,409);
  const moved=structuredClone(f.course);moved.lessons[0].date='2027-01-03';assert.equal((await save(moved)).status,200);
  assert.equal((await(await f.timeline()).json()).course.lessons[0].quiz.title,definition.title);
  moved.lessons[0].status='cancelled';f.db.prepare('UPDATE course_overviews SET content=?').run(JSON.stringify(moved));
  assert.equal((await f.request(users.sa,{action:'start',revision:1,attemptId:crypto.randomUUID()})).status,409);assert.equal((await f.request(users.sa)).status,200);
 }finally{f.db.close();}
});
