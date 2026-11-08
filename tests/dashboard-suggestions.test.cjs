const {test}=require('node:test'),assert=require('node:assert/strict');
const now=Date.parse('2026-11-08T12:00:00Z'),day=86400000;
const classroom={id:'class-1',name:'Literature'},students=[{id:'a',name:'Alice'},{id:'b',name:'Bob'}];
const load=async()=>({...(await import('../dist/dashboard-suggestions.mjs')),skill:(await import('../dist/assessment-catalogue.mjs')).default.groups[0].skills[0].id});
function evidence(skill,correct=5){return Array.from({length:10},(_,i)=>({id:'r'+i,learnerId:'a',skillId:skill,correct:i<correct,supported:false,hint:false,occurredAt:now-(i<5?2:1)*day}));}
function quizzes(scores=[3,4,5]){return scores.map((score,i)=>({id:'lesson-'+i,title:'Lesson '+(i+1),status:'completed',quiz:{results:[{learnerId:'a',first:{score,total:10,submittedAt:now-(3-i)*day},latest:{score:10,total:10,submittedAt:now-i*day}}]}}));}
const run=(fn,timeline,extras={})=>fn({classroom,students,timeline,now,...extras});

test('support prompts need enough independent evidence across days, and explain their threshold',async()=>{
 const {assessmentSuggestions:fn,skill}=await load(),rows=evidence(skill);
 const [s]=run(fn,{skillEvidence:rows});assert.equal(s.kind,'intervention');assert.match(s.facts[0],/5\/10.*50%.*2 recorded days/);assert.match(s.title,/Identify syllable types/);assert.equal(new URL('https://example.invalid'+s.href).searchParams.get('subject'),'foundations');
 assert.equal(run(fn,{skillEvidence:rows.slice(0,9)}).length,0);
 assert.equal(run(fn,{skillEvidence:rows.map(r=>({...r,occurredAt:now-day}))}).length,0);
 assert.equal(run(fn,{skillEvidence:evidence(skill,6)}).length,0);
});
test('supported, hinted, unknown, duplicate, stale, future and undated work does not inflate evidence',async()=>{
 const {assessmentSuggestions:fn,skill}=await load(),rows=evidence(skill);
 const unusable=[{supported:true},{supported:undefined},{hint:true},{correct:null},{skillId:'unknown'},{learnerId:'foreign'},{occurredAt:now-43*day},{occurredAt:now+day},{occurredAt:undefined},{id:undefined}];
 for(const invalid of unusable)assert.equal(run(fn,{skillEvidence:rows.map(r=>({...r,...invalid}))}).length,0,JSON.stringify(invalid));
 assert.equal(run(fn,{skillEvidence:[...rows.slice(0,5),...rows.slice(0,5)]}).length,0);
 assert.equal(run(fn,{skillEvidence:rows},{students:[students[1]]}).length,0);
});
test('recent window and latest twenty govern suggestions without changing source arrays',async()=>{
 const {assessmentSuggestions:fn,skill}=await load(),rows=evidence(skill,10),old=evidence(skill,0).map(r=>({...r,id:'old'+r.id,occurredAt:now-42*day}));
 const original=JSON.stringify(rows);const [s]=run(fn,{skillEvidence:[...old,...rows,...rows.map(r=>({...r,id:'new'+r.id}))]});
 assert.equal(s.kind,'award');assert.match(s.facts[0],/20\/20/);assert.equal(JSON.stringify(rows),original);
 assert.equal(run(fn,{skillEvidence:evidence(skill).map((r,i)=>({...r,occurredAt:now-(i<5?42:41)*day}))}).length,1);
});
test('progress compares five earlier with five later responses on separate days',async()=>{
 const {assessmentSuggestions:fn,skill}=await load();
 const rows=evidence(skill).map((r,i)=>({...r,correct:i>=5}));const s=run(fn,{skillEvidence:rows}).find(r=>r.kind==='award');
 assert.match(s.title,/Progress/);assert.match(s.notes,/Earlier five: 0%; latest five: 100%/);
 const overlap=rows.map((r,i)=>({...r,occurredAt:now-day-(9-i)*60000}));assert.equal(run(fn,{skillEvidence:overlap}).some(r=>r.kind==='award'),false);
});
test('undated fictional sample evidence requires the explicit demo source and is visibly labelled',async()=>{
 const {assessmentSuggestions:fn,skill}=await load(),rows=evidence(skill).map((r,i)=>({...r,occurredAt:undefined,demo:true,week:1,day:i<5?1:2}));
 assert.equal(run(fn,{skillEvidence:rows}).length,0);
 const [s]=run(fn,{skillEvidence:rows,demoSource:'educade-v1'});assert.equal(s.demo,true);assert.match(s.notes,/Fictional demo responses/);
 assert.equal(run(fn,{skillEvidence:rows.map(r=>({...r,demo:false})),demoSource:'educade-v1'}).length,0);
});
test('quiz evidence uses first submitted attempts in three distinct recent noncancelled lessons',async()=>{
 const {assessmentSuggestions:fn}=await load(),lessons=quizzes();const [s]=run(fn,{course:{lessons}});assert.equal(s.kind,'intervention');assert.match(s.facts[0],/12\/30.*40%/);
 for(const altered of [lessons.slice(0,2),lessons.map(r=>({...r,id:'same'})),lessons.map(r=>({...r,status:'cancelled'})),lessons.map(r=>({...r,quiz:{results:[{learnerId:'a',latest:r.quiz.results[0].latest}]}}))])assert.equal(run(fn,{course:{lessons:altered}}).length,0);
 assert.equal(run(fn,{course:{lessons:quizzes([9,9,9])}})[0].kind,'award');
 assert.equal(run(fn,{course:{lessons:quizzes([6,6,6])}}).length,0);
 for(const invalid of [{total:0},{score:11},{score:-1},{submittedAt:undefined},{submittedAt:now-43*day},{submittedAt:now+1}])assert.equal(run(fn,{course:{lessons:lessons.map(r=>({...r,quiz:{results:[{...r.quiz.results[0],first:{...r.quiz.results[0].first,...invalid}}]}}))}}).length,0);
});
test('published teacher ratings require three present records and keep effort distinct from learning',async()=>{
 const {assessmentSuggestions:fn}=await load();
 const lessons=Array.from({length:3},(_,i)=>({id:'lesson'+i,report:{publishedAt:now-(i+1)*day,assessments:[{learnerId:'a',attendance:'present',ratings:{learning:2,effort:4}}]}}));
 const rows=run(fn,{course:{lessons}});assert.deepEqual(new Set(rows.map(r=>r.kind)),new Set(['award','intervention']));assert.match(rows.find(r=>r.kind==='award').title,/effort/);
 for(const alter of [r=>({...r,publishedAt:undefined}),r=>({...r,assessments:[{...r.assessments[0],attendance:'absent'}]}),r=>({...r,assessments:[{...r.assessments[0],ratings:{learning:null,effort:0}}]})])assert.equal(run(fn,{course:{lessons:lessons.map(l=>({...l,report:alter(l.report)}))}}).length,0);
});
test('only one prompt per learner and kind is chosen, and accepted or hidden prompts are suppressed',async()=>{
 const {assessmentSuggestions:fn,visibleSuggestions,skill}=await load();
 const timeline={skillEvidence:[...evidence(skill),...evidence(skill,10).map(r=>({...r,id:'b'+r.id,learnerId:'b'}))],course:{lessons:quizzes()}};
 const rows=run(fn,timeline);assert.equal(rows.filter(r=>r.learnerId==='a'&&r.kind==='intervention').length,1);assert.equal(rows.length,2);
 const a=rows.find(r=>r.learnerId==='a'),b=rows.find(r=>r.learnerId==='b');assert.equal(visibleSuggestions(rows,[],new Set([a.key])).length,1);
 assert.deepEqual(visibleSuggestions(rows,[{suggestionKey:b.key}]),[a]);
 assert.deepEqual(visibleSuggestions(rows,[{classId:a.classId,learnerId:a.learnerId,kind:'intervention',status:'active'}]),[b]);
 assert.equal(visibleSuggestions(rows,[{classId:a.classId,learnerId:a.learnerId,kind:'intervention',status:'resolved'}]).length,2);
 assert.equal(visibleSuggestions(rows,[{classId:'other',learnerId:a.learnerId,kind:'intervention',status:'active'}]).length,2);
 assert.equal(run(fn,timeline).find(r=>r.learnerId==='b').key,b.key);
 const changed={...timeline,skillEvidence:timeline.skillEvidence.map(r=>r.learnerId==='b'?{...r,id:r.id+'-new'}:r)};assert.notEqual(run(fn,changed).find(r=>r.learnerId==='b').key,b.key);
});
