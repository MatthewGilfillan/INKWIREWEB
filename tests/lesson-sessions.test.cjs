const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {fixture:base,origin}=require('./helpers/assignment-fixture.cjs');
async function fixture(){
 const f=await base(),{handleLessonSessions}=await import('../cloudflare/lesson-sessions.mjs'),{handleClassBoards}=await import('../cloudflare/class-boards.mjs');
 const {defaults,generateLessons}=await import('../dist/course-model.mjs');f.course={...defaults('Reading'),weeks:1,startDate:'2030-01-07'};f.course.lessons=generateLessons(f.course);f.course.lessons[0].id='lesson-one';
 f.db.prepare('INSERT INTO course_overviews VALUES(?,1,?,?,0)').run(f.classId,JSON.stringify(f.course),'teacher');
 f.session=async(who='teacher',body,status=200)=>{const response=await handleLessonSessions(new Request(origin+`/api/lesson-sessions/classes/${f.classId}/lessons/lesson-one`,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify({expectedUserId:f.users[who].id,requestId:randomUUID(),...body})}:{})}),f.env,f.users[who]);const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value;};
 f.board=async(who,id='',body,status=200)=>{const response=await handleClassBoards(new Request(origin+'/api/class-boards/classes/'+f.classId+(id?'/'+id:''),{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify({expectedUserId:f.users[who].id,requestId:randomUUID(),...body})}:{})}),f.env,f.users[who]);const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value;};
 f.open=async(id,extra={})=>{const {board}=await f.board('teacher',id);return f.board('teacher',id,{action:'settings',...board,open:true,published:true,...extra});};
 f.create=async(template='reading-wall')=>{const {id}=await f.board('teacher','',{action:'create',template,title:'Our lesson'},201);await f.open(id,{lessonId:'lesson-one'});return id;};
 f.pages=owner=>f.db.prepare('SELECT * FROM notebook_pages WHERE class_id=? AND learner_id=?').all(f.classId,owner).map(p=>({...p,document:JSON.parse(p.document_json)}));
 return f;
}
test('actual lesson start/end is teacher controlled, retry safe and independent of schedule',async()=>{const f=await fixture();try{
 assert.equal((await f.session()).session,null);await f.session('student',{action:'start',revision:0},403);await f.session('otherTeacher',undefined,404);
 const token=randomUUID(),started=await f.session('teacher',{action:'start',revision:0,requestId:token});assert.equal(started.session.phase,'running');assert.ok(started.session.startedAt<Date.parse(f.course.startDate));assert.deepEqual((await f.session('teacher',{action:'start',revision:0,requestId:token})).session,started.session);
 await f.session('teacher',{action:'end',revision:0},409);const ended=await f.session('invitedTeacher',{action:'end',revision:1});assert.equal(ended.session.phase,'ended');assert.equal((await f.session('student')).session.phase,'ended');assert.equal((await f.session('parent')).session.phase,'ended');
}finally{f.db.close();}});
test('ending saves immutable boards into matching student sections and keeps unrelated boards open',async()=>{const f=await fixture();try{
 const id=await f.create();await f.board('student',id,{action:'post',stage:'question',text:'Why does Mira act?'});const unrelated=(await f.board('teacher','',{action:'create',template:'reading-wall',title:'Another lesson'},201)).id;await f.open(unrelated);
 await f.session('teacher',{action:'start',revision:0});const ended=await f.session('teacher',{action:'end',revision:1});assert.equal(ended.session.pending,0);assert.equal(ended.session.snapshots.length,1);const sid=ended.session.snapshots[0].snapshotId;
 for(const owner of [f.learnerId,f.otherLearner]){const pages=f.pages(owner);assert.equal(pages.filter(p=>p.section_id==='lesson-lesson-one').length,2);const final=pages.find(p=>p.document.content.some(n=>n.attrs?.snapshotId===sid));assert.ok(final);assert.ok(final.title.endsWith(' · Final'));}
 const frozen=(await f.board('student',id+'/snapshots/'+sid)).snapshot;assert.equal(frozen.posts[0].text,'Why does Mira act?');await f.board('student',id,{action:'post',text:'Too late'},409);assert.equal((await f.board('teacher',unrelated)).board.open,true);
 await f.board('teacher',id,{action:'settings',...(await f.board('teacher',id)).board,open:true},409); // Reopening is denied until an explicit lesson restart.
 const restart=await f.session('teacher',{action:'start',revision:ended.session.revision});assert.equal(restart.session.phase,'running');await f.open(id);await f.board('student',id,{action:'post',stage:'question',text:'A later response'});assert.deepEqual((await f.board('student',id+'/snapshots/'+sid)).snapshot,frozen);
}finally{f.db.close();}});
test('partial final-page delivery stays pending and retries without duplicate snapshots or data loss',async()=>{const f=await fixture();try{
 const id=await f.create();await f.session('teacher',{action:'start',revision:0});const prepare=f.env.DB.prepare.bind(f.env.DB);let broken=true;f.env.DB.prepare=sql=>{if(broken&&sql.startsWith('INSERT OR IGNORE INTO notebook_pages'))throw Error('Temporary delivery error');return prepare(sql);};
 const token=randomUUID(),pending=await f.session('teacher',{action:'end',revision:1,requestId:token},202);assert.equal(pending.session.phase,'ending');assert.equal(pending.session.pending,1);await f.board('student',id,{action:'post',text:'Too late'},409);broken=false;
 const done=await f.session('teacher',{action:'end',revision:1,requestId:token});assert.equal(done.session.phase,'ended');assert.equal((await f.board('teacher',id)).board.snapshots.length,1);assert.equal(f.pages(f.learnerId).length,2);await f.session('teacher',{action:'end',revision:1,requestId:token});assert.equal(f.pages(f.learnerId).length,2);
}finally{f.db.close();}});
test('close posting creates a final version and notebook reconciliation repairs missed final pages',async()=>{const f=await fixture();try{
 const id=await f.create('story-mountain'),{board}=await f.board('teacher',id);const closed=await f.board('teacher',id,{action:'settings',...board,open:false});const sid=closed.board.closedSnapshotId;assert.ok(sid);assert.equal(f.pages(f.learnerId).length,2);
 const final=f.pages(f.learnerId).find(p=>p.document.content.some(n=>n.attrs?.snapshotId===sid));f.db.prepare('DELETE FROM notebook_item_meta WHERE class_id=? AND book_owner=? AND item_id=?').run(f.classId,f.learnerId,final.id);f.db.prepare('DELETE FROM notebook_pages WHERE id=?').run(final.id);
 const response=await f.call('student',f.base);assert.equal(response.status,200);assert.equal(f.pages(f.learnerId).length,2);
}finally{f.db.close();}});
test('lesson status projects to family timelines without teacher identity or private history',async()=>{const f=await fixture();try{
 const {handleLessonFeedback}=await import('../cloudflare/lesson-feedback.mjs'),helpers={json:(v,s=200)=>Response.json(v,{status:s}),fail:(message,s=400)=>Response.json({message},{status:s})};await f.session('teacher',{action:'start',revision:0});
 const response=await handleLessonFeedback(new Request(origin+`/api/lesson-feedback/classes/${f.classId}/overview`),f.env,f.users.student,helpers);assert.equal(response.status,200);const value=await response.json();assert.equal(value.course.lessons[0].session.phase,'running');assert.equal(value.course.lessons[0].session.operations,undefined);assert.equal(value.course.lessons[0].session.endToken,undefined);
}finally{f.db.close();}});
test('a course edit cannot remove a lesson with actual teaching history',async()=>{const f=await fixture();try{
 await f.session('teacher',{action:'start',revision:0});const {handleCourseOverview}=await import('../cloudflare/course-overviews.mjs');const course=structuredClone(f.course);course.lessons[0].id='replacement-lesson';
 const response=await handleCourseOverview(new Request(origin+'/api/classes/'+f.classId+'/overview',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({revision:1,course})}),f.env,f.users.teacher,f.classId,{json:(v,s=200)=>Response.json(v,{status:s}),fail:(message,s=400,code)=>Response.json({message,code},{status:s}),readJSON:r=>r.json()});
 assert.equal(response.status,409);assert.equal((await response.json()).code,'LESSON_HAS_SESSION');assert.equal((await f.session()).session.phase,'running');
}finally{f.db.close();}});
test('a teacher can reveal rankings and finish a pending end without reopening student writing',async()=>{const f=await fixture();try{
 const id=await f.create('rank-justify');await f.session('teacher',{action:'start',revision:0});const pending=await f.session('teacher',{action:'end',revision:1},202);assert.match(pending.pendingIssues[0].message,/Reveal rankings/);assert.equal((await f.session('student')).pendingIssues,undefined);
 const {board}=await f.board('teacher',id);await f.board('teacher',id,{action:'settings',...board,revealRankings:true});await f.board('student',id,{action:'post',text:'Not while ending'},409);
 const done=await f.session('teacher',{action:'end',revision:pending.session.revision});assert.equal(done.session.phase,'ended');assert.equal(done.session.pending,0);
}finally{f.db.close();}});
