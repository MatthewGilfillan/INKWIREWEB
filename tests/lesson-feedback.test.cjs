const {test}=require('node:test');const assert=require('node:assert/strict');const {DatabaseSync}=require('node:sqlite');const {readFileSync,readdirSync}=require('node:fs');const path=require('node:path');
const origin='https://inkwire-education.com',classId='11111111-1111-4111-8111-111111111111',end=Date.parse('2026-11-01T10:00:00Z');
const transcript='[Matthew] 17:58:00\nFor homework, read chapter two before our next lesson.\n[Alice] 17:59:00\nThe animals mistake promises for proof.\n[Matthew] 17:59:30\nAlice, please ask your parent to bring your reading journal.\n[Bob] 17:59:40\nI am not sure yet.\n';
const file={filename:'Fictional lesson.txt',fileData:'data:text/plain;base64,'+Buffer.from(transcript).toString('base64')};
const teachers={owner:{id:'t',emailVerified:true,requestedRole:'teacher'},other:{id:'u',emailVerified:true,requestedRole:'teacher'},student:{id:'sa',emailVerified:true,requestedRole:'student'},parent:{id:'pa',emailVerified:true,requestedRole:'parent'},otherParent:{id:'pb',emailVerified:true,requestedRole:'parent'}};
const draft={teacherSpeaker:'Matthew',assessments:[{learnerId:'a',attendance:'present',speaker:'Alice',parentNote:'Please check Alice’s journal.',ratings:{attitude:5,prepared:4,effort:3,learning:4}},{learnerId:'b',attendance:'absent',speaker:'Bob',parentNote:'Please contact me about the missed lesson.',ratings:{attitude:null,prepared:null,effort:null,learning:null}}]};
const generated={summary:'**Lesson overview**\nAlice explored allegory at 17:30.\n\n**Main learning**\nThe class practised supporting ideas.',homework:{text:'Read chapter two before the next lesson.',evidence:'For homework, read chapter two before our next lesson.'},students:[{number:1,quote:'The animals mistake promises for proof.',parentComment:{text:'Please bring the reading journal.',evidence:'Alice, please ask your parent to bring your reading journal.'}},{number:2,quote:'I am not sure yet.',parentComment:null}]};
async function fixture(){
 const {handleLessonFeedback}=await import('../cloudflare/lesson-feedback.mjs');const {defaults,generateLessons}=await import('../dist/course-model.mjs');const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');for(const name of readdirSync(path.join(__dirname,'../cloudflare/migrations')).filter(n=>n.endsWith('.sql')).sort())db.exec(readFileSync(path.join(__dirname,'../cloudflare/migrations',name),'utf8'));
 for(const [id,role] of [['t','teacher'],['u','teacher'],['sa','student'],['sb','student'],['pa','parent'],['pb','parent']])db.prepare('INSERT INTO user(id,name,email,emailVerified,createdAt,updatedAt,requestedRole) VALUES(?,?,?,1,0,0,?)').run(id,id,id+'@example.invalid',role);
 db.prepare('INSERT INTO classes(id,owner_id,name,subject,request_id,created_at) VALUES(?,?,?,?,?,0)').run(classId,'t','Fictional Animal Farm','Literature','req');
 for(const [id,name,user]of[['a','Alice','sa'],['b','Bob','sb']]){db.prepare('INSERT INTO learners VALUES(?,?,?,0)').run(id,name,user);db.prepare('INSERT INTO class_students VALUES(?,?,0)').run(classId,id);db.prepare('INSERT INTO learner_parents VALUES(?,?,?,0)').run(id,id==='a'?'pa':'pb','Parent '+name);}
 const course={...defaults('Animal Farm'),weeks:1,startDate:'2026-11-01',startTime:'16:00',timeZone:'Asia/Shanghai',sourceNotes:'PRIVATE SOURCE NOTES'};course.lessons=generateLessons(course);course.lessons[0].homework='Original planned homework';course.lessons[0].activities='PRIVATE TEACHING NOTES';
 db.prepare('INSERT INTO course_overviews VALUES(?,1,?,?,0)').run(classId,JSON.stringify(course),'t');
 const DB={prepare(sql){const stmt=db.prepare(sql);let args=[];return {bind(...values){args=values;return this;},async first(){return stmt.get(...args)||null;},async all(){return {results:stmt.all(...args)};},async run(){return stmt.run(...args);}};}};
 const env={DB,APP_ORIGIN:origin,OPENAI_API_KEY:'test-only',OPENAI_PLANNING_ENABLED:'true'};
 const helpers={json:(v,status=200)=>Response.json(v,{status}),fail:(message,status=400,code)=>Response.json({message,code},{status}),readJSON:async(req,max=32768)=>{const s=await req.text();if(Buffer.byteLength(s)>max)throw Error('BODY_TOO_LARGE');return JSON.parse(s);}};
 const request=(suffix,body,user=teachers.owner,headers={})=>handleLessonFeedback(new Request(origin+'/api/lesson-feedback/classes/'+classId+'/'+suffix,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),env,user,helpers);
 const body=(action='publish',revision=0)=>({action,revision,courseRevision:1,draft:structuredClone(draft),...file,requestId:crypto.randomUUID()});
 return {db,env,helpers,course,request,body,clearLimit:()=>db.prepare('DELETE FROM ai_planning_limits').run()};
}
function provider(value=generated){return Response.json({status:'completed',model:'gpt-6-sol',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]},{headers:{'x-request-id':'req_fictional'}});}

