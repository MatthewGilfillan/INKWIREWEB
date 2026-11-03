const {test}=require('node:test'),assert=require('node:assert/strict');
test('scrollable calendar ranges stay inside the API limit and cross year boundaries',async()=>{
 const {calendarRequestRange,followingMonths}=await import('../dist/calendar-view.js');
 assert.deepEqual(followingMonths('2026-12'),['2026-12','2027-01']);assert.deepEqual(followingMonths('2100-12'),['2100-12']);
 for(const month of ['2026-02','2026-08','2026-11','2026-12']){const {from,to}=calendarRequestRange(month);assert.ok(Date.parse(to)>Date.parse(from));assert.ok((Date.parse(to)-Date.parse(from))/86400000<=42);}
});
test('stacked months avoid duplicate outside-day events and display Beijing meetings in local Thai time',async()=>{
 const {calendarMonthHTML}=await import('../dist/calendar-view.js'),{projectCalendar}=await import('../dist/calendar-model.mjs');
 const course={timeZone:'Asia/Shanghai',startTime:'18:00',lessonMinutes:60,lessons:[{date:'2026-11-30',title:'A <lesson>'},{date:'2026-12-01',title:'December lesson',status:'cancelled'}]};
 const {events}=projectCalendar([{id:'a',name:'Beijing class',course}], '2026-11-01','2027-01-01','Asia/Bangkok');
 const options={events,mode:'month',zone:'Asia/Bangkok',now:Date.parse('2026-11-03T12:00:00Z')};
 const november=calendarMonthHTML({...options,month:'2026-11'}),december=calendarMonthHTML({...options,month:'2026-12'});
 assert.match(november,/17:00–18:00/);assert.match(november,/A &lt;lesson&gt;/);assert.ok(!november.includes('December lesson'));assert.ok(!december.includes('A &lt;lesson&gt;'));assert.match(december,/Cancelled/);
 const filtered=calendarMonthHTML({...options,month:'2026-11',classId:'different',mode:'agenda'});assert.match(filtered,/No lessons scheduled/);assert.ok(!filtered.includes('data-event='));
});

test('display time zones lead with a readable GMT offset and city, including half-hour and daylight offsets',async()=>{
 const {displayTimeZoneLabel}=await import('../dist/display-time-zone.mjs');
 const winter=Date.parse('2026-11-03T12:00:00Z'),summer=Date.parse('2026-07-03T12:00:00Z');
 assert.equal(displayTimeZoneLabel('Asia/Bangkok',winter),'GMT+7 · Bangkok');
 assert.equal(displayTimeZoneLabel('Asia/Shanghai',winter),'GMT+8 · Beijing');
 assert.equal(displayTimeZoneLabel('Asia/Kolkata',winter),'GMT+5:30 · Kolkata');
 assert.equal(displayTimeZoneLabel('Europe/London',winter),'GMT+0 · London');
 assert.equal(displayTimeZoneLabel('Europe/London',summer),'GMT+1 · London');
});
