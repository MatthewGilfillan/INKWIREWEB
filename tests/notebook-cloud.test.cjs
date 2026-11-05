const test=require('node:test'),assert=require('node:assert/strict');
test('cloud is green only after work is saved and connected',async()=>{
 const {syncPresentation}=await import('../src/notebook-cloud.mjs');
 assert.deepEqual(syncPresentation(),{state:'saved',message:'All changes saved.'});
 assert.match(syncPresentation({readOnly:true}).message,/Read-only/);
 for(const state of [{dirty:true},{busy:true},{loading:true},{online:false},{localOnly:true}])assert.equal(syncPresentation(state).state,'pending');
});
test('save errors remain red even when the connection succeeds',async()=>{
 const {syncPresentation}=await import('../src/notebook-cloud.mjs');
 assert.equal(syncPresentation({error:'Save rejected',dirty:true,busy:true}).state,'error');
 assert.match(syncPresentation({error:'Save rejected'}).message,/Save rejected/);
 assert.equal(syncPresentation({localFailure:true,online:false}).state,'error');
});
test('offline and practice states never claim cloud persistence',async()=>{
 const {syncPresentation}=await import('../src/notebook-cloud.mjs');
 assert.match(syncPresentation({online:false,dirty:true,error:'Network unavailable'}).message,/waiting to sync/);
 assert.match(syncPresentation({localOnly:true}).message,/not saved to the cloud/);
});
