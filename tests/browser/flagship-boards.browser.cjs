const {test}=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium}=require('playwright');
const {fixture,origin}=require('../helpers/assignment-fixture.cjs');

test('four flagship boards preserve typed evidence, Venn placement, paired responses, drafts and teacher settings',async()=>{
 const f=await fixture(),{handleClassBoards}=await import('../../cloudflare/class-boards.mjs');
 const prefix='/api/class-boards/classes/'+f.classId;
 async function api(who,suffix='',body){const response=await handleClassBoards(new Request(origin+prefix+suffix,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify({expectedUserId:f.users[who].id,requestId:randomUUID(),...body})}:{})}),f.env,f.users[who]);const value=await response.json();assert.ok(response.ok,JSON.stringify(value));return value;}
 async function create(template){const {id}=await api('teacher','',{action:'create',template,title:template==='reading-wall'?'Our Reading Wall':undefined,background:template==='venn-diagram'?'marble':'linen'}),{board}=await api('teacher','/'+id);await api('teacher','/'+id,{action:'settings',...board,published:true,open:true,settingsVersion:board.settingsVersion});return id;}
 const ids=Object.fromEntries(await Promise.all(['reading-wall','venn-diagram','cause-effect','problem-solution-board'].map(async t=>[t,await create(t)])));
 const server=http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname),file=path.resolve('dist','.'+pathname);if(!file.startsWith(path.resolve('dist')+path.sep))throw Error('Path');const data=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(data);}catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROME_CHANNEL?{channel:process.env.PLAYWRIGHT_CHROME_CHANNEL}:{})});const context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage(),errors=[];let who='student';
 page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(8000);
 await context.route('**/api/**',async route=>{const request=route.request(),url=new URL(request.url()),response=await handleClassBoards(new Request(origin+url.pathname+url.search,{method:request.method(),headers:{...Object.fromEntries(Object.entries(request.headers()).filter(([k])=>!['origin','host','content-length'].includes(k.toLowerCase()))),Origin:origin},...(request.method()==='POST'?{body:request.postDataBuffer()}:{})}),f.env,f.users[who]);await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});});
 async function open(template){await page.goto(base+'/board-embed.html?'+new URLSearchParams({classId:f.classId,boardId:ids[template]}));await page.locator('[data-add-board-post]').waitFor({state:'attached'});}
 try{
  await open('reading-wall');assert.equal(await page.locator('[data-board-cog]').count(),0);
  assert.equal(await page.locator('[data-board-prompt]').isVisible(),false);
  assert.equal(await page.locator('.class-board-heading [data-board-state]').innerText(),'Open to class');
  assert.equal(await page.locator('.class-board-heading [data-story-stage]').count(),1);
  assert.ok((await page.locator('.class-board-heading').boundingBox()).height<75,'Reading controls share a compact header');
  await page.locator('[data-story-stage]').selectOption('question');assert.equal(await page.locator('[data-story-stage]').inputValue(),'question');await page.locator('[data-story-stage]').selectOption('all');
  await page.getByRole('button',{name:'Enter fullscreen',exact:true}).click();await page.waitForFunction(()=>document.fullscreenElement?.id==='embedded-live-board');
  await page.getByRole('button',{name:'Exit fullscreen',exact:true}).click();await page.waitForFunction(()=>!document.fullscreenElement);
  const opened=context.waitForEvent('page');await page.getByRole('button',{name:'View in new window',exact:true}).click();const popup=await opened;await popup.locator('[data-board-title]').waitFor();assert.equal(new URL(popup.url()).searchParams.get('boardId'),ids['reading-wall']);assert.equal(await popup.evaluate(()=>window.opener),null);assert.equal(await popup.locator('[data-present-board],.standalone-board-navigation').count(),0);assert.equal(await popup.locator('.class-board-title-group .board-back-link').count(),1);assert.equal(await popup.getByText('Insert this board into a notebook',{exact:true}).count(),0);await popup.getByRole('button',{name:'Enter fullscreen',exact:true}).click();await popup.waitForFunction(()=>!!document.fullscreenElement);await popup.getByRole('button',{name:'Exit fullscreen',exact:true}).click();await popup.waitForFunction(()=>!document.fullscreenElement);await popup.close();
  await page.locator('[data-add-board-post]').click();assert.equal(await page.locator('[data-reading-response]').count(),9);
  const composer=page.locator('[data-board-composer]');
  await page.locator('[data-reading-response=connection]').click();
  assert.equal(await composer.locator('[name=title]').inputValue(),'Connection to our lives');
  assert.equal(await composer.locator('textarea:visible').count(),2);
  assert.equal(await composer.locator('[required]').count(),0);
  assert.equal(await composer.locator('[name=reference]').isVisible(),false);
  assert.equal(await composer.locator('[name=reasoning]').isVisible(),false);
  assert.equal(await composer.locator('[name=url]').isVisible(),false);
  await page.getByRole('button',{name:'Add a link',exact:true}).click();
  assert.equal(await composer.locator('[name=url]').isVisible(),true);
  await page.getByRole('button',{name:'Add a link',exact:true}).click();
  const chooserEvent=page.waitForEvent('filechooser');await page.getByRole('button',{name:'Attach image',exact:true}).click();assert.ok(await chooserEvent);
  await composer.locator('[name=title]').fill('My own subject');
  await page.locator('[data-response-back]').click();await page.locator('[data-reading-response=prediction]').click();
  assert.equal(await composer.locator('[name=title]').inputValue(),'My own subject','Custom subjects survive response type changes');
  await composer.locator('[name=title]').fill('');
  await page.locator('[data-response-back]').click();await page.locator('[data-reading-response=character]').click();
  assert.equal(await composer.locator('[name=title]').inputValue(),'Character’s thoughts, feelings, and motivations');
  const evidence='She invites the people she has met.\n\nChapter 24';
  await composer.locator('[name=text]').fill('Opal wants to belong.');await composer.locator('[name=evidence]').fill(evidence);
  await composer.locator('.reading-extras summary').click();await composer.locator('[name=reasoning]').fill('Inviting them shows she wants friendship.');
  await page.getByRole('button',{name:'Close response and keep draft'}).click();await page.reload();await page.locator('.board-compose-dialog[open]').waitFor();
  assert.equal(await composer.locator('[name=evidence]').inputValue(),evidence);
  assert.equal(await composer.locator('[name=reasoning]').isVisible(),false,'Extensions stay folded when reopening a draft');
  assert.equal(await composer.locator('[name=reasoning]').inputValue(),'Inviting them shows she wants friendship.');
  await page.screenshot({path:'/tmp/inkwire-reading-composer-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.locator('.board-compose-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await page.screenshot({path:'/tmp/inkwire-reading-composer-mobile.png'});
  await page.evaluate(()=>document.documentElement.dataset.lmsTheme='dark');await page.waitForTimeout(250);await page.screenshot({path:'/tmp/inkwire-reading-composer-dark.png'});
  await page.evaluate(()=>document.documentElement.dataset.lmsTheme='light');await page.setViewportSize({width:1440,height:1100});
  await page.locator('[data-post-submit]').click();await page.locator('.board-compose-dialog').waitFor({state:'hidden'});await page.locator('[data-post-card]').waitFor();
  let post=(await api('student','/'+ids['reading-wall'])).board.posts[0];assert.equal(post.stage,'character');assert.equal(post.reference,'');assert.equal(post.evidence,evidence);assert.match(await page.locator('[data-post-card]').innerText(),/Character’s thoughts/);
  await page.locator('[data-post-card] summary').click();await page.locator('[data-edit-post]').click();await composer.locator('[name=text]').fill('Opal wants to belong and help others.');await page.locator('[data-post-submit]').click();await page.locator('.board-compose-dialog').waitFor({state:'hidden'});assert.equal((await api('teacher','/'+ids['reading-wall'])).board.posts[0].evidence,evidence);
  await page.locator('[data-post-card]').screenshot({path:'/tmp/inkwire-reading-wall-card.png'});
  // A response needs no evidence, extension, or subject supplied by the student.
  await page.locator('[data-add-board-post]').click();await page.locator('[data-reading-response=question]').click();await composer.locator('[name=title]').fill('');await composer.locator('[name=text]').fill('Why does Opal feel lonely?');
  await page.getByRole('button',{name:'Close response and keep draft'}).click();await page.reload();await page.locator('.board-compose-dialog[open]').waitFor();assert.equal(await composer.locator('[name=title]').inputValue(),'','An intentionally blank subject stays blank');
  await page.locator('[data-post-submit]').click();await page.locator('.board-compose-dialog').waitFor({state:'hidden'});
  assert.ok((await api('teacher','/'+ids['reading-wall'])).board.posts.some(p=>p.text==='Why does Opal feel lonely?'&&!p.evidence&&!p.reasoning&&!p.title));
  // References on older posts migrate into Evidence when there is space.
  await api('student','/'+ids['reading-wall'],{action:'post',title:'Older response',text:'A saved idea',stage:'connection',evidence:'An older quotation.',reference:'Page 32'});
  await page.locator('[data-board-refresh]').click();const legacyCard=page.locator('[data-post-card]').filter({hasText:'Older response'});await legacyCard.waitFor();await legacyCard.locator('summary').click();await legacyCard.locator('[data-edit-post]').click();
  assert.equal(await composer.locator('[name=evidence]').inputValue(),'An older quotation.\n\nPage / source: Page 32');assert.equal(await composer.locator('[name=reference]').inputValue(),'');
  await page.locator('[data-post-submit]').click();await page.locator('.board-compose-dialog').waitFor({state:'hidden'});
  assert.ok((await api('teacher','/'+ids['reading-wall'])).board.posts.some(p=>p.title==='Older response'&&p.evidence.includes('Page / source: Page 32')&&!p.reference));
  await api('student','/'+ids['reading-wall'],{action:'post',title:'Full length evidence',text:'A saved idea',stage:'connection',evidence:'A'.repeat(1600),reference:'Page 48'});
  await page.locator('[data-board-refresh]').click();const longCard=page.locator('[data-post-card]').filter({hasText:'Full length evidence'});await longCard.waitFor();await longCard.locator('summary').click();await longCard.locator('[data-edit-post]').click();
  assert.equal(await composer.locator('[name=evidence]').inputValue(),'A'.repeat(1600));assert.match(await composer.locator('.reading-saved-source').innerText(),/Page 48/);
  await page.locator('[data-post-submit]').click();await page.locator('.board-compose-dialog').waitFor({state:'hidden'});
  assert.ok((await api('teacher','/'+ids['reading-wall'])).board.posts.some(p=>p.title==='Full length evidence'&&p.evidence.length===1600&&p.reference==='Page 48'),'Long legacy evidence and its source are both preserved');
  await open('venn-diagram');assert.equal(await page.locator('.venn-circles circle').count(),2);assert.equal(await page.locator('.venn-region').count(),3);assert.equal(await page.locator('.story-stage-column').count(),0);await page.locator('.venn-category-1 [data-add-stage]').click();await page.locator('[data-board-composer] [name=text]').fill('Both characters feel lonely.');assert.equal(await page.locator('[data-board-composer] [name=stage]').inputValue(),'s2');await page.locator('[data-post-submit]').click();await page.locator('.venn-region-1 [data-post-card]').waitFor();assert.equal(await page.locator('[data-post-card]').count(),1);
  await page.locator('[data-post-card] summary').click();await page.locator('[data-move-stage]').selectOption('s1');await page.locator('.venn-region-0 [data-post-card]').waitFor();assert.equal((await api('student','/'+ids['venn-diagram'])).board.posts[0].stage,'s1');await page.locator('[data-post-card] summary').click();await page.locator('[data-expand-response]').click();await page.locator('.story-response-dialog[open]').waitFor();await page.locator('.story-dialog-close').click();
  await page.setViewportSize({width:1024,height:768});await page.screenshot({path:'/tmp/inkwire-venn-ipad.png'});await page.evaluate(()=>document.documentElement.dataset.lmsTheme='dark');assert.equal(await page.locator('#embedded-live-board').evaluate(el=>getComputedStyle(el).color),'rgb(17, 44, 77)','Board paper appearance stays independent of site dark mode');await page.screenshot({path:'/tmp/inkwire-venn-dark.png'});await page.evaluate(()=>document.documentElement.dataset.lmsTheme='light');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  who='teacher';await open('venn-diagram');await page.locator('[data-board-cog]').click();await page.locator('[data-story-panel=setup]').click();await page.locator('[name=heading-s1]').fill('Opal');await page.locator('[name=heading-s3]').fill('Gloria');await page.getByRole('button',{name:'Save activity settings',exact:true}).click();await page.getByText('Activity settings saved.',{exact:true}).waitFor();await page.locator('[data-close-board-settings]').click();assert.equal(await page.locator('.venn-category-0 h3').innerText(),'Opal');assert.equal((await api('student','/'+ids['venn-diagram'])).board.sectionLabels.s3,'Gloria');
  who='student';await page.setViewportSize({width:1440,height:1100});
  for(const [template,main,result]of [['cause-effect','Opal brings Winn-Dixie home.','She begins meeting new people.'],['problem-solution-board','A new student feels left out.','Invite them to join a small group.']]){
   await open(template);assert.match(await page.locator('.paired-pinned').innerText(),template==='cause-effect'?/Cause[\s\S]*Effect/:/Problem[\s\S]*Solution/);await page.locator('[data-add-pair]').click();await page.locator('[data-board-composer] [name=text]').fill(main);await page.locator('[data-board-composer] [name=character]').fill(result);await page.locator('[data-board-composer] [name=reasoning]').fill('A thoughtful connection supported by the text.');await page.locator('[data-post-submit]').click();await page.locator('.paired-response').waitFor();assert.match(await page.locator('.paired-result').innerText(),new RegExp(result.replace(/[.]/g,'\\.')));assert.equal((await api('teacher','/'+ids[template])).board.posts[0].character,result);assert.ok((await page.locator('.paired-main .class-board-post').boundingBox()).width<=362,'Fullscreen-sized paired notes retain a comfortable width');
   for(let i=0;i<5;i++)await api('student','/'+ids[template],{action:'post',text:main+' '+i,character:result,reasoning:'Because the characters act together.',stage:'s1'});await page.locator('[data-board-refresh]').click();await page.waitForFunction(()=>document.querySelectorAll('.paired-response').length===6);
   const before=await page.locator('.paired-pinned').boundingBox();await page.locator('.paired-canvas').evaluate(el=>el.scrollTop=400);const after=await page.locator('.paired-pinned').boundingBox();assert.ok(Math.abs(before.y-after.y)<2,'Title and both headings stay pinned');await page.screenshot({path:'/tmp/inkwire-'+template+'.png'});
  }
  who='teacher';await open('reading-wall');await page.locator('[data-board-cog]').click();
  await page.locator('[name=background]').selectOption('painted-ocean');
  for(const theme of ['light','dark']){await page.evaluate(theme=>document.documentElement.dataset.lmsTheme=theme,theme);assert.deepEqual(await page.locator('#embedded-live-board').evaluate(el=>{const s=getComputedStyle(el);return {size:s.backgroundSize,repeat:s.backgroundRepeat,position:s.backgroundPosition};}),{size:'cover',repeat:'no-repeat',position:'50% 50%'});}
  await page.evaluate(()=>document.documentElement.dataset.lmsTheme='light');
  await page.locator('[name=backgroundUpload]').setInputFiles({name:'my-background.png',mimeType:'image/png',buffer:await fs.readFile('dist/assets/board-backgrounds/sand.png')});
  await page.locator('[data-background-status]').filter({hasText:'Background uploaded.'}).waitFor();const customId=await page.locator('[name=backgroundImageId]').inputValue();assert.ok(customId);
  assert.match(await page.locator('#embedded-live-board').evaluate(el=>el.style.getPropertyValue('--board-pattern')),new RegExp(customId));
  await page.getByRole('button',{name:'Save board details',exact:true}).click();await page.locator('[data-board-settings-drawer]').waitFor({state:'hidden'});assert.equal((await api('teacher','/'+ids['reading-wall'])).board.backgroundImageId,customId);
  who='student';await open('reading-wall');assert.equal(await page.locator('#embedded-live-board').getAttribute('data-pattern'),'custom');
  await page.evaluate(()=>document.fonts.ready);assert.match(await page.locator('[data-board-title]').evaluate(el=>getComputedStyle(el).fontFamily),/Poppins/);assert.match(await page.locator('.class-board-text').first().evaluate(el=>getComputedStyle(el).fontFamily),/Sofia Sans Condensed/);
  await api('student','/'+ids['reading-wall'],{action:'post',text:'I predict they will meet again.',stage:'prediction'});await page.locator('[data-board-refresh]').click();const prediction=page.locator('[data-post-card][data-reading-type=prediction]');await prediction.waitFor();assert.match(await prediction.evaluate(el=>getComputedStyle(el,'::before').transform),/matrix\(-1,/,'Only the paper skin is flipped, moving the clip to the right');
  assert.deepEqual(errors,[]);
 }catch(error){console.error({errors,status:await page.locator('[data-board-status]').textContent(),invalid:await page.locator('form :invalid').evaluateAll(els=>els.map(el=>({name:el.name,value:el.value,message:el.validationMessage})))});await page.screenshot({path:'/tmp/inkwire-flagship-failure.png'});throw error;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));f.db.close();}
});
