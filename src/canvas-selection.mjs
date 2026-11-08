import {Plugin,PluginKey} from '@tiptap/pm/state';
import {Decoration,DecorationSet} from '@tiptap/pm/view';
export const canvasSelectionKey=new PluginKey('canvasObjectSelection');
export const isTextBox=node=>node?.type.name==='textFrame'||node?.type.name==='paragraph'&&!!node.attrs.inkFrame;
export function canvasSelectionPlugin(){return new Plugin({
 key:canvasSelectionKey,
 state:{init:()=>[],apply(tr,positions){const explicit=tr.getMeta(canvasSelectionKey);if(explicit!==undefined)return explicit;return positions.flatMap(pos=>{const mapped=tr.mapping.mapResult(pos,1);return !mapped.deleted&&isTextBox(tr.doc.nodeAt(mapped.pos))?[mapped.pos]:[];});}},
 props:{decorations(state){return DecorationSet.create(state.doc,(canvasSelectionKey.getState(state)||[]).flatMap(pos=>{const node=state.doc.nodeAt(pos);return isTextBox(node)?[Decoration.node(pos,pos+node.nodeSize,{class:'frame-object-selected'})]:[];}));}}
});}
export function deleteSelectedTextBoxes(view){
 if(!view.editable)return false;
 const positions=(canvasSelectionKey.getState(view.state)||[]).filter(pos=>isTextBox(view.state.doc.nodeAt(pos)));
 if(!positions.length)return false;
 let tr=view.state.tr;for(const pos of positions.slice().sort((a,b)=>b-a))tr=tr.delete(pos,pos+view.state.doc.nodeAt(pos).nodeSize);
 view.dispatch(tr.setMeta(canvasSelectionKey,[]));view.focus();return true;
}
export function mountCanvasSelection(editor,{onBlankClick}){
 const view=editor.view,root=view.dom,doc=root.ownerDocument,overlay=doc.createElement('div'),menu=doc.createElement('div');
 overlay.className='canvas-selection-rectangle';overlay.hidden=true;menu.className='notebook-context-menu canvas-text-menu';menu.hidden=true;menu.setAttribute('role','menu');menu.setAttribute('aria-label','Text box actions');
 const remove=doc.createElement('button');remove.type='button';remove.setAttribute('role','menuitem');menu.append(remove);doc.body.append(overlay,menu);
 const selected=()=>canvasSelectionKey.getState(view.state)||[],set=positions=>view.dispatch(view.state.tr.setMeta(canvasSelectionKey,positions).setMeta('addToHistory',false));
 const entries=()=>{const result=[];view.state.doc.descendants((node,pos)=>{if(isTextBox(node)){const dom=view.nodeDOM(pos);if(dom?.getBoundingClientRect)result.push({pos,dom});return false;}});return result;};
 const close=()=>{menu.hidden=true;},erase=()=>{close();deleteSelectedTextBoxes(view);};remove.onclick=erase;
 let gesture;
 const down=event=>{
  if(!view.editable||root.dataset.tool!=='text'||event.button!==0)return;close();
  const box=event.target.closest('.folio-text-frame');
  if(box){if(event.target.closest('.frame-handle,.frame-resize')||event.target===box){const item=entries().find(item=>item.dom===box);if(item)set([item.pos]);}else if(selected().length)set([]);return;}
  if(event.target.closest('button,input,select,textarea,.notebook-file'))return;
  if(selected().length)set([]);
  // Leave text selection inside an existing outline to the browser.
  const paragraph=event.target.closest('.ink-paragraph');if(paragraph&&!paragraph.classList.contains('ink-page-caret')&&paragraph.querySelector('.ink-paragraph-content')?.textContent)return;
  event.preventDefault();event.stopPropagation();root.focus();root.setPointerCapture(event.pointerId);gesture={id:event.pointerId,start:[event.clientX,event.clientY],dragged:false};
 };
 const motion=event=>{
  if(!gesture||event.pointerId!==gesture.id)return;
  const [x,y]=gesture.start,left=Math.min(x,event.clientX),top=Math.min(y,event.clientY),right=Math.max(x,event.clientX),bottom=Math.max(y,event.clientY);
  if(!gesture.dragged&&Math.hypot(event.clientX-x,event.clientY-y)<5)return;gesture.dragged=true;
  overlay.hidden=false;Object.assign(overlay.style,{left:left+'px',top:top+'px',width:right-left+'px',height:bottom-top+'px'});
  const positions=entries().filter(({dom})=>{const r=dom.getBoundingClientRect();return r.right>=left&&r.left<=right&&r.bottom>=top&&r.top<=bottom;}).map(({pos})=>pos);
  if(positions.join(',')!==selected().join(','))set(positions);
 };
 const finish=event=>{if(!gesture||event.pointerId!==gesture.id)return;const previous=gesture;gesture=null;overlay.hidden=true;if(root.hasPointerCapture(event.pointerId))root.releasePointerCapture(event.pointerId);if(!previous.dragged&&event.type!=='pointercancel')onBlankClick(event);};
 const context=event=>{const box=event.target.closest('.folio-text-frame');if(!view.editable||!box||root.dataset.tool!=='text')return;const item=entries().find(item=>item.dom===box);if(!item)return;event.preventDefault();event.stopPropagation();if(!selected().includes(item.pos))set([item.pos]);view.focus();remove.textContent=selected().length>1?'Delete text boxes':'Delete text box';menu.hidden=false;const r=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(event.clientX,innerWidth-r.width-8))+'px';menu.style.top=Math.max(8,Math.min(event.clientY,innerHeight-r.height-8))+'px';remove.focus();};
 const key=event=>{if(!selected().length)return;if(['Delete','Backspace'].includes(event.key)&&!event.isComposing){event.preventDefault();event.stopImmediatePropagation();erase();}else if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();set([]);view.focus();}};
 const outside=event=>{if(!menu.contains(event.target))close();if(!root.contains(event.target)&&!menu.contains(event.target)&&!event.target.closest('#note-toolbar')&&selected().length)set([]);};
 root.addEventListener('pointerdown',down,true);root.addEventListener('pointermove',motion,true);root.addEventListener('pointerup',finish,true);root.addEventListener('pointercancel',finish,true);root.addEventListener('contextmenu',context,true);root.addEventListener('keydown',key,true);menu.addEventListener('keydown',key,true);doc.addEventListener('pointerdown',outside,true);
 return ()=>{root.removeEventListener('pointerdown',down,true);root.removeEventListener('pointermove',motion,true);root.removeEventListener('pointerup',finish,true);root.removeEventListener('pointercancel',finish,true);root.removeEventListener('contextmenu',context,true);root.removeEventListener('keydown',key,true);doc.removeEventListener('pointerdown',outside,true);overlay.remove();menu.remove();};
}
