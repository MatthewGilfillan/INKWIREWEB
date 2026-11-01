const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const cid='11111111-1111-4111-8111-111111111111',empty='22222222-2222-4222-8222-222222222222';

test('course overview defaults to a readable outline; editing, draft preview, save failures and lesson actions preserve data',async()=>{
  const {defaults,generateLessons,validateCourse}=await import('../../dist/course-model.mjs');
  const now=Date.UTC(2026,10,1,9,59,59);
  let course={...defaults('Esperanza Rising · Literature study'),weeks:2,lessonCount:2,lessonMinutes:90,startDate:'2026-11-01',startTime:'16:30',timeZone:'Asia/Shanghai',description:'Explore character, setting, and the choices that shape a story.'};
  course.lessons=generateLessons(course).map((l,i)=>({...l,id:'lesson-'+i}));
  Object.assign(course.lessons[0],{title:'Introduction to Esperanza Rising',section:'About the author · pre-reading',goal:'Connect the author’s background with the setting of the novel.',reading:'Meet the author and read the opening chapter.',activities:'Discuss first impressions of Esperanza.\nExplore key vocabulary together.',homework:'Read chapters 1–4 and collect two quotations about Esperanza.'});
  Object.assign(course.lessons[1],{title:'Chapters 1–4',status:'cancelled'});
  course=validateCourse(course);let revision=1,failSave=false,saves=0,quizOpens=0;
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROME_CHANNEL?{channel:process.env.PLAYWRIGHT_CHROME_CHANNEL}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);await page.clock.install({time:now});
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/classes')return route.fulfill({json:{classes:[{id:cid,name:'Esperanza Rising',membership:'owner',overviewRevision:revision},{id:empty,name:'New literature class',membership:'owner'}]}});
    if(path.endsWith('/roster'))return route.fulfill({json:{students:[]}});
    if(path.startsWith('/api/quiz-assistant/'))return route.fulfill({json:{available:false,lessons:course.lessons.map((l,i)=>({id:l.id,assigned:i===0,hasDraft:false}))}});
    if(path.startsWith('/api/lesson-quizzes/')){quizOpens++;return route.fulfill({json:{teacher:true,locked:true,revision:1,lessonTitle:course.lessons[0].title,quiz:{title:'Opening chapter reading check',questions:[{prompt:'Who is the central character?',options:['Esperanza','Another character'],correctIndex:0,explanation:''}],reflectionPrompt:''}}});}
    if(path.endsWith('/overview')){
      if(path.includes(empty))return route.fulfill({json:{course:null,revision:0,serverNow:now}});
      if(route.request().method()==='POST'){
        if(failSave)return route.fulfill({status:503,json:{message:'Please try saving again.'}});
        course=validateCourse(route.request().postDataJSON().course);revision++;saves++;
      }
      return route.fulfill({json:{course,revision,serverNow:now}});
    }
    if(path.endsWith('/planning-assistant'))return route.fulfill({json:{available:false}});
    return route.fulfill({status:404,json:{}});
  });
  try{
    await page.goto('http://127.0.0.1:8788/teacher.html');await page.getByRole('tab',{name:'Course overview',exact:true}).click();
    await page.locator('[data-course-overview]').waitFor({state:'visible'});
    assert.equal(await page.locator('#course-form').isVisible(),false);
    assert.equal(await page.locator('[data-overview-lesson]').count(),2);
    assert.equal(await page.locator('.overview-number').first().innerText(),'01');
    await page.locator('[data-overview-quiz-status="lesson-0"]').getByText('Assigned',{exact:true}).waitFor();
    const firstFeedback=page.locator('[data-overview-lesson="0"] [data-feedback-open]');
    assert.equal(await firstFeedback.isEnabled(),false);await page.clock.runFor(1500);assert.equal(await firstFeedback.isEnabled(),true);
    assert.equal(await page.locator('[data-overview-lesson="1"] [data-feedback-open]').isEnabled(),false);
    await page.locator('.course-planner').screenshot({path:'/tmp/inkwire-course-overview-desktop.png'});
    await page.locator('[data-overview-quiz="lesson-0"]').click();await page.locator('dialog.lesson-quiz').waitFor({state:'visible'});assert.equal(quizOpens,1);
    await page.getByRole('button',{name:'Close pre-lesson quiz',exact:true}).click();
    await page.getByRole('button',{name:'Edit lesson 2',exact:true}).click();
    assert.equal(await page.locator('#course-form').isVisible(),true);assert.equal(await page.locator('[data-plan-lesson="1"]').getAttribute('open'),'');
    await page.locator('#lesson-1-title').fill('Chapters 1–4: a change of perspective');
    failSave=true;await page.getByRole('button',{name:'Save course overview',exact:true}).click();await page.getByText('Please try saving again.',{exact:true}).waitFor();
    assert.equal(await page.locator('#course-form').isVisible(),true);assert.equal(await page.locator('#lesson-1-title').inputValue(),'Chapters 1–4: a change of perspective');
    failSave=false;await page.getByRole('button',{name:'Save course overview',exact:true}).click();await page.locator('[data-course-overview]').waitFor({state:'visible'});
    assert.equal(saves,1);assert.equal(await page.locator('#course-form').isVisible(),false);assert.match(await page.locator('[data-overview-lesson="1"] h3').innerText(),/a change of perspective/);
    await page.getByRole('button',{name:'Edit Unit Plan',exact:true}).click();await page.locator('#lesson-0-title').fill('<img src=x onerror=alert(1)> Draft title');
    await page.getByRole('button',{name:'Back to overview',exact:true}).click();
    assert.equal(await page.locator('[data-course-overview] img').count(),0);assert.match(await page.locator('[data-overview-lesson="0"] h3').innerText(),/<img src=x/);
    assert.equal(await firstFeedback.isEnabled(),false);assert.equal(await page.locator('[data-overview-quiz="lesson-0"]').isEnabled(),false);
    await page.getByRole('button',{name:'Continue editing unit plan',exact:true}).click();assert.match(await page.locator('#lesson-0-title').inputValue(),/Draft title/);
    page.once('dialog',d=>d.accept());await page.locator('#selected-class').selectOption(empty);await page.getByRole('tab',{name:'Course overview',exact:true}).click();
    await page.getByRole('button',{name:'Create Unit Plan',exact:true}).waitFor();assert.equal(await page.locator('[data-overview-lesson]').count(),0);assert.equal(await page.locator('#course-form').isVisible(),false);
    await page.getByRole('button',{name:'Create Unit Plan',exact:true}).click();assert.equal(await page.locator('#course-form').isVisible(),true);assert.equal(saves,1);
    await page.locator('#selected-class').selectOption(cid);await page.locator('[data-course-overview]').waitFor({state:'visible'});
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.locator('.course-planner').screenshot({path:'/tmp/inkwire-course-overview-mobile.png'});
    assert.deepEqual(errors,[]);
  }finally{await browser.close();}
});
