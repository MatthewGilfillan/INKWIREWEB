const {test}=require('node:test');const assert=require('node:assert/strict');
async function setup(count=8){const {defaults,generateLessons,validateCourse}=await import('../dist/course-model.mjs');const c={...defaults('Friday & Saturday'),weeks:Math.ceil(count/2),lessonCount:count,lessonsPerWeek:2,startDate:'2027-01-01',endDate:'2027-01-30',weeklySlots:[{day:5,startTime:'18:00',lessonMinutes:90},{day:6,startTime:'10:00',lessonMinutes:60}],billingMode:'packs',billTo:'Rivendell'};c.lessons=generateLessons(c).map((l,i)=>({...l,id:'lesson-'+i}));return {c,validateCourse,...await import('../dist/schedule-model.mjs')};}
test('Friday and Saturday times, inclusive end date and crossed-out dates preserve the lesson sequence',async()=>{
 const {c,scheduleCandidates,applySchedule,validateCourse}=await setup();const dates=scheduleCandidates(c);assert.equal(dates.length,10);assert.equal(dates[0].date,'2027-01-01');assert.equal(dates.at(-1).date,'2027-01-30');
 assert.throws(()=>applySchedule(c),/Select exactly 8/);
 const saved=validateCourse(applySchedule(c,['2027-01-08|18:00','2027-01-09|10:00']));
 assert.deepEqual(saved.lessons.map(l=>l.id),c.lessons.map(l=>l.id));assert.deepEqual(saved.lessons.map(l=>l.title),c.lessons.map(l=>l.title));
 assert.equal(saved.lessons[1].startTime,'10:00');assert.equal(saved.lessons[1].lessonMinutes,60);assert.equal(saved.lessons[2].date,'2027-01-15');assert.equal(saved.lessons.at(-1).date,'2027-01-30');
 assert.equal(scheduleCandidates({...c,endDate:''}).length,8);
 assert.throws(()=>validateCourse({...c,endDate:'2026-12-31'}),/end date/);
 assert.throws(()=>scheduleCandidates({...c,weeklySlots:[c.weeklySlots[0],c.weeklySlots[0]]}),/different day/);
});
test('pack boundaries and monthly hours count chargeable lessons once after cancellation or rescheduling',async()=>{
 const {c,applySchedule,billingSchedule,billingMonths,validateCourse}=await setup(9);const planned=applySchedule(c,['2027-01-09|10:00']);
 let rows=billingSchedule(planned);assert.match(rows.get('lesson-7').label,/lesson 8 of 8.*renew/);assert.equal(rows.get('lesson-8').pack,2);
 planned.lessons[0].status='cancelled';rows=billingSchedule(planned);assert.equal(rows.get('lesson-0').number,null);assert.equal(rows.get('lesson-8').number,8);
 planned.lessons[0].chargeCancelled=true;rows=billingSchedule(planned);assert.equal(rows.get('lesson-8').pack,2);
 const before=billingMonths(planned).reduce((n,m)=>n+m.minutes,0);planned.lessons[1].date='2027-02-01';rows=billingSchedule(planned);assert.equal(rows.get('lesson-1').number,1);assert.equal(rows.get('lesson-1').pack,2);
 assert.equal(billingMonths(planned).reduce((n,m)=>n+m.minutes,0),before);assert.equal(billingMonths(planned).at(-1).minutes,60);
 assert.equal(validateCourse(planned).lessons[0].chargeCancelled,true);
});
test('calendar and feedback unlock use individual lesson times, while cancelled lessons stay visible and locked',async()=>{
 const {c,applySchedule}=await setup();const planned=applySchedule(c,['2027-01-08|18:00','2027-01-09|10:00']);const {projectCalendar}=await import('../dist/calendar-model.mjs');const {lessonEnd}=await import('../dist/lesson-feedback-model.mjs');
 const result=projectCalendar([{id:'c',name:'Course',course:planned}],'2027-01-01','2027-02-01','Asia/Shanghai');
 assert.equal(result.events[0].startsAt,'2027-01-01T10:00:00.000Z');assert.equal(result.events[0].endsAt,'2027-01-01T11:30:00.000Z');assert.equal(result.events[1].startsAt,'2027-01-02T02:00:00.000Z');
 assert.equal(lessonEnd(planned,planned.lessons[1]),Date.parse('2027-01-02T03:00:00Z'));
 planned.lessons[1].status='cancelled';assert.equal(lessonEnd(planned,planned.lessons[1]),null);assert.equal(projectCalendar([{id:'c',name:'Course',course:planned}],'2027-01-01','2027-02-01','UTC').events[1].status,'cancelled');
});
