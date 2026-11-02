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
test('rich text fonts, size, colors and highlight survive the shared document merge and unsafe styles are rejected',async()=>{
 const {seedState,mergeState,encodeState}=await import('../src/notebook-sync.mjs');
 const attrs={fontFamily:'Calibri',fontSize:'20pt',color:'#2244aa',backgroundColor:'#fff176'};
 const doc={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Teacher feedback',marks:[{type:'textStyle',attrs},{type:'bold'},{type:'underline'}]}]}]};
 const state=seedState(doc);const merged=mergeState(state,encodeState(state));assert.deepEqual(merged.document.content[0].content[0].marks.find(m=>m.type==='textStyle').attrs,attrs);
 const {cleanTextStyle}=await import('../src/text-format.mjs');assert.deepEqual(cleanTextStyle({fontSize:'24px',color:'rgb(255, 0, 0)'}),{fontSize:'18pt',color:'#ff0000'});
 for(const attr of [{fontFamily:'url(https://evil.invalid)'},{fontSize:'200pt'},{backgroundColor:'url(javascript:bad)'},{onclick:'bad'}])assert.throws(()=>cleanTextStyle(attr));
});
test('free-positioned text containers retain geometry, rich text and concurrent contents in shared storage',async()=>{
 const {seedState,mergeState,encodeState}=await import('../src/notebook-sync.mjs');const {cleanFrame}=await import('../src/text-frame.mjs');
 const attrs={x:80,y:160,width:420,height:240};const doc={type:'doc',content:[{type:'textFrame',attrs,content:[{type:'paragraph',content:[{type:'text',text:'Movable feedback',marks:[{type:'textStyle',attrs:{fontFamily:'Calibri',fontSize:'20pt'}}]}]}]}]};
 const bytes=seedState(doc),result=mergeState(bytes,encodeState(bytes));assert.deepEqual(result.document.content[0].attrs,attrs);assert.equal(result.document.content[0].content[0].content[0].text,'Movable feedback');
 for(const bad of [{x:-1},{width:20},{height:Infinity},{onload:'bad'}])assert.throws(()=>cleanFrame(bad));
});
test('inline PDF geometry, background state and ink survive synchronized storage while unsafe payloads are rejected',async()=>{
 const {printoutNodes,cleanPrintout}=await import('../src/printout-node.mjs'),{cleanStroke}=await import('../src/ink-stroke.mjs');
 const {seedState,mergeState,encodeState}=await import('../src/notebook-sync.mjs');
 const pages=printoutNodes('00000000-0000-4000-8000-000000000001',[{width:612,height:792},{width:595,height:842}]);
 assert.equal(pages[1].attrs.y,840);assert.equal(pages[0].attrs.background,true);
 pages[0].attrs.width=306;pages[0].attrs.height=396;pages[0].attrs.background=false;
 const ink={type:'inkStroke',attrs:{points:[[100,200],[110,205]],size:2,color:'#123456',highlight:false}};
 const document={type:'doc',content:[...pages,ink,{type:'paragraph',attrs:{inkFrame:{x:100,y:200,width:340,height:30}},content:[{type:'text',text:'Student answer'}]}]};
 const state=seedState(document),merged=mergeState(state,encodeState(state));assert.deepEqual(merged.document,document);
 for(const a of [{...pages[0].attrs,assetId:'https://evil.invalid/a.pdf'},{...pages[0].attrs,page:60},{...pages[0].attrs,width:-1},{...pages[0].attrs,src:'javascript:bad'}])assert.throws(()=>cleanPrintout(a));
 for(const a of [{...ink.attrs,points:[[0,0],[Infinity,0]]},{...ink.attrs,color:'url(bad)'},{...ink.attrs,size:100}])assert.throws(()=>cleanStroke(a));
});
