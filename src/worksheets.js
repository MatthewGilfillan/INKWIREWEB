import * as pdfjs from 'pdfjs-dist';
import {escape,requestId} from '../dist/workspace-shared.js';
pdfjs.GlobalWorkerOptions.workerSrc='/pdf/pdf.worker.min.mjs';
const $=selector=>document.querySelector(selector);
const query=new URLSearchParams(location.search);
const demo=query.get('preview')==='1'&&location.hostname!=='inkwire-education.com'&&location.hostname!=='www.inkwire-education.com';
const classId=query.get('class')||'',requestedLearner=query.get('learner')||'';
const notebookContext=query.get('notebook')==='1',embedded=notebookContext&&query.get('embed')==='1';
if(embedded)document.body.classList.add('notebook-embed');
const pdfOptions={cMapUrl:'/pdf/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdf/standard_fonts/',wasmUrl:'/pdf/wasm/',isEvalSupported:false};
const hints={select:'Select your text or ink to move it. Double-click your text to type.',text:'Click anywhere on a page to add a text box.',pen:'Draw with your mouse or stylus. Choose Select to scroll on a touch screen.',highlight:'Drag to highlight. The PDF background stays locked.',erase:'Click or drag over your own annotations to erase them.'};
let library,meta,pdf,marks=new Map(),versions=new Map(),pending=new Map(),conflicts=new Map(),history=[],redo=[],selected=null,tool='select',zoom=1,fit=true,revision=-1,activePage=0,editing=null,gesture=null,printing=false,openToken=0,pollTimer,saveTimer,saving=false,observer;
let pageNodes=[],rendering=new Map(),visible=new Set(),pdfTask,fileToUpload,uploadRequestId,queuedFeedback='',textBefore=null;
const own=m=>meta&&meta.role!=='parent'&&m?.ownerId===meta.userId&&m.layer===meta.role;
const editable=()=>!!meta?.learnerId&&meta.role!=='parent'&&!conflicts.has('access');
const raw=m=>{if(!m)return null;const {id,ownerId,layer,version,deleted,...data}=m;return structuredClone(data);};
const clone=m=>m?structuredClone(m):null;
function error(message=''){ $('#workspace-error').textContent=message;$('#workspace-error').hidden=!message; }
function status(message){$('#save-status').textContent=message;}
function updateStatus(){if(embedded)window.parent.postMessage({type:'inkwire:worksheet-status',dirty:!!(pending.size||conflicts.size)},location.origin);if(conflicts.size)status('Needs review');else if(pending.size)status(navigator.onLine?'Saving…':'Offline · changes in this tab');else status(meta?.role==='parent'?'Read-only copy':'All changes saved');$('#download-recovery').hidden=!pending.size&&!conflicts.size;$('#publish-parent').disabled=!!pending.size||!!conflicts.size||saving||!meta?.learnerId;}
async function request(path,options={}) {
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',...options,signal:AbortSignal.timeout(options.body instanceof File?90000:20000)});
  if(!response.ok){const data=await response.json().catch(()=>({}));throw Object.assign(new Error(data.message||'Unable to complete this request.'),{status:response.status,code:data.code,current:data.current});}
  return response.json();
}
function endpoint(suffix=''){const params=new URLSearchParams();if(notebookContext)params.set('notebook','1');if(meta?.learnerId)params.set('learnerId',meta.learnerId);return '/api/worksheets/'+meta.id+suffix+'?'+params;}
const realAdapter={
  list:()=>request('/api/worksheets?'+new URLSearchParams({classId,...(notebookContext?{notebook:'1'}:{}),...(requestedLearner?{learnerId:requestedLearner}:{})})),
  metadata:(id,learnerId)=>request('/api/worksheets/'+id+'?'+new URLSearchParams({...learnerId?{learnerId}:{},...notebookContext?{notebook:'1'}:{}})),
  pdf:()=>fetch(endpoint('/pdf'),{credentials:'same-origin',cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Unable to load this PDF.');return new Uint8Array(await r.arrayBuffer());}),
  state:()=>request(endpoint('/state')+'&revision='+encodeURIComponent(revision)),
  save:body=>request(endpoint('/marks'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),
  publish:()=>request(endpoint('/publish'),{method:'POST'}),
  upload:(file,pages,title,id)=>request('/api/worksheets?'+new URLSearchParams({classId,title}),{method:'POST',headers:{'Content-Type':'application/pdf','X-PDF-Pages':JSON.stringify(pages),'X-Worksheet-Id':id},body:file}),
};
let adapter=realAdapter;
if(demo){
  const {createPreviewAdapter}=await import('./worksheet-preview-adapter.js');adapter=await createPreviewAdapter(query.get('role')||'teacher',notebookContext?{classId,learnerId:requestedLearner,liveParent:true}:{});
  $('#preview-label').hidden=false;$('#dashboard-link').href='./';$('#dashboard-link').textContent='Ink Wire home';
  const picker=document.createElement('select');picker.id='preview-role';picker.setAttribute('aria-label','Preview role');picker.innerHTML='<option value="teacher">Teacher preview</option><option value="student">Student preview</option><option value="parent">Parent preview</option>';picker.value=adapter.role;$('#preview-label').append(picker);picker.onchange=()=>{if((pending.size||conflicts.size)&&!confirm('Leave this copy with unsaved changes?')){picker.value=adapter.role;return;}location.href='/worksheets?preview=1&role='+picker.value;};
}
let deepLinkOpened=false;
async function loadLibrary(){
  $('#library-status').textContent='Loading worksheets…';$('#library-retry').hidden=true;
  try{
    library=await adapter.list();$('#class-name').textContent=library.className;$('#upload-open').hidden=library.role!=='teacher';if(!demo)$('#dashboard-link').href='/'+library.role;
    $('#library-status').textContent=library.role==='parent'?'Worksheets and feedback shared by the teacher.':library.role==='student'?'Your own copy of each worksheet. Write, draw, and return to it after class.':'';
    $('#worksheet-cards').innerHTML=library.worksheets.length?library.worksheets.map(w=>`<article class="ws-card"><div class="pdf-icon">PDF WORKSHEET</div><h2>${escape(w.title)}</h2><p>${w.pageCount} ${w.pageCount===1?'page':'pages'} · ${library.role==='parent'?'Teacher-shared copy':'Locked background'}</p><button class="primary" data-open-worksheet="${escape(w.id)}">${library.role==='parent'?'View work':'Open worksheet'} →</button></article>`).join(''):`<div class="ws-empty"><h2>${library.role==='teacher'?'Add your first worksheet':library.role==='parent'?'No shared worksheets yet':'No worksheets yet'}</h2><p>${library.role==='teacher'?'Upload a PDF. Students can type and draw on their own copies.':library.role==='parent'?'Your child’s teacher can share completed work and feedback here.':'Your teacher’s PDF worksheets will appear here.'}</p></div>`;
    if(!deepLinkOpened&&query.get('worksheet')){deepLinkOpened=true;await openWorksheet(query.get('worksheet'),requestedLearner||library.learnerId||library.students?.[0]?.id||'');}
  }catch(problem){$('#library-status').textContent=problem.message;$('#library-retry').hidden=false;if(problem.status===401)location.replace('/account');}
}
$('#library-retry').onclick=loadLibrary;
$('#worksheet-cards').onclick=event=>{const b=event.target.closest('[data-open-worksheet]');if(b)openWorksheet(b.dataset.openWorksheet,requestedLearner||library.learnerId||library.students?.[0]?.id||'');};
function resetWorkspace(){clearTimeout(pollTimer);clearTimeout(saveTimer);observer?.disconnect();openToken++;pdfTask?.destroy().catch(()=>{});pdfTask=null;pdf=null;marks=new Map();versions=new Map();pending=new Map();conflicts=new Map();history=[];redo=[];selected=null;editing=null;gesture=null;revision=-1;pageNodes=[];rendering=new Map();visible=new Set();$('#worksheet-pages').replaceChildren();error();}
async function openWorksheet(id,learnerId){
  if(pending.size||conflicts.size){error('Wait for saving to finish, or download your unsaved work before leaving this copy.');return;}
  resetWorkspace();const token=openToken;
  $('#worksheet-library').hidden=true;$('#worksheet-workspace').hidden=false;$('#worksheet-title').textContent='Loading worksheet…';status('Loading…');
  try{
    meta=await adapter.metadata(id,learnerId);if(token!==openToken)return;
    $('#worksheet-title').textContent=meta.title;$('#copy-label').textContent=meta.learnerName?meta.learnerName+' · '+(meta.role==='parent'?(notebookContext?'Live notebook · read only':'Published work'):meta.role==='teacher'?'Teacher feedback':'My work'):'Master PDF · add a student to begin';
    $('#learner-picker').hidden=meta.role!=='teacher';$('#learner-select').innerHTML=(library.students||[]).map(s=>`<option value="${escape(s.id)}">${escape(s.name)}</option>`).join('');$('#learner-select').value=meta.learnerId||'';
    for(const id of ['drawing-tools','style-tools'])$('#'+id).hidden=!editable();$('#feedback-tools').hidden=meta.role!=='teacher'||!editable();$('#publish-parent').hidden=meta.role!=='teacher'||notebookContext;$('#ink-color').value=meta.role==='teacher'?'#7461ad':'#243556';
    $('#read-only-message').hidden=editable();$('#read-only-message').textContent=meta.role==='parent'?(notebookContext?'Read-only: this is your child’s live notebook. New writing and feedback appear automatically.':'Read-only: this is the copy your child’s teacher shared. New edits appear when the teacher shares an updated copy.'):'Add a student to this class to open their worksheet copy. The original PDF is ready.';
    publishedLabel(meta.publishedAt);setTool('select');buildPages();
    const data=await adapter.pdf();if(token!==openToken)return;
    pdfTask=pdfjs.getDocument({...pdfOptions,data});pdf=await pdfTask.promise;if(token!==openToken)return;
    if(pdf.numPages!==meta.pages.length)throw Error('The PDF page count does not match this worksheet. Please upload it again.');
    setupObserver();await renderPage(0);if(meta.learnerId)await poll();else updateStatus();
  }catch(problem){if(token===openToken){error(problem.message);status('Could not open worksheet');}}
}
$('#learner-select').onchange=event=>{const value=event.target.value;if(pending.size||conflicts.size){event.target.value=meta.learnerId;error('Wait for saving to finish before changing students.');return;}openWorksheet(meta.id,value);};
$('#back-library').onclick=()=>{if(pending.size||conflicts.size){error('Wait for saving to finish, or download your unsaved work before leaving.');return;}resetWorkspace();meta=null;$('#worksheet-workspace').hidden=true;$('#worksheet-library').hidden=false;loadLibrary();};
function buildPages(){
  $('#page-navigation').innerHTML=meta.pages.map((p,i)=>`<button data-page="${i}" class="${i===0?'active':''}">Page ${i+1}</button>`).join('');
  for(let i=0;i<meta.pages.length;i++){
    const p=meta.pages[i],wrap=document.createElement('div');wrap.className='worksheet-page-wrap';wrap.dataset.page=i;
    const stage=document.createElement('div');stage.className='worksheet-page';stage.dataset.page=i;stage.dataset.tool=tool;stage.style.width=p.width+'px';stage.style.height=p.height+'px';stage.setAttribute('aria-label','Worksheet page '+(i+1));
    const canvas=document.createElement('canvas');canvas.className='pdf-canvas';canvas.width=1;canvas.height=1;canvas.setAttribute('aria-label','PDF page '+(i+1));canvas.setAttribute('role','img');
    const loading=document.createElement('div');loading.className='page-loading';loading.textContent='Loading page '+(i+1)+'…';
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('ink-canvas');svg.setAttribute('viewBox',`0 0 ${p.width} ${p.height}`);svg.setAttribute('aria-label','Drawings on page '+(i+1));
    const text=document.createElement('div');text.className='text-layer';stage.append(canvas,loading,svg,text);wrap.append(stage);$('#worksheet-pages').append(wrap);pageNodes.push({wrap,stage,canvas,loading,svg,text,rendered:false});
    stage.addEventListener('pointerdown',pointerDown);stage.addEventListener('pointermove',pointerMove);stage.addEventListener('pointerup',pointerUp);stage.addEventListener('pointercancel',pointerCancel);
  }
  fitWidth();
}
function setupObserver(){observer=new IntersectionObserver(entries=>{for(const entry of entries){const i=Number(entry.target.dataset.page);if(entry.isIntersecting){visible.add(i);renderPage(i).catch(e=>error(e.message));}else{visible.delete(i);if(!printing&&!rendering.has(i)&&pageNodes[i]?.rendered){pageNodes[i].canvas.width=1;pageNodes[i].canvas.height=1;pageNodes[i].rendered=false;pageNodes[i].loading.hidden=false;}}}},{root:$('#page-scroll'),rootMargin:'900px 0px'});pageNodes.forEach(p=>observer.observe(p.wrap));}
async function renderPage(i){
  if(!pdf||!pageNodes[i]||pageNodes[i].rendered)return;if(rendering.has(i))return rendering.get(i);
  const token=openToken,node=pageNodes[i],document=pdf;
  const task=(async()=>{const p=await document.getPage(i+1);if(token!==openToken)return;const initial=p.getViewport({scale:1});const ratio=Math.min(printing?2:Math.max(1.3,Math.min(devicePixelRatio||1,2)),2200/Math.max(initial.width,initial.height));const viewport=p.getViewport({scale:ratio});node.canvas.width=Math.ceil(viewport.width);node.canvas.height=Math.ceil(viewport.height);await p.render({canvasContext:node.canvas.getContext('2d'),viewport}).promise;if(token===openToken){node.rendered=true;node.loading.hidden=true;}})();rendering.set(i,task);try{await task;}finally{if(rendering.get(i)===task)rendering.delete(i);}
}
function applyZoom(){for(let i=0;i<pageNodes.length;i++){const {width,height}=meta.pages[i],n=pageNodes[i];n.stage.style.transform=`scale(${zoom})`;n.wrap.style.width=width*zoom+'px';n.wrap.style.height=height*zoom+'px';}$('#zoom-value').textContent=Math.round(zoom*100)+'%';}
function fitWidth(){if(!meta)return;const width=Math.max(200,$('#page-scroll').clientWidth-70);zoom=Math.min(1.4,width/Math.max(...meta.pages.map(p=>p.width)));fit=true;applyZoom();}
$('#zoom-in').onclick=()=>{zoom=Math.min(2.5,zoom+.15);fit=false;applyZoom();};$('#zoom-out').onclick=()=>{zoom=Math.max(.25,zoom-.15);fit=false;applyZoom();};$('#fit-page').onclick=fitWidth;new ResizeObserver(()=>{if(fit&&meta&&!printing)fitWidth();}).observe($('#page-scroll'));
$('#page-navigation').onclick=event=>{const b=event.target.closest('[data-page]');if(b){activePage=Number(b.dataset.page);pageNodes[activePage].wrap.scrollIntoView({block:'start',behavior:'smooth'});$('#page-navigation .active')?.classList.remove('active');b.classList.add('active');}};
function setTool(next){if(editing)document.activeElement?.blur();tool=next;pageNodes.forEach(n=>n.stage.dataset.tool=next);document.querySelectorAll('[data-tool]').forEach(b=>{if(b.tagName==='BUTTON')b.setAttribute('aria-pressed',String(b.dataset.tool===next));});$('#tool-hint').textContent=editable()?hints[next]:'PDF background locked · read-only view';}
$('#drawing-tools').onclick=event=>{const b=event.target.closest('button[data-tool]');if(b)setTool(b.dataset.tool);};
function select(id){if(editing&&editing!==id)document.activeElement?.blur();selected=id;renderMarks();$('#delete-mark').disabled=!own(marks.get(id));}
function makeStroke(mark){const line=document.createElementNS('http://www.w3.org/2000/svg','polyline');line.setAttribute('points',mark.points.map(p=>p.join(',')).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke',mark.color);line.setAttribute('stroke-width',mark.size);line.setAttribute('stroke-linecap','round');line.setAttribute('stroke-linejoin','round');if(mark.kind==='highlight')line.setAttribute('opacity','.32');line.classList.add('stroke');if(mark.id===selected)line.classList.add('selected-stroke');line.dataset.mark=mark.id||'';return line;}
function renderMarks(){
  if(!meta)return;
  for(let page=0;page<pageNodes.length;page++){
    const n=pageNodes[page];n.svg.replaceChildren();
    const rows=[...marks.values()].filter(m=>!m.deleted&&m.page===page).sort((a,b)=>(a.layer==='teacher')-(b.layer==='teacher'));
    for(const m of rows.filter(m=>m.kind!=='text'))n.svg.append(makeStroke(m));
    const textIds=new Set(rows.filter(m=>m.kind==='text').map(m=>m.id));
    for(const el of [...n.text.children])if(!textIds.has(el.dataset.mark))el.remove();
    for(const m of rows.filter(m=>m.kind==='text')){
      let box=[...n.text.children].find(el=>el.dataset.mark===m.id);if(!box){box=document.createElement('div');box.className='note-box';box.dataset.mark=m.id;n.text.append(box);}
      box.classList.toggle('selected',selected===m.id&&own(m));Object.assign(box.style,{left:m.x+'px',top:m.y+'px',width:m.width+'px',height:m.height+'px',fontSize:m.fontSize+'px',fontWeight:m.bold?'600':'400',color:m.color});
      if(editing===m.id)continue;
      let display=box.querySelector('.note-display');if(!display){box.replaceChildren();display=document.createElement('div');display.className='note-display';box.append(display);}display.textContent=m.text;box.title=(m.layer==='teacher'?'Teacher feedback':'Student work')+(own(m)?' · double-click to type':'');
      if(own(m)&&!box.querySelector('.note-handle')){const handle=document.createElement('button');handle.className='note-handle';handle.type='button';handle.textContent='↔ Move';handle.setAttribute('aria-label','Move text box');const resize=document.createElement('button');resize.className='note-resize';resize.type='button';resize.setAttribute('aria-label','Resize text box');box.append(handle,resize);box.ondblclick=()=>startText(m.id);}
    }
  }
  if(gesture?.kind==='draw')pageNodes[gesture.page].svg.append(makeStroke(gesture.mark));
  $('#undo-mark').disabled=!history.length;$('#redo-mark').disabled=!redo.length;$('#delete-mark').disabled=!own(marks.get(selected));
}
function startText(id){if(!editable()||!own(marks.get(id)))return;selected=id;renderMarks();const m=marks.get(id),box=[...pageNodes[m.page].text.children].find(x=>x.dataset.mark===id);editing=id;textBefore=clone(m);const input=document.createElement('textarea');input.value=m.text;input.maxLength=4000;input.spellcheck=true;input.setAttribute('aria-label','Text annotation');box.querySelector('.note-display').replaceWith(input);
  input.onpointerdown=e=>e.stopPropagation();input.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();input.blur();}e.stopPropagation();};
  input.oninput=()=>{const current=marks.get(id);const next={...current,text:input.value};input.style.height='100%';next.height=Math.min(meta.pages[current.page].height-current.y,Math.max(current.height,input.scrollHeight+6));marks.set(id,next);box.style.height=next.height+'px';queue(next);};
  input.onblur=()=>{const after=clone(marks.get(id));if(textBefore&&JSON.stringify(raw(textBefore))!==JSON.stringify(raw(after)))remember(id,textBefore,after);editing=null;textBefore=null;renderMarks();};input.focus();input.setSelectionRange(input.value.length,input.value.length);
}
function remember(id,before,after){history.push({id,before:clone(before),after:clone(after)});if(history.length>100)history.shift();redo=[];$('#undo-mark').disabled=false;$('#redo-mark').disabled=true;}
function queue(mark){pending.set(mark.id,{mark:clone(mark),generation:requestId()});clearTimeout(saveTimer);saveTimer=setTimeout(flush,450);updateStatus();}
function change(mark,{record=true}={}){const before=clone(marks.get(mark.id));marks.set(mark.id,clone(mark));if(record)remember(mark.id,before,mark);queue(mark);renderMarks();}
function create(mark){const m={...mark,id:requestId(),ownerId:meta.userId,layer:meta.role,version:0,deleted:false};change(m);return m.id;}
function remove(id){const m=marks.get(id);if(own(m)&&!m.deleted){change({...m,deleted:true});if(selected===id)selected=null;}}
function point(event,page){const rect=pageNodes[page].stage.getBoundingClientRect(),p=meta.pages[page];return [Math.max(0,Math.min(p.width,(event.clientX-rect.left)*p.width/rect.width)),Math.max(0,Math.min(p.height,(event.clientY-rect.top)*p.height/rect.height))];}
function hit(page,p){return [...marks.values()].reverse().find(m=>{if(m.page!==page||m.deleted||!own(m))return false;if(m.kind==='text')return p[0]>=m.x&&p[0]<=m.x+m.width&&p[1]>=m.y&&p[1]<=m.y+m.height;return m.points.some((b,i)=>{const a=m.points[Math.max(0,i-1)],dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy,t=length?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length)):0;return Math.hypot(a[0]+t*dx-p[0],a[1]+t*dy-p[1])<Math.max(8,m.size/2);});});}
function pointerDown(event){
  if(!editable()||event.button!==0||gesture)return;
  const page=Number(event.currentTarget.dataset.page),p=point(event,page),target=event.target.closest('[data-mark]'),m=target?marks.get(target.dataset.mark):(tool==='select'?hit(page,p):null);activePage=page;
  if(tool==='select'){
    if(m&&own(m)){
      select(m.id);
      if(event.target.closest('.note-handle')||m.kind!=='text'||event.target.closest('.note-resize')){event.preventDefault();gesture={kind:event.target.closest('.note-resize')?'resize':'move',page,id:m.id,start:p,before:clone(m),pointerId:event.pointerId};event.currentTarget.setPointerCapture(event.pointerId);}
    }else select(null);
    return;
  }
  event.preventDefault();if(editing)document.activeElement?.blur();select(null);
  if(tool==='text'){
    const size=Number($('#text-size').value),pageSize=meta.pages[page],width=Math.min(220,pageSize.width),height=Math.min(90,pageSize.height);const id=create({kind:'text',page,x:Math.min(p[0],pageSize.width-width),y:Math.min(p[1],pageSize.height-height),width,height,fontSize:size,bold:$('#text-bold').getAttribute('aria-pressed')==='true',color:$('#ink-color').value,text:queuedFeedback||''});queuedFeedback='';$('#feedback-select').value='';setTool('select');select(id);startText(id);return;
  }
  if(tool==='erase'){const found=hit(page,p);if(found)remove(found.id);gesture={kind:'erase',page,pointerId:event.pointerId};}
  else gesture={kind:'draw',page,pointerId:event.pointerId,mark:{kind:tool,page,color:$('#ink-color').value,size:tool==='highlight'?Number($('#ink-size').value)*4:Number($('#ink-size').value),points:[p,p]}};
  event.currentTarget.setPointerCapture(event.pointerId);renderMarks();
}
function pointerMove(event){
  if(!gesture||event.pointerId!==gesture.pointerId)return;event.preventDefault();const g=gesture,p=point(event,g.page),page=meta.pages[g.page];
  if(g.kind==='draw'){const last=g.mark.points.at(-1);if(g.mark.points.length<1500&&Math.hypot(last[0]-p[0],last[1]-p[1])>1)g.mark.points.push(p);renderMarks();}
  else if(g.kind==='erase'){const found=hit(g.page,p);if(found)remove(found.id);}
  else {const m=clone(g.before),dx=p[0]-g.start[0],dy=p[1]-g.start[1];if(g.kind==='resize'){m.width=Math.max(20,Math.min(page.width-m.x,g.before.width+dx));m.height=Math.max(20,Math.min(page.height-m.y,g.before.height+dy));}
    else if(m.kind==='text'){m.x=Math.max(0,Math.min(page.width-m.width,g.before.x+dx));m.y=Math.max(0,Math.min(page.height-m.height,g.before.y+dy));}
    else {const xs=m.points.map(q=>q[0]),ys=m.points.map(q=>q[1]);const x=Math.max(-Math.min(...xs),Math.min(page.width-Math.max(...xs),dx)),y=Math.max(-Math.min(...ys),Math.min(page.height-Math.max(...ys),dy));m.points=m.points.map(q=>[q[0]+x,q[1]+y]);}marks.set(m.id,m);renderMarks();}
}
function pointerUp(event){if(!gesture||event.pointerId!==gesture.pointerId)return;const g=gesture;gesture=null;if(g.kind==='draw')create(g.mark);else if(g.kind==='move'||g.kind==='resize'){const after=clone(marks.get(g.id));if(JSON.stringify(raw(after))!==JSON.stringify(raw(g.before))){remember(g.id,g.before,after);queue(after);}}renderMarks();}
function pointerCancel(event){if(!gesture||event.pointerId!==gesture.pointerId)return;if(gesture.before)marks.set(gesture.id,gesture.before);gesture=null;renderMarks();}
$('#delete-mark').onclick=()=>remove(selected);
function undo(direction){if(editing)document.activeElement?.blur();const from=direction==='undo'?history:redo,to=direction==='undo'?redo:history,step=from.pop();if(!step)return;const current=marks.get(step.id),desired=direction==='undo'?step.before:step.after;if(!own(current))return;const next=desired?{...clone(desired),version:current.version}:{...current,deleted:true};marks.set(step.id,next);queue(next);to.push(step);renderMarks();}
$('#undo-mark').onclick=()=>undo('undo');$('#redo-mark').onclick=()=>undo('redo');
function styleSelection(){const m=marks.get(selected);if(!own(m))return;const next={...m,color:$('#ink-color').value,...(m.kind==='text'?{fontSize:Number($('#text-size').value),bold:$('#text-bold').getAttribute('aria-pressed')==='true'}:{size:Number($('#ink-size').value)*(m.kind==='highlight'?4:1)})};change(next);}
$('#ink-color').onchange=styleSelection;$('#text-size').onchange=styleSelection;$('#ink-size').onchange=styleSelection;$('#text-bold').onclick=()=>{$('#text-bold').setAttribute('aria-pressed',String($('#text-bold').getAttribute('aria-pressed')!=='true'));styleSelection();};
$('#feedback-select').onchange=event=>{queuedFeedback=event.target.value;if(queuedFeedback){setTool('text');$('#tool-hint').textContent='Click on the page to place this feedback. You can edit its wording.';}};
window.addEventListener('keydown',event=>{if(!meta||!editable()||event.target.matches('input,textarea,select')||event.target.isContentEditable)return;if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();undo(event.shiftKey?'redo':'undo');}else if(['Delete','Backspace'].includes(event.key)&&selected){event.preventDefault();remove(selected);}});
async function flush(){
  if(saving||!meta||!editable()||!pending.size||conflicts.size)return;saving=true;updateStatus();const token=openToken;
  try{
    while(pending.size&&token===openToken){const [id,item]=pending.entries().next().value;const version=versions.get(id)||0;const result=await adapter.save({id,version,deleted:item.mark.deleted===true,mark:raw(item.mark)});if(token!==openToken)return;versions.set(id,result.mark.version);const current=pending.get(id);if(current?.generation===item.generation){pending.delete(id);marks.set(id,result.mark);}else if(marks.has(id))marks.get(id).version=result.mark.version;}
    if(!pending.size){error();renderMarks();}
  }catch(problem){
    if(problem.status===401||problem.status===403||problem.status===404){error('Your access has changed. Download any unsaved work, then sign in again.');conflicts.set('access',true);}
    else if(problem.status===409||problem.status===400||problem.status===413){error(problem.message+' Download unsaved work before reloading.');conflicts.set('save',true);}
    else {error('Connection interrupted. Your unsaved changes are still in this tab; saving will retry.');saveTimer=setTimeout(flush,3000);}
  }finally{saving=false;updateStatus();}
}
async function poll(){
  if(!meta?.learnerId)return;const token=openToken;
  try{const result=await adapter.state();if(token!==openToken)return;if(!result.unchanged&&(meta.role==='parent'||result.revision>=revision)){if(meta.role==='parent'){marks.clear();versions.clear();}revision=result.revision;for(const m of result.marks){if(pending.has(m.id)||editing===m.id||gesture?.id===m.id)continue;if((versions.get(m.id)||0)>m.version)continue;versions.set(m.id,m.version);marks.set(m.id,m);}if(!gesture)renderMarks();if(result.publishedAt)publishedLabel(result.publishedAt);}updateStatus();}
  catch(problem){if(token!==openToken)return;if(problem.status===401||problem.status===403||problem.status===404){error('This worksheet is no longer accessible. Download unsaved work before returning to your dashboard.');conflicts.set('access',true);$('#drawing-tools').hidden=true;$('#style-tools').hidden=true;return;}status('Reconnecting…');}
  finally{if(token===openToken&&!conflicts.has('access'))pollTimer=setTimeout(poll,document.hidden?12000:2000);}
}
window.addEventListener('online',()=>{flush();});document.addEventListener('visibilitychange',()=>{if(!document.hidden&&meta&&!conflicts.has('access')){clearTimeout(pollTimer);poll();}});
window.addEventListener('beforeunload',event=>{if(pending.size||conflicts.size){event.preventDefault();event.returnValue='';}});
$('#download-recovery').onclick=()=>{const data=JSON.stringify({title:meta.title,worksheetId:meta.id,learnerId:meta.learnerId,savedAt:new Date().toISOString(),marks:[...marks.values()].filter(m=>own(m)&&!m.deleted)},null,2);const url=URL.createObjectURL(new Blob([data],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='inkwire-unsaved-annotations.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);};
function publishedLabel(time){$('#published-label').textContent=time?'Shared with parent '+new Date(time).toLocaleString(undefined,{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short'})+' (Beijing / Shanghai)':'';}
$('#publish-parent').onclick=async()=>{if(editing)document.activeElement?.blur();await flush();if(pending.size||conflicts.size)return;const b=$('#publish-parent');b.disabled=true;try{const result=await adapter.publish();publishedLabel(result.publishedAt);status('Shared with parent');}catch(problem){error(problem.message);}finally{updateStatus();}};
$('#print-worksheet').onclick=async()=>{if(!pdf)return;if(editing)document.activeElement?.blur();const button=$('#print-worksheet'),previousZoom=zoom;button.disabled=true;printing=true;status('Preparing pages…');try{await document.fonts.ready;for(let i=0;i<meta.pages.length;i++)await renderPage(i);zoom=Math.min(700/Math.max(...meta.pages.map(p=>p.width)),950/Math.max(...meta.pages.map(p=>p.height)));applyZoom();window.print();}catch(problem){error(problem.message);}finally{zoom=previousZoom;applyZoom();printing=false;button.disabled=false;updateStatus();}};
function chooseFile(file){fileToUpload=file;uploadRequestId=requestId();$('#pdf-file-name').textContent=file?file.name:'Up to 10 MB · 60 pages';if(file&&!$('#upload-name').value)$('#upload-name').value=file.name.replace(/\.pdf$/i,'').slice(0,120);}
$('#upload-open').onclick=()=>{$('#upload-error').hidden=true;$('#upload-dialog').showModal();};for(const id of ['upload-close','upload-cancel'])$('#'+id).onclick=()=>$('#upload-dialog').close();$('#pdf-input').onchange=e=>chooseFile(e.target.files[0]);
document.addEventListener('dragover',e=>{if(Array.from(e.dataTransfer?.types||[]).includes('Files')){e.preventDefault();if(library?.role==='teacher')e.dataTransfer.dropEffect='copy';}});
document.addEventListener('drop',e=>{if(!Array.from(e.dataTransfer?.types||[]).includes('Files'))return;e.preventDefault();if(library?.role!=='teacher'){error('Only teachers can add PDF printouts.');return;}const files=e.dataTransfer.files;if(files.length!==1){error('Drop one PDF at a time.');return;}if(embedded){window.parent.postMessage({type:'inkwire:pdf-drop',file:files[0]},location.origin);return;}$('#upload-error').hidden=true;$('#upload-dialog').showModal();chooseFile(files[0]);$('#pdf-input').required=false;});
$('#upload-form').onsubmit=async event=>{
  event.preventDefault();const file=fileToUpload,button=$('#upload-submit'),title=$('#upload-name').value.trim();if(!file||file.size>10*1024*1024||!title){$('#upload-error').textContent='Choose a PDF of up to 10 MB and enter a title.';$('#upload-error').hidden=false;return;}
  button.disabled=true;button.textContent='Checking PDF…';$('#upload-error').hidden=true;let task;
  try{task=pdfjs.getDocument({...pdfOptions,data:new Uint8Array(await file.arrayBuffer()),password:''});const document=await task.promise;if(document.numPages>60)throw Error('Choose a PDF with no more than 60 pages.');const pages=[];for(let i=1;i<=document.numPages;i++){const page=await document.getPage(i),view=page.getViewport({scale:1});if(view.width<50||view.height<50||view.width>2000||view.height>2000)throw Error('This PDF uses an unsupported page size. Please export it using standard paper sizes.');pages.push({width:view.width,height:view.height});}button.textContent='Uploading…';const result=await adapter.upload(file,pages,title,uploadRequestId);$('#upload-dialog').close();$('#upload-form').reset();chooseFile(null);$('#pdf-input').required=true;await loadLibrary();await openWorksheet(result.id,library.learnerId||library.students?.[0]?.id||'');}
  catch(problem){$('#upload-error').textContent=problem.name==='PasswordException'?'This PDF is password-protected. Upload an unlocked copy.':problem.message;$('#upload-error').hidden=false;}
  finally{await task?.destroy();button.disabled=false;button.textContent='Add worksheet';}
};
await loadLibrary();
