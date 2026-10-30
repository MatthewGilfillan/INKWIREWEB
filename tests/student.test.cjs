const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ctx=vm.createContext({localStorage:{getItem:()=>null}});
vm.runInContext(fs.readFileSync('dist/student.js','utf8'),ctx);
vm.runInContext(fs.readFileSync('dist/transcript.js','utf8'),ctx);
test('new checklist overrides legacy reading, without crossing learners or lessons',()=>{
 const data={read:true,preparation:{'Alex Lee|1':{reading:false},'Alex Lee|3':{reading:true},'Jamie Chen|2':{reading:true}}};
 assert.equal(ctx.studentPrep(data,1).reading,false);
 assert.equal(ctx.studentPrep(data,2).reading,false);
 assert.equal(ctx.studentPrep(data,3).reading,true);
 assert.equal(ctx.studentPrep({read:true},1).reading,true);
});
test('readiness counts completed tasks; zero quiz score still counts as completion',()=>{
 assert.equal(ctx.studentReadiness({},1).done,0);
 assert.equal(ctx.studentReadiness({},1).total,2);
 assert.equal(ctx.studentReadiness({read:true,quizzes:{'Alex Lee|1':{score:0}}},1).done,2);
 assert.equal(ctx.studentReadiness({read:true,quizzes:{'Alex Lee|1':{score:4}}},2).done,0);
 assert.equal(ctx.studentReadiness({},2).quizAvailable,false);
 assert.equal(ctx.studentReadiness({},2).total,1);
});
test('notebook counts and exports only valid, nonempty pages belonging to this learner',()=>{
 const data={notes:{'Alex Lee|1|Writing':'A thoughtful paragraph.','Alex Lee|2|Discussion':'   ','Alex Lee|25|Writing':'OUTSIDE','Jamie Chen|1|Writing':'OTHER','Alex Lee|2|Private':'PRIVATE','Alex Lee|3|Reflection|bad':'BAD'},assessments:{'Alex Lee|1':{private:'SECRET'}}};
 assert.equal(ctx.studentNoteCount(data),1);
 const out=ctx.studentExport(data,()=>({title:'A lesson'}));
 assert.ok(out.includes('A thoughtful paragraph.'));
 for(const forbidden of ['OUTSIDE','OTHER','PRIVATE','BAD','SECRET'])assert.ok(!out.includes(forbidden));
});
test('empty and whitespace notebook word counts are accurate',()=>{
 assert.equal(ctx.studentWordCount('  \n  '),0);
 assert.equal(ctx.studentWordCount('One\nnew idea.'),3);
});
test('transcript importer accepts text and VTT, rejects invalid and oversize files',()=>{
 assert.equal(ctx.validateTranscriptFile('lesson.VTT',40,'\uFEFFWEBVTT\n\nHello'),'WEBVTT\n\nHello');
 assert.equal(ctx.validateTranscriptFile('lesson.txt',5,'Hello'),'Hello');
 assert.throws(()=>ctx.validateTranscriptFile('lesson.pdf',5,'Hello'),/Choose a Zoom/);
 assert.throws(()=>ctx.validateTranscriptFile('lesson.txt',2100000,'Hello'),/2 MB/);
 assert.throws(()=>ctx.validateTranscriptFile('lesson.txt',0,''),/empty/);
 assert.throws(()=>ctx.validateTranscriptFile('lesson.txt',3,'a\0b'),/plain-text/);
});
test('cross-tab teacher saves retain incoming student work without replacing the open form',()=>{
 const code=fs.readFileSync('dist/app.js','utf8');let listener;let renders=0;
 const room=vm.createContext({role:'teacher',state:{notes:{},quizzes:{},assessments:{},plan:{}},location:{hash:'#teacher'},window:{addEventListener:(name,handler)=>{listener=handler;}},render:()=>{renders++;}});
 vm.runInContext(code.slice(code.indexOf('// Merge cross-tab updates')),room);
 listener({key:'inkwire-v2',newValue:JSON.stringify({preparation:{'Alex Lee|1':{reading:true}},notes:{'Alex Lee|1|Writing':'Saved work'},richNotes:{'Alex Lee|1|Writing':{type:'doc',content:[]}}})});
 assert.equal(room.state.preparation['Alex Lee|1'].reading,true);
 assert.equal(room.state.notes['Alex Lee|1|Writing'],'Saved work');
 assert.equal(room.state.richNotes['Alex Lee|1|Writing'].type,'doc');
 assert.equal(renders,0);
});
test('legacy notes preserve text, line breaks, and literal HTML when migrated into Tiptap',async()=>{
 const {textDocument,notebookContent}=await import('../src/notebook-content.mjs');
 const original='A thought\r\n\r\n<script>alert(1)</script> & a quotation';
 const document=textDocument(original);
 assert.equal(document.content.length,3);
 assert.equal(document.content[2].content[0].text,'<script>alert(1)</script> & a quotation');
 assert.equal(document.content[1].type,'paragraph');
 assert.equal(document.content[1].content,undefined);
 assert.deepEqual(notebookContent(null,original),document);
 const rich={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Keep formatting',marks:[{type:'bold'}]}]}]};
 assert.equal(notebookContent(rich,'Keep formatting'),rich);
});
