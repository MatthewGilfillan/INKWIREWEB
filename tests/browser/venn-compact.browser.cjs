const {test}=require('node:test'),assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto'),http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const {chromium}=require('playwright');
const {fixture,origin}=require('../helpers/assignment-fixture.cjs');

test('Venn keeps category actions above circles and response controls in compact menus',async()=>{
 const f=await fixture(),{handleClassBoards}=await import('../../cloudflare/class-boards.mjs');
 const prefix='/api/class-boards/classes/'+f.classId;
 async function api(who,suffix='',body){const response=await handleClassBoards(new Request(origin+prefix+suffix,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify({expectedUserId:f.users[who].id,requestId:randomUUID(),...body})}:{})}),f.env,f.users[who]);const value=await response.json();assert.ok(response.ok,JSON.stringify(value));return value;}
 const {id}=await api('teacher','',{action:'create',template:'venn-diagram',title:'Compare Opal and Gloria',background:'linen'});
 let board=(await api('teacher','/'+id)).board;
 await api('teacher','/'+id,{action:'settings',...board,published:true,open:true,sectionLabels:{s1:'Opal',s2:'Both',s3:'Gloria'},settingsVersion:board.settingsVersion});
 for(const [stage,title,text]of [['s1','New in town','Opal is adjusting to a new place.'],['s1','Misses her mother','Opal has questions about her family.'],['s2','Feel lonely','Both characters know what loneliness feels like.'],['s3','Shares her stories','Gloria shares experiences from her past.']])await api('student','/'+id,{action:'post',stage,title,text});
 const server=http.createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname),file=path.resolve('dist','.'+pathname);if(!file.startsWith(path.resolve('dist')+path.sep))throw Error('Path');const data=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(data);}catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROME_CHANNEL?{channel:process.env.PLAYWRIGHT_CHROME_CHANNEL}:{})}),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.setDefaultTimeout(8000);page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/api/**',async route=>{const request=route.request(),url=new URL(request.url()),response=await handleClassBoards(new Request(origin+url.pathname+url.search,{method:request.method(),headers:{...Object.fromEntries(Object.entries(request.headers()).filter(([k])=>!['origin','host','content-length'].includes(k.toLowerCase()))),Origin:origin},...(request.method()==='POST'?{body:request.postDataBuffer()}:{})}),f.env,f.users.student);await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});});
 try{
  await page.goto('http://127.0.0.1:'+server.address().port+'/board-embed.html?'+new URLSearchParams({classId:f.classId,boardId:id}));await page.locator('.venn-category').first().waitFor();
  assert.equal(await page.locator('[data-add-board-post]').isVisible(),false);
  assert.deepEqual(await page.locator('.venn-category h3').allTextContents(),['Opal','Both','Gloria']);
  const circle=await page.locator('.venn-circles').boundingBox();for(const header of await page.locator('.venn-category').all()){const box=await header.boundingBox();assert.ok(box.y+box.height<=circle.y,'Category heading and add button sit outside circles');assert.ok((await header.locator('button').boundingBox()).height>=44);}
  const card=page.locator('[data-post-card]').filter({has:page.getByRole('heading',{name:'New in town',exact:true})});
  assert.equal(await card.locator('.story-event-tools').count(),0);assert.equal(await card.locator('[data-expand-response]').isVisible(),false);assert.ok((await card.boundingBox()).height<220,'Short responses stay compact');
  await card.locator('summary').click();await card.locator('[data-expand-response]').click();await page.locator('.story-response-dialog[open]').waitFor();assert.match(await page.locator('[data-response-detail]').innerText(),/adjusting to a new place/);await page.locator('.story-dialog-close').click();
  await card.locator('[data-move-stage]').selectOption('s2');await page.locator('.venn-region-1 [data-post-card]').filter({hasText:'New in town'}).waitFor();assert.equal((await api('student','/'+id)).board.posts.find(p=>p.title==='New in town').stage,'s2');
  const moved=page.locator('.venn-region-1 [data-post-card]').filter({hasText:'New in town'});await moved.locator('summary').click();await moved.locator('[data-move-order=up]').click();await page.waitForFunction(()=>document.querySelector('.venn-region-1 [data-post-card] h3').textContent==='New in town');
  await page.getByRole('button',{name:'Add response to Gloria',exact:true}).click();assert.equal(await page.locator('[data-board-composer] [name=stage]').inputValue(),'s3');await page.locator('[data-board-composer] [name=text]').fill('Gloria helps Opal look beyond appearances.');await page.locator('[data-post-submit]').click();await page.locator('.board-compose-dialog').waitFor({state:'hidden'});await page.locator('.venn-region-2 [data-post-card]').filter({hasText:'Gloria helps Opal'}).waitFor();
  await page.screenshot({path:'/tmp/inkwire-venn-compact-light.png',fullPage:true});
  await page.setViewportSize({width:1024,height:768});await page.evaluate(()=>document.documentElement.dataset.lmsTheme='dark');await page.screenshot({path:'/tmp/inkwire-venn-compact-ipad-dark.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const before=(await api('teacher','/'+id)).board;await api('teacher','/'+id,{action:'settings',...before,open:false,settingsVersion:before.settingsVersion});await page.reload();await page.locator('.venn-category').first().waitFor();assert.equal(await page.locator('[data-add-stage]').count(),0);const closed=page.locator('[data-post-card],[data-snapshot-card]').first();await closed.locator('summary').click();assert.equal(await closed.locator('[data-move-stage]').count(),0);assert.equal(await closed.locator('[data-edit-post]').count(),0);await closed.locator('[data-expand-response]').click();await page.locator('.story-response-dialog[open]').waitFor();
  assert.deepEqual(errors,[]);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));f.db.close();}
});
