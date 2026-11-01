import './notebook-editor.js';
import * as Y from 'yjs';
import {escape,requestId} from '../dist/workspace-shared.js';
import {encodeState,decodeState} from './notebook-sync.mjs';
import {inspectPrintout,validatePrintout,uploadPrintout} from './pdf-printout.mjs';
import {recoverDraft} from './notebook-recovery.mjs';
const $=s=>document.querySelector(s),query=new URLSearchParams(location.search);
const practice=query.get('preview')==='1'&&!['inkwire-education.com','www.inkwire-education.com'].includes(location.hostname);
let library,book,selection,active,openEpoch=0,embeddedDirty=false,naming,refreshing=false,printoutImport=null;
const colors=['#9d89be','#67a7a3','#ccaa70','#7c9fc1','#b38ba4'];
async function request(path,body) {
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify({...body,expectedUserId:library?.userId})}),signal:AbortSignal.timeout(20000)});
  const value=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(Error(value.message||'Could not open this notebook. Please try again.'),{status:response.status});if(library?.userId&&value.userId&&value.userId!==library.userId)throw Object.assign(Error('Your signed-in account changed. Reload to open its notebooks.'),{status:401});return value;
}
const path=id=>'/api/notebooks/'+id.split('.').map(encodeURIComponent).join('/');
let adapter={
  list:()=>request('/api/notebooks'),book:id=>request(path(id)),page:(id,page)=>request(path(id)+'/pages/'+page),
  section:(id,input)=>request(path(id)+'/sections',input),create:(id,input)=>request(path(id)+'/pages',input),
  save:(id,page,update)=>request(path(id)+'/pages/'+page,{update}),move:(id,page,sectionId)=>request(path(id)+'/pages/'+page,{action:'move',sectionId}),
};
function problem(error){$('#hub-error').textContent=error?.message||String(error);$('#hub-error').hidden=false;}
function clearProblem(){$('#hub-error').hidden=true;}
function pending(){return !!printoutImport?.busy||embeddedDirty||!!active&&(active.dirty>active.saved||active.saving||active.localFailure);}
function mayNavigate(){if(!pending())return true;problem(Error('Your changes are still saving. Keep this page open, or download your draft before leaving.'));return false;}
function row(value,current,icon,subtitle='',extra='') {return `<button class="folio-row" data-id="${escape(value.id)}" aria-current="${String(current)}" ${extra}>${icon}<span class="row-copy"><b>${escape(value.title)}</b>${subtitle?`<small>${escape(subtitle)}</small>`:''}</span></button>`;}
function updateLinks(){
  const url=new URL(location.href);for(const k of ['notebookId','sectionId','pageId'])url.searchParams.delete(k);
  if(book)url.searchParams.set('notebookId',book.id);if(selection?.sectionId)url.searchParams.set('sectionId',selection.sectionId);if(selection?.pageId)url.searchParams.set('pageId',selection.pageId);
  const c=$('#class-filter').value;if(c)url.searchParams.set('classId',c);else url.searchParams.delete('classId');history.replaceState(null,'',url);
  const master=new URL(url);for(const k of ['classId','notebookId','sectionId','pageId'])master.searchParams.delete(k);$('#master-link').href=master;
  for(const [id,role] of [['student-preview','student'],['parent-preview','parent']]){const link=new URL(url);link.searchParams.set('role',role);$('#'+id).href=link;}
}
function pane(name){$('#folio-grid').dataset.pane=name;$('#mobile-pane').value=name;}
function renderBooks(){
  const classId=$('#class-filter').value,search=$('#notebook-search').value.trim().toLowerCase();
  const visible=library.notebooks.filter(b=>(!classId||b.classId===classId)&&(!search||(b.learnerName+' '+b.className).toLowerCase().includes(search)));
  $('#notebook-count').textContent=String(visible.length);
  $('#notebook-list').innerHTML=visible.length?visible.map(b=>row(b,b.id===book?.id,`<span class="book-icon" style="--book-color:${colors[library.notebooks.indexOf(b)%colors.length]}" aria-hidden="true"></span>`,b.className)).join(''):'<p class="nav-empty">No notebooks match this view.</p>';
  const scoped=library.classes.find(c=>c.id===classId);$('#hub-title').textContent=scoped?scoped.name+' notebooks':library.role==='teacher'?'Master notebooks':library.role==='parent'?'My child’s notebooks':'My notebooks';
  $('#scope-label').textContent=scoped?'CLASS NOTEBOOKS':library.role==='teacher'?'YOUR TEACHING WORKSPACE':'YOUR LEARNING WORKSPACE';
  $('#scope-description').textContent=library.role==='parent'?'A live, read-only view of the notebook shared with your child.':scoped?'Student notebooks for this class. The same pages are available from the master view.':library.role==='student'?'Your notebooks, organized by class, section, and page.':'Every student’s notebook, organized by class, section, and page.';
}
function renderLists(){
  renderBooks();$('#selected-book').textContent=book?book.learnerName+' · '+book.className:'Choose a notebook';
  $('#section-list').innerHTML=(selection?.sections||[]).map((s,i)=>row(s,s.id===selection.sectionId,`<span class="section-icon" style="--book-color:${colors[i%colors.length]}" aria-hidden="true"></span>`)).join('');
  const section=selection?.sections.find(s=>s.id===selection.sectionId);$('#selected-section').textContent=section?.title||'Choose a section';$('#page-breadcrumb').textContent=book?book.learnerName+' / '+(section?.title||'Sections'):'A LITTLE SPACE FOR BIG IDEAS';
  const pages=(selection?.pages||[]).filter(p=>p.sectionId===selection.sectionId);
  $('#page-list').innerHTML=pages.length?pages.map(p=>row(p,p.id===selection.pageId,`<span class="page-icon" aria-hidden="true">${p.kind==='worksheet'?'▧':'☷'}</span>`,p.kind==='worksheet'?(p.displayMode==='attachment'?'PDF file attachment':'PDF printout'):'Notebook page')).join(''):'<p class="nav-empty">No pages in this section yet.</p>';
  for(const id of ['add-section','add-page'])$('#'+id).disabled=!book||library.role!=='teacher';
  $('#add-printout').hidden=!book||library.role!=='teacher';
  $('#printout-hint').hidden=!book||library.role!=='teacher';
  $('#move-page').innerHTML=(selection?.sections||[]).map(s=>`<option value="${escape(s.id)}">${escape(s.title)}</option>`).join('');$('#move-page').value=selection?.sectionId||'';updateLinks();
}
function closePage(){
  openEpoch++;if(active){clearTimeout(active.timer);active.doc.destroy();active=null;}window.InkWireEditor?.destroy();embeddedDirty=false;
  $('#pdf-attachment').hidden=true;const frame=$('#worksheet-frame');frame.hidden=true;frame.removeAttribute('src');$('#note-editor').hidden=true;$('#note-editor').replaceChildren();$('#note-toolbar').hidden=true;$('#page-empty').hidden=false;$('#move-label').hidden=true;$('#download-page').hidden=true;$('#page-status').textContent='';$('#page-title').textContent='Choose a page';$('#page-meta').textContent='Open a page, or create a space for the next lesson.';
}
async function openBook(id,{initial=false}={}) {
  if(!initial&&!mayNavigate())return;const next=library.notebooks.find(b=>b.id===id);if(!next)return;
  closePage();book=next;selection=null;renderLists();const epoch=openEpoch;$('#connection').textContent='Opening notebook…';
  try{const data=await adapter.book(id);if(epoch!==openEpoch)return;selection={...data,sectionId:initial&&query.get('sectionId')||data.sections.find(s=>s.id==='classwork')?.id||data.sections[0]?.id};if(!data.sections.some(s=>s.id===selection.sectionId))selection.sectionId=data.sections[0]?.id;renderLists();
    const pages=data.pages.filter(p=>p.sectionId===selection.sectionId),chosen=initial&&pages.find(p=>p.id===query.get('pageId'))||pages[0];if(chosen)await openPage(chosen.id);else pane('pages');$('#connection').textContent=practice?'Saved on this device':'Connected';
  }catch(e){problem(e);$('#connection').textContent='Could not open notebook';}
}
function saveStatus(c){if(c!==active)return;$('#page-status').textContent=c.localFailure?'Device saving failed—download your draft.':c.dirty>c.saved?(navigator.onLine?'Saving changes…':'Saved on this device · waiting for a connection'):c.readOnly?(practice?'Read-only · follows edits in this browser':'Read-only · synchronized with the student notebook'):practice?'Saved on this device':'All changes saved online';$('#connection').textContent=navigator.onLine?'Connected':'Offline';}
async function flush(c){
  if(c!==active||c.saving||c.readOnly||c.dirty<=c.saved)return;c.saving=true;saveStatus(c);
  try{await c.persist;const generation=c.dirty,update=encodeState(Y.encodeStateAsUpdate(c.doc));const result=await adapter.save(c.bookId,c.pageId,update);if(c!==active)return;Y.applyUpdate(c.doc,decodeState(result.syncState),'remote');c.saved=generation;c.version=result.version;clearProblem();}
  catch(e){problem(e);if([401,403,404].includes(e.status))window.InkWireEditor?.setEditable(false);}
  finally{c.saving=false;saveStatus(c);if(c===active&&c.dirty>c.saved)c.timer=setTimeout(()=>flush(c),navigator.onLine?2500:6000);}
}
async function openPage(id){
  if(!mayNavigate())return;const page=selection?.pages.find(p=>p.id===id);if(!page)return;closePage();const epoch=openEpoch;selection.pageId=id;renderLists();pane('content');
  $('#page-title').textContent=page.title;$('#page-breadcrumb').textContent=book.learnerName+' / '+selection.sections.find(s=>s.id===page.sectionId)?.title;$('#page-meta').textContent=book.className+(library.role==='parent'?' · Parent view · read only':' · Shared student notebook');$('#move-label').hidden=library.role!=='teacher';$('#move-page').value=page.sectionId;$('#page-empty').hidden=true;
  if(page.kind==='worksheet'&&page.displayMode==='attachment'){
    $('#pdf-attachment').hidden=false;$('#attachment-title').textContent=page.title;$('#page-status').textContent='Downloadable PDF file';const link=$('#download-pdf');link.download=page.title+'.pdf';
    if(practice){link.href='#';link.onclick=async e=>{e.preventDefault();const {createPreviewAdapter}=await import('./worksheet-preview-adapter.js');const ws=await createPreviewAdapter(library.role,{classId:book.classId,learnerId:book.learnerId,liveParent:true});await ws.metadata(page.id);const url=URL.createObjectURL(new Blob([await ws.pdf()],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download=page.title+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};}
    else{link.onclick=null;link.href='/api/worksheets/'+page.id+'/pdf?'+new URLSearchParams({learnerId:book.learnerId,notebook:'1',download:'1'});}return;
  }
  if(page.kind==='worksheet'){
    const url=new URL(practice?'worksheets.html':'/worksheets',location.href);for(const [k,v] of Object.entries({class:book.classId,learner:book.learnerId,worksheet:page.id,notebook:'1',embed:'1'}))url.searchParams.set(k,v);if(practice){url.searchParams.set('preview','1');url.searchParams.set('role',library.role);}$('#worksheet-frame').src=url;$('#worksheet-frame').hidden=false;$('#page-status').textContent='PDF background locked · '+(library.role==='parent'?'live read-only view':'type and draw over the page');return;
  }
  $('#page-status').textContent='Loading page…';
  try{
    const {page:latest}=await adapter.page(book.id,id);if(epoch!==openEpoch)return;if(!latest?.syncState)throw Error('The page could not be loaded.');
    const doc=new Y.Doc();Y.applyUpdate(doc,decodeState(latest.syncState),'remote');
    const c={doc,bookId:book.id,pageId:id,readOnly:library.role==='parent',dirty:0,saved:0,version:latest.version,persist:Promise.resolve()};
    c.draftKey=(library.userId||'practice-'+library.role)+':'+book.id+':'+id;
    try{if(!c.readOnly){const cached=await recoverDraft(c.draftKey);if(cached){Y.applyUpdate(doc,new Uint8Array(cached),'remote');c.dirty=1;}}}catch(e){c.localFailure=true;problem(Error('Device recovery is unavailable. Keep this page open and download your draft before leaving.'));}
    if(epoch!==openEpoch){doc.destroy();return;}active=c;$('#note-editor').hidden=false;$('#note-toolbar').hidden=c.readOnly;$('#download-page').hidden=false;
    doc.on('update',(update,origin)=>{if(origin==='remote'||c.readOnly||c!==active)return;c.dirty++;c.persist=c.persist.then(()=>recoverDraft(c.draftKey,Y.encodeStateAsUpdate(doc))).catch(()=>{c.localFailure=true;problem(Error('Could not save a device copy. Download your draft before leaving.'));});clearTimeout(c.timer);c.timer=setTimeout(()=>flush(c),400);saveStatus(c);});
    window.InkWireEditor.mount({element:$('#note-editor'),toolbar:$('#note-toolbar'),label:page.title,ydoc:doc,readOnly:c.readOnly,onChange:()=>{},onRecovery:()=>problem(Error('Some page formatting could not be displayed.'))});saveStatus(c);if(c.dirty)flush(c);
  }catch(e){problem(e);$('#page-status').textContent='Could not open page';}
}
$('#notebook-list').onclick=e=>{const b=e.target.closest('[data-id]');if(b)openBook(b.dataset.id);};
$('#section-list').onclick=e=>{const b=e.target.closest('[data-id]');if(!b||!mayNavigate())return;closePage();selection.sectionId=b.dataset.id;selection.pageId=null;renderLists();pane('pages');const first=selection.pages.find(p=>p.sectionId===selection.sectionId);if(first)openPage(first.id);};
$('#page-list').onclick=e=>{const b=e.target.closest('[data-id]');if(b)openPage(b.dataset.id);};
$('#notebook-search').oninput=renderBooks;
$('#class-filter').onchange=()=>{if(!mayNavigate()){$('#class-filter').value=query.get('classId')||'';return;}renderBooks();const first=library.notebooks.find(b=>!$('#class-filter').value||b.classId===$('#class-filter').value);if(first)openBook(first.id);else{closePage();book=null;selection=null;renderLists();}pane('notebooks');};
$('#toggle-navigation').onclick=()=>{const focused=$('#folio-grid').classList.toggle('focus-page');$('#toggle-navigation').textContent=focused?'Show notebooks ↙':'Focus on page ↗';$('#toggle-navigation').setAttribute('aria-expanded',String(!focused));if(focused)pane('content');};
$('#mobile-pane').onchange=e=>pane(e.target.value);
for(const nav of document.querySelectorAll('.folio-column nav'))nav.addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;const buttons=[...nav.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(i<0)return;e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,i+(e.key==='ArrowDown'?1:-1)))]?.focus();});
for(const [id,kind] of [['add-section','section'],['add-page','page']])$('#'+id).onclick=()=>{if(!mayNavigate()||!book||library.role!=='teacher')return;naming=kind;$('#name-heading').textContent=kind==='section'?'New section':'New page';$('#new-name').placeholder=kind==='section'?'e.g. Week 3 · Character study':'e.g. Class summary';$('#new-name').value='';$('#name-error').textContent='';$('#name-dialog').showModal();$('#new-name').focus();};
$('#name-cancel').onclick=()=>$('#name-dialog').close();
$('#name-form').onsubmit=async e=>{e.preventDefault();const title=$('#new-name').value.trim();if(!title)return;const submit=e.target.querySelector('[type=submit]'),id=requestId();submit.disabled=true;
  try{if(naming==='section')await adapter.section(book.id,{id,title});else await adapter.create(book.id,{id,title,sectionId:selection.sectionId});const data=await adapter.book(book.id);selection={...data,sectionId:naming==='section'?id:selection.sectionId};$('#name-dialog').close();renderLists();if(naming==='page')await openPage(id);else{closePage();pane('pages');}}
  catch(e){$('#name-error').textContent=e.message;}finally{submit.disabled=false;}};
