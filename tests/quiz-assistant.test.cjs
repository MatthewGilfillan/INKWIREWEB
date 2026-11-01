const {test}=require('node:test');const assert=require('node:assert/strict');
const {fixture,users,definition,cid,origin}=require('./helpers/quiz-fixture.cjs');
const aiDraft={quiz:definition,reviewNotes:'Check the reading before assigning.',sources:['Reading.txt: opening voice.','Unit plan: support ideas with textual evidence.']};
const response=value=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
async function setup(){const f=await fixture();Object.assign(f.env,{OPENAI_PLANNING_ENABLED:'true',OPENAI_API_KEY:'test-only'});const {handleQuizAssistant}=await import('../cloudflare/quiz-assistant.mjs'),{handleCourseResources}=await import('../cloudflare/course-resources.mjs');
 const request=(kind,body,user=users.t,headers={})=>(kind==='resources'?handleCourseResources:handleQuizAssistant)(new Request(`${origin}/api/${kind==='resources'?'course-resources':'quiz-assistant'}/classes/${cid}`,{method:body?'POST':'GET',headers:{Origin:origin,...(body && !(body instanceof FormData)?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})}),f.env,user,f.helpers);
 const generate=()=>({requestId:crypto.randomUUID(),courseRevision:1,lessonIds:['legacy-1'],questionCount:3,brief:'The narrator tells the story. Answers should use a quotation from the reading.'});
 return {...f,ai:request,generate};}
