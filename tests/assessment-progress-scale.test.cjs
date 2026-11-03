const {test}=require('node:test'),assert=require('node:assert/strict');
test('provisional B–M+ estimates cover percentage boundaries without grading missing evidence',async()=>{
 const {estimateProgressLevel}=await import('../dist/assessment-progress-scale.mjs');
 for(const [score,code] of [[0,'B'],[39,'B'],[40,'B+'],[54,'B+'],[55,'D'],[69,'D'],[70,'D+'],[79,'D+'],[80,'M'],[89,'M'],[90,'M+'],[100,'M+']])assert.equal(estimateProgressLevel(score).code,code,String(score));
 for(const score of [null,undefined,NaN,Infinity,-1,101,'80'])assert.equal(estimateProgressLevel(score),null);
 assert.equal(estimateProgressLevel(79.6).code,'M');assert.equal(estimateProgressLevel(79.6).percentage,80);
});
test('class and student standards views share labelled estimates and leave unassessed areas empty',async()=>{
 const {classOverviewHTML}=await import('../dist/educade-assessment-view.js'),{studentPageHTML}=await import('../dist/educade-student-view.js');
 const {loadAssessmentDemo}=await import('../dist/assessment-demo.mjs'),{default:catalogue}=await import('../dist/assessment-catalogue.mjs');
 const demo=await loadAssessmentDemo('demo-educade-5a'),student=demo.students.find(s=>s.name==='Alex Chen');
 const classHTML=classOverviewHTML({students:demo.students,lessons:[],catalogue,records:demo.skillEvidence,scope:'overall',mode:'standards',search:'',sort:'name',portrait:'initials'});
 const profileHTML=studentPageHTML({classId:'5a',className:'Class 5A',student,students:demo.students,catalogue,records:demo.skillEvidence,lessons:[],mode:'standards'});
 for(const html of [classHTML,profileHTML]){
  assert.match(html,/data-level="D"/);assert.match(html,/67% · Estimated|65% · Estimated/);assert.match(html,/provisional estimates from practice accuracy/);
  assert.match(html,/<strong>M\+<\/strong> 90–100%/);assert.doesNotMatch(html,/Not reviewed|No teacher standards judgments|style=|<dialog/);
 }
 assert.match(profileHTML,/data-level="M"[^>]*aria-label="Reading Foundations: estimated M, Mastering, from 85 percent/);
 const empty=studentPageHTML({classId:'5a',className:'Class 5A',student,students:demo.students,catalogue,records:[],lessons:[],mode:'standards'});
 assert.match(empty,/No evidence yet/);assert.doesNotMatch(empty,/data-level=|0% · Estimated/);
});
