const {test}=require('node:test');const assert=require('node:assert/strict');
test('unit timeline measures scheduled lessons, excluding cancelled and undated lessons from the elapsed count',async()=>{
 const {unitPosition}=await import('../dist/unit-position.mjs');
 const course={lessons:[{endsAt:100},{endsAt:150,status:'cancelled'},{endsAt:null},{endsAt:300}]};
 assert.deepEqual(unitPosition(course,200),{held:1,total:3,percent:33,current:3,undated:1});
 assert.equal(unitPosition({lessons:[{endsAt:null,report:{}}]},200).held,0);
 assert.equal(unitPosition(null).total,0);assert.equal(unitPosition({lessons:[{status:'cancelled'}]}).current,-1);
});
test('teacher raw schedules and family overview timestamps give the same unit position',async()=>{
 const {unitPosition}=await import('../dist/unit-position.mjs');
 const now=Date.parse('2026-11-03T10:00:00Z');
 const raw={timeZone:'Asia/Bangkok',startTime:'16:00',lessonMinutes:60,lessons:[{date:'2026-10-27'},{date:'2026-11-04'},{date:''}]};
 assert.equal(unitPosition(raw,now).held,1);assert.equal(unitPosition(raw,now).current,1);
 assert.deepEqual(unitPosition(raw,now),unitPosition({lessons:[{endsAt:Date.parse('2026-10-27T10:00:00Z')},{endsAt:Date.parse('2026-11-04T10:00:00Z')},{endsAt:null}]},now));
});
test('workspace preference accepts only supported layouts',async()=>{
 const {workspaceChoice}=await import('../dist/unit-position.mjs');
 for(const value of [null,'',undefined,'<script>','compact'])assert.equal(workspaceChoice(value),'essentials');
 assert.equal(workspaceChoice('extended'),'extended');
});
