const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const owner='11111111-1111-4111-8111-111111111111',empty='22222222-2222-4222-8222-222222222222',invited='33333333-3333-4333-8333-333333333333';
test('teacher calendar opens and reschedules lessons; owner deletion can be cancelled, trashed and restored',async()=>{
  const {defaults,generateLessons}=await import('../../dist/course-model.mjs');
  const {projectCalendar}=await import('../../dist/calendar-model.mjs');
  const course={...defaults('Winter literature'),weeks:2,startDate:'2027-01-06',startTime:'18:00'};course.lessons=generateLessons(course);
  course.lessons[0].title='Introducing the play';course.lessons[1].title='Developing a response';
  const other={...defaults('A shared course'),weeks:1,startDate:'2027-01-20',startTime:'16:00',lessonMinutes:50};other.lessons=generateLessons(other);other.lessons[0].title='A discussion lesson';
  const classes=[{id:owner,name:'Winter literature',subject:'Reading & essays',membership:'owner',course,revision:1},{id:empty,name:'Summer class',membership:'owner',course:null,revision:0},{id:invited,name:'Shared class',membership:'teacher',course:other,revision:1}];
  let deletions=0;
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROME_CHANNEL?{channel:process.env.PLAYWRIGHT_CHROME_CHANNEL}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
    const url=new URL(route.request().url()),path=url.pathname;
    if(path==='/api/classes')return route.fulfill({json:{classes:classes.filter(c=>!c.deletedAt).map(c=>({...c,overviewRevision:c.revision,courseWeeks:c.course?.weeks,courseFrequency:c.course?.lessonsPerWeek,courseMinutes:c.course?.lessonMinutes}))}});
    if(path==='/api/classes/trash')return route.fulfill({json:{classes:classes.filter(c=>c.deletedAt&&c.membership==='owner')}});
    if(path==='/api/classes/calendar')return route.fulfill({json:projectCalendar(classes.filter(c=>!c.deletedAt),url.searchParams.get('from'),url.searchParams.get('to'),url.searchParams.get('timeZone'))});
    if(path.endsWith('/roster'))return route.fulfill({json:{students:[]}});
    const match=path.match(/^\/api\/classes\/([^/]+)\/(overview|delete|restore)$/);
    if(match){
      const c=classes.find(c=>c.id===match[1]);
      if(match[2]==='overview'){
        if(route.request().method()==='POST'){c.course=route.request().postDataJSON().course;c.revision++;}
        return route.fulfill({json:{course:c.course,revision:c.revision}});
      }
      if(match[2]==='delete'){deletions++;c.deletedAt=Date.now();}else c.deletedAt=null;
      return route.fulfill({json:{classroom:{id:c.id,deletedAt:c.deletedAt}}});
    }
    return route.fulfill({status:404,json:{}});
  });
  try{
    await page.goto('http://127.0.0.1:8788/teacher.html');
    await page.getByRole('button',{name:'Calendar',exact:true}).click();
    await page.locator('[data-cal=month]').fill('2027-01');
    await page.waitForFunction(()=>document.querySelector('[data-cal=status]').textContent.includes('3 scheduled lessons'));
    assert.match(await page.locator('[data-cal=unscheduled]').innerText(),/Summer class/);
    assert.match(await page.locator(`[data-event="${owner}:0"]`).innerText(),/17:00–19:00/);
    await page.locator('[data-cal=class]').selectOption(owner);
    assert.equal(await page.locator('.calendar-event').count(),2);
    await page.locator('[data-cal=zone]').selectOption('UTC');
    await page.waitForFunction(()=>document.querySelector('[data-cal=status]').textContent.includes('Times shown in UTC'));
    assert.match(await page.locator(`[data-event="${owner}:0"]`).innerText(),/10:00–12:00/);
    await page.locator(`[data-event="${owner}:1"]`).click();
    await page.waitForFunction(()=>document.querySelector('#lesson-1-title')?.value==='Developing a response');
    assert.equal(await page.locator('[data-plan-lesson="1"]').getAttribute('open'),'');
    await page.locator('#lesson-1-date').fill('2027-01-14');
    await page.getByRole('button',{name:'Save course overview',exact:true}).click();
    await page.getByText('Course overview saved.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Close course overview'}).click();
    await page.getByRole('region',{name:'Thursday, 14 January 2027',exact:true}).locator(`[data-event="${owner}:1"]`).waitFor();
    await page.locator('[data-cal=class]').selectOption('');
    await page.locator('[data-cal=zone]').selectOption('Asia/Bangkok');
    await page.waitForFunction(()=>document.querySelector('[data-cal=status]').textContent.includes('Times shown in Asia/Bangkok'));
    await page.screenshot({path:'/tmp/inkwire-teacher-calendar.png',fullPage:true});
    await page.locator('[data-cal=mode]').selectOption('agenda');
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:'/tmp/inkwire-teacher-calendar-mobile.png',fullPage:true});
    await page.getByRole('button',{name:'Classes',exact:true}).click();
    const card=page.locator(`[data-class-id="${owner}"]`);await card.locator(':scope>summary').click();
    await card.getByText('Class settings',{exact:true}).click();
    await card.getByRole('button',{name:'Delete class',exact:true}).click();
    await page.locator('#delete-class').getByRole('button',{name:'Close',exact:true}).click();
    assert.equal(deletions,0);
    await card.getByRole('button',{name:'Delete class',exact:true}).click();
    await page.getByRole('button',{name:'Move to Trash',exact:true}).click();
    await card.waitFor({state:'detached'});assert.equal(deletions,1);
    assert.equal(await page.locator(`[data-class-id="${invited}"] [data-delete-class]`).count(),0);
    await page.getByRole('button',{name:'Calendar',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[data-cal=status]').textContent.includes('1 scheduled lesson'));
    assert.equal(await page.locator(`[data-event^="${owner}:"]`).count(),0);
    await page.getByRole('button',{name:'Trash',exact:true}).click();
    await page.getByRole('button',{name:'Restore class',exact:true}).click();
    await page.getByText('Trash is empty.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Calendar',exact:true}).click();
    await page.waitForFunction(()=>document.querySelector('[data-cal=status]').textContent.includes('3 scheduled lessons'));
    await page.locator(`[data-event="${owner}:1"]`).waitFor();
    assert.equal(course.lessons[1].title,classes[0].course.lessons[1].title);
    assert.equal(classes[0].course.lessons[1].date,'2027-01-14');
    await page.locator('[data-cal=month]').fill('2027-02');
    await page.waitForFunction(()=>document.querySelector('[data-cal=status]').textContent.includes('0 scheduled lessons'));
    assert.match(await page.locator('.calendar-empty').first().innerText(),/No lessons/);
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
