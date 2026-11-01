const {test}=require('node:test');const assert=require('node:assert/strict');
const {fixture,users,definition,cid,origin}=require('./helpers/quiz-fixture.cjs');
const output=value=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
const plan=(count=2)=>({title:'The Crucible',description:'Study the play and develop literary analysis.',gradeBand:'Secondary',themes:'Power and reputation',essentialQuestions:'How does authority influence justice?',enduringUnderstandings:'Fear can distort judgement.',reviewNotes:'The book itself is not supplied. Verify reading boundaries.',lessons:Array.from({length:count},(_,i)=>({title:'Source lesson '+(i+1),section:'Act '+(i+1),goal:'Support a claim with evidence.',reading:i?'Complete the previous assigned reading.':'',homework:'Prepare a supported paragraph.',skills:'Analysis',activities:'Discuss the evidence and plan a paragraph.',evidence:'A supported interpretation.',sourcePages:'1'}))});
const draft={quiz:definition,reviewNotes:'Check source alignment.',sources:['Unit plan: evidence.','Unit plan: support claims.']};
async function setup(){const f=await fixture();Object.assign(f.env,{OPENAI_PLANNING_ENABLED:'true',OPENAI_API_KEY:'test-only'});f.db.prepare('INSERT INTO course_resources VALUES(?,?,?,?,?,?,?,?)').run('r',cid,'Unit plan.pdf','unit-plan',80,'file-private','t',0);
 const {handleCoursePreparation}=await import('../cloudflare/course-preparation.mjs');
 const request=(body,user=users.t,headers={})=>handleCoursePreparation(new Request(`${origin}/api/course-preparation/classes/${cid}`,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})}),f.env,user,f.helpers);
 const start=()=>({action:'start',id:crypto.randomUUID(),course:f.course,revision:1,lengthMode:'source',questionCount:3,brief:'Follow the uploaded unit plan.'});return {...f,prep:request,start};}
