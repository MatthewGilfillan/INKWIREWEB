const {test}=require('node:test');const assert=require('node:assert/strict');const {chromium}=require('playwright');
const {fixture,users,cid,origin,definition}=require('../helpers/quiz-fixture.cjs');
test('teacher uploads course resources, generates private quiz drafts, edits and assigns; provider failures preserve edits',async()=>{
 const f=await fixture(),fetch=global.fetch;Object.assign(f.env,{OPENAI_API_KEY:'test-only',OPENAI_PLANNING_ENABLED:'true'});
 const {handleCourseResources}=await import('../../cloudflare/course-resources.mjs'),{handleQuizAssistant}=await import('../../cloudflare/quiz-assistant.mjs');
 let files=0,generations=0,fail=false;global.fetch=async(url,init)=>{
  if(url.endsWith('/files')){files++;return Response.json({id:'file-browser-'+files});}
  generations++;if(fail)return new Response('provider error',{status:500});const payload=JSON.parse(init.body),input=JSON.parse(payload.input[0].content.at(-1).text);assert.equal(payload.input[0].content.filter(c=>c.type==='input_file').length,2);
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({drafts:input.lessons.map(l=>({lessonId:l.lessonId,draft:{quiz:definition,reviewNotes:'Check that students have read the opening passage.',sources:['Book.txt: the narrator introduces the story.','Unit plan.csv: support answers with textual evidence.']}})),notes:''})}]}]});
 };
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROME_CHANNEL?{channel:process.env.PLAYWRIGHT_CHROME_CHANNEL}:{})}),page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(path.startsWith('/api/course-resources/') || path.startsWith('/api/quiz-assistant/')){const request=new Request(origin+path,{method:req.method(),headers:{...req.headers(),origin},...(req.method()==='POST'?{body:req.postDataBuffer()}:{})});const result=await(path.startsWith('/api/course-resources/')?handleCourseResources:handleQuizAssistant)(request,f.env,users.t,f.helpers);return route.fulfill({status:result.status,json:await result.json()});}
  if(path.startsWith('/api/lesson-quizzes/')){const response=await f.request(users.t,req.method()==='POST'?req.postDataJSON():undefined,path.split('/').at(-1));return route.fulfill({status:response.status,json:await response.json()});}
  if(path.startsWith('/api/lesson-feedback/')){const response=await f.timeline();return route.fulfill({status:response.status,json:await response.json()});}
  if(path==='/api/classes')return route.fulfill({json:{classes:[{id:cid,name:'Fictional literature',membership:'owner',overviewRevision:1}]}});
  if(path.endsWith('/roster'))return route.fulfill({json:{students:[]}});
  if(path.endsWith('/overview'))return route.fulfill({json:{course:f.course,revision:1}});
  if(path.endsWith('/planning-assistant'))return route.fulfill({json:{available:true}});
  return route.fulfill({status:404,json:{message:'Not found'}});
 });
 try{
  await page.goto('http://127.0.0.1:8788/teacher.html');await page.getByRole('tab',{name:'Course overview',exact:true}).click();await page.getByText('Resources & AI quizzes',{exact:true}).click();
  await page.locator('[data-resource-files]').setInputFiles([{name:'Book.txt',mimeType:'text/plain',buffer:Buffer.from('The narrator tells the story. Quotations support interpretations.')},{name:'Unit plan.csv',mimeType:'text/csv',buffer:Buffer.from('lesson,objective\n1,Narrator\n2,Textual evidence')}]);await page.getByRole('button',{name:'Upload resources',exact:true}).click();await page.getByText(/Resources ready/).waitFor();assert.equal(files,2);
  await page.getByRole('button',{name:'Draft quizzes for course',exact:true}).click();await page.getByText('2 quiz drafts ready for review.',{exact:true}).waitFor();assert.equal(generations,1);assert.equal(f.db.prepare('SELECT count(*) n FROM lesson_quizzes').get().n,0);
  await page.locator('.course-quiz-setup').scrollIntoViewIfNeeded();await page.screenshot({path:'/tmp/inkwire-ai-quiz-course-resources.png'});
  await page.getByRole('button',{name:'Review AI draft',exact:true}).first().click();await page.getByRole('heading',{name:'AI draft · teacher review',exact:true}).waitFor();assert.equal(await page.locator('[data-question-prompt]').first().inputValue(),definition.questions[0].prompt);
  await page.locator('[data-question-prompt]').first().fill('Who is narrating this passage?');fail=true;page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Suggest questions with AI',exact:true}).click();await page.locator('[data-quiz-error]').getByText(/OpenAI could not/).waitFor();assert.equal(await page.locator('[data-question-prompt]').first().inputValue(),'Who is narrating this passage?');assert.equal(f.db.prepare('SELECT count(*) n FROM lesson_quizzes').get().n,0);
  fail=false;await page.screenshot({path:'/tmp/inkwire-ai-quiz-review.png'});await page.setViewportSize({width:390,height:844});assert.equal(await page.locator('dialog.lesson-quiz').evaluate(el=>el.scrollWidth<=el.clientWidth),true);await page.screenshot({path:'/tmp/inkwire-ai-quiz-mobile.png'});
  await page.getByRole('button',{name:'Save & assign quiz',exact:true}).click();await page.getByText('Quiz assigned to this lesson.',{exact:true}).waitFor();assert.equal(f.db.prepare('SELECT count(*) n FROM lesson_quizzes').get().n,1);assert.equal(f.db.prepare('SELECT count(*) n FROM quiz_drafts').get().n,1);
  await page.getByRole('button',{name:'Close pre-lesson quiz',exact:true}).click();await page.getByRole('tab',{name:'Timeline',exact:true}).click();await page.getByRole('button',{name:'Review AI draft',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'View / edit quiz',exact:true}).count(),1);assert.deepEqual(errors,[]);
 }finally{global.fetch=fetch;await browser.close();f.db.close();}
});
