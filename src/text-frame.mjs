import {Node} from '@tiptap/core';
import {Plugin,PluginKey,TextSelection} from '@tiptap/pm/state';
import {Decoration,DecorationSet} from '@tiptap/pm/view';
import {isChangeOrigin} from '@tiptap/extension-collaboration';
export function cleanFrame(attrs={}){if(!attrs||typeof attrs!=='object'||Array.isArray(attrs)||Object.keys(attrs).some(k=>!['x','y','width','height'].includes(k)))throw Error('Invalid text box.');const out={x:attrs.x??24,y:attrs.y??24,width:attrs.width??340,height:attrs.height??30};if(!Object.values(out).every(Number.isFinite)||out.x<0||out.x>5000||out.y<0||out.y>200000||out.width<140||out.width>2000||out.height<20||out.height>6000)throw Error('Invalid text box dimensions.');return out;}
export function emptyTextFrame(node){let object=false;node.descendants(n=>{if(n.isLeaf&&!n.isText&&n.type.name!=='hardBreak')object=true;});return (node.type.name==='textFrame'||node.type.name==='paragraph'&&node.attrs.inkFrame)&&node.textContent.length===0&&!object;}
function pruneEmpty(view){if(view.isDestroyed||view.hasFocus()||!view.editable)return;const {selection}=view.state;for(let depth=selection.$from.depth;depth>0;depth--){const node=selection.$from.node(depth);if(emptyTextFrame(node)){const pos=selection.$from.before(depth);view.dispatch(view.state.tr.delete(pos,pos+node.nodeSize));return;}}}
export function textFrameCleanup(editable,onEmpty=()=>{}){return new Plugin({
 appendTransaction(transactions,oldState,state){
  if(!editable()||transactions.some(isChangeOrigin))return;
  const positions=[];
  oldState.doc.descendants((old,pos)=>{if(old.type.name!=='textFrame'&&!(old.type.name==='paragraph'&&old.attrs.inkFrame))return;let mapped=pos,removed=false;for(const tr of transactions){const r=tr.mapping.mapResult(mapped,1);mapped=r.pos;removed ||= r.deleted;}if(removed)return;const node=state.doc.nodeAt(mapped);if(!node||!emptyTextFrame(node))return;const inside=state.selection.from>mapped&&state.selection.to<mapped+node.nodeSize;const wasInside=oldState.selection.from>pos&&oldState.selection.to<pos+old.nodeSize;if(old.textContent.length>0||wasInside&&!inside){positions.push([mapped,node.nodeSize]);if(old.textContent.length>0&&wasInside)queueMicrotask(()=>onEmpty({...node.attrs.inkFrame||node.attrs}));}});
  if(!positions.length)return;let tr=state.tr;for(const [pos,size]of positions.sort((a,b)=>b[0]-a[0]))tr=tr.delete(pos,pos+size);return tr;
 },
 props:{handleDOMEvents:{blur(view){setTimeout(()=>pruneEmpty(view),0);return false;}}}
});}
export const TextFrame=Node.create({
 addOptions(){return {onEmpty:()=>{},canvas:false};},
 name:'textFrame',group:'block',content:'block+',defining:true,isolating:true,
 addGlobalAttributes(){return [{types:['paragraph'],attributes:{inkFrame:{default:null,parseHTML:e=>{try{return e.dataset.inkParagraph?cleanFrame(JSON.parse(e.dataset.inkParagraph)):null;}catch{return null;}},renderHTML:attrs=>attrs.inkFrame?{'data-ink-paragraph':JSON.stringify(cleanFrame(attrs.inkFrame)),style:`position:absolute;left:${attrs.inkFrame.x}px;top:${attrs.inkFrame.y}px;width:${attrs.inkFrame.width}px`}:{} }}}];},
 addAttributes(){return Object.fromEntries(Object.entries({x:24,y:24,width:340,height:30}).map(([key,value])=>[key,{default:value,parseHTML:e=>e.hasAttribute('data-'+key)?Number(e.getAttribute('data-'+key)):value}]));},
 parseHTML(){return [{tag:'div[data-folio-text-frame]',contentElement:'.frame-content'}];},
 renderHTML({node}){const a=cleanFrame(node.attrs);return ['div',{'data-folio-text-frame':'','data-x':a.x,'data-y':a.y,'data-width':a.width,'data-height':a.height,class:'folio-text-frame',style:`position:absolute;left:${a.x}px;top:${a.y}px;width:${a.width}px;height:${a.height}px`},['div',{class:'frame-content'},0]];},
 addProseMirrorPlugins(){return [textFrameCleanup(()=>this.editor.isEditable,this.options.onEmpty),...(this.options.canvas?[canvasTyping()]:[])];},
 addNodeView(){return ({node,editor,getPos})=>{
  let current=node;
  const dom=document.createElement('div');dom.className='folio-text-frame';dom.dataset.folioTextFrame='';
  const contentDOM=document.createElement('div');contentDOM.className='frame-content';
  const move=document.createElement('button');move.type='button';move.className='frame-handle';move.textContent='⠿';move.contentEditable='false';move.setAttribute('aria-label','Move text');move.title='Drag to move text';
  const resize=document.createElement('button');resize.type='button';resize.className='frame-resize';resize.contentEditable='false';resize.setAttribute('aria-label','Resize text');dom.append(move,contentDOM,resize);
  const paint=a=>{Object.assign(dom.style,{left:a.x+'px',top:a.y+'px',width:a.width+'px',height:a.height+'px'});const root=dom.closest('.folio-canvas');if(root)root.style.minHeight=Math.max(1200,parseFloat(root.style.minHeight)||0,a.y+a.height+100)+'px';};paint(current.attrs);
  const selectAll=()=>{const pos=getPos();if(typeof pos!=='number')return;editor.view.dispatch(editor.state.tr.setSelection(TextSelection.create(editor.state.doc,pos+2,pos+current.nodeSize-2)));editor.view.focus();};
  const drag=event=>{
   if(!editor.isEditable||event.button!==0)return;
   const pos=getPos(),s=editor.state.selection,isResize=event.target===resize;
   const inside=typeof pos==='number'&&s.from>pos&&s.to<pos+current.nodeSize;
   if(event.currentTarget===dom&&event.target.closest('.frame-handle,.frame-resize'))return;
   if(event.currentTarget===dom&&event.target.closest('.frame-content'))return;
   event.preventDefault();event.stopPropagation();selectAll();
   const before={...current.attrs},start={x:event.clientX,y:event.clientY},handle=event.currentTarget;let next=before;
   handle.setPointerCapture(event.pointerId);dom.classList.add('frame-dragging');
   const motion=e=>{const dx=e.clientX-start.x,dy=e.clientY-start.y;next=isResize?{...before,width:Math.max(140,Math.min(2000,before.width+dx)),height:Math.max(20,Math.min(6000,before.height+dy))}:{...before,x:Math.max(0,Math.min(5000,before.x+dx)),y:Math.max(0,Math.min(200000,before.y+dy))};paint(next);};
   const finish=e=>{handle.removeEventListener('pointermove',motion);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',cancel);dom.classList.remove('frame-dragging');const pos=getPos();if(typeof pos==='number'&&!editor.isDestroyed){const live=editor.state.doc.nodeAt(pos);if(live?.type.name==='textFrame'&&JSON.stringify(before)!==JSON.stringify(next))editor.view.dispatch(editor.state.tr.setNodeMarkup(pos,undefined,{...live.attrs,...next}));}if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);};
   const cancel=e=>{next=before;finish(e);paint(before);};handle.addEventListener('pointermove',motion);handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',cancel);
  };
  let growthTask;
  const grow=()=>{cancelAnimationFrame(growthTask);growthTask=requestAnimationFrame(()=>{if(editor.isDestroyed||!editor.isEditable)return;const pos=getPos();if(typeof pos!=='number')return;const live=editor.state.doc.nodeAt(pos);if(live?.type.name!=='textFrame')return;const height=Math.min(6000,Math.max(20,contentDOM.scrollHeight+6));if(Math.abs(height-live.attrs.height)>2)editor.view.dispatch(editor.state.tr.setNodeMarkup(pos,undefined,{...live.attrs,height}).setMeta('addToHistory',false));});};
  const selectionChanged=()=>{const pos=getPos(),s=editor.state.selection;dom.classList.toggle('frame-selected',typeof pos==='number'&&!s.empty&&s.from>pos&&s.to<pos+current.nodeSize);};
  editor.on('selectionUpdate',selectionChanged);
  move.onpointerdown=drag;resize.onpointerdown=drag;dom.onpointerdown=drag;
  return {dom,contentDOM,update(next){if(next.type.name!=='textFrame')return false;current=next;paint(next.attrs);grow();return true;},destroy(){cancelAnimationFrame(growthTask);editor.off('selectionUpdate',selectionChanged);},stopEvent:e=>!!e.target.closest('.frame-handle,.frame-resize'),ignoreMutation:m=>m.type!=='selection'&&(m.target===dom||!contentDOM.contains(m.target))};
 };},
});
// A page click never writes to the shared document. Only committed input creates an outline.
export function insertTypedFrame(editor,attrs,document,selection,focus=true){
 const {state}=editor,empty=state.doc.childCount===1&&state.doc.firstChild.type.name==='paragraph'&&!state.doc.firstChild.content.size;
 const content=state.schema.nodeFromJSON(document).content,frame=state.schema.nodes.textFrame.create(attrs,content),pos=empty?0:state.doc.content.size;
 let tr=state.tr;if(empty)tr=tr.replaceWith(0,state.doc.content.size,frame);else tr=tr.insert(pos,frame);
 tr.setSelection(TextSelection.create(tr.doc,pos+1+selection.anchor,pos+1+selection.head));editor.view.dispatch(tr);if(focus)editor.view.focus();
}

export const canvasCaretKey=new PluginKey('inkCanvasCaret');
export function ensureCanvasCaret(view){
 const {doc,schema}=view.state;
 if(doc.lastChild?.type.name==='paragraph'&&!doc.lastChild.content.size)return;
 view.dispatch(view.state.tr.insert(doc.content.size,schema.nodes.paragraph.create()).setMeta('addToHistory',false).setStoredMarks(view.state.storedMarks));
}
export function placeCanvasCaret(view,attrs){
 if(!view.editable)return;
 const {doc}=view.state,node=doc.lastChild;
 if(node?.type.name!=='paragraph'||node.content.size)return;
 const pos=doc.content.size-node.nodeSize;
 // Moving the canvas caret is layout navigation, not a request to reset the typing style.
 const marks=view.state.storedMarks??view.state.selection.$from.marks();
 view.dispatch(view.state.tr.setMeta(canvasCaretKey,{...cleanFrame(attrs),pos}).setSelection(TextSelection.create(doc,pos+1)).setStoredMarks(marks));view.focus();
}
export function canvasTyping(){return new Plugin({
 key:canvasCaretKey,
 state:{init:()=>null,apply(tr,caret){const supplied=tr.getMeta(canvasCaretKey);if(supplied!==undefined)return supplied;if(!caret)return null;const mapped=tr.mapping.mapResult(caret.pos,-1);return mapped.deleted?null:{...caret,pos:mapped.pos};}},
 props:{
  nodeViews:{paragraph:(node,view,getPos)=>positionedParagraphView(node,view,getPos)},
  decorations(state){const caret=canvasCaretKey.getState(state);if(!caret)return null;const node=state.doc.nodeAt(caret.pos);if(!node||node.type.name!=='paragraph')return null;return DecorationSet.create(state.doc,[Decoration.node(caret.pos,caret.pos+node.nodeSize,{class:'ink-page-caret',style:`position:absolute;left:${caret.x}px;top:${caret.y}px;width:${caret.width}px;margin:0;`})]);},
  handlePaste(view,event,slice){
   const caret=canvasCaretKey.getState(view.state),{$from}=view.state.selection,paragraph=$from.parent;
   if(caret){const content=slice.content.firstChild?.isBlock?slice.content:view.state.schema.nodes.paragraph.create(null,slice.content);const frame=view.state.schema.nodes.textFrame.create(cleanFrame({x:caret.x,y:caret.y,width:caret.width,height:caret.height}),content),node=view.state.doc.nodeAt(caret.pos);let tr=view.state.tr.replaceWith(caret.pos,caret.pos+node.nodeSize,frame).setMeta(canvasCaretKey,null);if(tr.doc.lastChild.type.name!=='paragraph'||tr.doc.lastChild.content.size)tr=tr.insert(tr.doc.content.size,view.state.schema.nodes.paragraph.create());tr.setSelection(TextSelection.near(tr.doc.resolve(caret.pos+frame.nodeSize-2)));view.dispatch(tr);return true;}
   if(paragraph.type.name==='paragraph'&&paragraph.attrs.inkFrame&&(slice.content.childCount>1||slice.content.firstChild?.type.name!=='paragraph')){const pos=$from.before(),frame=view.state.schema.nodes.textFrame.create(paragraph.attrs.inkFrame,view.state.schema.nodes.paragraph.create(null,paragraph.content));let tr=view.state.tr.replaceWith(pos,pos+paragraph.nodeSize,frame);tr.setSelection(TextSelection.create(tr.doc,view.state.selection.from+1,view.state.selection.to+1));view.dispatch(tr.replaceSelection(slice));return true;}
   return false;
  },
  handleKeyDown(view,event){if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='a'){
    const {$from}=view.state.selection;for(let depth=$from.depth;depth>0;depth--){const node=$from.node(depth);if(node.type.name==='textFrame'||node.type.name==='paragraph'&&node.attrs.inkFrame){const pos=$from.before(depth),padding=node.type.name==='textFrame'?2:1;view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc,pos+padding,pos+node.nodeSize-padding)));event.preventDefault();return true;}}
   }
   const caret=canvasCaretKey.getState(view.state),paragraph=view.state.selection.$from.parent;const positioned=paragraph.type.name==='paragraph'&&paragraph.attrs.inkFrame;if(!caret&&!positioned)return false;if(event.key==='Escape'){view.dispatch(view.state.tr.setMeta(canvasCaretKey,null));view.dom.blur();return true;}if(event.key==='Enter'){event.preventDefault();view.dispatch(view.state.tr.replaceSelectionWith(view.state.schema.nodes.hardBreak.create()));return true;}return false;},
 },
 appendTransaction(transactions,oldState,state){
  const caret=canvasCaretKey.getState(state);if(!caret||!transactions.some(tr=>tr.docChanged)||transactions.some(isChangeOrigin))return;
  const node=state.doc.nodeAt(caret.pos);if(node?.type.name!=='paragraph'||!node.content.size)return;
  const {pos,...attrs}=caret;
  let tr=state.tr.setNodeMarkup(pos,undefined,{...node.attrs,inkFrame:attrs}).setMeta(canvasCaretKey,null);
  if(tr.doc.lastChild.type.name!=='paragraph'||tr.doc.lastChild.content.size)tr=tr.insert(tr.doc.content.size,state.schema.nodes.paragraph.create());
  return tr.setStoredMarks(state.storedMarks);
 }
});}

