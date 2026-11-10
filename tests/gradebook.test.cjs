const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {fixture:base,origin}=require('./helpers/assignment-fixture.cjs');
async function fixture(){const f=await base(),{handleGradebook}=await import('../cloudflare/gradebook.mjs');f.env.WORKSHEETS.list=async({prefix})=>({objects:[...f.objects.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key})),truncated:false});
 f.grade=(who,suffix='',body,headers={})=>handleGradebook(new Request(origin+'/api/gradebook/classes/'+f.classId+suffix,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify({expectedUserId:f.users[who]?.id,requestId:randomUUID(),...body})})}),f.env,f.users[who],{readJSON:async r=>r.json()});return f;}
const activity=(overrides={})=>({title:'Explain character motivation',date:'2026-11-10',purpose:'formative',format:'points',max:10,standards:[{code:'CCSS.RL.4.3',title:'Use text details to explain character actions.'}],source:{kind:'manual',id:''},successCriteria:'Explain and support with evidence.',...overrides});
const entry=(overrides={})=>({state:'observed',evidenceType:'observation',support:'independent',grade:0,judgments:[{code:'CCSS.RL.4.3',level:'approaching'}],evidenceNote:'Explains the action, but needs evidence.',feedback:'Choose a detail that supports your explanation.',nextStep:'Model how to link the detail to the claim.',followUp:'2026-11-12',privateNote:'Private diagnostic note',...overrides});
async function send(f,who,suffix='',body,status=200){const r=await f.grade(who,suffix,body),v=await r.json();assert.equal(r.status,status,JSON.stringify(v));return v;}
async function create(f,options={}){return (await send(f,'teacher','',{action:'create',activity:activity(options)},201)).activity;}
async function save(f,a,mode='draft',changes={},who='teacher'){return (await send(f,who,'/'+a.id,{action:'entry',revision:a.revision,learnerId:f.learnerId,mode,entry:entry(changes)})).activity;}
test('gradebook drafts are private, teacher publication is official, later drafts preserve published grade',async()=>{
 const f=await fixture();let a=await create(f);a=await save(f,a);assert.equal((await send(f,'student')).activities.length,0);assert.equal((await send(f,'parent')).activities.length,0);
 a=await save(f,a,'publish',{grade:7});let family=await send(f,'parent');assert.equal(family.activities[0].entries[0].published.grade,7);assert.equal(JSON.stringify(family).includes('Private diagnostic note'),false);assert.equal('draft'in family.activities[0].entries[0],false);assert.equal('history'in family.activities[0].entries[0],false);
 a=await save(f,a,'draft',{grade:9,privateNote:'Changed private note'});family=await send(f,'student');assert.equal(family.activities[0].entries[0].published.grade,7);assert.equal((await send(f,'teacher','/'+a.id)).activity.entries[0].history.length,3);
 a=await save(f,a,'publish',{grade:9});assert.equal((await send(f,'student')).activities[0].entries[0].published.grade,9);await send(f,'teacher','/'+a.id,{action:'entry',revision:a.revision,learnerId:f.learnerId,mode:'withdraw'});assert.equal((await send(f,'student')).activities.length,0);assert.equal((await send(f,'teacher','/'+a.id)).activity.entries[0].history.length,5);f.db.close();
});
test('membership, roles, CSRF, account switch and current enrollment protect grades and history',async()=>{
 const f=await fixture();let a=await create(f);await save(f,a,'publish',{grade:8});
 for(const who of ['otherTeacher','otherParent'])await send(f,who,'',undefined,404);
 await send(f,'student','/'+a.id,{action:'entry',revision:1,learnerId:f.learnerId,mode:'publish',entry:entry()},403);
 assert.equal((await f.grade('teacher','',{action:'create',activity:activity()},{Origin:'https://evil.invalid'})).status,403);
 await send(f,'teacher','',{action:'create',expectedUserId:'otherTeacher',activity:activity()},401);
 assert.equal((await send(f,'otherStudent')).activities.length,0);
 assert.equal((await send(f,'invitedTeacher')).activities.length,1);
 f.db.prepare('DELETE FROM class_students WHERE class_id=? AND learner_id=?').run(f.classId,f.learnerId);await send(f,'student','',undefined,404);await send(f,'parent','',undefined,404);assert.equal((await send(f,'teacher','/'+a.id)).activity.entries.length,0);f.db.close();
});
test('numeric grades, letter grades, standards-only judgments and feedback-only assessments retain their own scales',async()=>{
 const {cleanActivity,cleanEntry,gradeLabel}=await import('../dist/gradebook-model.mjs');
 const points=cleanActivity(activity());assert.equal(gradeLabel(cleanEntry(entry({grade:0}),points),points),'0 / 10');assert.throws(()=>cleanEntry(entry({grade:11}),points));assert.throws(()=>cleanEntry(entry({grade:'4'}),points));assert.throws(()=>cleanEntry(entry({grade:NaN}),points));
 const percent=cleanActivity(activity({format:'percentage'}));assert.equal(gradeLabel(cleanEntry(entry({grade:78.5}),percent),percent),'78.5%');assert.throws(()=>cleanEntry(entry({grade:101}),percent));
 const letter=cleanActivity(activity({format:'letter'}));assert.equal(gradeLabel(cleanEntry(entry({grade:'A−'}),letter),letter),'A−');
 const levels=cleanActivity(activity({format:'standards'}));assert.match(gradeLabel(cleanEntry(entry({grade:null}),levels),levels),/Approaching/);assert.throws(()=>cleanEntry(entry({grade:3}),levels));
 const none=cleanActivity(activity({format:'none',standards:[]}));assert.equal(gradeLabel(cleanEntry(entry({grade:null,judgments:[]}),none),none),'Feedback only');
 for(const state of ['missing','absent','exempt','unobserved']){const r=cleanEntry(entry({state,grade:0,judgments:[]}),points);assert.equal(r.grade,null);assert.notEqual(gradeLabel(r,points),'0 / 10');}
 assert.throws(()=>cleanEntry(entry({state:'absent'}),points));assert.throws(()=>cleanEntry(entry({judgments:[{code:'CCSS.RL.4.3',level:'invented'}]}),points));assert.throws(()=>cleanActivity(activity({date:'2026-02-30'})));assert.throws(()=>cleanEntry(entry({followUp:'2026-02-30'}),points));assert.throws(()=>cleanActivity(activity({format:'standards',standards:[]})));
});
test('compare-and-swap, stale revisions and retries do not silently overwrite another teacher',async()=>{
 const f=await fixture();let a=await create(f),rid=randomUUID(),body={action:'entry',requestId:rid,revision:a.revision,learnerId:f.learnerId,mode:'draft',entry:entry()};a=(await send(f,'teacher','/'+a.id,body)).activity;
 assert.equal((await send(f,'teacher','/'+a.id,body)).activity.revision,a.revision);await send(f,'invitedTeacher','/'+a.id,{...body,requestId:randomUUID()},409);
 const responses=await Promise.all([f.grade('teacher','/'+a.id,{...body,revision:a.revision,requestId:randomUUID()}),f.grade('invitedTeacher','/'+a.id,{...body,revision:a.revision,requestId:randomUUID()})]);assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal((await send(f,'teacher','/'+a.id)).activity.entries[0].history.length,2);f.db.close();
});
test('automatic evidence is captured from server quiz attempts; later attempts never replace published teacher judgment',async()=>{
 const f=await fixture(),lesson='legacy-1',qid=randomUUID();
 f.db.prepare('INSERT INTO lesson_quizzes(class_id,lesson_id,title,questions,updated_by,updated_at) VALUES(?,?,?,?,?,0)').run(f.classId,lesson,'Reading check',JSON.stringify([{},{}]),'teacher');
 f.db.prepare('INSERT INTO quiz_attempts(id,class_id,lesson_id,learner_id,learner_name,quiz_revision,started_at,submitted_at,score,total,answers) VALUES(?,?,?,?,?,1,0,100,1,2,?)').run(qid,f.classId,lesson,f.learnerId,'Student','[]');
 let a=await create(f,{source:{kind:'quiz',id:lesson}});a=await save(f,a,'publish',{grade:8,sourceEvidence:{fake:'injected'}});
 assert.equal(a.entries[0].published.sourceEvidence.result.latest.score,1);assert.equal(a.entries[0].published.sourceEvidence.type,'automatic-quiz');
 f.db.prepare('INSERT INTO quiz_attempts(id,class_id,lesson_id,learner_id,learner_name,quiz_revision,started_at,submitted_at,score,total,answers) VALUES(?,?,?,?,?,1,200,300,2,2,?)').run(randomUUID(),f.classId,lesson,f.learnerId,'Student','[]');
 const r=(await send(f,'teacher','/'+a.id)).activity.entries[0];assert.equal(r.published.grade,8);assert.equal(r.published.sourceEvidence.result.latest.score,1);assert.equal((await send(f,'student')).activities[0].entries[0].published.grade,8);
 assert.equal(f.db.prepare('SELECT score FROM quiz_attempts WHERE id=?').get(qid).score,1);await send(f,'teacher','',{action:'create',activity:activity({source:{kind:'quiz',id:'other-class-quiz'}})},400);f.db.close();
});
test('teacher entries, follow-ups and standards record successive observations without forcing a grade',async()=>{
 const f=await fixture();let a=await create(f,{format:'none'});a=await save(f,a,'draft',{grade:null,evidenceType:'hinge',support:'supported'});a=await save(f,a,'publish',{grade:null,evidenceType:'conversation',judgments:[{code:'CCSS.RL.4.3',level:'meeting'}],followUpDone:true});const row=a.entries[0];assert.equal(row.history[0].entry.support,'supported');assert.equal(row.history[1].entry.followUpDone,true);assert.equal(row.published.grade,null);assert.equal((await send(f,'parent')).activities[0].entries[0].published.judgments[0].level,'meeting');f.db.close();
});
test('activity corrections preserve publication details and cannot reinterpret an existing grading scale',async()=>{
 const f=await fixture();let a=await create(f);a=await save(f,a,'publish',{grade:8});
 const corrected=activity({title:'Corrected title'});a=(await send(f,'teacher','/'+a.id,{action:'update',revision:a.revision,activity:corrected})).activity;
 assert.equal(a.title,'Corrected title');assert.equal((await send(f,'student')).activities[0].entries[0].published.activity.title,'Explain character motivation');
 await send(f,'teacher','/'+a.id,{action:'update',revision:a.revision,activity:{...corrected,max:100}},400);
 a=await save(f,a,'publish',{grade:8});assert.equal((await send(f,'student')).activities[0].entries[0].published.activity.title,'Corrected title');assert.equal(a.entries[0].history[0].entry.activity.title,'Explain character motivation');f.db.close();
});
test('notebook activity links must belong to the authorized class, including the master notebook',async()=>{
 const f=await fixture(),pid=randomUUID();f.db.prepare('INSERT INTO teacher_notebook_pages VALUES(?,?,?,?,?,?,?,?,?,?)').run(f.classId,'teacher',pid,'lesson-1','Analysis','note','{}',null,1,0);
 const a=await create(f,{source:{kind:'notebook',id:pid}});assert.equal(a.source.id,pid);
 await send(f,'teacher','',{action:'create',activity:activity({source:{kind:'notebook',id:randomUUID()}})},400);f.db.close();
});
