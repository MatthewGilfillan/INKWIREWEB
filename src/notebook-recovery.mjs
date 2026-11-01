import * as Y from 'yjs';
const open=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('inkwire-notebook-recovery-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('drafts');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
export async function recoverDraft(key,bytes) {
  const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('drafts',bytes?'readwrite':'readonly'),store=tx.objectStore('drafts'),r=store.get(key);let result;r.onsuccess=()=>{try{result=bytes?(r.result?Y.mergeUpdates([new Uint8Array(r.result),bytes]):bytes):r.result;if(bytes)store.put(result,key);}catch(e){tx.abort();reject(e);}};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);});}finally{db.close();}
}
