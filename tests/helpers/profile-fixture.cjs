const {fixture,users,origin}=require('./quiz-fixture.cjs');
async function profileFixture(){
 const f=await fixture(),{handleProfile}=await import('../../cloudflare/profiles.mjs');
 const original=f.env.DB;
 f.env.DB={prepare(sql){const stmt=original.prepare(sql),bind=stmt.bind;stmt.bind=function(...args){return bind.apply(this,args.map(v=>v instanceof ArrayBuffer?new Uint8Array(v):v));};return stmt;}};
 const request=(user=users.sa,body,path='/api/profiles/me',headers={})=>handleProfile(new Request(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})}),f.env,user,f.helpers);
 return {...f,request,handleProfile};
}
module.exports={profileFixture,users,origin};
