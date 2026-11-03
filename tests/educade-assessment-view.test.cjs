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
test('learner evidence expands only that row while names retain profile navigation',async()=>{
 const {classRowsHTML}=await import('../dist/educade-assessment-view.js'),{default:catalogue}=await import('../dist/assessment-catalogue.mjs');
 const reading=catalogue.groups.find(g=>g.domain==='reading').skills[0],writing=catalogue.groups.find(g=>g.domain==='writing').skills[0];
 const data={students:[{id:'alex',name:'Alex'},{id:'maya',name:'Maya'}],lessons:[],catalogue,scope:'overall',mode:'bars',search:'',sort:'name',portrait:'initials',records:[{learnerId:'alex',skillId:reading.id,correct:true,supported:false,response:'A <script>response</script>',week:2,day:3},{learnerId:'alex',skillId:reading.id,correct:false,supported:true,hint:true,response:'Earlier response',week:1,day:1},{learnerId:'maya',skillId:writing.id,correct:true,response:'Only Maya'}]};
 const collapsed=classRowsHTML(data);
 assert.match(collapsed,/<button[^>]*data-assessment-learner="alex"[^>]*>Alex<\/button>/);
 assert.match(collapsed,/<button[^>]*data-expand-learner="alex"[^>]*aria-expanded="false"/);
 assert.ok(!collapsed.includes('Earlier response'));assert.ok(!collapsed.includes('Only Maya'));
 const expanded=classRowsHTML({...data,expandedLearner:'alex'});
 assert.match(expanded,/data-expand-learner="alex"[^>]*aria-expanded="true"/);
 assert.match(expanded,/data-expand-learner="maya"[^>]*aria-expanded="false"/);
 assert.match(expanded,/1\/2<\/strong> correct · 1 hints/);assert.match(expanded,/1 independent · 1 supported/);
 assert.match(expanded,/Skills encountered/);assert.match(expanded,/Explore reading skills/);
 assert.match(expanded,/A &lt;script&gt;response&lt;\/script&gt;/);assert.ok(!expanded.includes('Only Maya'));
 assert.ok(expanded.indexOf('Week 2 · Day 3')<expanded.indexOf('Week 1 · Day 1'));
 assert.match(expanded,/No evidence yet for this area/);assert.ok(!expanded.includes('style='));
 // Column expansion remains independent: Maya's writing evidence is visible
 // even with Alex's row collapsed; reading responses are still hidden.
 const column=classRowsHTML({...data,expandedAxis:'writing'});
 assert.match(column,/Only Maya/);assert.ok(!column.includes('Earlier response'));
 assert.match(column,/data-expand-learner="alex"[^>]*aria-expanded="false"/);
});
test('skill views limit expanded evidence to the selected learning area and retain nested details',async()=>{
 const {classRowsHTML}=await import('../dist/educade-assessment-view.js'),{default:catalogue}=await import('../dist/assessment-catalogue.mjs');
 const skill=catalogue.profileAxes.vocabulary[0],other=catalogue.groups.find(g=>g.domain==='writing').skills[0];
 const detailKey='class-evidence-a-'+encodeURIComponent(skill.id)+'-'+encodeURIComponent(skill.id);
 const html=classRowsHTML({students:[{id:'a',name:'A'}],lessons:[],catalogue,scope:'vocabulary',mode:'heatmap',search:'',sort:'name',portrait:'initials',expandedLearner:'a',expandedDetails:new Set([detailKey]),records:[{learnerId:'a',skillId:skill.id,correct:false,response:'Vocabulary attempt'},{learnerId:'a',skillId:other.id,correct:true,response:'Unrelated writing attempt'}]});
 assert.match(html,/Vocabulary attempt/);assert.ok(!html.includes('Unrelated writing attempt'));
 assert.ok(html.includes('data-class-detail="'+detailKey+'" open'));assert.match(html,/Try again · Independent · No hint used/);
});
