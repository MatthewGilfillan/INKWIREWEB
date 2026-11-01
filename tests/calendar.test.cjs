const {test}=require('node:test');
const assert=require('node:assert/strict');

test('lesson times convert from their course zone, including fractional offsets and date boundaries',async()=>{
  const {lessonInstant,zonedClock}=await import('../dist/calendar-model.mjs');
  const instant=lessonInstant('2026-11-01','00:30','Asia/Shanghai');
  assert.equal(new Date(instant).toISOString(),'2026-10-31T16:30:00.000Z');
  assert.deepEqual(zonedClock(instant,'Asia/Bangkok'),{date:'2026-10-31',time:'23:30'});
  assert.equal(new Date(lessonInstant('2027-01-01','11:00','Asia/Kathmandu')).toISOString(),'2027-01-01T05:15:00.000Z');
  assert.deepEqual(zonedClock(lessonInstant('2027-01-01','00:00','UTC'),'UTC'),{date:'2027-01-01',time:'00:00'});
});
test('clock-change gaps and duplicate times require review rather than silently moving a lesson',async()=>{
  const {lessonInstant}=await import('../dist/calendar-model.mjs');
  assert.throws(()=>lessonInstant('2026-03-08','02:30','America/New_York'),/does not exist/);
  assert.throws(()=>lessonInstant('2026-11-01','01:30','America/New_York'),/occurs twice/);
  assert.equal(new Date(lessonInstant('2026-03-08','03:30','America/New_York')).toISOString(),'2026-03-08T07:30:00.000Z');
});
test('calendar projection preserves durations, unscheduled lessons and source-zone review issues',async()=>{
  const {projectCalendar,calendarGrid,shiftMonth}=await import('../dist/calendar-model.mjs');
  const calendar=projectCalendar([{id:'class',name:'A class',course:{title:'A course',timeZone:'Asia/Shanghai',startTime:'00:30',lessonMinutes:90,lessons:[{date:'2026-11-01',title:'Scheduled'},{date:'',title:'No date'}]}},{id:'empty',name:'Empty class',course:null}], '2026-10-01','2026-11-01','Asia/Bangkok');
  assert.equal(calendar.events.length,1);assert.equal(calendar.events[0].date,'2026-10-31');
  assert.deepEqual(calendar.events[0].dates,['2026-10-31','2026-11-01']);
  assert.equal(Date.parse(calendar.events[0].endsAt)-Date.parse(calendar.events[0].startsAt),90*60000);
  assert.deepEqual(calendar.unscheduled.map(c=>c.count),[1,null]);
  assert.equal(calendarGrid('2026-11')[0],'2026-11-01');assert.equal(calendarGrid('2026-11').length,35);
  assert.equal(shiftMonth('2026-12',1),'2027-01');
  const continuation=projectCalendar([{id:'night',name:'Overnight',course:{title:'A course',timeZone:'UTC',startTime:'23:30',lessonMinutes:90,lessons:[{date:'2026-10-31',title:'Overnight lesson'}]}}],'2026-11-01','2026-12-01','UTC');
  assert.equal(continuation.events.length,1,'a lesson continuing into the month is included');
  const issue=projectCalendar([{id:'class',name:'A class',course:{title:'A course',timeZone:'America/New_York',startTime:'01:30',lessonMinutes:50,lessons:[{date:'2026-11-01',title:'Clock change'}]}}],'2026-11-01','2026-12-01','UTC');
  assert.equal(issue.events.length,0);assert.match(issue.issues[0].message,/occurs twice/);
});
