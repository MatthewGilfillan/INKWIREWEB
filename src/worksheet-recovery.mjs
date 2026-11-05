const open=()=>new Promise((resolve,reject)=>{const request=indexedDB.open('inkwire-worksheet-recovery-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('drafts');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
export async function worksheetDraft(key,value){
 const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('drafts',value===undefined?'readonly':'readwrite'),store=tx.objectStore('drafts');let request;if(value===undefined)request=store.get(key);else request=value.length?store.put(value,key):store.delete(key);tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Browser saving was interrupted.'));});}finally{db.close();}
}
export function worksheetDraftKey(meta){return JSON.stringify([meta.userId,meta.role,meta.id,meta.learnerId]);}
function content(mark){const {version,ownerId,layer,...data}=mark;const sort=value=>Array.isArray(value)?value.map(sort):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sort(value[key])])):value;return JSON.stringify(sort(data));}
export function planWorksheetRecovery(records,serverMarks,userId,role){
 const restore=[],conflicts=[];for(const record of Array.isArray(records)?records:[]){const mark=record?.mark;if(!mark||mark.ownerId!==userId||mark.layer!==role||!Number.isSafeInteger(record.version)||record.version<0)continue;
 const remote=serverMarks.get(mark.id);if(remote&&content(remote)===content(mark))continue;if(!remote&&record.version===0&&mark.deleted)continue;
 if((remote?.version||0)!==record.version)conflicts.push(mark.id);
 restore.push(record);
 }return {restore,conflicts};
}
