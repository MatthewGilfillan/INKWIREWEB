const {test}=require('node:test'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const {profileFixture,users,origin}=require('../helpers/profile-fixture.cjs');
test('avatar builder, creature choices, reload, private photo crop, retry and mobile under strict CSP',async()=>{
 const f=await profileFixture(),errors=[];let rejectSave=false,saveCount=0;
 const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROME_CHANNEL?{channel:process.env.PLAYWRIGHT_CHROME_CHANNEL}:{})});
 const page=await browser.newPage({viewport:{width:1360,height:1100}});page.setDefaultTimeout(12000);page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/profile.html',async route=>{const response=await route.fetch();await route.fulfill({response,headers:{...response.headers(),'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}});});
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  if(path==='/api/account')return route.fulfill({json:{role:'student',email:'test@example.invalid'}});
  if(path.startsWith('/api/profiles/')){
   if(req.method()==='POST'){saveCount++;if(rejectSave)return route.fulfill({status:503,json:{message:'Please try again.'}});}
   const result=await f.request(users.sa,req.method()==='POST'?req.postDataJSON():undefined,path);
   return route.fulfill({status:result.status,headers:Object.fromEntries(result.headers),body:Buffer.from(await result.arrayBuffer())});
  }
  return route.fulfill({status:404,json:{message:'Not found'}});
 });
 try{
  await page.goto('http://127.0.0.1:8788/profile.html');await page.locator('#profile-workspace').waitFor({state:'visible'});
  assert.equal(saveCount,0);await page.getByRole('button',{name:'Girl',exact:true}).click();assert.match(await page.locator('#profile-preview').innerHTML(),/<svg/);
  await page.getByRole('button',{name:'Bookworm',exact:true}).click();await page.getByRole('button',{name:'Extras',exact:true}).click();await page.getByRole('button',{name:'Round glasses',exact:true}).click();
  await page.getByRole('button',{name:'Smiles',exact:true}).click();await page.getByRole('button',{name:'Big grin',exact:true}).click();await page.getByRole('button',{name:'Background: Lavender',exact:true}).click();
  await page.screenshot({path:'/tmp/inkwire-profile-worm.png',fullPage:true});
  rejectSave=true;await page.getByRole('button',{name:'Save picture',exact:true}).click();await page.getByText('Please try again.',{exact:true}).waitFor();assert.equal((await(await f.request()).json()).revision,0);
  rejectSave=false;await page.getByRole('button',{name:'Save picture',exact:true}).click();await page.getByText('Picture saved. It’s ready for your classroom.',{exact:true}).waitFor();
  const saved=await(await f.request()).json();assert.equal(saved.avatar.head,'worm');assert.equal(saved.avatar.accessory,'round-glasses');assert.equal(saved.avatar.mouth,'grin');
  await page.reload();await page.locator('[data-head="worm"][aria-pressed="true"]').waitFor();
  for(const head of ['bear','cat','rabbit','robot','person']){await page.locator(`[data-head="${head}"]`).click();assert.equal(await page.locator('#profile-preview svg').count(),1);}
  await page.locator('[data-head="bear"]').click();await page.getByRole('button',{name:'Eyes',exact:true}).click();await page.getByRole('button',{name:'Wink',exact:true}).click();
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/inkwire-profile-mobile.png',fullPage:true});
  await page.getByRole('button',{name:'Save picture',exact:true}).click();await page.getByText('Picture saved. It’s ready for your classroom.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Upload a photo',exact:true}).click();
  const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=900;c.height=600;const x=c.getContext('2d');x.fillStyle='#efb9c5';x.fillRect(0,0,900,600);x.fillStyle='#1b4a60';x.fillRect(300,100,300,400);return c.toDataURL('image/png').split(',')[1];});
  await page.locator('#profile-photo').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.locator('#photo-crop-controls').waitFor({state:'visible'});
  await page.locator('#photo-zoom').focus();await page.keyboard.press('End');await page.locator('#photo-x').focus();await page.keyboard.press('Home');assert.equal(await page.locator('#profile-preview canvas').count(),1);
  await page.getByRole('button',{name:'Save picture',exact:true}).click();await page.getByText('Picture saved. It’s ready for your classroom.',{exact:true}).waitFor();
  const image=await f.request(users.sa,undefined,'/api/profiles/me/image');assert.equal(image.headers.get('Content-Type'),'image/jpeg');const imageBytes=Buffer.from(await image.arrayBuffer());assert.ok(imageBytes.length>1000&&imageBytes.length<204800);assert.equal((await(await f.request()).json()).kind,'photo');
  await page.reload();await page.getByAltText('Your saved profile photo').waitFor();assert.equal(await page.locator('#profile-preview img').evaluate(img=>img.complete&&img.naturalWidth===512),true);
  await page.getByRole('button',{name:'Use default picture',exact:true}).click();await page.getByRole('button',{name:'Save picture',exact:true}).click();await page.getByText('Picture saved. It’s ready for your classroom.',{exact:true}).waitFor();assert.equal((await(await f.request()).json()).kind,'none');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();f.db.close();}
});
