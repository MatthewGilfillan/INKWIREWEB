import {catalogPages,emptyDocument,notebookKey,PRINT_SECTION} from './notebook-model.mjs';
import {seedState,encodeState,mergeState} from './notebook-sync.mjs';
const SAMPLE='00000000-0000-4000-8000-000000000001';
const classes=[{id:'10000000-0000-4000-8000-000000000001',name:'Literature & the World'},{id:'10000000-0000-4000-8000-000000000002',name:'Creative Writing'}];
const students=[{id:'20000000-0000-4000-8000-000000000001',name:'Alex Lee'},{id:'20000000-0000-4000-8000-000000000002',name:'Jamie Chen'},{id:'20000000-0000-4000-8000-000000000003',name:'Sam Rivera'}];
const open=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('inkwire-notebooks-practice-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('items');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function transaction(key,change) {const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('items',change?'readwrite':'readonly'),store=tx.objectStore('items'),r=store.get(key);let value,problem;r.onsuccess=()=>{try{value=change?change(r.result):r.result;if(change)store.put(value,key);}catch(e){problem=e;tx.abort();}};tx.oncomplete=()=>resolve(structuredClone(value));tx.onabort=()=>reject(problem||tx.error);tx.onerror=()=>reject(tx.error);});}finally{db.close();}}
function sampleDocument(name,title,className) {return {type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:title}]},{type:'paragraph',content:[{type:'text',text:`${name} · ${className}`}]},{type:'heading',attrs:{level:3},content:[{type:'text',text:'What we explored'}]},{type:'paragraph',content:[{type:'text',text:'We explored how characters reveal their ideas through their choices. Choose one moment in the reading and explain what it tells us.'}]},{type:'bulletList',content:[{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Find a short quotation that supports your interpretation.'}]}]},{type:'listItem',content:[{type:'paragraph',content:[{type:'text',text:'Explain why that evidence matters.'}]}]}]},{type:'heading',attrs:{level:3},content:[{type:'text',text:'Teacher feedback'}]},{type:'paragraph',content:[{type:'text',marks:[{type:'bold'}],text:'A thoughtful start. '},{type:'text',text:'Develop your explanation with one specific detail from the text. You can paste your feedback here and keep the headings and lists.'}]}]};}
export async function previewAdapter(role='teacher') {
  if(!['teacher','student','parent'].includes(role))role='teacher';
  const notebooks=classes.flatMap((c,i)=>students.slice(0,i?2:3).map(s=>({id:notebookKey(c.id,s.id),classId:c.id,className:c.name,learnerId:s.id,learnerName:s.name,title:s.name})));
  for(const book of notebooks)await transaction(book.id,old=>{
    if(old)return old;const pages=['Class summary','Vocabulary & ideas'].map((title,i)=>{const document=sampleDocument(book.learnerName,title,book.className);return {id:`30000000-0000-4000-8000-00000000000${i+1}`,title,sectionId:'classwork',kind:'note',document,syncState:encodeState(seedState(document)),version:1,updatedAt:Date.now()};});
    return {sections:[{id:PRINT_SECTION,title:'PDF printouts'},{id:'classwork',title:'Classwork'},{id:'feedback',title:'Feedback & next steps'}],pages};
  });
  const allowed=book=>role==='teacher'||book.learnerId===students[0].id;
  function check(id,write=false,manage=false){const book=notebooks.find(b=>b.id===id);if(!book||!allowed(book)||write&&role==='parent'||manage&&role!=='teacher')throw Error('This view does not have permission for that action.');return book;}
  return {
    async list(){return {role,classes,notebooks:notebooks.filter(allowed)};},
    async book(id){const b=check(id),data=await transaction(id);const {createPreviewAdapter}=await import('./worksheet-preview-adapter.js');const w=await createPreviewAdapter(role,{classId:b.classId,learnerId:b.learnerId,liveParent:true});const ws=(await w.list()).worksheets;return {...data,pages:catalogPages(ws,data.pages),role,learnerName:b.learnerName};},
    async page(bookId,id){check(bookId);return {page:(await transaction(bookId)).pages.find(p=>p.id===id)};},
    async section(bookId,input){check(bookId,true,true);await transaction(bookId,b=>({...b,sections:[...b.sections,{id:input.id,title:input.title}]}));},
    async create(bookId,input){check(bookId,true,true);await transaction(bookId,b=>({...b,pages:[...b.pages,{...input,kind:'note',document:emptyDocument(),syncState:encodeState(seedState(emptyDocument())),version:1,updatedAt:Date.now()}]}));},
    async save(bookId,id,update){check(bookId,true);let result;await transaction(bookId,b=>{const p=b.pages.find(p=>p.id===id);if(!p)throw Error('Page not found.');const merged=mergeState(Uint8Array.from(atob(p.syncState),c=>c.charCodeAt(0)),update);p.document=merged.document;p.syncState=encodeState(merged.state);p.version++;p.updatedAt=Date.now();result={syncState:p.syncState,version:p.version};return b;});return result;},
    async move(bookId,id,sectionId){check(bookId,true,true);const data=await this.book(bookId),page=data.pages.find(p=>p.id===id);await transaction(bookId,b=>{const existing=b.pages.find(p=>p.id===id);if(existing)existing.sectionId=sectionId;else b.pages.push({...page,sectionId});return b;});},
  };
}
