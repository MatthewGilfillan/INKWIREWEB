const {test}=require('node:test'),assert=require('node:assert/strict');
test('square eraser covers stationary ink, line segments and the full sweep between pointer events',async()=>{
 const {strokeHitsEraser,eraserSizes}=await import('../src/ink-geometry.mjs');
 const stroke={points:[[20,80],[300,80]],size:2};
 assert.equal(strokeHitsEraser(stroke,[100,80],[100,80],12),true);
 assert.equal(strokeHitsEraser(stroke,[100,20],[100,140],12),true);
 assert.equal(strokeHitsEraser(stroke,[100,40],[100,40],40),false);
 assert.equal(strokeHitsEraser(stroke,[100,60],[100,60],40),true);
 assert.equal(strokeHitsEraser(stroke,[100,60],[100,60],12),false);
 assert.equal(strokeHitsEraser({points:[[30,30],[30,30]],size:2},[25,25],[25,25],12),true);
 // The swept diagonal is a polygon, not a bounding box that erases distant ink.
 assert.equal(strokeHitsEraser({points:[[90,10],[100,10]],size:2},[0,0],[100,100],12),false);
 assert.deepEqual(eraserSizes.map(s=>s.size),[12,24,40]);
});
test('live drawing coordinates use the canvas origin after scrolling and automatic ink preserves saved data',async()=>{
 const {canvasPoint,inkStrokeColor}=await import('../src/ink-geometry.mjs');
 assert.deepEqual(canvasPoint({left:230,top:-140},{clientX:330,clientY:60}),[100,200]);
 assert.equal(inkStrokeColor('#243556'), 'var(--notebook-auto-ink, #243556)');
 assert.equal(inkStrokeColor('#ffe45c',true),'#ffe45c');
});
test('selected text boxes delete as objects, preserve neighbouring text and map safely through edits',async()=>{
 const {getSchema}=await import('@tiptap/core'),{default:StarterKit}=await import('@tiptap/starter-kit'),{EditorState}=await import('@tiptap/pm/state'),{TextFrame}=await import('../src/text-frame.mjs');
 const {canvasSelectionKey,canvasSelectionPlugin,deleteSelectedTextBoxes}=await import('../src/canvas-selection.mjs');
 const schema=getSchema([StarterKit,TextFrame]),box=text=>schema.nodes.paragraph.create({inkFrame:{x:20,y:20,width:180,height:30}},schema.text(text));
 const a=box('First'),b=box('Keep'),c=box('Third');let state=EditorState.create({schema,doc:schema.nodes.doc.create(null,[a,b,c,schema.nodes.paragraph.create()]),plugins:[canvasSelectionPlugin()]});
 const view={editable:true,get state(){return state;},dispatch(tr){state=state.applyTransaction(tr).state;},focus(){}};
 view.dispatch(state.tr.setMeta(canvasSelectionKey,[0,a.nodeSize+b.nodeSize]));
 view.dispatch(state.tr.insertText('!',a.nodeSize+2));
 assert.deepEqual(canvasSelectionKey.getState(state),[0,a.nodeSize+b.nodeSize+1]);
 assert.equal(deleteSelectedTextBoxes(view),true);assert.equal(state.doc.textContent,'K!eep');assert.equal(state.doc.lastChild.type.name,'paragraph');assert.deepEqual(canvasSelectionKey.getState(state),[]);
 // Ordinary typing is not an object selection; Delete must be handled by the text editor.
 assert.equal(deleteSelectedTextBoxes(view),false);
 view.dispatch(state.tr.setMeta(canvasSelectionKey,[0]));view.editable=false;assert.equal(deleteSelectedTextBoxes(view),false);assert.equal(state.doc.textContent,'K!eep');
});

test('master notebooks opens the complete teacher chooser while learner and class deep links retain their targets',async()=>{
 const {initialNotebook}=await import('../src/notebook-navigation.mjs');
 const books=[{id:'class.teacher'},{id:'class.student'}];
 assert.equal(initialNotebook(books,{role:'teacher'}),null);
 assert.equal(initialNotebook(books,{role:'teacher',notebookId:'class.student'}),books[1]);
 assert.equal(initialNotebook(books,{role:'teacher',classId:'class'}),books[0]);
 assert.equal(initialNotebook(books,{role:'student'}),books[0]);
 assert.equal(initialNotebook(books,{role:'parent'}),books[0]);
});
