import './notebook-editor.js';
import * as Y from 'yjs';
import {recoverDraft} from './notebook-recovery.mjs';
const p=new URLSearchParams(location.search),cid=p.get('classId'),aid=p.get('assignmentId'),lid=p.get('learnerId'),pid=p.get('pageId'),attempt=p.get('attempt'),work=p.get('mode')==='work';
const base='/api/assignments/classes/'+cid+'/'+aid,endpoint=work?base+'/work/pages/'+pid+'?'+new URLSearchParams({learnerId:lid}):base+'/submissions/'+lid+'/'+attempt+'/pages/'+pid;
const status=document.querySelector('#assignment-page-status'),title=document.querySelector('#assignment-page-title'),body=document.querySelector('#note-body'),toolbar=document.querySelector('#note-toolbar');
let doc,userId='',dirty=0,saved=0,version=0,editable=false,timer,busy=null,draftKey='',persist=Promise.resolve(),stopped=false;
const encode=bytes=>{let value='';for(let i=0;i<bytes.length;i+=8192)value+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(value);};
const decode=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
const post=data=>parent.postMessage(data,location.origin);
async function api(url,body){const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)}),result=await r.json();if(!r.ok)throw Error(result.message||'The notebook page could not be saved.');if(userId&&result.userId!==userId){stopped=true;window.InkWireEditor.setEditable(false);throw Error('Your account changed. Reload this page.');}userId=result.userId;return result;}
function problem(err){status.textContent=err.message;status.dataset.error='true';post({type:'assignment:error',message:err.message});}
async function clearRecovery(){const db=await new Promise((resolve,reject)=>{const req=indexedDB.open('inkwire-notebook-recovery-v1',1);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});try{await new Promise((resolve,reject)=>{const tx=db.transaction('drafts','readwrite');tx.objectStore('drafts').delete(draftKey);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
async function flush(){
 clearTimeout(timer);if(busy)await busy;if(!editable||dirty===saved)return;if(stopped)throw Error('Reload this page before saving.');
 const generation=dirty;busy=(async()=>{await persist;status.textContent='Saving…';const result=await api(endpoint,{update:encode(Y.encodeStateAsUpdate(doc)),expectedUserId:userId});Y.applyUpdate(doc,decode(result.syncState),'remote');saved=generation;version=result.version;status.textContent=dirty===saved?'Saved':'Saving…';status.dataset.error='false';if(saved===dirty)await clearRecovery();})();try{await busy;}finally{busy=null;}if(dirty!==saved)await flush();
}
window.addEventListener('message',async event=>{if(event.origin!==location.origin||event.source!==parent||event.data?.type!=='assignment:flush')return;try{await flush();post({type:'assignment:flushed',id:event.data.id,ok:true,version});}catch(err){problem(err);post({type:'assignment:flushed',id:event.data.id,ok:false,message:err.message});}});
window.addEventListener('beforeunload',event=>{if(dirty!==saved){event.preventDefault();event.returnValue='';}});
window.addEventListener('pagehide',()=>{clearTimeout(timer);});
try{
 const result=await api(endpoint);if(!result.page?.syncState)throw Error('This is a PDF worksheet. Open it in Notebooks to work on it; it can still be selected when submitting.');
 title.textContent=result.page.title;version=result.page.version;editable=p.get('readOnly')!=='1'&&(work?result.readOnly!==true:result.editable);doc=new Y.Doc();Y.applyUpdate(doc,decode(result.page.syncState),'remote');
 draftKey=['assignment-page',userId,cid,aid,lid,attempt||'work',pid].join(':');const recovery=editable?await recoverDraft(draftKey):null;if(recovery){Y.applyUpdate(doc,recovery,'recovery');dirty++;}
 const pdfTasks=new Map();const assetUrl=(id,pdf)=>work?`/api/notebooks/${cid}/${lid}/pages/${pid}/${pdf?'pdfs':'assets'}/${id}`:base+`/submissions/${lid}/${attempt}/pages/${pid}/assets/${id}`;
 async function bytes(id,pdf){const response=await fetch(assetUrl(id,pdf),{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw Error('This file could not be loaded.');return response;}
 const loadPdf=id=>{if(!pdfTasks.has(id))pdfTasks.set(id,(async()=>{const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc='/pdf/pdf.worker.min.mjs';return pdfjs.getDocument({data:new Uint8Array(await(await bytes(id,true)).arrayBuffer()),isEvalSupported:false,cMapUrl:'/pdf/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdf/standard_fonts/',wasmUrl:'/pdf/wasm/'}).promise;})());return pdfTasks.get(id);};
 doc.on('update',(_,origin)=>{if(origin==='remote'||!editable)return;dirty++;const update=Y.encodeStateAsUpdate(doc);persist=persist.catch(()=>{}).then(()=>recoverDraft(draftKey,update));status.textContent='Saving…';clearTimeout(timer);timer=setTimeout(()=>flush().catch(problem),500);});
 window.InkWireEditor.mount({element:body,toolbar,label:result.page.title,ydoc:doc,readOnly:!editable,loadPdf,loadAsset:async id=>(await bytes(id,false)).blob(),onChange:()=>{},onRecovery:()=>problem(Error('Some page formatting could not be displayed.'))});
 toolbar.querySelector('[aria-label="Hide formatting options"]')?.click();toolbar.hidden=!editable;document.querySelector('#assignment-page-retry').hidden=!editable;status.textContent=editable?'Saved':'Read only';post({type:'assignment:ready',version});if(dirty)flush().catch(problem);
 document.querySelector('#assignment-page-retry').onclick=()=>flush().catch(problem);
}catch(err){problem(err);body.textContent=err.message;}
