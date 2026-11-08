import {canvasPoint,strokeHitsEraser,inkStrokeColor} from './ink-geometry.mjs';
import {ensureCanvasCaret} from './text-frame.mjs';
export function mountNotebookInk(editor,element,{getTool,getInk,getEraserSize}){
 const root=editor.view.dom,doc=root.ownerDocument,ns='http://www.w3.org/2000/svg',cursor=doc.createElement('div');
 cursor.className='notebook-eraser-cursor';cursor.hidden=true;doc.body.append(cursor);
 // This sibling overlay and the saved node views now share the canvas origin.
 element.style.position='relative';let gesture;
 const cursorAt=event=>{if(getTool()!=='eraser'||!editor.isEditable||event.target.closest('button')){cursor.hidden=true;return;}const size=getEraserSize();cursor.hidden=false;Object.assign(cursor.style,{left:event.clientX-size/2+'px',top:event.clientY-size/2+'px',width:size+'px',height:size+'px'});};
 const erase=(from,to)=>{editor.state.doc.descendants((node,pos)=>{if(node.type.name==='inkStroke'&&!gesture.erased.has(node)&&strokeHitsEraser(node.attrs,from,to,getEraserSize())){const dom=editor.view.nodeDOM(pos);gesture.erased.set(node,dom);if(dom)dom.style.visibility='hidden';}});};
 const draw=event=>{
  const tool=getTool();if(!editor.isEditable||!['pen','highlight','eraser'].includes(tool)||event.button!==0||event.target.closest('button'))return;
  event.preventDefault();event.stopPropagation();const point=canvasPoint(root.getBoundingClientRect(),event);
  root.setPointerCapture(event.pointerId);gesture={tool,id:event.pointerId,last:point,erased:new Map()};cursorAt(event);
  if(tool==='eraser'){erase(point,point);return;}
  const {color,size}=getInk(),highlight=tool==='highlight',svg=doc.createElementNS(ns,'svg'),line=doc.createElementNS(ns,'polyline');
  Object.assign(gesture,{points:[point],color,size,highlight,svg,line});svg.classList.add('ink-stroke','ink-stroke-preview');svg.setAttribute('aria-hidden','true');svg.append(line);
  for(const [key,value]of Object.entries({stroke:inkStrokeColor(color,highlight),'stroke-width':size,fill:'none','stroke-linecap':'round','stroke-linejoin':'round',opacity:highlight?'.32':'1',points:point.join(',')}))line.setAttribute(key,value);
  element.append(svg);const bounds=root.getBoundingClientRect(),container=element.getBoundingClientRect();Object.assign(svg.style,{left:bounds.left-container.left+element.scrollLeft+'px',top:bounds.top-container.top+element.scrollTop+'px'});
 };
 const motion=event=>{cursorAt(event);if(!gesture||event.pointerId!==gesture.id)return;const point=canvasPoint(root.getBoundingClientRect(),event);
  if(gesture.tool==='eraser')erase(gesture.last,point);else if(gesture.points.length<1500){gesture.points.push(point);gesture.line.setAttribute('points',gesture.points.map(p=>p.join(',')).join(' '));}gesture.last=point;
 };
 const finish=event=>{
  if(!gesture||event.pointerId!==gesture.id)return;const g=gesture;
  if(event.type!=='pointercancel')motion(event);gesture=null;g.svg?.remove();for(const dom of g.erased.values())if(dom)dom.style.visibility='';
  if(root.hasPointerCapture(event.pointerId))root.releasePointerCapture(event.pointerId);
  if(event.type==='pointercancel'||editor.isDestroyed)return;
  if(g.tool==='eraser'){const positions=[];editor.state.doc.descendants((node,pos)=>{if(g.erased.has(node))positions.push([pos,node.nodeSize]);});let tr=editor.state.tr;for(const [pos,size]of positions.reverse())tr=tr.delete(pos,pos+size);if(positions.length)editor.view.dispatch(tr);}
  else{if(g.points.length===1)g.points.push([g.points[0][0]+.1,g.points[0][1]]);editor.view.dispatch(editor.state.tr.insert(editor.state.doc.content.size,editor.schema.nodes.inkStroke.create({points:g.points,color:g.color,size:g.size,highlight:g.highlight})));}
  ensureCanvasCaret(editor.view);
 };
 const leave=()=>{if(!gesture)cursor.hidden=true;},hide=()=>{cursor.hidden=true;};
 root.addEventListener('pointerdown',draw,true);root.addEventListener('pointermove',motion,true);root.addEventListener('pointerup',finish,true);root.addEventListener('pointercancel',finish,true);root.addEventListener('pointerleave',leave);element.addEventListener('scroll',hide);doc.defaultView.addEventListener('blur',hide);
 return {hideCursor:hide,destroy(){root.removeEventListener('pointerdown',draw,true);root.removeEventListener('pointermove',motion,true);root.removeEventListener('pointerup',finish,true);root.removeEventListener('pointercancel',finish,true);root.removeEventListener('pointerleave',leave);element.removeEventListener('scroll',hide);doc.defaultView.removeEventListener('blur',hide);gesture?.svg?.remove();cursor.remove();}};
}
