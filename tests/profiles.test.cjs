const {test}=require('node:test'),assert=require('node:assert/strict');
const {profileFixture,users}=require('./helpers/profile-fixture.cjs');
test('avatars persist per account, retain choices, and only related teachers and parents can see a learner picture',async()=>{
 const f=await profileFixture(),{avatarPreset}=await import('../dist/avatar-model.mjs');
 try{
  assert.equal((await f.request(null)).status,401);
  assert.equal((await f.request({...users.sa,emailVerified:false})).status,401);
  assert.deepEqual(await(await f.request()).json(),{kind:'none',avatar:null,revision:0});
  const avatar={...avatarPreset('worm'),accessory:'round-glasses',mouth:'grin'};
  assert.equal((await f.request(users.sa,{kind:'avatar',avatar,revision:0,userId:'sb'})).status,200);
  assert.deepEqual((await(await f.request()).json()).avatar,avatar);
  assert.equal((await(await f.request(users.sb)).json()).kind,'none');
  const path='/api/profiles/learners/a/image';
  for(const u of [users.sa,users.pa,users.t]){const r=await f.request(u,undefined,path);assert.equal(r.status,200);assert.equal(r.headers.get('Content-Type'),'image/svg+xml');assert.match(r.headers.get('Cache-Control'),/no-store/);assert.match(await r.text(),/Cartoon avatar/);}
  for(const u of [users.sb,users.u])assert.equal((await f.request(u,undefined,path)).status,404);
  assert.equal((await f.request(users.pa,undefined,'/api/profiles/learners/b/image')).status,404);
  assert.equal((await f.request(users.t,undefined,'/api/profiles/me/other/image')).status,404);
  f.db.prepare('DELETE FROM learner_parents').run();assert.equal((await f.request(users.pa,undefined,path)).status,404);
  f.db.prepare('UPDATE classes SET deleted_at=1').run();assert.equal((await f.request(users.t,undefined,path)).status,404);
 }finally{f.db.close();}
});
test('profile saving checks origin, allow-listed parts, revision conflicts, and safely returns to default',async()=>{
 const f=await profileFixture(),{defaultAvatar}=await import('../dist/avatar-model.mjs');const body={kind:'avatar',avatar:defaultAvatar,revision:0};
 try{
  assert.equal((await f.request(users.sa,body,undefined,{Origin:'https://other.invalid'})).status,403);
  assert.equal((await f.request(users.sa,body,undefined,{'Sec-Fetch-Site':'cross-site'})).status,403);
  assert.equal((await f.request(users.sa,{...body,avatar:{...defaultAvatar,eyes:'<script>alert(1)</script>'}})).status,400);
  assert.equal((await f.request(users.sa,{...body,avatar:{...defaultAvatar,extra:'value'}})).status,400);
  assert.equal((await f.request(users.sa,{...body,revision:4})).status,409);
  assert.equal((await f.request(users.sa,body)).status,200);
  assert.equal((await f.request(users.sa,body)).status,409);
  assert.equal((await f.request(users.sa,{kind:'none',revision:1})).status,200);
  assert.deepEqual(await(await f.request()).json(),{kind:'none',avatar:null,revision:2});
  assert.equal((await f.request(users.sa,{...body,revision:1})).status,409);
  assert.ok(!(await(await f.request(users.sa,undefined,'/api/profiles/me/image')).text()).includes('Cartoon avatar'));
 }finally{f.db.close();}
});
test('JPEG validation removes location metadata and rejects active content, oversized dimensions and trailing data',async()=>{
 const {cleanProfileJPEG}=await import('../cloudflare/profiles.mjs');
 const bytes=Buffer.from([255,216,255,225,0,6,71,80,83,33,255,192,0,11,8,2,0,2,0,1,1,17,0,255,218,0,8,1,1,0,0,63,0,12,255,0,34,255,217]);
 const cleaned=cleanProfileJPEG(bytes.toString('base64'));assert.equal(Buffer.from(cleaned).includes(Buffer.from('GPS!')),false);
 for(const bad of [Buffer.from('<svg onload="alert(1)"/>'),Buffer.concat([bytes,Buffer.from('extra')]),bytes.subarray(0,-1),Buffer.alloc(204801,1)])assert.throws(()=>cleanProfileJPEG(bad.toString('base64')));
 const giant=Buffer.from(bytes);giant[15]=255;assert.throws(()=>cleanProfileJPEG(giant.toString('base64')));
 const f=await profileFixture();try{assert.equal((await f.request(users.sa,{kind:'photo',photo:Buffer.from('<svg/>').toString('base64'),revision:0})).status,400);assert.equal((await(await f.request()).json()).revision,0);}finally{f.db.close();}
});
test('all avatar character and feature combinations render without scripts or outside assets',async()=>{
 const {choices,defaultAvatar,avatarSVG,randomAvatar,validAvatar}=await import('../dist/avatar-model.mjs');
 for(const head of choices.head)for(const [key,values]of Object.entries(choices))for(const v of values){const avatar={...defaultAvatar,head,[key]:v},svg=avatarSVG(avatar);assert.ok(validAvatar(avatar));assert.ok(svg.startsWith('<svg'));assert.ok(!/script|href=|url\(|foreignObject|onload/i.test(svg));}
 for(let i=0;i<100;i++)assert.ok(validAvatar(randomAvatar()));
 assert.ok(!avatarSVG({...defaultAvatar,background:'"><script/>'}).includes('<script'));
});