$('#move-page').onchange=async e=>{const previous=selection.sectionId;if(!mayNavigate()){e.target.value=previous;return;}try{await adapter.move(book.id,selection.pageId,e.target.value);const id=selection.pageId,data=await adapter.book(book.id);selection={...data,sectionId:e.target.value,pageId:id};renderLists();clearProblem();}catch(error){e.target.value=previous;problem(error);}};
$('#download-page').onclick=()=>{if(!active)return;const bytes=JSON.stringify({notebook:book.learnerName,page:$('#page-title').textContent,savedAt:new Date().toISOString(),syncState:encodeState(Y.encodeStateAsUpdate(active.doc)),text:window.InkWireEditor.getText()},null,2);const u=URL.createObjectURL(new Blob([bytes],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='folio-page-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==$('#worksheet-frame').contentWindow)return;if(e.data?.type==='inkwire:worksheet-status')embeddedDirty=!!e.data.dirty;if(e.data?.type==='inkwire:pdf-drop'&&e.data.file instanceof File)offerPrintout(e.data.file);});
window.addEventListener('beforeunload',e=>{if(pending()){e.preventDefault();e.returnValue='';}});
window.addEventListener('online',()=>{if(active)flush(active);poll();});
async function poll(){if(refreshing||!book||!selection||document.hidden)return;refreshing=true;const currentBook=book,epoch=openEpoch,c=active;
  try{if(c){const {page}=await adapter.page(c.bookId,c.pageId);if(c===active&&page?.syncState){Y.applyUpdate(c.doc,decodeState(page.syncState),'remote');c.version=page.version;window.InkWireEditor?.setEditable(!c.readOnly);saveStatus(c);}}
    const fresh=await adapter.book(currentBook.id);if(book===currentBook&&epoch===openEpoch){const shape=v=>JSON.stringify({sections:v.sections,pages:v.pages.map(p=>({id:p.id,title:p.title,sectionId:p.sectionId,kind:p.kind,displayMode:p.displayMode}))});const changed=shape(selection)!==shape(fresh);selection={...fresh,sectionId:selection.sectionId,pageId:selection.pageId};if(changed)renderLists();}
  }catch(e){if(epoch===openEpoch){problem(e);$('#connection').textContent=e.status===401?'Sign-in expired':'Reconnecting…';if([401,403,404].includes(e.status))window.InkWireEditor?.setEditable(false);}}
  finally{refreshing=false;}}
async function initialize(){
  try{if(practice){adapter=await(await import('./notebook-preview.mjs')).previewAdapter(query.get('role')||'teacher');$('#practice-banner').hidden=false;}
    library=await adapter.list();if(!library.classes.length)library.classes=[...new Map(library.notebooks.map(b=>[b.classId,{id:b.classId,name:b.className}])).values()];$('#view-label').textContent=library.role==='parent'?'Parent · read only':library.role==='student'?'Student notebook':'Teacher workspace';$('#dashboard-link').textContent=library.role==='teacher'?'Teacher dashboard':library.role==='parent'?'Parent dashboard':'Student dashboard';$('#dashboard-link').href=practice?'studio.html?role='+library.role:'/'+library.role;
    $('#class-filter').innerHTML='<option value="">All classes</option>'+library.classes.map(c=>`<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('');$('#class-filter').value=library.classes.some(c=>c.id===query.get('classId'))?query.get('classId'):'';
    renderLists();const visible=library.notebooks.filter(b=>!$('#class-filter').value||b.classId===$('#class-filter').value),first=visible.find(b=>b.id===query.get('notebookId'))||visible[0];if(first)await openBook(first.id,{initial:true});else{$('#connection').textContent='No notebooks yet';$('#page-meta').textContent='Add students to a class to see their notebooks here.';}
  }catch(e){problem(e);$('#connection').textContent='Could not load notebooks';if(e.status===401){const a=document.createElement('a');a.href='/account';a.textContent='Sign in to your website account →';$('#page-empty').append(a);}}}
function offerPrintout(file){
  if(printoutImport?.busy)return;
  if(!book||!selection||library.role!=='teacher'){problem(Error('Choose a student notebook in your teacher view before inserting a PDF.'));return;}
  if(!mayNavigate())return;
  if(!$('#printout-dialog').open){printoutImport={bookId:book.id,classId:book.classId,learnerId:book.learnerId,sectionId:selection.sectionId,id:requestId(),file:null};$('#printout-name').value='';$('#printout-explanation').textContent='Every PDF page stays locked underneath writing and drawing. Each student in this class has a separate copy.';document.querySelector('[name="pdf-display"][value="printout"]').checked=true;$('#printout-file').value='';$('#printout-file-name').textContent='Up to 10 MB · 60 pages';$('#printout-target').textContent=book.learnerName+' · '+book.className+' / '+selection.sections.find(s=>s.id===selection.sectionId)?.title;$('#printout-error').hidden=true;$('#printout-dialog').showModal();}
  if(file){try{validatePrintout(file);printoutImport.file=file;printoutImport.id=requestId();$('#printout-file-name').textContent=file.name;if(!$('#printout-name').value)$('#printout-name').value=file.name.replace(/\.pdf$/i,'').slice(0,120);$('#printout-error').hidden=true;}catch(e){$('#printout-error').textContent=e.message;$('#printout-error').hidden=false;}}
}
$('#add-printout').onclick=()=>offerPrintout();
for(const input of document.querySelectorAll('[name="pdf-display"]'))input.onchange=()=>{$('#printout-explanation').textContent=input.value==='attachment'?'The original PDF is saved as a downloadable file. It does not cover your notebook page.':'Every PDF page stays locked underneath writing and drawing. Each student in this class has a separate copy.';};
$('#printout-file').onchange=e=>offerPrintout(e.target.files[0]);
$('#printout-cancel').onclick=()=>{if(!printoutImport?.busy){$('#printout-dialog').close();printoutImport=null;}};
$('#printout-dialog').addEventListener('cancel',e=>{if(printoutImport?.busy)e.preventDefault();else printoutImport=null;});
let fileDragDepth=0;
const fileDrag=e=>Array.from(e.dataTransfer?.types||[]).includes('Files');
document.addEventListener('dragenter',e=>{if(!fileDrag(e))return;e.preventDefault();fileDragDepth++;if(library?.role==='teacher'&&book&&!$('#printout-dialog').open)$('#pdf-drop-overlay').hidden=false;});
document.addEventListener('dragover',e=>{if(fileDrag(e)){e.preventDefault();e.dataTransfer.dropEffect=library?.role==='teacher'?'copy':'none';}});
document.addEventListener('dragleave',e=>{if(!fileDrag(e))return;if(--fileDragDepth<=0){fileDragDepth=0;$('#pdf-drop-overlay').hidden=true;}});
document.addEventListener('drop',e=>{if(!fileDrag(e))return;e.preventDefault();fileDragDepth=0;$('#pdf-drop-overlay').hidden=true;if(e.dataTransfer.files.length!==1){problem(Error('Drop one PDF at a time.'));return;}offerPrintout(e.dataTransfer.files[0]);});
$('#printout-form').onsubmit=async e=>{
  e.preventDefault();const upload=printoutImport;if(!upload||upload.busy)return;const title=$('#printout-name').value.trim();
  try{validatePrintout(upload.file);if(!title)throw Error('Enter a page title.');}catch(error){$('#printout-error').textContent=error.message;$('#printout-error').hidden=false;return;}
  upload.busy=true;$('#printout-submit').disabled=true;$('#printout-cancel').disabled=true;$('#printout-file').disabled=true;$('#printout-name').disabled=true;$('#printout-error').hidden=true;$('#printout-submit').textContent='Checking PDF…';
  try{
    const displayMode=document.querySelector('[name="pdf-display"]:checked').value;const pages=await inspectPrintout(upload.file);$('#printout-submit').textContent='Uploading…';
    if(practice){const {createPreviewAdapter}=await import('./worksheet-preview-adapter.js');const ws=await createPreviewAdapter('teacher',{classId:upload.classId,learnerId:upload.learnerId,liveParent:true});await ws.upload(upload.file,pages,title,upload.id,displayMode);}
    else await uploadPrintout({file:upload.file,pages,title,id:upload.id,classId:upload.classId,displayMode});
    if(upload.sectionId!=='printouts')await adapter.move(upload.bookId,upload.id,upload.sectionId);
    const data=await adapter.book(upload.bookId);selection={...data,sectionId:upload.sectionId};upload.busy=false;$('#printout-dialog').close();printoutImport=null;clearProblem();renderLists();await openPage(upload.id);
  }catch(error){$('#printout-error').textContent=error.message;$('#printout-error').hidden=false;}
  finally{upload.busy=false;$('#printout-submit').disabled=false;$('#printout-cancel').disabled=false;$('#printout-file').disabled=false;$('#printout-name').disabled=false;$('#printout-submit').textContent='Insert PDF';}
};
await initialize();setInterval(poll,2000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
