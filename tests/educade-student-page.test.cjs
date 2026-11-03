const {test}=require('node:test'),assert=require('node:assert/strict');
test('EDUCADE student pages retain separate foundations/literacy evidence, class navigation and inline skill exploration',async()=>{
 const {studentPageHTML,studentAxes}=await import('../dist/educade-student-view.js');
 const {axisStats}=await import('../dist/educade-assessment-view.js'),{loadAssessmentDemo}=await import('../dist/assessment-demo.mjs'),{default:catalogue}=await import('../dist/assessment-catalogue.mjs');
 const d=await loadAssessmentDemo('demo-educade-5a'),axes=studentAxes(catalogue,'overall');assert.equal(axes.length,5);
 assert.equal(axes[0].section,'foundations');assert.equal(axes[1].section,'comprehension');
 const own=d.skillEvidence.filter(r=>r.learnerId===d.students[0].id);assert.equal(axisStats(catalogue,own,axes[0]).score,85);assert.notEqual(axisStats(catalogue,own,axes[1]).score,85);
 const html=studentPageHTML({classId:'saved-class',className:'Class 5A',student:d.students[0],students:d.students,catalogue,lessons:[],records:d.skillEvidence,scope:'literacy',mode:'radar',selectedSkill:catalogue.profileAxes.reading[0].id,demo:true});
 for(const expected of ['Alex Chen','data-back-class','data-switch-learner','data-profile-scope','data-profile-evidence','Glows &amp; Grows','Progress over four weeks','Open notebook','student-response-evidence'])assert.ok(html.includes(expected),expected);
 assert.doesNotMatch(html,/<dialog|aria-modal|style=/);assert.match(html,/Class 5A/);
 const empty=studentPageHTML({classId:'x',className:'X',student:{id:'x',name:'No evidence'},students:[],catalogue,lessons:[],records:[]});assert.match(empty,/No evidence yet/);assert.doesNotMatch(empty,/>0%/);
});
