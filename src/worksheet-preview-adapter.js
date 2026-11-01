// Local practice adapter. Production accounts always use the authenticated API.
const SAMPLE='00000000-0000-4000-8000-000000000001',STUDENT='sample-student';
const open=()=>new Promise((resolve,reject)=>{const request=indexedDB.open('inkwire-worksheet-practice-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('items');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
async function baseRead(key){const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('items','readonly'),r=tx.objectStore('items').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{db.close();}}
async function baseWrite(key,value){const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('items','readwrite');tx.objectStore('items').put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
export async function createPreviewAdapter(requestedRole, context={}){
  const learnerName=({'20000000-0000-4000-8000-000000000001':'Alex Lee','20000000-0000-4000-8000-000000000002':'Jamie Chen','20000000-0000-4000-8000-000000000003':'Sam Rivera'})[context.learnerId]||'Sample learner';
  const student=context.learnerId||STUDENT, suffix=context.classId?':'+context.classId:'', workKey=key=>key+suffix+(key.startsWith('marks:')||key.startsWith('mark:')||key.startsWith('published:')?':'+student:'');
  const read=key=>baseRead(workKey(key)),write=(key,value)=>baseWrite(workKey(key),value);

  const role=['teacher','student','parent'].includes(requestedRole)?requestedRole:'teacher',userId='preview-'+role+(context.learnerId?':'+context.learnerId:'');let currentId=SAMPLE;
  if(!await read('doc:'+SAMPLE))await write('doc:'+SAMPLE,{id:SAMPLE,title:'Reading closely · practice worksheet',pages:[{width:612,height:792},{width:612,height:792}]});
  if(!await read('list'))await write('list',[SAMPLE]);
  return {
    role,
    async list(){const ids=await read('list'),docs=await Promise.all(ids.map(id=>read('doc:'+id)));const worksheets=[];for(const d of docs){const publication=await read('published:'+d.id);if(role!=='parent'||publication||context.liveParent)worksheets.push({...d,pageCount:d.pages.length,publishedAt:publication?.publishedAt});}return {userId,role,className:'Practice classroom',learnerId:role==='teacher'?null:student,learnerName,students:[{id:student,name:learnerName}],worksheets};},
    async metadata(id){currentId=id;const d=await read('doc:'+id);return {...d,userId,role,learnerId:student,learnerName};},
    async pdf(){const file=await read('pdf:'+currentId);return file?new Uint8Array(await file.arrayBuffer()):new Uint8Array(await(await fetch('/assets/worksheet-practice.pdf')).arrayBuffer());},
    async state(){if(role==='parent'&&!context.liveParent){const p=await read('published:'+currentId);return p?{...p,revision:String(p.publishedAt)}:{revision:0,marks:[]};}const ids=await read('marks:'+currentId)||[];return {revision:Date.now(),marks:(await Promise.all(ids.map(id=>read('mark:'+currentId+':'+id)))).filter(Boolean)};},
    async save(input){
      if(role==='parent')throw Object.assign(Error('Read-only copy'),{status:403});
      const db=await open(),doc=currentId;try{return await new Promise((resolve,reject)=>{
        const tx=db.transaction('items','readwrite'),store=tx.objectStore('items'),key=workKey('mark:'+doc+':'+input.id),r=store.get(key);let mark,problem;
        r.onsuccess=()=>{const previous=r.result;if(previous&&previous.ownerId!==userId)problem=Object.assign(Error('You can change only your own annotations.'),{status:403});else if((previous?.version||0)!==input.version)problem=Object.assign(Error('Annotation changed in another tab.'),{status:409});if(problem){tx.abort();return;}
          mark={...input.mark,id:input.id,ownerId:userId,layer:role,version:input.version+1,deleted:input.deleted};store.put(mark,key);const list=store.get(workKey('marks:'+doc));list.onsuccess=()=>{const ids=new Set(list.result||[]);ids.add(input.id);store.put([...ids],workKey('marks:'+doc));};};
        tx.oncomplete=()=>resolve({mark});tx.onabort=()=>reject(problem||tx.error||Error('Could not save practice work'));tx.onerror=()=>reject(tx.error);
      });}finally{db.close();}
    },
    async publish(){if(role!=='teacher')throw Error('Only teachers can share work.');const data=await this.state(),publishedAt=Date.now();await write('published:'+currentId,{...data,publishedAt});return {publishedAt};},
    async upload(file,pages,title,id,displayMode='printout'){await write('pdf:'+id,file);await write('doc:'+id,{id,pages,title,displayMode});const ids=await read('list');if(!ids.includes(id))await write('list',[id,...ids]);return {id};},
  };
}
