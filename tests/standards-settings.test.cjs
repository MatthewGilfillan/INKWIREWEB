const {test}=require('node:test'),assert=require('node:assert/strict');
const selection={version:1,deferred:false,frameworks:[{id:'ib-pyp',scope:'school'},{id:'ipc',scope:'mp2'}],judgmentScale:'b-m-plus',notes:'Observe explanations over time.'};
test('all requested framework families have explicit scopes, editions, provenance and unique criterion IDs',async()=>{
 const {standardsPacks}=await import('../dist/standards-registry.mjs');
 assert.ok(['ccss-ela','england-english','oxford-writing','alberta-ela-k6','cie-primary-0058','cie-lower-0861','gcse-language','gcse-literature','igcse-0500-2027','igcse-0475-2027','ap-literature','ib-pyp','ib-myp-language','ib-dp-literature','ib-dp-langlit','ipc'].every(id=>standardsPacks.some(p=>p.id===id)));
 const ids=standardsPacks.flatMap(p=>p.criteria.map(c=>c.id));assert.equal(new Set(ids).size,ids.length);
 for(const p of standardsPacks){assert.match(p.source,/^https:\/\//);assert.ok(p.edition);assert.ok(p.coverage);assert.ok(p.scopes.length);assert.equal(p.checked,'2026-11-03');}
 assert.equal(standardsPacks.find(p=>p.id==='oxford-writing').criteria.length,6); // overview areas, not reproduced licensed checklists
});
test('PYP and IPC configure school progress for knowledge and skills while keeping understanding qualitative',async()=>{
 const {validateStandardsSelection,schoolProgressScale}=await import('../dist/standards-registry.mjs');
 const value=validateStandardsSelection(selection);assert.deepEqual(value.dimensions,['knowledge','skills']);assert.equal(value.understandingMode,'evidence-profile');
 assert.deepEqual(schoolProgressScale.map(l=>l.code),['B','B+','D','D+','M','M+']);assert.deepEqual(schoolProgressScale.filter(l=>!l.code.includes('+')).map(l=>l.label),['Beginning','Developing','Mastering']);
 assert.equal('score' in value,false);assert.ok(value.frameworks.every(row=>row.edition));
});
test('invalid or duplicate frameworks, cross-framework levels and invented scales cannot be saved',async()=>{
 const {validateStandardsSelection}=await import('../dist/standards-registry.mjs');
 for(const bad of [{frameworks:[{id:'unknown',scope:'g5'}]},{frameworks:[{id:'ib-pyp',scope:'hl'}]},{frameworks:[selection.frameworks[0],selection.frameworks[0]]},{judgmentScale:'percent-to-mastery'},{notes:'x'.repeat(4001)},{deferred:true},{frameworks:[]},{dimensions:['knowledge','knowledge']},{dimensions:['unmeasured-score']}])assert.throws(()=>validateStandardsSelection({...selection,...bad}));
 assert.equal(validateStandardsSelection(undefined),undefined);assert.equal(validateStandardsSelection({version:1,deferred:true,frameworks:[],judgmentScale:'framework',notes:''}).deferred,true);
});
test('assessment selections survive course validation, export/import, rescheduling and planning suggestions',async()=>{
 const {defaults,generateLessons,validateCourse,readCourseFile}=await import('../dist/course-model.mjs');
 const {validateStandardsSelection}=await import('../dist/standards-registry.mjs');
 const {applyPlanningResult}=await import('../cloudflare/planning-assistant.mjs');
 const course={...defaults(),assessment:validateStandardsSelection(selection)};course.lessons=generateLessons(course);
 assert.deepEqual(validateCourse(course).assessment,course.assessment);
 assert.deepEqual(readCourseFile({type:'inkwire-course',version:1,course}).assessment,course.assessment);
 const planned={description:'Updated',reviewNotes:'',lessons:course.lessons.map((l,i)=>({number:i+1,title:l.title,goal:l.goal,reading:'',homework:'',skills:'',activities:'Practice and discuss.',evidence:''}))};
 assert.deepEqual(applyPlanningResult(course,'course',null,planned).course.assessment,course.assessment);
 const {buildScheduledCourse}=await import('../dist/class-setup-model.mjs');
 const scheduled=buildScheduledCourse({title:'Trial',assessment:course.assessment,format:'custom',lessonCount:2,lessonMinutes:60,startDate:'2027-01-04',endDate:'2027-01-11',timeZone:'UTC',weeklySlots:[{day:1,startTime:'16:00',lessonMinutes:60}],billingMode:'none',billTo:''});
 assert.deepEqual(scheduled.assessment,course.assessment);
});
test('class API persists course standards in the existing course transaction',async()=>{
 const {classSetupFixture}=require('./helpers/class-setup-fixture.cjs');
 const {buildScheduledCourse}=await import('../dist/class-setup-model.mjs');
 const f=await classSetupFixture();
 try{const course=buildScheduledCourse({title:'Assessment test',assessment:selection,format:'custom',lessonCount:2,lessonMinutes:60,startDate:'2027-01-04',endDate:'2027-01-11',timeZone:'UTC',weeklySlots:[{day:1,startTime:'16:00',lessonMinutes:60}],billingMode:'none',billTo:''});
 const result=await f.api('/api/classes',{name:'Assessment test',subject:'English',requestId:crypto.randomUUID(),course});assert.equal(result.status,201);
 const stored=JSON.parse(f.db.prepare('SELECT content FROM course_overviews WHERE class_id=?').get((await result.json()).classroom.id).content);assert.deepEqual(stored.assessment,course.assessment);
 }finally{f.db.close();}
});
