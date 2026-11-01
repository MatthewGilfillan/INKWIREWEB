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

test('each answer is saved before feedback, resumes privately, and the first score survives replays',async()=>{
 const f=await fixture();try{
  await f.assign();const attemptId=crypto.randomUUID(),base={revision:1,attemptId};await f.request(users.sa,{...base,action:'start'});
  const answer={...base,action:'answer',questionIndex:0,answerIndex:1};
  assert.equal((await f.request(users.sb,answer)).status,404);
  assert.equal((await f.request(users.sa,{...answer,questionIndex:1})).status,409);
  assert.equal((await f.request(users.sa,{...answer,answerIndex:9})).status,400);
  let state=await(await f.request(users.sa,answer)).json();
  assert.deepEqual(state.feedback,{questionIndex:0,answerIndex:1,correctIndex:0,explanation:definition.questions[0].explanation});
  assert.equal(state.result.first,null);assert.equal(state.review,undefined);assert.equal(state.quiz.questions[1].correctIndex,undefined);
  state=await(await f.request(users.sa,{...answer,answerIndex:0})).json();assert.equal(state.feedback.answerIndex,1,'an already revealed answer cannot be changed');
  assert.equal((await f.request(users.sa,{...base,action:'submit',answers:[0,0],reflection:''})).status,409,'old clients cannot overwrite individual answers');
  state=await(await f.request(users.sa)).json();assert.equal(state.active,attemptId);assert.equal(state.progress.length,1);assert.equal(state.progress[0].answerIndex,1);
  const other=await(await f.request(users.sb)).json();assert.deepEqual(other.progress,[]);assert.equal(other.review,undefined);
  state=await(await f.request(users.sa,{...answer,questionIndex:1,answerIndex:0})).json();assert.equal(state.active,null);assert.equal(state.result.first.score,1);assert.equal(state.result.attemptCount,1,'last answer automatically records the score');
  state=await(await f.request(users.sa,{...answer,questionIndex:1,answerIndex:1})).json();assert.equal(state.feedback.answerIndex,0);assert.equal(state.result.first.score,1);
  assert.equal((await f.request(users.sa,{...base,action:'reflection',reflection:'Can we discuss the narrator?'})).status,200);assert.equal(f.db.prepare('SELECT reflection FROM quiz_attempts WHERE id=?').get(attemptId).reflection,'Can we discuss the narrator?');
  assert.equal((await f.request(users.sb,{...base,action:'reflection',reflection:'Changed'})).status,409);
  const replay=crypto.randomUUID();await f.request(users.sa,{action:'start',revision:1,attemptId:replay});
  for(let i=0;i<2;i++)state=await(await f.request(users.sa,{action:'answer',revision:1,attemptId:replay,questionIndex:i,answerIndex:0})).json();
  assert.equal(state.result.first.score,1);assert.equal(state.result.latest.score,2);assert.equal(state.result.best.score,2);
  const teacher=await(await f.timeline()).json(),parent=await(await f.timeline(users.pa,'overview?learnerId=a')).json();
  assert.equal(teacher.course.lessons[0].quiz.results[0].first.score,1);assert.equal(parent.course.lessons[0].quiz.result.first.score,1);assert.ok(!JSON.stringify(parent).includes('answer_progress'));
 }finally{f.db.close();}
});
test('concurrent submissions commit only one answer and cannot race a legacy bulk submission',async()=>{
 const f=await fixture();try{
  await f.assign();let attemptId=crypto.randomUUID();await f.request(users.sa,{action:'start',revision:1,attemptId});
  const answer={action:'answer',revision:1,attemptId,questionIndex:0,answerIndex:1};
  const results=await Promise.all([f.request(users.sa,answer),f.request(users.sa,{...answer,answerIndex:0})]);
  const states=await Promise.all(results.map(r=>r.json()));assert.equal(states[0].feedback.answerIndex,states[1].feedback.answerIndex);
  assert.equal(JSON.parse(f.db.prepare('SELECT answer_progress FROM quiz_attempts WHERE id=?').get(attemptId).answer_progress).length,1);
  await f.request(users.sa,{...answer,questionIndex:1});
  attemptId=crypto.randomUUID();await f.request(users.sa,{action:'start',revision:1,attemptId});
  const race=await Promise.all([f.request(users.sa,{...answer,attemptId}),f.request(users.sa,{action:'submit',revision:1,attemptId,answers:[0,0],reflection:''})]);
  const row=f.db.prepare('SELECT * FROM quiz_attempts WHERE id=?').get(attemptId);
  if(row.submitted_at===null){assert.deepEqual(JSON.parse(row.answer_progress),[1]);assert.equal(race[1].status,409);}else{assert.equal(row.score,2);assert.deepEqual(JSON.parse(row.answers),[0,0]);assert.equal((await race[0].json()).feedback.answerIndex,0);}
 }finally{f.db.close();}
});