test('one-click preparation reads uploaded files, persists private progress, resumes and attaches unassigned quizzes after review',async()=>{
 const f=await setup(),previous=global.fetch;let calls=0;global.fetch=async(url,init)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');const body=JSON.parse(init.body);assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.equal(body.input[0].content[0].file_id,'file-private');assert.ok(!init.body.includes('Alice'));assert.match(body.instructions,/untrusted/);const context=JSON.parse(body.input[0].content.at(-1).text);return output(calls===1?plan():{drafts:context.lessons.map(l=>({lessonId:l.lessonId,draft})),notes:''});};
 try{
  const start=f.start();assert.equal((await f.prep(start)).status,200);assert.equal(calls,0);assert.equal((await f.prep(start)).status,200);
  const next={action:'next',id:start.id};let r=await f.prep(next);assert.equal(r.status,200,await r.clone().text());const prepared=(await r.json()).preparation;assert.equal(prepared.course.title,'The Crucible');assert.equal(prepared.course.lessons[0].id,'legacy-1');assert.equal(prepared.course.lessons[0].date,f.course.lessons[0].date);assert.ok(!JSON.stringify(prepared).includes('file-private'));
  assert.equal(f.db.prepare('SELECT revision FROM course_overviews').get().revision,1);assert.equal(f.db.prepare('SELECT count(*) n FROM quiz_drafts').get().n,0);
  assert.equal((await f.prep(next)).status,200);assert.equal(calls,2);assert.equal((await f.prep(next)).status,200);assert.equal(calls,2,'completed steps are not billed again');
  assert.equal(f.db.prepare('SELECT count(*) n FROM lesson_quizzes').get().n,0);
  const {handleCourseOverview}=await import('../cloudflare/course-overviews.mjs');const saved=await handleCourseOverview(new Request(`${origin}/api/classes/${cid}/overview`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({course:prepared.course,revision:1})}),f.env,users.t,cid,f.helpers);assert.equal(saved.status,200);
  const attached=await(await f.prep({action:'attach-quizzes',id:start.id})).json();assert.equal(attached.saved.length,2);assert.equal(f.db.prepare('SELECT count(*) n FROM lesson_quizzes').get().n,0);
  assert.equal((await(await f.prep({action:'attach-quizzes',id:start.id})).json()).saved.length,0,'retry cannot replace teacher drafts');
  const parent=await(await f.timeline(users.pa,'overview?learnerId=a')).json();assert.ok(!JSON.stringify(parent).includes('Check source alignment'));
 }finally{global.fetch=previous;f.db.close();}
});
test('preparation rejects nonteachers, cross-class access, cross-site writes, stale courses and resource changes',async()=>{
 const f=await setup(),previous=global.fetch;let calls=0;global.fetch=async()=>{calls++;return output(plan());};
 try{
  assert.equal((await f.prep(undefined,users.sa)).status,403);assert.equal((await f.prep(undefined,users.u)).status,404);assert.equal((await f.prep(undefined,null)).status,401);
  assert.equal((await f.prep(f.start(),users.t,{Origin:'https://other.invalid'})).status,403);
  assert.equal((await f.prep({...f.start(),revision:0})).status,409);
  const start=f.start();await f.prep(start);f.db.prepare('UPDATE course_resources SET provider_file_id=?').run('file-new');assert.equal((await f.prep({action:'next',id:start.id})).status,409);assert.equal(calls,0);
  f.db.prepare('UPDATE course_resources SET provider_file_id=?').run('file-private');global.fetch=async()=>{f.db.prepare('UPDATE course_overviews SET revision=2').run();return output(plan());};assert.equal((await f.prep({action:'next',id:start.id})).status,502);assert.equal((await(await f.prep()).json()).preparation.course,null);assert.equal(f.db.prepare('SELECT until_at FROM course_preparations').get().until_at,0);
 }finally{global.fetch=previous;f.db.close();}
});
test('failed quiz steps preserve the plan and completed work; locks prevent concurrent API spend',async()=>{
 const f=await setup(),previous=global.fetch;global.fetch=async()=>output(plan(4));
 try{
  const start=f.start();await f.prep(start);const next={action:'next',id:start.id};await f.prep(next);
  global.fetch=async()=>new Response('provider failure',{status:500});assert.equal((await f.prep(next)).status,502);const partial=(await(await f.prep()).json()).preparation;assert.equal(partial.course.lessons.length,4);assert.equal(Object.keys(partial.quizzes).length,0);
  let release;global.fetch=async()=>{await new Promise(resolve=>release=resolve);return output({drafts:[],notes:'Upload book excerpts for these questions.'});};const working=f.prep(next);while(!release)await new Promise(resolve=>setImmediate(resolve));assert.equal((await f.prep(next)).status,409);release();assert.equal((await working).status,200);
  global.fetch=async()=>output({drafts:[],notes:'More source material is needed.'});assert.equal((await f.prep(next)).status,200);assert.equal(Object.keys((await(await f.prep()).json()).preparation.quizzes).length,4);
 }finally{global.fetch=previous;f.db.close();}
});
test('source lesson count and selected format are validated; generated content cannot change schedule fields',async()=>{
 const f=await setup();const {applyPreparedPlan}=await import('../cloudflare/course-preparation.mjs');
 try{assert.throws(()=>applyPreparedPlan(f.course,plan(3),'settings'),/lesson count/);const p=plan();p.lessons[0].date='2099-01-01';const course=applyPreparedPlan(f.course,p,'source');assert.equal(course.lessons[0].date,f.course.lessons[0].date);assert.throws(()=>applyPreparedPlan(f.course,{...plan(),gradeBand:9},'source'));}finally{f.db.close();}
});
test('Drive imports accept only folder URLs and enforce download size bounds',async()=>{
 const {parseDriveFolder,boundedDriveBlob}=await import('../dist/drive-course-import.js');
 assert.equal(parseDriveFolder('https://drive.google.com/drive/folders/abc-123?resourcekey=key').id,'abc-123');assert.throws(()=>parseDriveFolder('https://evil.invalid/drive/folders/abc'));assert.throws(()=>parseDriveFolder('https://drive.google.com/file/d/abc'));
 assert.equal((await boundedDriveBlob(new Response('sample'))).size,6);await assert.rejects(()=>boundedDriveBlob(new Response('large',{headers:{'Content-Length':String(21*1024*1024)}})),/larger/);await assert.rejects(()=>boundedDriveBlob(new Response('',{status:401})),/expired/);
});
