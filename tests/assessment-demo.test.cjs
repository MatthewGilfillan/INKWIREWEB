const {test}=require('node:test'),assert=require('node:assert/strict');
test('EDUCADE fictional classes preserve original rosters, skill responses and accuracy without real identities',async()=>{
 const {assessmentDemoClasses,loadAssessmentDemo,isAssessmentDemo}=await import('../dist/assessment-demo.mjs');
 const {default:source}=await import('../dist/educade-demo-data.mjs');
 const {default:catalogue}=await import('../dist/assessment-catalogue.mjs');
 const {classAxes,axisStats}=await import('../dist/educade-assessment-view.js');
 const ids=new Set(catalogue.groups.flatMap(g=>g.skills.map(s=>s.id))),seen=new Set();
 assert.equal(assessmentDemoClasses.length,2);
 for(const c of assessmentDemoClasses){
  const d=await loadAssessmentDemo(c.id),original=source.classes.find(row=>c.id.endsWith(row.id));
  assert.equal(d.students.length,original.studentIds.length);assert.equal(isAssessmentDemo(c.id),true);
  for(const s of d.students){assert.ok(s.demo);assert.match(s.id,/^demo-educade-/);assert.ok(!seen.has(s.id));seen.add(s.id);assert.ok(!s.email);}
  for(const r of d.skillEvidence){assert.ok(r.demo);assert.ok(d.students.some(s=>s.id===r.learnerId));assert.ok(ids.has(r.skillId));assert.equal(typeof r.correct,'boolean');assert.ok(r.response);}
  for(const s of d.students){
   const originalStudent=source.students.find(row=>s.id==='demo-educade-'+row.id);
   for(const axis of classAxes(catalogue,'overall'))assert.equal(axisStats(catalogue,d.skillEvidence.filter(r=>r.learnerId===s.id),axis).score,source.domainStats(originalStudent,axis.domain).score);
  }
 }
 await assert.rejects(loadAssessmentDemo('real-class-id'));
});
test('demo class markup uses actual response bars under strict CSP and never links fictional learners to profile APIs',async()=>{
 const {loadAssessmentDemo}=await import('../dist/assessment-demo.mjs'),{default:catalogue}=await import('../dist/assessment-catalogue.mjs');
 const {classOverviewHTML}=await import('../dist/educade-assessment-view.js');
 const d=await loadAssessmentDemo('demo-educade-5a'),html=classOverviewHTML({students:d.students,lessons:[],catalogue,records:d.skillEvidence,scope:'overall',mode:'bars',search:'',sort:'name',portrait:'photos'});
 assert.match(html,/Alex Chen/);assert.match(html,/sample responses/);assert.match(html,/<rect class="educade-hp-fill/);assert.doesNotMatch(html,/style=/);assert.doesNotMatch(html,/\/api\/profiles/);assert.match(html,/<strong>6<\/strong><span>with evidence/);assert.match(html,/<strong>0<\/strong><span>awaiting evidence/);
});
