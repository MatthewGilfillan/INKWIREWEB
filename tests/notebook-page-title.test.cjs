const {test}=require('node:test');
const assert=require('node:assert/strict');
test('title autosaves serialize edits, preserving the latest typing and expected title',async()=>{
 const {pageTitleSession}=await import('../src/notebook-page-title.mjs');const calls=[];let finish;
 const session=pageTitleSession({initial:'Untitled page',save:(value,expected)=>{calls.push([value,expected]);return calls.length===1?new Promise(resolve=>{finish=resolve;}):Promise.resolve();}});
 session.change('My lesson');const saving=session.flush();session.change('My lesson notes');finish();await saving;
 assert.deepEqual(calls,[['My lesson','Untitled page'],['My lesson notes','My lesson']]);assert.equal(session.dirty,false);assert.equal(session.saved,'My lesson notes');session.release();
});
test('an interrupted title save keeps its local draft and retries without overwriting a concurrent title',async()=>{
 const {pageTitleSession,formatPageCreatedAt}=await import('../src/notebook-page-title.mjs');let cached,fail=true;const errors=[];
 const cache={read:()=>cached,write:value=>{cached=value;},clear:()=>{cached=null;}};
 const session=pageTitleSession({initial:'Untitled page',cache,save:async()=>{if(fail)throw Error('Offline');},onError:e=>errors.push(e.message)});
 session.change('Reading notes');await session.flush();assert.equal(session.dirty,true);assert.equal(session.locallySaved,true);assert.deepEqual(cached,{value:'Reading notes',expected:'Untitled page'});
 fail=false;await session.flush();assert.equal(session.dirty,false);assert.equal(cached,null);session.release();assert.deepEqual(errors,['Offline']);
 assert.equal(formatPageCreatedAt(null),'');assert.match(formatPageCreatedAt(Date.UTC(2026,10,5,14)),/2026/);
});
