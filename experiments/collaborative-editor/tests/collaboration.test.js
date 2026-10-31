import test from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';
const ownerKey = process.env.TEST_OWNER_KEY || 'local-development-test';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn) { for(let i=0;i<100;i++){ if(fn())return; await sleep(50); } throw Error('Timed out waiting for sync'); }
async function client(id,key) {
 const doc = new Y.Doc(); const ws = new WebSocket(base.replace(/^http/,'ws')+`/api/documents/${id}/connect`,['folio',key]); ws.binaryType='arraybuffer'; let ready=false, saved=0;
 ws.addEventListener('message',e=>{ if(typeof e.data !== 'string')Y.applyUpdate(doc,new Uint8Array(e.data),'remote'); else {const m=JSON.parse(e.data); if(m.type==='ready')ready=true;if(m.type==='saved')saved++;} });
 await until(()=>ready); doc.on('update',(u,o)=>{if(o!=='remote' && ws.readyState===1)ws.send(u)});
 return {doc,ws,get saved(){return saved}};
}
test('authorized creation, simultaneous merge, reconnect, persistence and isolation',async()=>{
 const unauthorized = await fetch(base+'/api/documents',{method:'POST'}); assert.equal(unauthorized.status,401);
 const response=await fetch(base+'/api/documents',{method:'POST',headers:{Authorization:`Bearer ${ownerKey}`}}); assert.equal(response.status,201);
 const {id,key}=await response.json(); const a=await client(id,key); const b=await client(id,key);
 try {
 a.doc.getText('test').insert(0,'Alpha'); b.doc.getText('test').insert(0,'Beta');
 await until(()=>a.doc.getText('test').toString().length===9 && b.doc.getText('test').toString().length===9);
 assert.equal(a.doc.getText('test').toString(),b.doc.getText('test').toString());
 a.doc.getMap('metadata').set('title','Collaborative test'); await until(()=>b.doc.getMap('metadata').get('title')==='Collaborative test');
 const c=await client(id,key); assert.equal(c.doc.getText('test').toString(),a.doc.getText('test').toString()); assert.equal(c.doc.getMap('metadata').get('title'),'Collaborative test'); c.ws.close();c.doc.destroy();
 b.ws.close(); await sleep(100); b.doc.getText('test').insert(0,'Offline ');
 const d=await client(id,key); d.ws.send(Y.encodeStateAsUpdate(b.doc)); await until(()=>a.doc.getText('test').toString().includes('Offline ')); d.ws.close(); d.doc.destroy();
 const denied=await fetch(base+`/api/documents/${id}/connect`,{headers:{'Sec-WebSocket-Protocol':'folio,'+'0'.repeat(64)}}); assert.equal(denied.status,403);
 const other=await fetch(base+'/api/documents',{method:'POST',headers:{Authorization:`Bearer ${ownerKey}`}});const room2=await other.json(); const isolated=await client(room2.id,room2.key); assert.equal(isolated.doc.getText('test').length,0);isolated.ws.close();isolated.doc.destroy();
 } finally {a.ws.close();b.ws.close();a.doc.destroy();b.doc.destroy();}
});
