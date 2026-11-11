const {test}=require('node:test'),assert=require('node:assert/strict');
test('the full grade-specific ELA list includes unassessed standards, substandards and secondary literacy strands',async()=>{
 const {gradeStandards}=await import('../dist/standards-progress.mjs'),{default:data}=await import('../dist/ccss-ela.mjs');
 assert.equal(new Set(data.standards.map(s=>s.code)).size,data.standards.length);assert.equal(data.standards.length,1013);assert.match(data.copyright,/National Governors Association/);
 const five=gradeStandards('5');for(const strand of ['RL','RI','W'])for(let n=1;n<=10;n++)assert.ok(five.some(s=>s.code===`${strand}.5.${n}`));for(const strand of ['RF','SL','L'])assert.ok(five.some(s=>s.strand===strand));assert.ok(five.some(s=>s.code==='L.5.4.b'));assert.ok(five.every(s=>s.description.length>10&&s.source.startsWith('https://www.thecorestandards.org/')));
 const seven=gradeStandards('7');assert.ok(seven.some(s=>s.code==='RH.6-8.1'));assert.ok(seven.some(s=>s.code==='RST.6-8.1'));assert.ok(seven.some(s=>s.code==='WHST.6-8.1'));assert.ok(!seven.some(s=>s.strand==='RF'||s.grade==='5'));assert.equal(gradeStandards('').length,0);
});
test('exact code normalization preserves substandards and does not infer a level from practice',async()=>{
 const {standardCode,standardEvidence}=await import('../dist/standards-progress.mjs');assert.equal(standardCode('CCSS.ELA-LITERACY.L.5.4.b'),'L.5.4.B');assert.equal(standardCode('CCSS.L.5.4b'),'L.5.4.B');
 const context={activities:[],records:[{learnerId:'a',skillId:'vocab',correct:true}],mappings:{vocab:{code:'CCSS.ELA-LITERACY.L.5.4.b'}}};assert.equal(standardEvidence('L.5.4.b','a',context).level,'review');assert.equal(standardEvidence('L.5.4','a',context).level,'none');assert.equal(standardEvidence('L.5.4.b','b',context).level,'none');
});
test('published teacher judgments drive attainment; drafts and unrelated learners never replace them',async()=>{
 const {standardEvidence,standardCounts}=await import('../dist/standards-progress.mjs');const entry=(at,level)=>({at,state:'observed',activity:{title:'Reading'},judgments:[{code:'RL.5.1',level}]});
 const context={activities:[{id:'one',title:'First',entries:[{learnerId:'a',published:entry(1,'approaching'),draft:entry(20,'exceeding')}]},{id:'two',title:'Recheck',entries:[{learnerId:'a',published:entry(2,'meeting')},{learnerId:'b',published:entry(30,'beginning')}]}]};
 const result=standardEvidence('CCSS.RL.5.1','a',context);assert.equal(result.level,'meeting');assert.equal(result.drafts[0].judgment.level,'exceeding');assert.equal(result.teacher.length,2);assert.equal(standardEvidence('RI.5.1','a',context).level,'none');assert.deepEqual(standardCounts({code:'RL.5.1'},[{id:'a'},{id:'b'},{id:'c'}],context),{meeting:1,beginning:1,none:1});
});
test('connected evidence shapes enclose the score neck and wide panel with bounded geometry',async()=>{
 const {connectedEvidencePath}=await import('../dist/evidence-expansion.js');const path=connectedEvidencePath(1000,340,220,440,-120);assert.match(path,/V -106/);assert.match(path,/H 426/);assert.match(path,/1000 340/);assert.match(path,/ Z$/);assert.doesNotMatch(path,/NaN|Infinity/);assert.doesNotMatch(connectedEvidencePath(200,200,-20,700,-10),/NaN|Infinity/);
});
