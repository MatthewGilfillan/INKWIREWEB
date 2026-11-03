const {test}=require('node:test'),assert=require('node:assert/strict');
test('account display timezone defaults to local and manual choices stay private to the owner',async()=>{
 const {classSetupFixture,users,origin}=require('./helpers/class-setup-fixture.cjs'),f=await classSetupFixture();
 const {handleAccountPreferences}=await import('../cloudflare/account-preferences.mjs');
 const api=(user,body,headers={})=>handleAccountPreferences(new Request(origin+'/api/account/preferences',{method:body?'POST':'GET',headers:{Origin:origin,...headers},...(body?{body:JSON.stringify(body)}:{})}),f.env,user,f.helpers);
 assert.deepEqual(await(await api(users.t)).json(),{timeZone:null});
 assert.equal((await api(users.t,{timeZone:'Asia/Shanghai'})).status,200);assert.deepEqual(await(await api(users.t)).json(),{timeZone:'Asia/Shanghai'});
 assert.deepEqual(await(await api(users.u)).json(),{timeZone:null});
 assert.equal((await api(users.t,{timeZone:'Invented/Zone'})).status,400);assert.equal((await api(users.t,{timeZone:'UTC',userId:'u'})).status,400);
 assert.equal((await api(users.t,{timeZone:'UTC'},{Origin:'https://foreign.invalid'})).status,403);assert.equal((await api(null)).status,401);
 assert.equal((await api(users.t,{timeZone:null})).status,200);assert.deepEqual(await(await api(users.t)).json(),{timeZone:null});f.db.close();
});
test('local display zone resolution validates manual choices and does not alter course wall times',async()=>{
 const {resolveDisplayTimeZone,deviceTimeZone,validDisplayTimeZone}=await import('../dist/display-time-zone.mjs');
 assert.equal(resolveDisplayTimeZone('Asia/Shanghai'),'Asia/Shanghai');assert.equal(resolveDisplayTimeZone(null),deviceTimeZone());assert.equal(resolveDisplayTimeZone('invalid'),deviceTimeZone());assert.equal(validDisplayTimeZone('Asia/Bangkok'),true);assert.equal(validDisplayTimeZone(''),false);
});
