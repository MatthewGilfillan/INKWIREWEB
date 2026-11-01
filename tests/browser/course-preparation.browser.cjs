const {test}=require('node:test');const assert=require('node:assert/strict');const {chromium}=require('playwright');
const cid='11111111-1111-4111-8111-111111111111';
test('a selected PDF prepares a private course, resumes a failed quiz step and attaches drafts only after saving',async()=>{
 const {defaults,generateLessons,validateCourse}=await import('../../dist/course-model.mjs');let saved=null,revision=0,job=null,uploads=0,steps=0,attached=0,failQuiz=true;
 const course={...defaults('The Crucible'),weeks:2,lessonCount:2,format:'full'};course.lessons=generateLessons(course).map((l,i)=>({...l,id:'prepared-'+i,title:i?'Miller, McCarthyism and allegory':'Salem and Puritan society',activities:'Discuss the evidence, then write a supported paragraph.'}));
 const quiz={quiz:{title:'Reading check',questions:[{prompt:'What supports a convincing interpretation?',options:['Evidence','A guess'],correctIndex:0,explanation:'Support claims with evidence.'}],reflectionPrompt:''},sources:['Unit plan: learning goals'],reviewNotes:'Check before assigning.'};
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROME_CHANNEL?{channel:process.env.PLAYWRIGHT_CHROME_CHANNEL}:{})}),page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 await page.route('**/api/**',async route=>{
  const path=new URL(route.request().url()).pathname,post=route.request().method()==='POST';
  if(path==='/api/classes')return route.fulfill({json:{classes:[{id:cid,name:'The Crucible · preparation trial',membership:'owner',overviewRevision:revision}]}});
  if(path.endsWith('/roster'))return route.fulfill({json:{students:[]}});
  if(path==='/api/drive-config')return route.fulfill({json:{clientId:''}});
  if(path.startsWith('/api/course-resources/')){if(post)uploads++;return route.fulfill({json:{available:true,resources:uploads?[{id:'r',filename:'Crucible plan.pdf',kind:'unit-plan',bytes:30}]:[]}});}
  if(path.startsWith('/api/course-preparation/')){
   if(post){const b=route.request().postDataJSON();if(b.action==='start'){assert.equal(uploads,1);assert.equal(b.course.lessonMinutes,50);assert.ok(b.course.lessons.every(l=>l.lessonMinutes===50));job={id:b.id,course:null,quizzes:{},reviewNotes:'The book text is not supplied.',lastError:''};}
    if(b.action==='next'){steps++;if(!job.course)job.course=course;else if(failQuiz){failQuiz=false;return route.fulfill({status:502,json:{message:'Temporary provider failure.'}});}else job.quizzes=Object.fromEntries(course.lessons.map(l=>[l.id,{draft:quiz,notes:''}]));}
    if(b.action==='attach-quizzes'){assert.ok(saved,'outline must be saved first');attached++;return route.fulfill({json:{saved:course.lessons.map(l=>l.id),skipped:[]}});}
   }return route.fulfill({json:{available:true,preparation:job}});
  }
  if(path.startsWith('/api/quiz-assistant/'))return route.fulfill({json:{available:true,lessons:[]}});
  if(path.endsWith('/planning-assistant'))return route.fulfill({json:{available:true}});
  if(path.endsWith('/overview')){if(post){saved=validateCourse(route.request().postDataJSON().course);revision++;}return route.fulfill({json:{course:saved,revision,serverNow:Date.now()}});}
  return route.fulfill({status:404,json:{}});
 });
 try{
  await page.goto('http://127.0.0.1:8788/teacher.html');await page.getByRole('tab',{name:'Course overview',exact:true}).click();await page.getByRole('button',{name:'Prepare Course with AI',exact:true}).click();
  await page.locator('[data-prep-start]:not([disabled])').waitFor();await page.locator('[data-prep-plan]').setInputFiles({name:'Crucible plan.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.7 sample plan')});
  await page.locator('[data-prep-minutes]').fill('50');await page.getByRole('button',{name:'Prepare whole course',exact:true}).click();await page.locator('[data-prep-status]').getByText(/Temporary provider failure/).waitFor();assert.equal(saved,null);assert.equal(attached,0);assert.equal(uploads,1);assert.equal(steps,2);
  await page.getByRole('button',{name:'Resume preparation',exact:true}).click();await page.locator('[data-prep-status]').getByText(/preparation complete/).waitFor();assert.equal(steps,3);assert.equal(uploads,1);assert.equal(attached,0);
  await page.locator('.preparation-lesson').first().locator('summary').click();await page.getByText('Correct: Evidence',{exact:true}).first().waitFor();
  await page.locator('#course-preparation').screenshot({path:'/tmp/inkwire-course-preparation-desktop.png'});await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator('#course-preparation').screenshot({path:'/tmp/inkwire-course-preparation-mobile.png'});
  await page.getByRole('button',{name:'Use plan in editor',exact:true}).click();assert.equal(await page.locator('#course-form').isVisible(),true);assert.equal(await page.locator('#course-title').inputValue(),'The Crucible');assert.equal(saved,null);
  await page.getByRole('button',{name:'Save course overview',exact:true}).click();await page.locator('[data-course-overview]').waitFor({state:'visible'});assert.equal(saved.lessons.length,2);assert.equal(attached,1);assert.equal(await page.locator('#course-preparation').isVisible(),false);assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
