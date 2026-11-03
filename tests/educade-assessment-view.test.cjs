const {test}=require('node:test'),assert=require('node:assert/strict');
test('adapted EDUCADE summaries exclude missing skill evidence from percentages',async()=>{
 const {summarizePractice}=await import('../dist/educade-assessment-view.js');
 assert.deepEqual(summarizePractice([]),{attempts:0,correct:0,score:null,independent:0,supported:0,hints:0});
 assert.deepEqual(summarizePractice([{correct:true,supported:false},{correct:false,supported:true,hint:true}]),{attempts:2,correct:1,score:50,independent:1,supported:1,hints:1});
});
test('class comparison preserves scope IDs and never maps whole quizzes to subject skills automatically',async()=>{
 const V=await import('../dist/educade-assessment-view.js'),{default:catalogue}=await import('../dist/assessment-catalogue.mjs');
 const data={students:[{id:'a',name:'A <test>'}],lessons:[{id:'l',quiz:{results:[{learnerId:'a',latest:{score:10,total:10}}]}}],scope:'overall',mode:'bars',search:'',sort:'name',portrait:'initials',catalogue,records:[]};
 const html=V.classOverviewHTML(data);assert.match(html,/No evidence yet/);assert.ok(!html.includes('100%'));assert.match(html,/A &lt;test&gt;/);assert.ok(!html.includes('Teacher Dashboard'));
 const id=catalogue.profileAxes.reading[0].id;assert.ok(V.classAxes(catalogue,'literacy').some(axis=>axis.id===id));
 const withRecord=V.classRowsHTML({...data,records:[{learnerId:'a',skillId:id,correct:true,supported:false}]});assert.match(withRecord,/100%/);assert.equal(V.axisStats(catalogue,[{skillId:id,correct:true}],{domain:'grammar'}).score,null);
});
test('EDUCADE radar omits missing values and requires three observed areas',async()=>{
 const {practiceRadarHTML}=await import('../dist/educade-assessment-view.js');
 const axes=['Reading','Writing','Grammar','Vocabulary'].map(label=>({label}));
 assert.ok(!practiceRadarHTML(axes,[90,null,null,null]).includes('<svg'));
 const partial=practiceRadarHTML(axes,[90,80,null,70]);assert.match(partial,/<svg/);assert.equal((partial.match(/<circle/g)||[]).length,3);assert.ok(!partial.includes('<polygon class="educade-radar-area"'));
 assert.match(practiceRadarHTML(axes,[90,80,60,70]),/<polygon class="educade-radar-area"/);
});
