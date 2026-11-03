const {test}=require('node:test');
const assert=require('node:assert/strict');
const load=()=>Promise.all([import('../dist/assessment-model.mjs'),import('../dist/assessment-catalogue.mjs')]);
test('EDUCADE catalogue preserves unique skill IDs and keeps partial mappings separate',async()=>{
 const [, {default:catalogue}]=await load();
 const skills=catalogue.groups.flatMap(g=>g.skills),ids=new Set(skills.map(s=>s.id));
 assert.equal(skills.length,134);assert.equal(ids.size,skills.length);assert.equal(Object.keys(catalogue.mappings).length,17);
 for(const [id,mapping] of Object.entries(catalogue.mappings)){assert.ok(ids.has(id));assert.equal(mapping.status,'candidate');assert.match(mapping.code,/^CCSS\.ELA-LITERACY\./);assert.ok(!ids.has(mapping.code));}
 assert.equal('students' in catalogue,false);assert.equal('evidence' in catalogue,false);
});
test('imported curriculum registry preserves provenance and does not equate Cambridge Primary with IGCSE',async()=>{
 const [, {default:catalogue}]=await load();const {default:registry}=await import('../dist/assessment-curricula.mjs');
 const ids=new Set(catalogue.groups.flatMap(g=>g.skills.map(s=>s.id)));
 assert.deepEqual(Object.keys(registry.frameworks),['ccss','england','australia','cambridge']);
 for(const [framework,links] of Object.entries(registry.alignments)){
  assert.match(registry.frameworks[framework].source,/^https:\/\//);
  for(const [id,link] of Object.entries(links)){assert.ok(ids.has(id));assert.ok(link.objective);assert.match(link.status,/prototype|Candidate|pending/);}
 }
 assert.match(registry.frameworks.cambridge.name,/Primary/);assert.ok(!Object.keys(registry.frameworks).includes('igcse'));
});
test('assessment evidence is learner scoped and distinguishes first results, attendance and missing data',async()=>{
 const [{learnerEvidence,evidenceSummary}]=await load();
 const lessons=[{id:'one',quiz:{results:[{learnerId:'a',first:{score:1,total:4},latest:{score:4,total:4}}]},report:{assessments:[{learnerId:'b',attendance:'present'}]}},{id:'two',quiz:{results:[{learnerId:'a',latest:{score:3,total:6}},{learnerId:'b',inProgress:true}]},report:{assessments:[{learnerId:'a',attendance:'absent'}]}},{id:'three',quiz:{results:[{learnerId:'a',inProgress:true}]}}];
 assert.deepEqual(evidenceSummary(learnerEvidence(lessons,'a')),{quizzes:2,feedback:1,present:0,accuracy:40});
 assert.deepEqual(evidenceSummary(learnerEvidence(lessons,'b')),{quizzes:0,feedback:1,present:1,accuracy:null});
 assert.deepEqual(evidenceSummary(learnerEvidence(lessons,'missing')),{quizzes:0,feedback:0,present:0,accuracy:null});
});
test('future game contract requires registered skills, bounded scores and provenance; ignores client mastery claims',async()=>{
 const [{validateGameEvidence},{default:catalogue}]=await load();
 const event={version:1,sourceId:'viking-quest',eventId:'response-123',activityId:'rising-tide',classId:'class-a',learnerId:'learner-a',skillId:catalogue.groups[0].skills[0].id,score:1,total:1,support:'independent',attempt:1,occurredAt:'2026-11-03T09:00:00Z',achievement:'exceeding'};
 const valid=validateGameEvidence(event,catalogue);assert.equal(valid.eventId,event.eventId);assert.equal('achievement' in valid,false);
 for(const bad of [{skillId:'CCSS.ELA-LITERACY.RL.5.1'},{skillId:'unknown'},{total:0},{score:2},{support:'mastered'},{attempt:0},{sourceId:''},{occurredAt:'yesterday'}])assert.throws(()=>validateGameEvidence({...event,...bad},catalogue));
});