test('course resource uploads support all requested formats, enforce private ownership and never expose provider file IDs',async()=>{
 const f=await setup(),fetch=global.fetch;let files=0,deletes=0;global.fetch=async(url,init)=>{if(init.method==='DELETE'){deletes++;return Response.json({deleted:true});}assert.equal(url,'https://api.openai.com/v1/files');assert.equal(init.body.get('purpose'),'user_data');files++;return Response.json({id:'file-test-'+files});};
 const upload=(name,bytes)=>{const body=new FormData();body.append('kind','book');body.append('file',new Blob([bytes]),name);return body;};
 try{
  assert.equal((await f.ai('resources',undefined,users.sa)).status,403);assert.equal((await f.ai('resources',undefined,users.u)).status,404);
  assert.equal((await f.ai('resources',upload('book.pdf','%PDF-1.7 sample'),users.t,{Origin:'https://other.invalid'})).status,403);
  assert.equal((await f.ai('resources',upload('bad.pdf','not a PDF'))).status,400);assert.equal((await f.ai('resources',upload('bad.zip','zip'))).status,400);assert.equal(files,0);
  for(const [name,bytes]of[['book.pdf','%PDF-1.7 sample'],['plan.docx','PK\u0003\u0004sample'],['questions.xlsx','PK\u0003\u0004sample'],['questions.csv','question,answer\nWho?,Narrator'],['plan.doc',new Uint8Array([208,207,17,224])],['questions.xls',new Uint8Array([208,207,17,224])]])assert.equal((await f.ai('resources',upload(name,bytes))).status,200,name);
  const list=await(await f.ai('resources')).json();assert.equal(list.resources.length,6);assert.ok(!JSON.stringify(list).includes('file-test'));assert.equal((await f.ai('resources',{action:'remove',id:list.resources[0].id},users.u)).status,404);assert.equal(deletes,0);
  assert.equal((await f.ai('resources',{action:'remove',id:list.resources[0].id})).status,200);assert.equal(deletes,1);assert.equal((await(await f.ai('resources')).json()).resources.length,5);
  global.fetch=async()=>new Response('private provider error',{status:500});assert.equal((await f.ai('resources',upload('failed.txt','Source text'))).status,502);assert.equal(f.db.prepare('SELECT count(*) n FROM course_resources').get().n,5);
 }finally{global.fetch=fetch;f.db.close();}
});
test('AI drafts are persisted privately, source-grounded, replay-safe and assigned only after teacher review',async()=>{
 const f=await setup(),fetch=global.fetch;let calls=0;f.db.prepare('INSERT INTO course_resources VALUES(?,?,?,?,?,?,?,?)').run('r',cid,'Reading.txt','book',80,'file-private','t',0);
 global.fetch=async(url,init)=>{calls++;const body=JSON.parse(init.body);assert.equal(body.store,false);assert.equal(body.text.format.strict,true);assert.deepEqual(body.input[0].content[0],{type:'input_file',file_id:'file-private'});assert.ok(!init.body.includes('Alice'));assert.match(body.instructions,/untrusted/);return response({drafts:[{lessonId:'legacy-1',draft:aiDraft}],notes:''});};
 try{
  const body=f.generate();const result=await f.ai('assistant',body);assert.equal(result.status,200,await result.clone().text());assert.deepEqual((await result.json()).saved,['legacy-1']);assert.equal(calls,1);
  assert.equal((await f.ai('assistant',body)).status,200);assert.equal(calls,1);
  assert.equal(f.db.prepare('SELECT count(*) n FROM lesson_quizzes').get().n,0);
  const teacher=await(await f.request()).json();assert.deepEqual(teacher.aiDraft.quiz,definition);assert.equal(teacher.aiDraft.source,'Course resources');
  const family=await(await f.timeline(users.sa,'overview')).json();assert.equal(family.course.lessons[0].quiz,null);assert.ok(!JSON.stringify(family).includes('Check the reading'));assert.equal(family.course.lessons[0].hasQuizDraft,undefined);
  assert.equal((await(await f.timeline()).json()).course.lessons[0].hasQuizDraft,true);
  assert.equal((await f.ai('assistant',f.generate(),users.sa)).status,403);assert.equal((await f.ai('assistant',f.generate(),users.u)).status,404);
  const saved=await f.request(users.t,{action:'save',revision:0,draftRevision:teacher.aiDraft.revision,quiz:teacher.aiDraft.quiz});assert.equal(saved.status,200);assert.equal((await saved.json()).aiDraft,null);assert.equal(f.db.prepare('SELECT count(*) n FROM lesson_quizzes').get().n,1);
  const started=await f.request(users.sa,{action:'start',revision:1,attemptId:crypto.randomUUID()});assert.equal(started.status,200);assert.equal((await f.ai('assistant',f.generate())).status,409);assert.equal(calls,1);
 }finally{global.fetch=fetch;f.db.close();}
});
test('course, draft, resource and answer-key races cannot silently replace reviewed work',async()=>{
 const f=await setup(),fetch=global.fetch;const {saveQuizDraft}=await import('../cloudflare/quiz-assistant.mjs');
 try{
  assert.equal(await saveQuizDraft(f.env,users.t,cid,'legacy-1',1,0,0,aiDraft,'Course resources'),true);
  assert.equal(await saveQuizDraft(f.env,users.t,cid,'legacy-1',1,0,-1,aiDraft,'Previous class transcript'),false,'automatic generation preserves existing draft');
  f.db.prepare('UPDATE course_overviews SET revision=2').run();assert.equal((await f.request(users.t,{action:'save',revision:0,draftRevision:1,quiz:definition})).status,409);f.db.prepare('UPDATE course_overviews SET revision=1').run();
  global.fetch=async()=>{await saveQuizDraft(f.env,users.t,cid,'legacy-1',1,0,1,{...aiDraft,reviewNotes:'New teacher draft'},'Course resources');return response({drafts:[{lessonId:'legacy-1',draft:aiDraft}],notes:''});};
  const raced=await(await f.ai('assistant',f.generate())).json();assert.deepEqual(raced.saved,[]);assert.deepEqual(raced.skipped,['legacy-1']);assert.equal((await(await f.request()).json()).aiDraft.reviewNotes,'New teacher draft');
  global.fetch=async()=>response({drafts:[{lessonId:'legacy-1',draft:{...aiDraft,quiz:{...definition,questions:[{...definition.questions[0],correctIndex:9}]}}}],notes:''});assert.equal((await f.ai('assistant',f.generate())).status,502);assert.equal((await(await f.request()).json()).aiDraft.reviewNotes,'New teacher draft');
  global.fetch=async()=>{f.db.prepare('UPDATE course_overviews SET revision=2').run();return response({drafts:[{lessonId:'legacy-1',draft:aiDraft}],notes:''});};assert.deepEqual((await(await f.ai('assistant',f.generate())).json()).saved,[]);
 }finally{global.fetch=fetch;f.db.close();}
});
test('publishing a transcript drafts the next scheduled lesson in the same API request without assigning it',async()=>{
 const f=await setup(),fetch=global.fetch;const {handleLessonFeedback}=await import('../cloudflare/lesson-feedback.mjs'),{nextQuizLesson}=await import('../cloudflare/quiz-assistant.mjs');
 let calls=0;global.fetch=async(url,init)=>{calls++;const body=JSON.parse(init.body);assert.ok(body.text.format.schema.properties.nextQuiz);return response({summary:'**Learning**\nThe class practised using evidence.',homework:null,students:[],nextQuiz:aiDraft});};
 try{
  f.course.startDate='2020-01-01';f.course.lessons.forEach((l,i)=>{l.date=i?'2020-01-08':'2020-01-01';});f.db.prepare('UPDATE course_overviews SET content=?').run(JSON.stringify(f.course));
  assert.equal(nextQuizLesson(f.course,'legacy-1').id,'legacy-2');
  const transcript='Teacher: We practised choosing quotations to support interpretations of the narrator. Next lesson we will check how evidence supports our answers.';
  const body={action:'publish',revision:0,courseRevision:1,requestId:crypto.randomUUID(),filename:'fictional.txt',fileData:'data:text/plain;base64,'+Buffer.from(transcript).toString('base64'),draftNextQuiz:true,draft:{teacherSpeaker:'Teacher',assessments:['a','b'].map(learnerId=>({learnerId,attendance:'present',speaker:'',parentNote:'',ratings:{attitude:4,prepared:4,effort:4,learning:4}}))}};
  const request=()=>handleLessonFeedback(new Request(`${origin}/api/lesson-feedback/classes/${cid}/lessons/legacy-1`,{method:'POST',headers:{Origin:origin},body:JSON.stringify(body)}),f.env,users.t,f.helpers);
  const result=await request();assert.equal(result.status,200,await result.clone().text());assert.equal((await result.json()).nextQuiz.saved,true);assert.equal(calls,1);assert.equal(f.db.prepare('SELECT lesson_id FROM quiz_drafts').get().lesson_id,'legacy-2');assert.equal(f.db.prepare('SELECT count(*) n FROM lesson_quizzes').get().n,0);
  assert.equal((await request()).status,200);assert.equal(calls,1);
  const parent=await(await f.timeline(users.pa,'overview?learnerId=a')).json();assert.ok(!JSON.stringify(parent).includes('nextQuiz'));assert.ok(!JSON.stringify(parent).includes('opening voice'));
  const reordered=structuredClone(f.course);reordered.lessons[1].date='2019-12-30';assert.equal(nextQuizLesson(reordered,'legacy-1'),null);reordered.lessons[1].date='2020-01-08';reordered.lessons[1].status='cancelled';assert.equal(nextQuizLesson(reordered,'legacy-1'),null);
 }finally{global.fetch=fetch;f.db.close();}
});
