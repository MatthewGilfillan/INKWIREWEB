import {Node} from '@tiptap/core';
import {Plugin,TextSelection} from '@tiptap/pm/state';
import {isChangeOrigin} from '@tiptap/extension-collaboration';
export function cleanFrame(attrs={}){if(!attrs||typeof attrs!=='object'||Array.isArray(attrs)||Object.keys(attrs).some(k=>!['x','y','width','height'].includes(k)))throw Error('Invalid text box.');const out={x:attrs.x??24,y:attrs.y??24,width:attrs.width??340,height:attrs.height??30};if(!Object.values(out).every(Number.isFinite)||out.x<0||out.x>5000||out.y<0||out.y>20000||out.width<140||out.width>2000||out.height<20||out.height>6000)throw Error('Invalid text box dimensions.');return out;}
export function emptyTextFrame(node){let object=false;node.descendants(n=>{if(n.isLeaf&&!n.isText&&n.type.name!=='hardBreak')object=true;});return node.type.name==='textFrame'&&node.textContent.length===0&&!object;}
function pruneEmpty(view){if(view.isDestroyed||view.hasFocus()||!view.editable)return;const {selection}=view.state;for(let depth=selection.$from.depth;depth>0;depth--){const node=selection.$from.node(depth);if(emptyTextFrame(node)){const pos=selection.$from.before(depth);view.dispatch(view.state.tr.delete(pos,pos+node.nodeSize));return;}}}
export function textFrameCleanup(editable,onEmpty=()=>{}){return new Plugin({
 appendTransaction(transactions,oldState,state){
  if(!editable()||transactions.some(isChangeOrigin))return;
  const positions=[];
  oldState.doc.descendants((old,pos)=>{if(old.type.name!=='textFrame')return;let mapped=pos,removed=false;for(const tr of transactions){const r=tr.mapping.mapResult(mapped,1);mapped=r.pos;removed ||= r.deleted;}if(removed)return;const node=state.doc.nodeAt(mapped);if(!node||!emptyTextFrame(node))return;const inside=state.selection.from>mapped&&state.selection.to<mapped+node.nodeSize;const wasInside=oldState.selection.from>pos&&oldState.selection.to<pos+old.nodeSize;if(old.textContent.length>0||wasInside&&!inside){positions.push([mapped,node.nodeSize]);if(old.textContent.length>0&&wasInside)queueMicrotask(()=>onEmpty({...node.attrs}));}});
  if(!positions.length)return;let tr=state.tr;for(const [pos,size]of positions.sort((a,b)=>b[0]-a[0]))tr=tr.delete(pos,pos+size);return tr;
 },
 props:{handleDOMEvents:{blur(view){setTimeout(()=>pruneEmpty(view),0);return false;}}}
});}
export const TextFrame=Node.create({
 addOptions(){return {onEmpty:()=>{}};},
 name:'textFrame',group:'block',content:'block+',defining:true,isolating:true,
 addAttributes(){return Object.fromEntries(Object.entries({x:24,y:24,width:340,height:30}).map(([key,value])=>[key,{default:value,parseHTML:e=>e.hasAttribute('data-'+key)?Number(e.getAttribute('data-'+key)):value}]));},
 parseHTML(){return [{tag:'div[data-folio-text-frame]',contentElement:'.frame-content'}];},
 renderHTML({node}){const a=cleanFrame(node.attrs);return ['div',{'data-folio-text-frame':'','data-x':a.x,'data-y':a.y,'data-width':a.width,'data-height':a.height,class:'folio-text-frame',style:`position:absolute;left:${a.x}px;top:${a.y}px;width:${a.width}px;height:${a.height}px`},['div',{class:'frame-content'},0]];},
 addProseMirrorPlugins(){return [textFrameCleanup(()=>this.editor.isEditable,this.options.onEmpty)];},
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
   const motion=e=>{const dx=e.clientX-start.x,dy=e.clientY-start.y;next=isResize?{...before,width:Math.max(140,Math.min(2000,before.width+dx)),height:Math.max(20,Math.min(6000,before.height+dy))}:{...before,x:Math.max(0,Math.min(5000,before.x+dx)),y:Math.max(0,Math.min(20000,before.y+dy))};paint(next);};
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
export function insertTypedFrame(editor,attrs,document,selection){
 const {state}=editor,empty=state.doc.childCount===1&&state.doc.firstChild.type.name==='paragraph'&&!state.doc.firstChild.content.size;
 const content=state.schema.nodeFromJSON(document).content,frame=state.schema.nodes.textFrame.create(attrs,content),pos=empty?0:state.doc.content.size;
 let tr=state.tr;if(empty)tr=tr.replaceWith(0,state.doc.content.size,frame);else tr=tr.insert(pos,frame);
 tr.setSelection(TextSelection.create(tr.doc,pos+1+selection.anchor,pos+1+selection.head));editor.view.dispatch(tr);editor.view.focus();
}
