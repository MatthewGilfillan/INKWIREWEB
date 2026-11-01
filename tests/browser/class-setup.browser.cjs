const {test}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {classSetupFixture,users,origin}=require('../helpers/class-setup-fixture.cjs');
test('create timetable, cross out two weeks, preserve session details, share a file and view mobile calendar',async()=>{
  const f=await classSetupFixture(),errors=[],previousFetch=global.fetch;let role='teacher';Object.assign(f.env,{OPENAI_PLANNING_ENABLED:'true',OPENAI_API_KEY:'test-only'});
  const {handleCourseResources}=await import('../../cloudflare/course-resources.mjs'),{handleCoursePreparation}=await import('../../cloudflare/course-preparation.mjs');
  global.fetch=async(url,init)=>{if(url.endsWith('/files'))return Response.json({id:'file-browser-test'});const body=JSON.parse(init.body),context=JSON.parse(body.input[0].content.at(-1).text);assert.equal(body.input[0].content[0].file_id,'file-browser-test');const result=context.requestedLessonCount?{title:'Prepared literature study',description:'A course from the supplied notes.',gradeBand:'Grade 6',themes:'Character',essentialQuestions:'How do characters change?',enduringUnderstandings:'Support interpretations with evidence.',reviewNotes:'Test provider response.',lessons:Array.from({length:context.requestedLessonCount},(_,i)=>({title:'Study session '+(i+1),section:'',goal:'Compare evidence.',reading:'Read the assigned excerpt.',homework:'Collect two examples.',skills:'Analysis',activities:'Discuss the evidence.',evidence:'A supported response.',sourcePages:''}))}:{drafts:[],notes:'Add book excerpts for quiz questions.'};return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(result)}]}]});};
  const {handleClassFiles}=await import('../../cloudflare/class-files.mjs'),{handleLessonFeedback}=await import('../../cloudflare/lesson-feedback.mjs');
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROME_CHANNEL?{channel:process.env.PLAYWRIGHT_CHROME_CHANNEL}:{})});
  const page=await browser.newPage({viewport:{width:1360,height:1000}});page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  await page.route('**/*.html',async route=>{const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}});});
  await page.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname,user=role==='teacher'?users.t:users.sa;
    let response;
    try{
      if(path.startsWith('/api/classes'))response=await f.api(path+url.search,req.method()==='POST'?req.postDataJSON():undefined,user);
      else if(path.startsWith('/api/class-files'))response=await handleClassFiles(new Request(origin+path,{method:req.method(),headers:{...req.headers(),origin},...(req.method()==='POST'?{body:req.postDataBuffer()}:{})}),f.env,user,f.helpers);
      else if(path.startsWith('/api/lesson-feedback/'))response=await handleLessonFeedback(new Request(origin+path+url.search),f.env,user,f.helpers);
      else if(path==='/api/enrollment/mine')response=Response.json({classes:f.db.prepare('SELECT id,name,subject FROM classes WHERE name=?').all('Calendar trial'),learner:{id:'a'}});
      else if(path.includes('/roster'))response=Response.json({students:[]});
      else if(path==='/api/account')response=Response.json({role,email:'test@example.invalid'});
      else if(path.startsWith('/api/quiz-assistant/'))response=Response.json({available:false,lessons:[]});
      else if(path.startsWith('/api/course-resources/'))response=await handleCourseResources(new Request(origin+path),f.env,user,f.helpers);
      else if(path.startsWith('/api/course-preparation/'))response=await handleCoursePreparation(new Request(origin+path,{method:req.method(),headers:{...req.headers(),origin},...(req.method()==='POST'?{body:req.postDataBuffer()}:{})}),f.env,user,f.helpers);
      else if(path==='/api/drive-config')response=Response.json({clientId:''});
      else response=Response.json({},{status:404});
      await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
    }catch(e){errors.push(e.stack);await route.fulfill({status:500,json:{message:e.message}});}
  });
  try{
    await page.goto('http://127.0.0.1:8788/teacher.html');await page.getByRole('button',{name:'+ Create class',exact:true}).click();
    const form=page.locator('#create-form');await form.getByLabel('Class name',{exact:true}).fill('Calendar trial');
    for(const el of await form.locator('[data-day]').all())await el.uncheck();await form.locator('[data-day="1"]').check();
    await form.locator('[data-setup="startDate"]').fill('2027-01-04');await form.locator('[data-setup="endDate"]').fill('2027-04-26');
    await form.getByRole('button',{name:'Review calendar',exact:true}).click();assert.match(await form.locator('[data-setup-count]').innerText(),/17 of 15.*Cross out 2/);assert.equal(await form.locator('[type=submit]').isEnabled(),false);
    await form.getByRole('button',{name:'Skip week of 2027-02-01',exact:true}).click();await form.getByRole('button',{name:'Skip week of 2027-02-08',exact:true}).click();assert.match(await form.locator('[data-setup-count]').innerText(),/15 of 15/);
    await form.locator('.setup-review').screenshot({path:'/tmp/inkwire-setup-calendar.png'});
    await form.getByRole('button',{name:'Create class & timetable',exact:true}).click();await page.locator('#create-class').waitFor({state:'hidden'});await page.locator('[data-course-overview] h3').filter({hasText:'Calendar trial'}).waitFor();
    const row=f.db.prepare('SELECT id FROM classes WHERE name=?').get('Calendar trial');let saved=JSON.parse(f.db.prepare('SELECT content FROM course_overviews WHERE class_id=?').get(row.id).content);assert.equal(saved.lessons.length,15);assert.equal(saved.lessons[4].date,'2027-02-15');assert.equal(saved.lessons[0].title,'Week 1');
    await page.getByRole('button',{name:'Edit lesson 1',exact:true}).click();await page.locator('#lesson-0-goal').fill('Explore the author’s background.');await page.getByRole('button',{name:'Save course overview',exact:true}).click();await page.locator('[data-course-overview]').waitFor({state:'visible'});await page.locator('[data-course-overview]').getByText('Explore the author’s background.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Edit timetable',exact:true}).click();await page.locator('[data-class-setup] [data-day="5"]').check();await page.locator('[data-class-setup] [data-day="1"]').uncheck();await page.locator('[data-class-setup] [data-day="6"]').check();
    const setup=page.locator('[data-class-setup]');await setup.locator('[data-setup="lessonCount"]').fill('8');await setup.locator('[data-setup="startDate"]').fill('2027-01-01');await setup.locator('[data-setup="endDate"]').fill('2027-01-30');await setup.locator('[data-setup-day="5"] [data-day-time]').fill('18:00');await setup.locator('[data-setup-day="6"] [data-day-time]').fill('10:00');await setup.locator('[data-setup-day="6"] [data-day-minutes]').fill('60');
    await setup.getByRole('button',{name:'Review calendar',exact:true}).click();await setup.getByRole('button',{name:'Skip week of 2027-01-04',exact:true}).click();
    await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/inkwire-setup-mobile.png',fullPage:true});
    await page.getByRole('button',{name:'Save timetable',exact:true}).click();await page.locator('[data-course-overview]').waitFor({state:'visible'});
    saved=JSON.parse(f.db.prepare('SELECT content FROM course_overviews WHERE class_id=?').get(row.id).content);assert.equal(saved.lessons[0].goal,'Explore the author’s background.');assert.equal(saved.lessons[1].title,'Week 1 Lesson 2');assert.equal(saved.lessons[1].startTime,'10:00');
    await page.setViewportSize({width:1360,height:1000});await page.getByRole('tab',{name:'Timeline',exact:true}).click();await page.getByRole('heading',{name:/Week 1 Lesson 1/}).waitFor();
    await page.getByRole('tab',{name:'Class files',exact:true}).click();await page.getByText('Your class library starts here',{exact:true}).waitFor();
    await page.locator('[data-files-input]').setInputFiles({name:'Reading guide.txt',mimeType:'text/plain',buffer:Buffer.from('Original reading guide for this test.')});await page.getByRole('button',{name:'Upload files',exact:true}).click();await page.getByRole('heading',{name:'Reading guide.txt',exact:true}).waitFor();
    assert.equal(f.db.prepare('SELECT student_download FROM class_files WHERE class_id=?').get(row.id).student_download,0);
    await page.locator('[data-file-students]').check();await page.getByRole('button',{name:'Save sharing for Reading guide.txt',exact:true}).click();await page.getByText('Visible to this class and linked parents',{exact:true}).waitFor();await page.screenshot({path:'/tmp/inkwire-class-files.png',fullPage:true});
    await page.locator('[data-file-ai]').check();await page.getByRole('button',{name:'Save sharing for Reading guide.txt',exact:true}).click();await page.locator('[data-files-message]').getByText(/Sharing settings saved/).waitFor();
    await page.getByRole('button',{name:'Populate overview with AI',exact:true}).click();await page.locator('[data-prep-start]:not([disabled])').waitFor();assert.equal(await page.locator('[data-prep-count]').inputValue(),'8');assert.equal(await page.locator('[data-prep-count]').isEnabled(),false);assert.equal(await page.locator('[data-prep-length]').inputValue(),'settings');
    await page.getByRole('button',{name:'Prepare whole course',exact:true}).click();await page.locator('[data-prep-status]').getByText(/preparation complete/).waitFor();await page.getByRole('button',{name:'Use plan in editor',exact:true}).click();await page.getByRole('button',{name:'Save course overview',exact:true}).click();await page.locator('[data-course-overview]').getByRole('heading',{name:'Prepared literature study',exact:true}).waitFor();
    const prepared=JSON.parse(f.db.prepare('SELECT content FROM course_overviews WHERE class_id=?').get(row.id).content);assert.deepEqual(prepared.lessons.map(l=>[l.id,l.date,l.startTime,l.lessonMinutes]),saved.lessons.map(l=>[l.id,l.date,l.startTime,l.lessonMinutes]));assert.equal(prepared.lessons[0].goal,'Compare evidence.');
    f.db.prepare('INSERT INTO class_students VALUES(?,?,0)').run(row.id,'a');role='student';await page.goto('http://127.0.0.1:8788/student.html');await page.getByRole('button',{name:'Class files',exact:true}).click();await page.getByRole('heading',{name:'Reading guide.txt',exact:true}).waitFor();assert.equal(await page.getByText('Use with AI',{exact:true}).count(),0);
    assert.deepEqual(errors,[]);
  }catch(e){console.error('Page errors:',errors);console.error(await page.locator('body').innerText());throw e;}finally{global.fetch=previousFetch;await browser.close();f.db.close();}
});
