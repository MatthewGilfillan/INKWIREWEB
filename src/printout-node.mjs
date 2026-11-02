import {Node} from '@tiptap/core';
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function cleanPrintout(a={}){
 const keys=['assetId','page','x','y','width','height','originalWidth','originalHeight','background'];
 if(!a||typeof a!=='object'||Object.keys(a).some(k=>!keys.includes(k))||!ID.test(a.assetId||'')||!Number.isInteger(a.page)||a.page<0||a.page>=60||typeof a.background!=='boolean')throw Error('Invalid PDF printout.');
 for(const [key,min,max] of [['x',0,10000],['y',0,200000],['width',50,2000],['height',50,4000],['originalWidth',50,2000],['originalHeight',50,2000]])if(!Number.isFinite(a[key])||a[key]<min||a[key]>max)throw Error('Invalid PDF printout dimensions.');
 return Object.fromEntries(keys.map(k=>[k,a[k]]));
}
export function printoutNodes(assetId,pages,{x=24,y=24}={}){return pages.map((page,index)=>{const attrs=cleanPrintout({assetId,page:index,x,y,width:page.width,height:page.height,originalWidth:page.width,originalHeight:page.height,background:true});y+=page.height+24;return {type:'pdfPrintout',attrs};});}
export const PdfPrintout=Node.create({
 name:'pdfPrintout',group:'block',atom:true,selectable:false,
 addOptions(){return {loadPdf:null};},
 addAttributes(){return Object.fromEntries(Object.entries({assetId:'',page:0,x:24,y:24,width:612,height:792,originalWidth:612,originalHeight:792,background:true}).map(([key,value])=>[key,{default:value}]));},
 parseHTML(){return [];},renderHTML(){return ['div',{'data-pdf-printout':''}];},
 addNodeView(){const load=this.options.loadPdf;return ({node,editor,getPos})=>{
  let current=node,dead=false;
  const dom=document.createElement('div');dom.className='ink-printout';dom.contentEditable='false';
  const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','PDF printout page '+(node.attrs.page+1));canvas.setAttribute('role','img');
  const message=document.createElement('span');message.className='printout-loading';message.textContent='Loading PDF page…';
  const tools=document.createElement('div');tools.className='printout-controls';
  const button=(text,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.onmousedown=e=>e.preventDefault();b.onclick=e=>{e.stopPropagation();fn();};tools.append(b);return b;};
  const change=attrs=>{const pos=getPos();if(editor.isEditable&&typeof pos==='number')editor.view.dispatch(editor.state.tr.setNodeMarkup(pos,undefined,{...current.attrs,...attrs}));};
  const move=button('⠿',()=>{});move.setAttribute('aria-label','Move printout');move.title='Drag to move printout';
  button('Restore original size',()=>change({width:current.attrs.originalWidth,height:current.attrs.originalHeight}));
  const background=button('Make background',()=>change({background:!current.attrs.background}));
  const resize=button('↘',()=>{});resize.setAttribute('aria-label','Resize printout');resize.className='printout-resize';
  dom.append(canvas,message,tools,resize);
  const paint=()=>{const a=current.attrs;Object.assign(dom.style,{left:a.x+'px',top:a.y+'px',width:a.width+'px',height:a.height+'px'});dom.classList.toggle('printout-background',a.background);tools.hidden=!editor.isEditable;move.hidden=resize.hidden=a.background;background.textContent=a.background?'Unlock printout':'Make background';background.setAttribute('aria-pressed',String(a.background));const root=editor.view.dom;root.style.minHeight=Math.max(1200,parseFloat(root.style.minHeight)||0,a.y+a.height+80)+'px';root.style.minWidth=Math.max(root.clientWidth,a.x+a.width+40)+'px';};
  const drag=event=>{if(!editor.isEditable||current.attrs.background||event.button!==0)return;event.preventDefault();event.stopPropagation();const before={...current.attrs},sx=event.clientX,sy=event.clientY,handle=event.currentTarget;let next=before;handle.setPointerCapture(event.pointerId);
   const motion=e=>{const dx=e.clientX-sx,dy=e.clientY-sy;if(handle===resize){const width=Math.max(50,Math.min(2000,before.width+dx));next={...before,width,height:Math.max(50,Math.min(4000,width*before.height/before.width))};}else next={...before,x:Math.max(0,Math.min(10000,before.x+dx)),y:Math.max(0,Math.min(200000,before.y+dy))};Object.assign(dom.style,{left:next.x+'px',top:next.y+'px',width:next.width+'px',height:next.height+'px'});};
   const finish=e=>{handle.removeEventListener('pointermove',motion);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',cancel);change(next);if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);};const cancel=e=>{next=before;finish(e);paint();};handle.addEventListener('pointermove',motion);handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',cancel);
  };move.onpointerdown=resize.onpointerdown=drag;
  // Background images pass ordinary clicks through to the page's typing/ink tools.
  const arrows=(event,resize=false)=>{if(!editor.isEditable||current.attrs.background||!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key))return;event.preventDefault();const step=event.shiftKey?10:1,a=current.attrs;if(resize){const width=Math.max(50,Math.min(2000,a.width+(['ArrowRight','ArrowDown'].includes(event.key)?step:-step)));change({width,height:Math.max(50,Math.min(4000,width*a.height/a.width))});}else change({x:Math.max(0,Math.min(10000,a.x+(event.key==='ArrowLeft'?-step:event.key==='ArrowRight'?step:0))),y:Math.max(0,Math.min(200000,a.y+(event.key==='ArrowUp'?-step:event.key==='ArrowDown'?step:0)))});};move.onkeydown=e=>arrows(e);resize.onkeydown=e=>arrows(e,true);
  dom.onmousedown=event=>{if(event.target.closest('button'))return;if(current.attrs.background){event.preventDefault();const root=editor.view.dom;root.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,clientX:event.clientX,clientY:event.clientY,button:0}));}};
  let renderTask;
  const render=()=>Promise.resolve().then(()=>load?.(current.attrs.assetId)).then(async pdf=>{if(!pdf||dead)return;const page=await pdf.getPage(current.attrs.page+1);if(dead)return;const view=page.getViewport({scale:Math.min(2,1600/current.attrs.originalWidth)});canvas.width=Math.ceil(view.width);canvas.height=Math.ceil(view.height);renderTask=page.render({canvasContext:canvas.getContext('2d'),viewport:view});await renderTask.promise;if(!dead)message.hidden=true;}).catch(error=>{if(!dead){message.textContent='PDF unavailable. Reopen this page to retry.';console.error(error);}});
  const observer=typeof IntersectionObserver==='function'?new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();render();}},{rootMargin:'900px'}):null;if(observer)observer.observe(dom);else render();
  queueMicrotask(()=>{if(!dead)paint();});
  return {dom,update(next){if(next.type.name!=='pdfPrintout'||next.attrs.assetId!==current.attrs.assetId||next.attrs.page!==current.attrs.page)return false;current=next;paint();return true;},stopEvent:e=>!!e.target.closest('button'),ignoreMutation:()=>true,destroy(){dead=true;observer?.disconnect();renderTask?.cancel();}};
 };},
});
