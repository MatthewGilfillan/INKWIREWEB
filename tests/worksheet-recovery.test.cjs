const test=require('node:test'),assert=require('node:assert/strict');
const mark={id:'mark-1',ownerId:'teacher',layer:'teacher',version:2,kind:'text',text:'Browser draft',deleted:false};
test('browser worksheet drafts are scoped to account, role, page and learner',async()=>{
 const {worksheetDraftKey,planWorksheetRecovery}=await import('../src/worksheet-recovery.mjs');const meta={userId:'teacher',role:'teacher',id:'worksheet',learnerId:'student'};
 for(const changed of [{userId:'other'},{role:'student'},{id:'other'},{learnerId:'other'}])assert.notEqual(worksheetDraftKey(meta),worksheetDraftKey({...meta,...changed}));
 assert.equal(planWorksheetRecovery([{mark,version:2}],new Map(),'other','teacher').restore.length,0);
 assert.equal(planWorksheetRecovery([{mark,version:2}],new Map(),'teacher','student').restore.length,0);
});
test('recovery retains the expected server version and detects concurrent changes',async()=>{
 const {planWorksheetRecovery}=await import('../src/worksheet-recovery.mjs');const records=[{mark,version:2}];
 const ordinary=planWorksheetRecovery(records,new Map([['mark-1',{...mark,text:'Previous',version:2}]]),'teacher','teacher');assert.equal(ordinary.restore[0].version,2);assert.equal(ordinary.conflicts.length,0);
 const concurrent=planWorksheetRecovery(records,new Map([['mark-1',{...mark,text:'Other device',version:3}]]),'teacher','teacher');assert.deepEqual(concurrent.conflicts,['mark-1']);assert.equal(concurrent.restore[0].version,2);
});
test('already acknowledged writes and never-uploaded deletions do not replay',async()=>{
 const {planWorksheetRecovery}=await import('../src/worksheet-recovery.mjs');
 assert.equal(planWorksheetRecovery([{mark,version:2}],new Map([['mark-1',{...mark,version:3}]]),'teacher','teacher').restore.length,0);
 assert.equal(planWorksheetRecovery([{mark:{...mark,deleted:true},version:0}],new Map(),'teacher','teacher').restore.length,0);
});
