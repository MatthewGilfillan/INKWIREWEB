const {test}=require('node:test');const assert=require('node:assert/strict');const {readFileSync}=require('node:fs');const {chromium}=require('playwright');
const cid='11111111-1111-4111-8111-111111111111';
test('teacher chooses Friday/Saturday times, skips extra dates, cancels and reschedules, and exports monthly hours',async()=>{
 const {defaults,generateLessons,validateCourse}=await import('../../dist/course-model.mjs');let course={...defaults('Flexible literature'),weeks:8,lessonCount:8,startDate:'2027-01-01'};course.lessons=generateLessons(course).map((l,i)=>({...l,id:'lesson-'+i}));let revision=1,saves=0;const originals=course.lessons.map(l=>l.title);
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROME_CHANNEL?{channel:process.env.PLAYWRIGHT_CHROME_CHANNEL}:{})}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);
 await page.route('**/api/**',async route=>{const p=new URL(route.request().url()).pathname;
  if(p==='/api/classes')return route.fulfill({json:{classes:[{id:cid,name:'Flexible literature',membership:'owner',overviewRevision:revision}]}});
  if(p.endsWith('/roster'))return route.fulfill({json:{students:[]}});
  if(p.endsWith('/overview')){if(route.request().method()==='POST'){course=validateCourse(route.request().postDataJSON().course);revision++;saves++;}return route.fulfill({json:{course,revision,serverNow:Date.now()}});}
  if(p.endsWith('/planning-assistant'))return route.fulfill({json:{available:false}});
  return route.fulfill({status:404,json:{}});
 });
 try{
  await page.goto('http://127.0.0.1:8788/teacher.html');await page.getByRole('tab',{name:'Course overview',exact:true}).click();await page.locator('#course-form').waitFor({state:'visible'});
  await page.locator('#course-end').fill('2027-01-30');await page.getByText('Weekly lesson days & times',{exact:true}).click();
  await page.getByRole('button',{name:'+ Add weekly lesson time',exact:true}).click();const friday=page.locator('[data-weekly-slot="0"]');await friday.locator('[data-slot-field=day]').selectOption('5');await friday.locator('[data-slot-field=startTime]').fill('18:00');await friday.locator('[data-slot-field=lessonMinutes]').fill('90');
  await page.getByRole('button',{name:'+ Add weekly lesson time',exact:true}).click();const saturday=page.locator('[data-weekly-slot="1"]');await saturday.locator('[data-slot-field=day]').selectOption('6');await saturday.locator('[data-slot-field=startTime]').fill('10:00');await saturday.locator('[data-slot-field=lessonMinutes]').fill('60');
  await page.getByRole('button',{name:'Preview lesson dates',exact:true}).click();assert.equal(await page.locator('[data-schedule-skip]').count(),10);assert.equal(await page.getByRole('button',{name:'Apply selected dates',exact:true}).isEnabled(),false);
  await page.locator('[data-schedule-skip="2027-01-08|18:00"]').check();await page.locator('[data-schedule-skip="2027-01-09|10:00"]').check();await page.getByRole('button',{name:'Apply selected dates',exact:true}).click();
  assert.equal(await page.locator('#lesson-2-date').inputValue(),'2027-01-15');assert.equal(await page.locator('#lesson-1-time').inputValue(),'10:00');assert.equal(await page.locator('#lesson-1-minutes').inputValue(),'60');
  await page.locator('#course-billing').selectOption('packs');assert.match(await page.locator('[data-plan-lesson="7"] [data-lesson-billing]').textContent(),/lesson 8 of 8.*renew/);
  await page.locator('[data-cancel-lesson="0"]').click();assert.match(await page.locator('[data-plan-lesson="0"] [data-lesson-billing]').textContent(),/no pack credit used/);assert.match(await page.locator('[data-plan-lesson="7"] [data-lesson-billing]').textContent(),/lesson 7 of 8/);
  await page.locator('[data-plan-lesson="0"] [data-lesson-field=chargeCancelled]').check();assert.match(await page.locator('[data-plan-lesson="7"] [data-lesson-billing]').textContent(),/lesson 8 of 8/);
  await page.locator('[data-plan-lesson="1"]>summary').click();await page.locator('[data-reschedule-lesson="1"]').click();await page.locator('#lesson-1-date').fill('2027-02-06');await page.locator('#lesson-1-time').fill('11:30');
  await page.getByRole('button',{name:'Save course overview',exact:true}).click();await page.getByText('Course overview saved.',{exact:true}).waitFor();assert.equal(saves,1);assert.deepEqual(course.lessons.map(l=>l.title),originals);assert.equal(course.lessons[0].status,'cancelled');assert.equal(course.lessons[0].chargeCancelled,true);assert.equal(course.lessons[1].date,'2027-02-06');assert.equal(course.lessons[1].startTime,'11:30');assert.equal(course.endDate,'2027-01-30');assert.equal(course.lessons.length,8);
  await page.locator('#course-billing').selectOption('monthly');await page.locator('#course-bill-to').fill('Rivendell');assert.match(await page.locator('[data-billing-summary]').innerText(),/9 scheduled hours/);assert.match(await page.locator('[data-billing-summary]').innerText(),/1 scheduled hours/);
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download billing schedule (CSV)',exact:true}).click();const file=await download;const csv=readFileSync(await file.path(),'utf8');assert.match(csv,/Rivendell/);assert.match(csv,/2027-02-06/);assert.equal(csv.split('\r\n').length,9);
  await page.locator('.schedule-editor').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/inkwire-flexible-schedule.png'});
  await page.setViewportSize({width:390,height:844});await page.locator('.schedule-editor').scrollIntoViewIfNeeded();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/inkwire-flexible-schedule-mobile.png'});
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
