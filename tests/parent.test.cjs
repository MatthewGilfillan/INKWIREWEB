const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({localStorage:{getItem:()=>null},Intl,Date});
vm.runInContext(fs.readFileSync('dist/parent.js','utf8'),context);
const plain = value => JSON.parse(JSON.stringify(value));

test('family projection contains only this learner and valid program lessons',()=>{
  const data={'Alex Lee|1':{homework:'Complete',private:'PRIVATE NOTE'},'Jamie Chen|1':{success:'OTHER LEARNER'},'Alex Lee|25':{success:'OUTSIDE PROGRAM'},'Alex Lee|1|other':{success:'BAD KEY'},'Alex Lee|0':{success:'BAD LESSON'},'Alex Lee|2':null};
  assert.deepEqual(plain(context.familyRecords(data)),[{lesson:1,homework:'Complete'}]);
});
test('a teacher-only note is not counted or exposed as a family review',()=>{
  assert.deepEqual(plain(context.familyRecords({'Alex Lee|3':{private:'PRIVATE NOTE'}})),[]);
});
test('records are chronological newest first and preserve observed fields',()=>{
  const result=context.familyRecords({'Alex Lee|1':{attitude:'Engaged'},'Alex Lee|12':{focus:'Sustained'},'Alex Lee|3':{homework:'Partial'}});
  assert.deepEqual(plain(result.map(r=>r.lesson)),[12,3,1]);
  assert.equal(result[2].attitude,'Engaged');
});
test('unknown attendance and unassigned homework are excluded from denominators',()=>{
  assert.deepEqual(plain(context.familyMetrics([{homework:'Complete',attendance:'Present'},{homework:'Partial',attendance:'Absent'},{homework:'Not assigned',attendance:'Rescheduled'},{homework:'Not submitted'},{}])),{reviewed:5,assigned:3,complete:1,attended:1,attendanceRecorded:2});
});
test('empty metrics do not pretend missing observations are poor performance',()=>{
  assert.deepEqual(plain(context.familyMetrics([])),{reviewed:0,assigned:0,complete:0,attended:0,attendanceRecorded:0});
});
test('lesson one preparation never leaks into other lesson readiness',()=>{
  const data={read:true,quizzes:{'Alex Lee|1':{score:0},'Jamie Chen|2':{score:4}}};
  assert.equal(context.familyPreparation('saved',1,data).reading,true);
  assert.equal(context.familyPreparation('saved',1,data).quiz.score,0);
  assert.equal(context.familyPreparation('saved',2,data).reading,null);
  assert.equal(context.familyPreparation('saved',2,data).quiz,null);
});
test('sample mode and saved mode remain separate',()=>{
  assert.equal(context.familyPreparation('sample',5,{}).reading,true);
  assert.equal(context.familyPreparation('saved',5,{}).reading,null);
  assert.notEqual(context.familyReadKey({lesson:1,success:'Same'},'saved'),context.familyReadKey({lesson:1,success:'Same'},'sample'));
});
test('changed family feedback becomes unread, private edits do not affect the read key',()=>{
  const base={lesson:1,success:'First note',private:'Secret'};
  assert.notEqual(context.familyReadKey(base,'saved'),context.familyReadKey({...base,success:'Revised note'},'saved'));
  assert.equal(context.familyReadKey(base,'saved'),context.familyReadKey({...base,private:'Changed secret'},'saved'));
  assert.ok(!context.familyReadKey(base,'saved').includes('Secret'));
});
test('sample dates stay consistent across week boundaries and time zones',()=>{
  assert.equal(context.familySampleDate(1).toISOString(),'2026-10-30T10:00:00.000Z');
  assert.equal(context.familySampleDate(2).toISOString(),'2026-11-01T10:00:00.000Z');
  assert.equal(context.familySampleDate(3).toISOString(),'2026-11-06T10:00:00.000Z');
  assert.equal(context.familyTime(1),'6:00 PM');
  vm.runInContext("parentTimezone='Asia/Bangkok'",context);
  assert.equal(context.familyTime(1),'5:00 PM');
});
test('student reading updates flow into the correct parent lesson and override legacy values',()=>{
 const data={read:true,preparation:{'Alex Lee|1':{reading:false},'Alex Lee|7':{reading:true},'Jamie Chen|8':{reading:true}}};
 assert.equal(context.familyPreparation('saved',1,data).reading,false);
 assert.equal(context.familyPreparation('saved',7,data).reading,true);
 assert.equal(context.familyPreparation('saved',8,data).reading,null);
});
test('reviewed recaps are projected without private teacher notes',()=>{
 const r=context.familyRecords({'Alex Lee|2':{summary:'We explored responsibility.',private:'Do not share.'}});
 assert.equal(r[0].summary,'We explored responsibility.');
 assert.equal(r[0].private,undefined);
});
test('homework timing is projected only when explicitly recorded',()=>{
 const records=context.familyRecords({'Alex Lee|1':{homework:'Complete'},'Alex Lee|2':{homework:'Partial',homeworkTiming:'Late',private:'Do not share'}});
 assert.equal(records[0].homeworkTiming,'Late');
 assert.equal(records[1].homeworkTiming,undefined);
 assert.equal(records[0].private,undefined);
});
