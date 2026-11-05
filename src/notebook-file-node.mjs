import {Node} from '@tiptap/core';
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export const fileTypes={doc:'application/msword',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',ppt:'application/vnd.ms-powerpoint',pptx:'application/vnd.openxmlformats-officedocument.presentationml.presentation',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp'};
export function notebookFileType(file){const ext=String(file.name||'').split('.').pop().toLowerCase(),mime=fileTypes[ext];if(!mime)throw Error('Choose a PDF, Word document, PowerPoint, or a JPG, PNG, GIF or WebP photo.');if(!file.size||file.size>25*1024*1024)throw Error('Choose a file of up to 25 MB.');return {ext,mime,image:mime.startsWith('image/')};}
export function cleanNotebookFile(a={}){
 const keys=['assetId','fileName','mime','size','x','y','width','height'];
 if(!a||typeof a!=='object'||Object.keys(a).some(k=>!keys.includes(k))||!ID.test(a.assetId||'')||typeof a.fileName!=='string'||!a.fileName.trim()||a.fileName.length>180||/[\x00-\x1f\x7f/\\]/.test(a.fileName)||!Object.values(fileTypes).includes(a.mime)||!Number.isInteger(a.size)||a.size<1||a.size>25*1024*1024)throw Error('Invalid notebook file.');
 for(const [key,min,max]of [['x',0,10000],['y',0,200000],['width',80,2000],['height',60,4000]])if(!Number.isFinite(a[key])||a[key]<min||a[key]>max)throw Error('Invalid notebook file position.');
 return Object.fromEntries(keys.map(k=>[k,a[k]]));
}
export const NotebookFile=Node.create({
 name:'notebookFile',group:'block',atom:true,selectable:false,
 addOptions(){return {loadAsset:null};},
 addAttributes(){return Object.fromEntries(Object.entries({assetId:'',fileName:'File',mime:'application/msword',size:1,x:24,y:24,width:320,height:100}).map(([key,value])=>[key,{default:value}]));},
 parseHTML(){return [];},renderHTML(){return ['div',{'data-notebook-file':''}];},
 addNodeView(){const load=this.options.loadAsset;return({node,editor,getPos})=>{
  let current=node,dead=false,url;
  const dom=document.createElement('div');dom.className='notebook-file';dom.contentEditable='false';
  const image=node.attrs.mime.startsWith('image/'),body=document.createElement(image?'img':'div');body.className='notebook-file-body';if(image){body.alt=node.attrs.fileName;body.draggable=false;}else body.textContent=node.attrs.fileName.split('.').pop().toUpperCase();
  const label=document.createElement('span');label.className='notebook-file-label';label.textContent=node.attrs.fileName;
  const status=document.createElement('span');status.className='notebook-file-status';status.textContent='Loading…';
  const tools=document.createElement('div');tools.className='notebook-file-tools';
  const move=document.createElement('button');move.type='button';move.textContent='⠿';move.title='Drag to move file';move.setAttribute('aria-label','Move '+node.attrs.fileName);
  const download=document.createElement('a');download.textContent='Download';download.download=node.attrs.fileName;download.hidden=true;
  const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.onclick=()=>{const pos=getPos();if(editor.isEditable&&typeof pos==='number')editor.view.dispatch(editor.state.tr.delete(pos,pos+current.nodeSize));};
  const resize=document.createElement('button');resize.type='button';resize.textContent='↘';resize.className='notebook-file-resize';resize.setAttribute('aria-label','Resize '+node.attrs.fileName);
  tools.append(move,download,remove);dom.append(body,label,status,tools,resize);dom.classList.toggle('notebook-photo',image);
  const change=attrs=>{const pos=getPos();if(editor.isEditable&&typeof pos==='number')editor.view.dispatch(editor.state.tr.setNodeMarkup(pos,undefined,{...current.attrs,...attrs}));};
  const paint=()=>{const a=current.attrs;Object.assign(dom.style,{left:a.x+'px',top:a.y+'px',width:a.width+'px',height:a.height+'px'});move.hidden=remove.hidden=resize.hidden=!editor.isEditable;editor.view.dom.style.minHeight=Math.max(1200,parseFloat(editor.view.dom.style.minHeight)||0,a.y+a.height+80)+'px';};
  const drag=e=>{if(!editor.isEditable||e.button!==0)return;e.preventDefault();e.stopPropagation();const handle=e.currentTarget,before={...current.attrs},sx=e.clientX,sy=e.clientY;let next=before;handle.setPointerCapture(e.pointerId);
   const motion=e=>{const dx=e.clientX-sx,dy=e.clientY-sy;next=handle===resize?{...before,width:Math.max(80,Math.min(2000,before.width+dx)),height:Math.max(60,Math.min(4000,image?(before.width+dx)*before.height/before.width:before.height))}:{...before,x:Math.max(0,Math.min(10000,before.x+dx)),y:Math.max(0,Math.min(200000,before.y+dy))};Object.assign(dom.style,{left:next.x+'px',top:next.y+'px',width:next.width+'px',height:next.height+'px'});};
   const finish=e=>{handle.removeEventListener('pointermove',motion);handle.removeEventListener('pointerup',finish);handle.removeEventListener('pointercancel',cancel);if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);change(next);paint();};const cancel=e=>{next=before;finish(e);};handle.addEventListener('pointermove',motion);handle.addEventListener('pointerup',finish);handle.addEventListener('pointercancel',cancel);
  };move.onpointerdown=resize.onpointerdown=drag;
  for(const handle of [move,resize])handle.onkeydown=e=>{if(!editor.isEditable||!e.key.startsWith('Arrow'))return;e.preventDefault();const a=current.attrs,d=e.shiftKey?10:1;if(handle===move)change({x:Math.max(0,Math.min(10000,a.x+(e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0))),y:Math.max(0,Math.min(200000,a.y+(e.key==='ArrowUp'?-d:e.key==='ArrowDown'?d:0)))});else{const width=Math.max(80,Math.min(2000,a.width+(['ArrowRight','ArrowDown'].includes(e.key)?d:-d)));change({width,height:image?Math.max(60,Math.min(4000,width*a.height/a.width)):a.height});}};
  Promise.resolve().then(()=>load?.(node.attrs.assetId)).then(blob=>{if(dead||!blob)throw Error('File unavailable');url=URL.createObjectURL(blob);if(image)body.src=url;download.href=url;download.hidden=false;status.hidden=true;}).catch(()=>{if(!dead)status.textContent='File unavailable. Reopen the page to retry.';});
  queueMicrotask(paint);return{dom,update(next){if(next.type.name!=='notebookFile'||next.attrs.assetId!==current.attrs.assetId)return false;current=next;paint();return true;},stopEvent:()=>true,ignoreMutation:()=>true,destroy(){dead=true;if(url)URL.revokeObjectURL(url);}};
 };},
});
