const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const id='11111111-1111-4111-8111-111111111111';
test('teacher previews, discards and accepts AI content without autosaving; stale responses and failures keep edits',async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROME_CHANNEL?{channel:process.env.PLAYWRIGHT_CHROME_CHANNEL}:{})});
  const context=await browser.newContext(),page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let requests=0,saves=0,saved=null,fail=false,release=null;
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    if(path==='/api/classes')return route.fulfill({json:{classes:[{id,name:'Literature planning',membership:'owner'}]}});
    if(path.endsWith('/roster'))return route.fulfill({json:{students:[]}});
    if(path.endsWith('/overview')){
      if(route.request().method()==='POST'){saves++;saved=route.request().postDataJSON().course;}
      return route.fulfill({json:{course:saved,revision:saved?1:0}});
    }
    if(path.endsWith('/planning-assistant')){
      if(route.request().method()==='GET')return route.fulfill({json:{available:true}});
      requests++;const body=route.request().postDataJSON();
      if(fail)return route.fulfill({status:502,json:{message:'AI planning could not complete. Your course has not changed.'}});
      if(release)await new Promise(resolve=>{release.resolve=resolve;});
      const course=structuredClone(body.course);
      const indexes=body.mode==='course'?course.lessons.map((_,i)=>i):[body.lessonIndex];
      for(const i of indexes){course.lessons[i].activities='10 min: retrieval\n30 min: close reading\n30 min: discussion\n35 min: writing\n15 min: reflection';course.lessons[i].skills='Evidence selection';course.lessons[i].evidence='Exit response';if(body.mode==='course')course.lessons[i].title='Generated lesson '+(i+1);}
      return route.fulfill({json:{course,reviewNotes:'<img src=x onerror=alert(1)> Confirm the reading.'}});
    }
    return route.fulfill({status:404,json:{}});
  });
  async function open(){await page.locator(`[data-class-id="${id}"]>summary`).click();await page.getByRole('button',{name:/Build course overview|Edit course overview/}).click();await page.locator('#course-form').waitFor({state:'visible'});}
  async function generate(){await page.locator('#ai-planning-brief').fill('Create an age-appropriate literature and essay course.');await page.getByRole('button',{name:'Generate suggestion',exact:true}).click();await page.locator('[data-ai-preview]').waitFor({state:'visible'});}
  try{
    await page.goto('http://127.0.0.1:8788/teacher.html');await open();
    await page.getByText('Plan with AI',{exact:false}).click();await generate();
    assert.equal(saves,0);assert.notEqual(await page.locator('#lesson-0-title').inputValue(),'Generated lesson 1');
    assert.equal(await page.locator('[data-ai-result] img').count(),0);assert.match(await page.locator('[data-ai-result]').innerText(),/<img src=x/);
    await page.getByRole('button',{name:'Discard suggestion',exact:true}).click();assert.equal(saves,0);
    await generate();await page.getByRole('button',{name:'Use suggestion in draft',exact:true}).click();
    assert.equal(await page.locator('#lesson-0-title').inputValue(),'Generated lesson 1');assert.equal(saves,0);
    await page.getByRole('button',{name:'Save course overview',exact:true}).click();await page.getByText('Course overview saved.',{exact:true}).waitFor();assert.equal(saves,1);
    await page.locator('#ai-planning-mode').selectOption('activities');await page.locator('#ai-planning-lesson').selectOption('4');await generate();
    assert.equal(await page.locator('.ai-lesson').count(),1);assert.match(await page.locator('.ai-lesson summary').innerText(),/Lesson 5/);
    await page.locator('#lesson-0-title').fill('Teacher edit after preview');await page.getByRole('button',{name:'Use suggestion in draft',exact:true}).click();
    assert.match(await page.locator('[data-ai-error]').innerText(),/course changed/);assert.equal(await page.locator('#lesson-0-title').inputValue(),'Teacher edit after preview');
    fail=true;await page.getByRole('button',{name:'Generate suggestion',exact:true}).click();await page.locator('[data-ai-error]').getByText(/could not complete/).waitFor();
    assert.equal(await page.locator('#lesson-0-title').inputValue(),'Teacher edit after preview');assert.equal(saves,1);
    fail=false;release={};await page.getByRole('button',{name:'Generate suggestion',exact:true}).click();
    await page.getByText(/Drafting your suggestion/).waitFor();assert.equal(await page.locator('#lesson-0-title').isEnabled(),false);
    page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Close course overview'}).click();
    release.resolve();release=null;
    await page.getByRole('button',{name:'Edit course overview'}).click();await page.locator('#course-form').waitFor({state:'visible'});
    assert.equal(await page.locator('#lesson-0-title').inputValue(),'Generated lesson 1');assert.equal(await page.locator('[data-ai-preview]').isVisible(),false);
    assert.equal(await page.locator('#lesson-0-title').isEnabled(),true);
    await page.setViewportSize({width:390,height:844});
    if(!await page.locator('.course-assistant>details').evaluate(el=>el.open))await page.getByText('Plan with AI',{exact:false}).click();
    await page.locator('.course-assistant').scrollIntoViewIfNeeded();assert.equal(await page.locator('.course-planner').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
    await page.screenshot({path:'/tmp/inkwire-ai-planning-mobile.png'});
    await page.setViewportSize({width:1440,height:1100});await page.locator('.course-assistant').scrollIntoViewIfNeeded();
    await page.screenshot({path:process.env.TEST_AI_SCREENSHOT||'/tmp/inkwire-ai-planning.png'});
    assert.equal(requests,5);assert.deepEqual(errors,[]);
  }finally{await context.close();await browser.close();}
});
