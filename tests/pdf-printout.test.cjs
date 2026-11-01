const {test}=require('node:test');
const assert=require('node:assert/strict');
const file=(extra={})=>({name:'Lesson.pdf',type:'application/pdf',size:42,arrayBuffer:async()=>new Uint8Array([37,80,68,70]).buffer,...extra});
test('printout import rejects missing, wrong-format and oversize files before reading them',async()=>{
 const {validatePrintout}=await import('../src/pdf-printout.mjs');
 for(const f of [null,file({size:0}),file({name:'notes.docx',type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}),file({size:10*1024*1024+1})])assert.throws(()=>validatePrintout(f));
 assert.doesNotThrow(()=>validatePrintout(file({name:'LESSON.PDF',type:''})));
});
test('PDF inspection reads all page sizes, enforces limits and releases parser resources on success and error',async()=>{
 const {inspectPrintout}=await import('../src/pdf-printout.mjs');let destroyed=0;
 const engine=(numPages,width=612)=>({getDocument(options){assert.ok(options.data instanceof Uint8Array);assert.equal(options.isEvalSupported,false);return {promise:Promise.resolve({numPages,getPage:async()=>({getViewport:()=>({width,height:792})})}),destroy:async()=>{destroyed++;}};}});
 assert.deepEqual(await inspectPrintout(file(),engine(2)),[{width:612,height:792},{width:612,height:792}]);
 await assert.rejects(()=>inspectPrintout(file(),engine(61)),/60 pages/);
 await assert.rejects(()=>inspectPrintout(file(),engine(1,3000)),/paper sizes/);assert.equal(destroyed,3);
});