function positionedParagraphView(node,view,getPos){
 let current=node;
 const dom=document.createElement('div'),contentDOM=document.createElement('p');contentDOM.className='ink-paragraph-content';
 const move=document.createElement('button');move.type='button';move.className='frame-handle';move.textContent='⠿';move.contentEditable='false';move.setAttribute('aria-label','Move text');move.title='Drag to move text';
 const resize=document.createElement('button');resize.type='button';resize.className='frame-resize';resize.contentEditable='false';resize.setAttribute('aria-label','Resize text');dom.append(move,contentDOM,resize);
 const paint=()=>{const a=current.attrs.inkFrame;dom.className='ink-paragraph'+(a?' folio-text-frame':'');move.hidden=resize.hidden=!a||!view.editable;if(a){dom.dataset.folioTextFrame='';Object.assign(dom.style,{display:'block',position:'absolute',left:a.x+'px',top:a.y+'px',width:a.width+'px',height:'auto'});}else{delete dom.dataset.folioTextFrame;dom.style.cssText='display:contents';}};paint();
 const drag=event=>{
  if(!view.editable||event.button!==0||!current.attrs.inkFrame)return;event.preventDefault();event.stopPropagation();
  const pos=getPos();view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc,pos+1,pos+current.nodeSize-1)));view.focus();
  const before={...current.attrs.inkFrame},start=[event.clientX,event.clientY],handle=event.currentTarget,isResize=handle===resize;let next=before;handle.setPointerCapture(event.pointerId);
  const motion=e=>{const dx=e.clientX-start[0],dy=e.clientY-start[1];next=isResize?{...before,width:Math.max(140,Math.min(2000,before.width+dx))}:{...before,x:Math.max(0,Math.min(5000,before.x+dx)),y:Math.max(0,Math.min(200000,before.y+dy))};Object.assign(dom.style,{left:next.x+'px',top:next.y+'px',width:next.width+'px'});};
  const finish=e=>{handle.removeEventListener('pointermove',motion);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',cancel);const at=getPos();if(typeof at==='number'&&!view.isDestroyed){const live=view.state.doc.nodeAt(at);if(live?.type.name==='paragraph'&&JSON.stringify(before)!==JSON.stringify(next))view.dispatch(view.state.tr.setNodeMarkup(at,undefined,{...live.attrs,inkFrame:next}));}if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);};
  const cancel=e=>{next=before;finish(e);paint();};handle.addEventListener('pointermove',motion);handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',cancel);
 };
 move.onpointerdown=resize.onpointerdown=drag;
 return {dom,contentDOM,update(next){if(next.type.name!=='paragraph')return false;current=next;paint();return true;},stopEvent:e=>!!e.target.closest('button'),ignoreMutation:m=>m.type!=='selection'&&(m.target===dom||m.target===move||m.target===resize)};
}
export function wrapPositionedParagraph(editor){
 const {state}=editor;const {$from}=state.selection;for(let depth=$from.depth;depth>0;depth--){const paragraph=$from.node(depth);if(paragraph.type.name==='paragraph'&&paragraph.attrs.inkFrame){const pos=$from.before(depth),frame=state.schema.nodes.textFrame.create(paragraph.attrs.inkFrame,state.schema.nodes.paragraph.create(null,paragraph.content));let tr=state.tr.replaceWith(pos,pos+paragraph.nodeSize,frame);tr.setSelection(TextSelection.create(tr.doc,state.selection.from+1,state.selection.to+1));editor.view.dispatch(tr);return;}}
}
