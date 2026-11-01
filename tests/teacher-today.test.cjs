const {test}=require('node:test');
const assert=require('node:assert/strict');

test('teacher next class skips ended, cancelled, undated and ambiguous lessons and keeps a current lesson',async()=>{
  const {nextDashboardLesson}=await import('../dist/teacher-today-model.mjs');
  const now=Date.parse('2026-11-01T13:00:00Z');
  const course={timeZone:'Asia/Bangkok',startTime:'20:00',lessonMinutes:60,lessons:[
    {date:'2026-10-31',title:'Ended'},
    {date:'2026-11-01',title:'Cancelled',status:'cancelled'},
    {date:'',title:'Undated'},
    {date:'2026-11-03',title:'Later'},
    {date:'2026-11-01',startTime:'19:30',title:'Current'},
    {date:'2026-11-02',title:'Tomorrow'},
  ]};
  assert.equal(nextDashboardLesson(course,now).title,'Current');
  assert.equal(nextDashboardLesson(course,now+3600000).title,'Tomorrow');
  assert.equal(nextDashboardLesson(null,now),null);
  assert.equal(nextDashboardLesson({...course,lessons:course.lessons.slice(0,3)},now),null);
  const london={timeZone:'Europe/London',startTime:'01:30',lessonMinutes:60,lessons:[{date:'2026-10-25',title:'Ambiguous clock change'}]};
  assert.equal(nextDashboardLesson(london,Date.parse('2026-10-24T00:00:00Z')),null);
});

test('dashboard dates follow Bangkok at day and year boundaries',async()=>{
  const {dashboardTime}=await import('../dist/teacher-today-model.mjs');
  const now=Date.parse('2026-12-31T16:00:00Z');
  const lesson={startsAt:Date.parse('2026-12-31T17:30:00Z'),endsAt:Date.parse('2026-12-31T18:30:00Z')};
  assert.equal(dashboardTime(lesson,now),'Tomorrow, 00:30');
  assert.equal(dashboardTime(lesson,lesson.startsAt+60000),'In progress · Today, 00:30');
  assert.match(dashboardTime({...lesson,startsAt:Date.parse('2027-02-05T10:00:00Z')},now),/2027/);
});
