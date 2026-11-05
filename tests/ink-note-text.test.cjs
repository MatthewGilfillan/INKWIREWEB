const {test}=require('node:test');
const assert=require('node:assert/strict');
async function setup(editable=true){
 const {getSchema}=await import('@tiptap/core'),{default:StarterKit}=await import('@tiptap/starter-kit'),{EditorState,TextSelection}=await import('@tiptap/pm/state'),{TextFrame,textFrameCleanup}=await import('../src/text-frame.mjs');
 const {TextFormat}=await import('../src/text-format.mjs');
 const schema=getSchema([StarterKit,TextFrame,TextFormat]);const frame=text=>schema.nodes.textFrame.create(null,schema.nodes.paragraph.create(null,text?schema.text(text):null));
 return {schema,frame,EditorState,TextSelection,plugin:textFrameCleanup(()=>editable)};
}
test('clearing the final character removes the text container and leaves a valid page',async()=>{
 const {schema,frame,EditorState,TextSelection,plugin}=await setup();let state=EditorState.create({schema,doc:schema.nodes.doc.create(null,frame('A')),plugins:[plugin]});state=state.apply(state.tr.setSelection(TextSelection.create(state.doc,3)));state=state.applyTransaction(state.tr.delete(2,3)).state;
 assert.equal(state.doc.childCount,1);assert.equal(state.doc.firstChild.type.name,'paragraph');assert.equal(state.doc.textContent,'');
});
test('chosen font and character formatting survive a page click, first input and a new line',async()=>{
 const {schema,EditorState}=await setup();const {canvasTyping,placeCanvasCaret}=await import('../src/text-frame.mjs');
 const plugin=canvasTyping(),style=schema.marks.textStyle.create({fontFamily:'Georgia',fontSize:'24pt',color:'#7030a0'}),marks=[schema.marks.bold.create(),style];
 let state=EditorState.create({schema,doc:schema.nodes.doc.create(null,schema.nodes.paragraph.create()),plugins:[plugin]});
 const view={editable:true,get state(){return state;},dispatch(tr){state=state.applyTransaction(tr).state;},focus(){}};
 state=state.apply(state.tr.setStoredMarks(marks));const before=state.doc.toJSON();
 placeCanvasCaret(view,{x:80,y:60,width:340,height:30});
 assert.deepEqual(state.doc.toJSON(),before);assert.deepEqual(state.storedMarks?.map(mark=>mark.toJSON()),marks.map(mark=>mark.toJSON()));
 for(const character of 'Georgia')view.dispatch(state.tr.insertText(character));
 plugin.props.handleKeyDown(view,{key:'Enter',preventDefault(){}});
 for(const character of 'Second line')view.dispatch(state.tr.insertText(character));
 state.doc.firstChild.forEach(node=>assert.deepEqual(node.marks.map(mark=>mark.toJSON()),marks.map(mark=>mark.toJSON())));
 // New empty canvas text inherits the current typing style without changing existing text.
 placeCanvasCaret(view,{x:80,y:160,width:340,height:30});view.dispatch(state.tr.insertText('Another box'));
 assert.deepEqual(state.doc.child(1).firstChild.marks.map(mark=>mark.toJSON()),marks.map(mark=>mark.toJSON()));
 const saved=schema.nodeFromJSON(state.doc.toJSON());assert.deepEqual(saved.child(1).firstChild.marks.map(mark=>mark.toJSON()),marks.map(mark=>mark.toJSON()));
});
test('moving into existing text adopts its own font rather than forcing the last font choice',async()=>{
 const {schema,EditorState,TextSelection}=await setup();const {canvasTyping,placeCanvasCaret}=await import('../src/text-frame.mjs');
 const georgia=schema.marks.textStyle.create({fontFamily:'Georgia'}),arial=schema.marks.textStyle.create({fontFamily:'Arial'});
 let state=EditorState.create({schema,doc:schema.nodes.doc.create(null,[schema.nodes.paragraph.create({inkFrame:{x:10,y:10,width:340,height:30}},schema.text('Existing',[arial])),schema.nodes.paragraph.create()]),plugins:[canvasTyping()]});
 const view={editable:true,get state(){return state;},dispatch(tr){state=state.applyTransaction(tr).state;},focus(){}};
 view.dispatch(state.tr.setStoredMarks([georgia]));placeCanvasCaret(view,{x:80,y:160,width:340,height:30});view.dispatch(state.tr.insertText('New'));
 view.dispatch(state.tr.setSelection(TextSelection.create(state.doc,9)));view.dispatch(state.tr.insertText(' text'));
 assert.equal(state.doc.firstChild.textContent,'Existing text');assert.deepEqual(state.doc.firstChild.firstChild.marks.map(mark=>mark.toJSON()),[arial.toJSON()]);assert.deepEqual(state.doc.child(1).firstChild.marks.map(mark=>mark.toJSON()),[georgia.toJSON()]);
});
test('an empty container survives while typing starts and disappears when its caret leaves',async()=>{
 const {schema,frame,EditorState,TextSelection,plugin}=await setup();let state=EditorState.create({schema,doc:schema.nodes.doc.create(null,[frame(''),schema.nodes.paragraph.create()]),plugins:[plugin]});state=state.applyTransaction(state.tr.setSelection(TextSelection.create(state.doc,2))).state;assert.equal(state.doc.firstChild.type.name,'textFrame');state=state.applyTransaction(state.tr.setSelection(TextSelection.create(state.doc,5))).state;assert.equal(state.doc.childCount,1);assert.equal(state.doc.firstChild.type.name,'paragraph');
});
test('read-only and remote collaboration transactions never prune someone else’s container',async()=>{
 const {ySyncPluginKey}=await import('@tiptap/y-tiptap');
 for(const [editable,remote]of [[false,false],[true,true]]){const {schema,frame,EditorState,plugin}=await setup(editable);let state=EditorState.create({schema,doc:schema.nodes.doc.create(null,frame('A')),plugins:[plugin]});let tr=state.tr.delete(2,3);if(remote)tr=tr.setMeta(ySyncPluginKey,{isChangeOrigin:true});state=state.applyTransaction(tr).state;assert.equal(state.doc.firstChild.type.name,'textFrame');}
});
test('caret movement does not erase another empty shared container',async()=>{
 const {schema,frame,EditorState,TextSelection,plugin}=await setup();let state=EditorState.create({schema,doc:schema.nodes.doc.create(null,[schema.nodes.paragraph.create(null,schema.text('Hello')),frame('')]),plugins:[plugin]});state=state.applyTransaction(state.tr.setSelection(TextSelection.create(state.doc,2))).state;assert.equal(state.doc.childCount,2);
});
test('PDF rich text keeps character highlights through validation and rejects active or oversized content',async()=>{
 const {cleanMark}=await import('../cloudflare/worksheets.mjs');
 const {annotationDocument}=await import('../src/annotation-text.mjs');
 const document={type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Hello '},{type:'text',text:'world',marks:[{type:'textStyle',attrs:{backgroundColor:'#fff176',fontFamily:'Calibri',fontSize:'20pt'}}]}]}]};
 const value={kind:'text',page:0,x:10,y:10,width:220,height:30,fontSize:16,color:'#243556',text:'Hello world',document};
 const cleaned=cleanMark(value,[{width:612,height:792}]);assert.deepEqual(annotationDocument(cleaned),document);assert.equal(cleaned.backgroundColor,null);
 assert.throws(()=>cleanMark({...value,text:'Different'},[{width:612,height:792}]));
 assert.throws(()=>cleanMark({...value,document:{type:'doc',content:[{type:'script',text:'alert(1)'}]}},[{width:612,height:792}]));
 const legacy=annotationDocument({...value,document:null,backgroundColor:'#fff176'});assert.equal(legacy.content[0].content[0].marks[0].attrs.backgroundColor,'#fff176');
});
test('committing the first typed content creates one positioned outline with an intact selection',async()=>{
 const {schema,EditorState}=await setup();const {insertTypedFrame}=await import('../src/text-frame.mjs');
 let state=EditorState.create({schema,doc:schema.nodes.doc.create(null,schema.nodes.paragraph.create())});let focused=false;
 const editor={get state(){return state;},view:{dispatch(tr){state=state.applyTransaction(tr).state;},focus(){focused=true;}}};
 const before=state.doc.toJSON();assert.equal(before.content[0].type,'paragraph');
 insertTypedFrame(editor,{x:140,y:90,width:340,height:30},{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:'Ready'}]}]},{anchor:6,head:6});
 assert.equal(state.doc.firstChild.type.name,'textFrame');assert.equal(state.doc.textContent,'Ready');assert.equal(state.doc.firstChild.attrs.height,30);assert.equal(state.selection.from,7);assert.equal(focused,true);
});
test('placing the canvas caret does not change the document; first input preserves the same paragraph',async()=>{
 const {schema,EditorState,TextSelection}=await setup();const {canvasTyping,canvasCaretKey,textFrameCleanup}=await import('../src/text-frame.mjs');
 let state=EditorState.create({schema,doc:schema.nodes.doc.create(null,schema.nodes.paragraph.create()),plugins:[canvasTyping(),textFrameCleanup(()=>true)]});
 const before=state.doc.toJSON(),attrs={x:140,y:90,width:340,height:30,pos:0};
 state=state.applyTransaction(state.tr.setMeta(canvasCaretKey,attrs).setSelection(TextSelection.create(state.doc,1))).state;assert.deepEqual(state.doc.toJSON(),before);
 const caretStyle=state.plugins.find(p=>p.key===canvasCaretKey.key).props.decorations(state).find()[0].type.attrs.style;
 assert.match(caretStyle,/--caret-x:140px/);assert.doesNotMatch(caretStyle,/(?:^|;)left:|(?:^|;)top:|(?:^|;)width:/);
 state=state.applyTransaction(state.tr.insertText('M')).state;assert.equal(state.doc.firstChild.type.name,'paragraph');assert.deepEqual(state.doc.firstChild.attrs.inkFrame,{x:140,y:90,width:340,height:30});
 state=state.applyTransaction(state.tr.insertText('ac')).state;assert.equal(state.doc.textContent,'Mac');assert.equal(state.doc.childCount,2);
 const {seedState,mergeState,encodeState}=await import('../src/notebook-sync.mjs');const bytes=seedState(state.doc.toJSON()),shared=mergeState(bytes,encodeState(bytes));assert.equal(shared.document.content[0].attrs.inkFrame.x,140);
 state=state.applyTransaction(state.tr.delete(1,4)).state;assert.equal(state.doc.childCount,1);assert.equal(state.doc.firstChild.attrs.inkFrame,null);assert.equal(state.doc.textContent,'');
});
