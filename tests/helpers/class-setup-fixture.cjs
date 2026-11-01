const {fixture,users,cid,origin}=require('./quiz-fixture.cjs');
async function classSetupFixture(){
  const f=await fixture(),objects=new Map();
  f.env.DB.batch=async statements=>{f.db.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());f.db.exec('COMMIT');return result;}catch(e){f.db.exec('ROLLBACK');throw e;}};
  f.env.WORKSHEETS={async put(key,value){objects.set(key,Buffer.from(value));},async get(key){const value=objects.get(key);return value?{body:value,arrayBuffer:async()=>value.buffer.slice(value.byteOffset,value.byteOffset+value.byteLength)}:null;},async delete(key){objects.delete(key);}};
  const {handleClasses}=await import('../../cloudflare/classes.mjs'),{handleClassFiles}=await import('../../cloudflare/class-files.mjs');
  const request=(path,body,user=users.t,headers={})=>{
    const multipart=body instanceof FormData;
    return (path.startsWith('/api/class-files/')?handleClassFiles:handleClasses)(new Request(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,...(!multipart?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:multipart?body:JSON.stringify(body)}:{})}),f.env,user,f.helpers);
  };
  const files=(body,user=users.t,headers={})=>request('/api/class-files/classes/'+cid,body,user,headers);
  const upload=(name='Lesson notes.txt',ai=false,students=false)=>{const body=new FormData();body.append('file',new Blob(['Original teaching notes.'],{type:'text/plain'}),name);body.append('kind','resource');body.append('aiEnabled',String(ai));body.append('studentDownload',String(students));return body;};
  return {...f,objects,api:request,files,upload};
}
module.exports={classSetupFixture,users,cid,origin};
