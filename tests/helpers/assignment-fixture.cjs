const {fixture:base,origin}=require('./notebook-fixture.cjs');
async function fixture(){
 const f=await base(),objects=new Map();let etag=0;
 f.env.WORKSHEETS={async get(key){const row=objects.get(key);return row?{etag:row.etag,body:new Blob([row.bytes]).stream(),async arrayBuffer(){return row.bytes.buffer.slice(row.bytes.byteOffset,row.bytes.byteOffset+row.bytes.byteLength);}}:null;},async put(key,value,options={}){const old=objects.get(key),condition=options.onlyIf;if(condition?.etagMatches&&old?.etag!==condition.etagMatches||condition?.etagDoesNotMatch==='*'&&old)return null;const bytes=typeof value==='string'?new TextEncoder().encode(value):new Uint8Array(value);const row={bytes,etag:String(++etag)};objects.set(key,row);return {etag:row.etag};}};
 const {handleAssignments}=await import('../../cloudflare/assignments.mjs');
 const readJSON=async(request,max)=>{const content=await request.text();if(content.length>max)throw Object.assign(Error('Too large'),{status:413});try{return JSON.parse(content);}catch{throw Object.assign(Error('Invalid JSON'),{status:400});}};
 f.assignment=(who,path='',body,headers={})=>handleAssignments(new Request(origin+'/api/assignments'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})}),f.env,f.users[who],{readJSON});
 f.objects=objects;return f;
}
module.exports={fixture,origin};