test('Beijing end time is enforced on server at the exact boundary, with auth, origin and complete ratings',async()=>{
 const f=await fixture(),clock=Date.now,fetch=global.fetch;let calls=0;global.fetch=async()=>{calls++;return provider();};
 try{
 Date.now=()=>end-1;
 assert.equal((await f.request('lessons/legacy-1',f.body(),null)).status,401);assert.equal((await f.request('lessons/legacy-1',f.body(),teachers.student)).status,403);assert.equal((await f.request('lessons/legacy-1',f.body(),teachers.other)).status,404);
 assert.equal((await f.request('lessons/legacy-1',f.body(),teachers.owner,{Origin:'https://evil.invalid'})).status,403);
 assert.equal((await f.request('lessons/legacy-1',f.body())).status,409);assert.equal(calls,0);assert.equal(f.db.prepare('SELECT count(*) n FROM lesson_feedback').get().n,0);
 Date.now=()=>end;let bad=f.body();bad.draft.assessments[0].ratings.effort=0;assert.equal((await f.request('lessons/legacy-1',bad)).status,400);
 const body=f.body();const res=await f.request('lessons/legacy-1',body);assert.equal(res.status,200,await res.clone().text());assert.equal(calls,1);assert.equal((await res.json()).revision,2);
 assert.equal((await f.request('lessons/legacy-1',body)).status,200);assert.equal(calls,1,'lost-response retry is idempotent');
 }finally{Date.now=clock;global.fetch=fetch;f.db.close();}
});
test('published report is projected per child, parent notes stay private, and demo profiles require class teacher access',async()=>{
 const f=await fixture(),clock=Date.now,fetch=global.fetch;Date.now=()=>end;global.fetch=async(url,init)=>{const payload=JSON.parse(init.body);assert.equal(payload.store,false);assert.equal(payload.text.format.strict,true);assert.ok(!init.body.includes('Please check Alice'));assert.ok(!init.body.includes('PRIVATE'));return provider();};
 try{
 const saved=await f.request('lessons/legacy-1',f.body('save'));assert.equal(saved.status,200);let before=await(await f.request('overview?learnerId=a',undefined,teachers.parent)).json();assert.equal(before.course.lessons[0].report,null);
 const res=await f.request('lessons/legacy-1',f.body('publish',1));assert.equal(res.status,200,await res.clone().text());
 const parent=await(await f.request('overview?learnerId=a',undefined,teachers.parent)).json(),student=await(await f.request('overview?learnerId=b',undefined,teachers.student)).json();
 const report=parent.course.lessons[0];assert.equal(report.homework,generated.homework.text);assert.equal(report.report.assessment.ratings.attitude,5);assert.equal(report.report.assessment.parentComment,draft.assessments[0].parentNote);assert.equal(report.report.assessment.quote,generated.students[0].quote);assert.ok(!report.report.summary.includes('Alice'));assert.ok(!report.report.summary.includes('17:30'));
 assert.equal(student.course.lessons[0].report.assessment.parentComment,undefined);assert.equal(student.learnerName,'Alice','student cannot select another child with query string');
 for(const forbidden of ['Bob','missed lesson','PRIVATE','teacherSpeaker','req_fictional'])assert.ok(!JSON.stringify(parent).includes(forbidden),forbidden);
 assert.equal((await f.request('overview?learnerId=b',undefined,teachers.parent)).status,404);
 assert.equal((await f.request('overview?learnerId=a&demo=1',undefined,teachers.other)).status,404);
 assert.equal((await f.request('demo-parents',{},teachers.student)).status,404);assert.equal((await f.request('demo-parents',{},teachers.owner,{Origin:'https://evil.invalid'})).status,403);
 assert.equal((await f.request('demo-parents',{})).status,200);assert.equal((await f.request('demo-parents',{})).status,200);assert.equal(f.db.prepare('SELECT count(*) n FROM demo_parent_profiles').get().n,2);assert.equal(f.db.prepare('SELECT count(*) n FROM user').get().n,6);
 const demo=await(await f.request('overview?learnerId=a&demo=1')).json();assert.equal(demo.demo,true);assert.equal(demo.course.lessons[0].report.assessment.parentComment,draft.assessments[0].parentNote);
 const teacher=await(await f.request('timeline')).json();assert.equal(teacher.teacher,true);assert.equal(teacher.course.lessons[0].report.assessment,null);assert.ok(!JSON.stringify(teacher).includes('Please check Alice'));
 f.db.prepare('DELETE FROM learner_parents WHERE parent_id=?').run('pa');assert.equal((await f.request('overview?learnerId=a',undefined,teachers.parent)).status,404);
 f.db.prepare('DELETE FROM class_students WHERE learner_id=?').run('a');assert.equal((await f.request('overview?learnerId=a&demo=1')).status,404);
 f.db.prepare('UPDATE classes SET deleted_at=1').run();assert.equal((await f.request('timeline')).status,404);assert.equal((await f.request('overview?learnerId=b',undefined,teachers.otherParent)).status,404);
 }finally{Date.now=clock;global.fetch=fetch;f.db.close();}
});
test('unsupported homework and quotations are omitted, with exact speaker attribution and no fabricated ratings',async()=>{
 const {verifyFeedback,speakerText}=await import('../cloudflare/lesson-feedback-ai.mjs');
 const roster=[{id:'a',name:'Alice'},{id:'b',name:'Bob'}];assert.match(speakerText(transcript,'Matthew'),/For homework/);assert.equal(speakerText('Teacher: Read chapter two.\nStudent: No homework.','Teacher'),'Read chapter two.');
 const fake=structuredClone(generated);fake.homework.evidence='Read the entire book tonight.';fake.students[0].quote='I am not sure yet.';fake.students[0].parentComment.evidence='Bob should bring his journal.';
 const out=verifyFeedback(fake,transcript,draft,roster);assert.equal(out.homework,null);assert.equal(out.extras.a.quote,null);assert.equal(out.extras.a.parentComment,null);assert.equal(out.extras.b,undefined);
 assert.equal(verifyFeedback(generated,transcript,{...draft,teacherSpeaker:''},roster).homework,null);
 const duplicated=structuredClone(generated);duplicated.students[1].number=1;assert.throws(()=>verifyFeedback(duplicated,transcript,draft,roster));
 const {validateAssessment}=await import('../dist/lesson-feedback-model.mjs');const alias=structuredClone(draft);alias.assessments[0].speaker='Matthew';assert.throws(()=>validateAssessment(alias,roster,true),/only one person/);
});
test('provider failure preserves the saved draft; concurrent publish and stale edits cannot overwrite a report',async()=>{
 const f=await fixture(),clock=Date.now,fetch=global.fetch;Date.now=()=>end;
 try{
 global.fetch=async()=>new Response('private-error',{status:500});const failed=await f.request('lessons/legacy-1',f.body());assert.equal(failed.status,502);let saved=await(await f.request('lessons/legacy-1')).json();assert.equal(saved.revision,1);assert.deepEqual(saved.draft,draft);assert.equal(saved.published,null);assert.equal(saved.busy,false);
 f.clearLimit();let release;const waiting=new Promise(r=>release=r);let entered;const started=new Promise(r=>entered=r);global.fetch=async()=>{entered();await waiting;return provider();};
 const body=f.body('publish',1),running=f.request('lessons/legacy-1',body);await started;assert.equal((await f.request('lessons/legacy-1',f.body('publish',1))).status,409);release();assert.equal((await running).status,200);
 const old=JSON.parse(f.db.prepare('SELECT published FROM lesson_feedback').get().published);
 assert.equal((await f.request('lessons/legacy-1',f.body('save',1))).status,409);
 f.clearLimit();global.fetch=async()=>{f.db.prepare('UPDATE course_overviews SET revision=revision+1').run();return provider();};saved=await(await f.request('lessons/legacy-1')).json();assert.equal((await f.request('lessons/legacy-1',f.body('publish',saved.revision))).status,502);assert.deepEqual(JSON.parse(f.db.prepare('SELECT published FROM lesson_feedback').get().published),old);
 assert.ok(!f.db.prepare('SELECT draft FROM lesson_feedback').get().draft.includes('The animals mistake'));
 }finally{Date.now=clock;global.fetch=fetch;f.db.close();}
});
test('published lessons retain stable identifiers and teachers can publish manual corrections without another API request',async()=>{
 const f=await fixture(),clock=Date.now,fetch=global.fetch;Date.now=()=>end;let calls=0;global.fetch=async()=>{calls++;return provider();};
 try{
 const result=await(await f.request('lessons/legacy-1',f.body())).json();const correction={...f.body('correct',result.revision),summary:'**Lesson overview**\nCorrected teacher summary.',homework:'Read chapter three.',extras:[{learnerId:'a',quote:'',parentComment:''},{learnerId:'b',quote:'',parentComment:''}]};assert.equal((await f.request('lessons/legacy-1',correction)).status,200);assert.equal(calls,1);
 const family=await(await f.request('overview?learnerId=a',undefined,teachers.parent)).json();assert.equal(family.course.lessons[0].report.assessment.quote,null);assert.equal(family.course.lessons[0].report.assessment.parentComment,null);assert.equal(family.course.lessons[0].homework,'Read chapter three.');assert.match(family.course.lessons[0].report.summary,/Corrected teacher/);
 const {handleCourseOverview}=await import('../cloudflare/course-overviews.mjs');const replaced=structuredClone(f.course);replaced.lessons[0].id=crypto.randomUUID();const req=new Request(origin+'/api/classes/'+classId+'/overview',{method:'POST',headers:{Origin:origin},body:JSON.stringify({course:replaced,revision:1})});assert.equal((await handleCourseOverview(req,f.env,teachers.owner,classId,f.helpers)).status,409);
 }finally{Date.now=clock;global.fetch=fetch;f.db.close();}
});
