import {pageTitleSession,formatPageCreatedAt} from './notebook-page-title.mjs';
import {mountCloudSync} from './notebook-cloud.mjs';
import {mountNotebookNavigation,initialNotebook} from './notebook-navigation.mjs';
import {notebookFileType} from './notebook-file-node.mjs';
import {officeJob,cleanOfficeJobs} from '../dist/office-jobs.mjs';
import {mountNotebookMenus} from './notebook-menus.mjs';
import {mountWorksheet} from './worksheets.js';
import './notebook-editor.js';
import * as Y from 'yjs';
import {escape,requestId,api} from '../dist/workspace-shared.js';
import {encodeState,decodeState} from './notebook-sync.mjs';
import {inspectPrintout,validatePrintout} from './pdf-printout.mjs';
import {recoverDraft} from './notebook-recovery.mjs';
const $=s=>document.querySelector(s),query=new URLSearchParams(location.search);
const practice=query.get('preview')==='1'&&!['inkwire-education.com','www.inkwire-education.com'].includes(location.hostname);
let titleSession=null,inlineRename=null,newSectionOptions={},fileBusy=false,syncBusy=false,syncError='',refreshTask,embeddedSyncStatus='',embeddedSyncError='',embeddedLocalFailure=false;
const namedUntitledPages=new Set();
let library,book,selection,active,openEpoch=0,embeddedDirty=false,naming,refreshing=false,printoutImport=null,worksheetMount=null,worksheetLoading=false;
const colors=['#9d89be','#67a7a3','#ccaa70','#7c9fc1','#b38ba4'];
async function request(path,body) {
  const response=await fetch(path,{credentials:'same-origin',cache:'no-store',method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify({...body,expectedUserId:library?.userId})}),signal:AbortSignal.timeout(body?.action==='translate'?120000:60000)});
  const value=await response.json().catch(()=>({}));if(!response.ok)throw Object.assign(Error(value.message||'Could not open this notebook. Please try again.'),{status:response.status});if(library?.userId&&value.userId&&value.userId!==library.userId)throw Object.assign(Error('Your signed-in account changed. Reload to open its notebooks.'),{status:401});return value;
}
const path=id=>'/api/notebooks/'+id.split('.').map(encodeURIComponent).join('/');
let adapter={
  list:()=>request('/api/notebooks'),book:id=>request(path(id)),page:(id,page)=>request(path(id)+'/pages/'+page),
  organize:(id,input)=>request(path(id)+'/organize',input),versions:(id,page)=>request(path(id)+'/versions/'+page),trash:id=>request(path(id)+'/trash'),
  section:(id,input)=>request(path(id)+'/sections',input),create:(id,input)=>request(path(id)+'/pages',input),
  rename:(id,page,title,expectedTitle)=>request(path(id)+'/pages/'+page,{action:'rename',title,expectedTitle}),
  save:(id,page,update)=>request(path(id)+'/pages/'+page,{update}),move:(id,page,sectionId)=>request(path(id)+'/pages/'+page,{action:'move',sectionId}),
};
const notebookNavigation=mountNotebookNavigation({grid:$('#folio-grid'),onToggle:()=>$('#toggle-navigation').click(),onSearch(){showNotebookBrowser('notebooks');$('#notebook-search').focus();},onRecent(){showNotebookBrowser('sections');renderRecentPages();notebookNavigation.showRecent();}});
function showNotebookBrowser(name){$('#folio-grid').classList.remove('focus-page');document.documentElement.classList.remove('ink-note-focus');pane(name);syncNavigationButton();}
function recentKey(){return 'inkwire-recent-pages:'+JSON.stringify([library?.userId||'practice',library?.role]);}
function recentPages(){try{const data=JSON.parse(localStorage.getItem(recentKey())||'[]');return Array.isArray(data)?data.filter(p=>p&&typeof p.title==='string'&&typeof p.pageId==='string'&&library?.notebooks.some(b=>b.id===p.bookId)).slice(0,20):[];}catch{return [];}}
function rememberPage(page){if(!library||!book)return;try{localStorage.setItem(recentKey(),JSON.stringify([{bookId:book.id,pageId:page.id,sectionId:page.sectionId,title:page.title},...recentPages().filter(p=>p.bookId!==book.id||p.pageId!==page.id)].slice(0,20)));}catch{}}
function renderRecentPages(){const pages=recentPages();$('#notebook-recent-list').innerHTML=pages.length?pages.map(p=>{const b=library.notebooks.find(b=>b.id===p.bookId);return `<button type="button" class="folio-row" data-recent-book="${escape(p.bookId)}" data-recent-page="${escape(p.pageId)}"><span class="page-icon" aria-hidden="true">☷</span><span class="row-copy"><b>${escape(p.title)}</b><small>${escape((b.teacherBook?'Teacher notebook':b.learnerName)+' · '+b.className)}</small></span></button>`;}).join(''):'<p class="nav-empty">Pages you open will appear here.</p>';}
$('#notebook-recent-list').onclick=async event=>{const button=event.target.closest('[data-recent-page]');if(!button||!mayNavigate())return;try{const id=button.dataset.recentBook;if(book?.id!==id)await openBook(id);if(book?.id!==id)return;const page=selection.pages.find(p=>p.id===button.dataset.recentPage);if(!page){problem(Error('This page is no longer available in the notebook.'));return;}selection.sectionId=page.sectionId;notebookNavigation.closeChooser();await openPage(page.id);}catch(error){problem(error);}};
function problem(error){const banner=$('#hub-error');banner.textContent=error?.message||String(error);banner.hidden=false;if(active?.localFailure&&active.dirty>active.saved){const button=document.createElement('button');button.type='button';button.textContent='Save recovery copy';button.onclick=downloadDraft;banner.append(' ',button);}}
function clearProblem(){$('#hub-error').hidden=true;}
const cloudSync=mountCloudSync($('#notebook-sync'),{observe:[$('#connection'),$('#page-status')],getState(){
 const loading=!library||/Opening|Loading/.test($('#connection').textContent+' '+$('#page-status').textContent)||worksheetLoading;
 const error=titleSession?.error||active?.saveError||syncError||embeddedSyncError||(/Needs review|Could not|expired|Reconnecting/.test(embeddedSyncStatus+' '+$('#connection').textContent+' '+$('#page-status').textContent)?embeddedSyncStatus||$('#page-status').textContent||$('#connection').textContent:'');
 return {online:navigator.onLine,loading,busy:syncBusy||fileBusy||printoutImport?.busy||active?.saving||titleSession?.saving,dirty:titleSession?.dirty||embeddedDirty||!!active&&active.dirty>active.saved,localFailure:active?.localFailure||embeddedLocalFailure,error,localOnly:practice,readOnly:active?.readOnly,disabled:syncBusy||active?.saving||worksheetLoading||fileBusy||!library};
},onSync:async()=>{
 if(syncBusy)return;syncBusy=true;syncError='';cloudSync.render();
 try{if(!navigator.onLine){problem(Error('You are offline. Your changes will sync when the connection returns.'));return;}
  await titleSession?.flush();if(titleSession?.error)throw Error(titleSession.error);const current=active;if(current&&!current.readOnly){clearTimeout(current.timer);await flush(current);if(current.saveError||current.localFailure||current.dirty>current.saved)throw Error(current.saveError||'Some changes are still waiting to save.');}
  if(worksheetMount)await worksheetMount.sync();await poll({force:true});
 }catch(error){syncError=error.message;problem(error);}finally{syncBusy=false;cloudSync.render();}
}});
function renamePending(){return !!inlineRename&&(inlineRename.saving||inlineRename.input.value.trim()!==inlineRename.title);}
function pending(){return titleSession?.dirty||titleSession?.saving||renamePending()||fileBusy||worksheetLoading||!!printoutImport?.busy||embeddedDirty||!!active&&(active.dirty>active.saved||active.saving||active.localFailure);}
function locallyRecoverable(){if(titleSession?.dirty&&!titleSession.locallySaved)return false;if(renamePending()||fileBusy||worksheetLoading||printoutImport?.busy)return false;if(active)return active.dirty<=active.saved||!active.localFailure&&active.localSaved>=active.dirty;return !embeddedDirty||!!worksheetMount?.locallySaved();}
function mayNavigate(){if(!pending()||locallyRecoverable())return true;problem(Error('Your browser is still saving this page. Keep it open for a moment, then try again.'));return false;}
function row(value,current,icon,subtitle='',extra='') {const menu=(value.sectionId||selection?.sections?.some(s=>s.id===value.id))?`<button type="button" class="folio-row-menu" data-item-menu data-id="${escape(value.id)}" aria-label="Options for ${escape(value.title)}" aria-haspopup="menu" title="More options">⋯</button>`:'';return `<div class="folio-nav-item" style="--item-depth:${value.depth||0}"><button class="folio-row" data-id="${escape(value.id)}" aria-current="${String(current)}" ${extra}>${icon}<span class="row-copy"><b>${escape(value.title)}</b>${subtitle?`<small>${escape(subtitle)}</small>`:''}</span></button>${menu}</div>`;}

function updateLinks(){
  const url=new URL(location.href);for(const k of ['notebookId','sectionId','pageId'])url.searchParams.delete(k);
  if(book)url.searchParams.set('notebookId',book.id);if(selection?.sectionId)url.searchParams.set('sectionId',selection.sectionId);if(selection?.pageId)url.searchParams.set('pageId',selection.pageId);
  const c=$('#class-filter').value;if(c)url.searchParams.set('classId',c);else url.searchParams.delete('classId');history.replaceState(null,'',url);
  const master=new URL(url);for(const k of ['classId','notebookId','sectionId','pageId'])master.searchParams.delete(k);$('#master-link').href=master;
  for(const [id,role] of [['student-preview','student'],['parent-preview','parent']]){const link=new URL(url);link.searchParams.set('role',role);$('#'+id).href=link;}
}
function pane(name){$('#folio-grid').dataset.pane=name;$('#mobile-pane').value=name;notebookNavigation.setPane(name);}
function renderBooks(){
  notebookNavigation.setBook(book);
  const classId=$('#class-filter').value,search=$('#notebook-search').value.trim().toLowerCase();
  const visible=library.notebooks.filter(b=>(!classId||b.classId===classId)&&(!search||(b.learnerName+' '+b.className).toLowerCase().includes(search)));
  $('#notebook-count').textContent=String(visible.length);
  $('#notebook-list').innerHTML=visible.length?visible.map(b=>row(b,b.id===book?.id,b.teacherBook?'<span class="teacher-book-pin" aria-hidden="true">⌖</span>':`<span class="book-icon" style="--book-color:${colors[library.notebooks.indexOf(b)%colors.length]}" aria-hidden="true"></span>`,b.className+(b.teacherBook?' · Private':''))).join(''):'<p class="nav-empty">No notebooks match this view.</p>';
  const scoped=library.classes.find(c=>c.id===classId);$('#hub-title').textContent=scoped?scoped.name+' notebooks':library.role==='teacher'?'Master notebooks':library.role==='parent'?'My child’s notebooks':'My notebooks';
  $('#scope-label').textContent=scoped?'CLASS NOTEBOOKS':library.role==='teacher'?'YOUR TEACHING WORKSPACE':'YOUR LEARNING WORKSPACE';
  $('#scope-description').textContent='';
}
function renderLists(){
  renderBooks();$('#selected-book').textContent=book?book.learnerName+' · '+book.className:'Choose a notebook';
  if(inlineRename?.kind!=='section')$('#section-list').innerHTML=(selection?.sections||[]).map((s,i)=>row(s,s.id===selection.sectionId,`<span class="section-icon ${s.group?'section-group-icon':''}" style="--book-color:${s.color||colors[i%colors.length]}" aria-hidden="true">${s.group?'▤':s.locked?'⌑':''}</span>`)).join('');
  const section=selection?.sections.find(s=>s.id===selection.sectionId);$('#selected-section').textContent=section?.title||'Choose a section';$('#page-breadcrumb').textContent=book?book.learnerName+' / '+(section?.title||'Sections'):'A LITTLE SPACE FOR BIG IDEAS';
  const page=selection?.pages.find(p=>p.id===selection.pageId),location=page?[book?.teacherBook?'Teacher notebook':book?.learnerName,section?.title,page.title].filter(Boolean).join(' / '):'';$('#notebook-page-location').textContent=location;$('#notebook-page-location').title=location;
  const pages=(selection?.pages||[]).filter(p=>p.sectionId===selection.sectionId);
  if(inlineRename?.kind!=='page')$('#page-list').innerHTML=pages.length?pages.map(p=>row(p,p.id===selection.pageId,`<span class="page-icon" aria-hidden="true">${p.kind==='worksheet'?'▧':'☷'}</span>`,'')).join(''):'<p class="nav-empty">No pages in this section yet.</p>';
  for(const id of ['add-section','add-page'])$('#'+id).disabled=!book||library.role!=='teacher';$('#add-page').disabled ||= !!section?.group||!!section?.locked;$('#notebook-deleted-items').hidden=library.role!=='teacher';$('#distribute-page').hidden=library.role!=='teacher'||!selection?.pageId;
  $('#add-printout').hidden=!book||library.role!=='teacher';
  $('#printout-hint').hidden=!book||library.role!=='teacher';
  updateLinks();
}
function closePage(){
  titleSession?.release();titleSession=null;
  openEpoch++;syncError='';embeddedSyncStatus='';embeddedSyncError='';embeddedLocalFailure=false;if(active){clearTimeout(active.timer);active.pdfHandles?.forEach(task=>task.destroy());active.doc.destroy();active=null;}window.InkWireEditor?.destroy();embeddedDirty=false;
  $('#pdf-attachment').hidden=true;worksheetMount?.destroy();worksheetMount=null;const frame=$('#worksheet-embed');frame.hidden=true;frame.replaceChildren();$('#note-editor').hidden=true;$('#note-body').replaceChildren();$('#note-toolbar').hidden=true;$('#note-toolbar').replaceChildren();$('#page-empty').hidden=false;$('#page-status').textContent='';$('#distribute-page').hidden=true;$('#page-title').value='Choose a page';$('#page-meta').textContent='Open a page, or create a space for the next lesson.';
}
async function openBook(id,{initial=false}={}) {
  if(!initial&&!mayNavigate())return;const next=library.notebooks.find(b=>b.id===id);if(!next)return;
  notebookNavigation.closeChooser();closePage();book=next;selection=null;renderLists();const epoch=openEpoch;$('#connection').textContent='Opening notebook…';
  try{const data=await adapter.book(id);if(epoch!==openEpoch)return;selection={...data,sectionId:initial&&query.get('sectionId')||data.sections.find(s=>s.id==='classwork')?.id||data.sections[0]?.id};if(!data.sections.some(s=>s.id===selection.sectionId))selection.sectionId=data.sections[0]?.id;renderLists();
    const pages=data.pages.filter(p=>p.sectionId===selection.sectionId),chosen=initial&&pages.find(p=>p.id===query.get('pageId'))||pages[0];if(chosen)await openPage(chosen.id);else pane('pages');$('#connection').textContent=practice?'Saved on this device':'Connected';
  }catch(e){problem(e);$('#connection').textContent='Could not open notebook';}
}
function saveStatus(c){if(c!==active)return;$('#page-status').textContent=c.localFailure?'Device saving failed—download your draft.':c.dirty>c.saved?(navigator.onLine?'Saving changes…':'Saved on this device · waiting for a connection'):c.readOnly?'Read only':'Saved';$('#connection').textContent=navigator.onLine?'Connected':'Offline';}
async function flush(c){
  if(c!==active||c.saving||c.readOnly||c.dirty<=c.saved)return;c.saving=true;saveStatus(c);
  try{await c.persist;const generation=c.dirty,update=encodeState(Y.encodeStateAsUpdate(c.doc));const result=await adapter.save(c.bookId,c.pageId,update);if(c!==active)return;Y.applyUpdate(c.doc,decodeState(result.syncState),'remote');c.saved=generation;c.version=result.version;c.saveError='';clearProblem();}
  catch(e){c.saveError=e.message;problem(e);if([401,403,404].includes(e.status))window.InkWireEditor?.setEditable(false);}
  finally{c.saving=false;saveStatus(c);if(c===active&&c.dirty>c.saved)c.timer=setTimeout(()=>flush(c),navigator.onLine?2500:6000);}
}
async function openPage(id){
  if(!mayNavigate())return;const page=selection?.pages.find(p=>p.id===id);if(!page)return;closePage();const epoch=openEpoch;selection.pageId=id;rememberPage(page);renderLists();pane('content');
  $('#page-title').readOnly=true;$('#page-title').value=page.title;$('#page-breadcrumb').textContent=book.learnerName+' / '+selection.sections.find(s=>s.id===page.sectionId)?.title;$('#page-meta').textContent=book.className+(book.teacherBook?' · Private teacher notebook':library.role==='parent'?' · Parent view · read only':' · Shared student notebook');$('#page-empty').hidden=true;
  if(page.kind==='worksheet'&&page.displayMode==='attachment'){
    $('#pdf-attachment').hidden=false;$('#attachment-title').textContent=page.title;$('#page-status').textContent='Downloadable PDF file';const link=$('#download-pdf');link.download=page.title+'.pdf';
    if(practice){link.href='#';link.onclick=async e=>{e.preventDefault();const {createPreviewAdapter}=await import('./worksheet-preview-adapter.js');const ws=await createPreviewAdapter(library.role,{classId:book.classId,learnerId:book.learnerId,liveParent:true});await ws.metadata(page.id);const url=URL.createObjectURL(new Blob([await ws.pdf()],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download=page.title+'.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};}
    else{link.onclick=null;link.href='/api/worksheets/'+page.id+'/pdf?'+new URLSearchParams({learnerId:book.learnerId,notebook:'1',download:'1'});}return;
  }
  if(page.kind==='worksheet'){
    const root=$('#worksheet-embed');root.innerHTML=__WORKSHEET_MARKUP__;root.hidden=false;worksheetLoading=true;$('#page-status').textContent='Opening PDF printout…';
    const params=new URLSearchParams({class:book.classId,learner:book.learnerId,worksheet:page.id,notebook:'1',embed:'1'});if(practice){params.set('preview','1');params.set('role',library.role);}
    try{worksheetMount=await mountWorksheet(root,{query:params,feedbackHost:$('#notebook-feedback-host'),onDirty:dirty=>{embeddedDirty=dirty;cloudSync.render();},onStatus:message=>{embeddedSyncStatus=message;cloudSync.render();},onSyncError:message=>{embeddedSyncError=message;cloudSync.render();},onLocalFailure:failed=>{embeddedLocalFailure=failed;cloudSync.render();},onPdfDrop:offerFiles});$('#page-status').textContent='';}catch(error){problem(error);}finally{worksheetLoading=false;}return;
  }

  $('#page-status').textContent='Loading page…';
  try{
    const {page:latest}=await adapter.page(book.id,id);if(epoch!==openEpoch)return;if(!latest?.syncState)throw Error('The page could not be loaded.');
    const doc=new Y.Doc();Y.applyUpdate(doc,decodeState(latest.syncState),'remote');
    const c={doc,bookId:book.id,pageId:id,readOnly:library.role==='parent',dirty:0,saved:0,localSaved:0,version:latest.version,persist:Promise.resolve()};
    c.draftKey=(library.userId||'practice-'+library.role)+':'+book.id+':'+id;
    try{if(!c.readOnly){const cached=await recoverDraft(c.draftKey);if(cached){Y.applyUpdate(doc,new Uint8Array(cached),'remote');c.dirty=1;c.localSaved=1;}}}catch(e){c.localFailure=true;problem(Error('Device recovery is unavailable. Keep this page open and download your draft before leaving.'));}
    if(epoch!==openEpoch){doc.destroy();return;}active=c;$('#note-editor').hidden=false;$('#note-toolbar').hidden=c.readOnly;
    doc.on('update',(update,origin)=>{if(origin==='remote'||c.readOnly||c!==active)return;c.dirty++;const generation=c.dirty,bytes=Y.encodeStateAsUpdate(doc);c.persist=c.persist.then(()=>recoverDraft(c.draftKey,bytes)).then(()=>{c.localSaved=generation;c.localFailure=false;if(c===active)cloudSync.render();}).catch(()=>{c.localFailure=true;problem(Error('Browser saving is unavailable. Keep this page open while cloud sync retries.'));});clearTimeout(c.timer);c.timer=setTimeout(()=>flush(c),400);saveStatus(c);});
    const pdfTasks=new Map();c.pdfTasks=pdfTasks;
    const loadPdf=assetId=>{if(!pdfTasks.has(assetId))pdfTasks.set(assetId,(async()=>{const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc='/pdf/pdf.worker.min.mjs';let bytes;
      if(practice){const {previewPdf}=await import('./notebook-pdf-preview.mjs');const file=await previewPdf(c.bookId+':'+c.pageId+':'+assetId);if(!file)throw Error('PDF unavailable.');bytes=new Uint8Array(await file.arrayBuffer());}
      else{const response=await fetch(path(c.bookId)+'/pages/'+c.pageId+'/pdfs/'+assetId,{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw Error('PDF unavailable.');bytes=new Uint8Array(await response.arrayBuffer());}
      const task=pdfjs.getDocument({data:bytes,isEvalSupported:false,cMapUrl:'/pdf/cmaps/',cMapPacked:true,standardFontDataUrl:'/pdf/standard_fonts/',wasmUrl:'/pdf/wasm/'});c.pdfHandles||=[];c.pdfHandles.push(task);return task.promise;
    })());return pdfTasks.get(assetId);};
    const loadAsset=async assetId=>{if(practice){const {previewPdf}=await import('./notebook-pdf-preview.mjs');const file=await previewPdf(c.bookId+':'+c.pageId+':file:'+assetId);if(!file)throw Error('File unavailable.');return file;}const response=await fetch(path(c.bookId)+'/pages/'+c.pageId+'/assets/'+assetId,{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw Error('File unavailable.');return response.blob();};
    titleEditing(page);window.InkWireEditor.mount({loadAsset,loadPdf,onInsertPdf:library.role==='teacher'?()=>offerFiles():null,element:$('#note-body'),toolbar:$('#note-toolbar'),label:page.title,ydoc:doc,readOnly:c.readOnly,onChange:()=>{},onRecovery:()=>problem(Error('Some page formatting could not be displayed.'))});saveStatus(c);if(c.dirty)flush(c);
  }catch(e){problem(e);$('#page-status').textContent='Could not open page';}
}
const titleField=$('#page-title');
async function renameInline(kind,item){
 if(library?.role!=='teacher'||!book||!item||!mayNavigate())return;
 if(titleSession?.dirty||titleSession?.saving){await titleSession.flush();if(titleSession.error)return;}
 const section=kind==='section'?item:selection.sections.find(s=>s.id===item.sectionId);if(section?.locked)return;
 if(inlineRename){inlineRename.input.focus();return;}
 const list=$('#'+(kind==='page'?'page-list':'section-list')),button=[...list.querySelectorAll('.folio-row')].find(row=>row.dataset.id===item.id);if(!button)return;
 const container=document.createElement('div');container.className=button.className+' folio-naming-row';container.setAttribute('aria-current',button.getAttribute('aria-current'));container.dataset.id=item.id;
 const icon=button.firstElementChild?.cloneNode(true);if(icon)container.append(icon);
 const input=document.createElement('input');input.type='text';input.className='folio-name-input';input.value=item.title;input.maxLength=120;input.autocomplete='off';input.setAttribute('aria-label','Rename '+kind);container.append(input);button.replaceWith(container);
 const edit=inlineRename={kind,id:item.id,title:item.title,revision:item.metaRevision,bookId:book.id,input,container,saving:false};if(kind==='page')namedUntitledPages.add(book.id+':'+item.id);
 async function finish(cancel=false){
  if(inlineRename!==edit||edit.saving)return;const title=input.value.trim();
  if(cancel||!title||title===edit.title){document.removeEventListener('pointerdown',away,true);inlineRename=null;clearProblem();renderLists();list.querySelector(`[data-id="${CSS.escape(edit.id)}"]`)?.focus();return;}
  edit.saving=true;input.readOnly=true;container.setAttribute('aria-busy','true');
  try{
   const page=selection?.pages.find(p=>p.id===edit.id);
   if(kind==='page'&&page?.kind==='note')await adapter.rename(edit.bookId,edit.id,title,edit.title);
   else await adapter.organize(edit.bookId,{action:'rename',kind,id:edit.id,revision:edit.revision,title,requestId:requestId()});
   if(book?.id===edit.bookId){await refreshNotebook();const current=(kind==='page'?selection.pages:selection.sections).find(i=>i.id===edit.id);if(current){current.title=title;}if(kind==='page'&&selection.pageId===edit.id){titleEditing(current);rememberPage(current);$('#note-body .inkwire-editor')?.setAttribute('aria-label',title);}}
   document.removeEventListener('pointerdown',away,true);inlineRename=null;clearProblem();renderLists();list.querySelector(`.folio-row[data-id="${CSS.escape(edit.id)}"]`)?.focus();
  }catch(error){edit.saving=false;input.readOnly=false;container.removeAttribute('aria-busy');input.setAttribute('aria-invalid','true');problem(error);input.focus();}
 }
 const away=event=>{if(!container.contains(event.target))finish();};document.addEventListener('pointerdown',away,true);
 input.onkeydown=event=>{if(event.key==='Enter'||event.key==='Escape'){event.preventDefault();event.stopPropagation();finish(event.key==='Escape');}};
 input.onblur=()=>finish();input.onclick=event=>event.stopPropagation();input.ondblclick=event=>event.stopPropagation();input.oncontextmenu=event=>event.stopPropagation();input.focus();input.select();
}
function updateTitlePreview(page,name){
 if(selection?.pageId!==page.id)return;page.title=name;const current=selection.pages.find(p=>p.id===page.id);if(current)current.title=name;
 const label=$('#page-list').querySelector(`.folio-row[data-id="${CSS.escape(page.id)}"] .row-copy b`);if(label)label.textContent=name;
 $('#note-body .inkwire-editor')?.setAttribute('aria-label',name);
 const section=selection.sections.find(s=>s.id===page.sectionId),location=[book.teacherBook?'Teacher notebook':book.learnerName,section?.title,name].filter(Boolean).join(' / ');$('#notebook-page-location').textContent=location;$('#notebook-page-location').title=location;
}
function titleEditing(page){
 const allowed=library?.role==='teacher'&&page.kind==='note';titleField.readOnly=!allowed;titleField.value=page.title==='Untitled page'?'':page.title;
 $('#page-created').textContent=formatPageCreatedAt(page.createdAt);
 if(!allowed)return;
 const bookId=book.id,id=page.id,key='inkwire-page-title:'+JSON.stringify([library.userId||'practice',bookId,id]);let session;
 session=pageTitleSession({initial:page.title,save:(name,expected)=>adapter.rename(bookId,id,name,expected),cache:{read:()=>JSON.parse(localStorage.getItem(key)||'null'),write:value=>localStorage.setItem(key,JSON.stringify(value)),clear:()=>localStorage.removeItem(key)},onDraft:name=>updateTitlePreview(page,name),onStatus(){if(titleSession===session){cloudSync.render();if(!session.dirty&&!session.saving)rememberPage(page);}},onError:error=>{if(titleSession===session)problem(error);}});
 titleSession=session;titleField.value=session.value;
}
titleField.oninput=()=>titleSession?.change(titleField.value);
titleField.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();titleSession?.flush();window.InkWireEditor.focusPage();}if(event.key==='Escape'){event.preventDefault();titleSession?.cancel();titleField.value=titleSession?.value||'';titleField.blur();}};
titleField.onblur=()=>titleSession?.flush();
$('#notebook-home').onclick=event=>{if(!mayNavigate())event.preventDefault();};
$('.notebook-site-header').addEventListener('click',event=>{if(event.target.closest('a[href]') && !mayNavigate())event.preventDefault();});
const accountMenu=$('.today-account');
document.addEventListener('click',event=>{if(!accountMenu.contains(event.target))accountMenu.open=false;});
document.addEventListener('keydown',event=>{if(event.key==='Escape')accountMenu.open=false;});
$('#notebook-signout').onclick=async()=>{
  if(practice || !mayNavigate())return;const button=$('#notebook-signout');button.disabled=true;
  try{await api('/api/accounts/signout',{});location.replace('/account');}catch(error){problem(error);button.disabled=false;}
};

$('#notebook-list').onclick=e=>{const b=e.target.closest('[data-id]');if(b)openBook(b.dataset.id);};
$('#section-list').onclick=e=>{const b=e.target.closest('[data-id]');if(!b||!mayNavigate())return;const section=selection.sections.find(s=>s.id===b.dataset.id);if(section?.locked){notebookMenus.unlock(section);return;}closePage();selection.sectionId=b.dataset.id;selection.pageId=null;renderLists();pane('pages');const first=selection.pages.find(p=>p.sectionId===selection.sectionId);if(first)openPage(first.id);};
$('#page-list').onclick=e=>{const b=e.target.closest('.folio-row[data-id]'),page=selection?.pages.find(p=>p.id===b?.dataset.id);if(!page)return;if(page.title==='Untitled page'&&!namedUntitledPages.has(book.id+':'+page.id)&&e.target.closest('.row-copy')){renameInline('page',page);return;}if(page.id!==selection?.pageId)openPage(page.id);};
$('#page-list').ondblclick=e=>{const b=e.target.closest('.folio-row[data-id]');renameInline('page',selection?.pages.find(p=>p.id===b?.dataset.id));};
$('#section-list').ondblclick=e=>{const b=e.target.closest('.folio-row[data-id]');renameInline('section',selection?.sections.find(s=>s.id===b?.dataset.id));};
for(const [id,kind]of [['page-list','page'],['section-list','section']])$('#'+id).addEventListener('keydown',event=>{if(event.key!=='F2'||event.target.matches('input'))return;const row=event.target.closest('.folio-row[data-id]');if(!row)return;event.preventDefault();renameInline(kind,(kind==='page'?selection.pages:selection.sections).find(item=>item.id===row.dataset.id));});
$('#notebook-search').oninput=renderBooks;
$('#class-filter').onchange=()=>{if(!mayNavigate()){$('#class-filter').value=query.get('classId')||'';return;}renderBooks();const first=library.notebooks.find(b=>!$('#class-filter').value||b.classId===$('#class-filter').value);if(first)openBook(first.id);else{closePage();book=null;selection=null;renderLists();}pane('notebooks');};
function syncNavigationButton(){
 const focused=$('#folio-grid').classList.contains('focus-page')||document.documentElement.classList.contains('ink-note-focus'),button=$('#toggle-navigation'),label=focused?'Restore notebook view':'Expand page view';
 const arrows=focused?'M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5M9 9 3 3M15 9l6-6M9 15l-6 6M15 15l6 6':'M8 3H3v5M16 3h5v5M3 16v5h5M16 21h5v-5M3 3l6 6M21 3l-6 6M3 21l6-6M21 21l-6-6';
 button.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+arrows+'"/></svg><span>'+label+'</span>';button.setAttribute('aria-expanded',String(focused));button.title=focused?'Show notebooks, sections and pages':'Hide the side panels to give your page more space';
 notebookNavigation.setExpanded(focused);
}
$('#toggle-navigation').onclick=()=>{const focused=!($('#folio-grid').classList.contains('focus-page')||document.documentElement.classList.contains('ink-note-focus'));$('#folio-grid').classList.toggle('focus-page',focused);document.documentElement.classList.remove('ink-note-focus');syncNavigationButton();if(focused)pane('content');else if(innerWidth<=850)pane('sections');};
new MutationObserver(syncNavigationButton).observe(document.documentElement,{attributes:true,attributeFilter:['class']});syncNavigationButton();
const fullscreenButton=$('#notebook-fullscreen'),fullscreenRoot=document.querySelector('.folio-app>main');
function fullscreenStatus(){const full=document.fullscreenElement===fullscreenRoot;fullscreenButton.setAttribute('aria-label',full?'Exit fullscreen':'Enter fullscreen');fullscreenButton.title=full?'Exit fullscreen · Esc':'Enter fullscreen';fullscreenButton.setAttribute('aria-pressed',String(full));}
fullscreenButton.hidden=!fullscreenRoot.requestFullscreen;fullscreenButton.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await fullscreenRoot.requestFullscreen();}catch{problem(Error('Fullscreen is unavailable in this browser view. Use your browser’s fullscreen command, or Expand page view.'));}};document.addEventListener('fullscreenchange',fullscreenStatus);fullscreenStatus();
$('#mobile-pane').onchange=e=>{if(e.target.value!=='content'){$('#folio-grid').classList.remove('focus-page');syncNavigationButton();}pane(e.target.value);};
for(const nav of document.querySelectorAll('.folio-column nav'))nav.addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;const buttons=[...nav.querySelectorAll('.folio-row')],i=buttons.indexOf(document.activeElement);if(i<0)return;e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,i+(e.key==='ArrowDown'?1:-1)))]?.focus();});
for(const [id,kind] of [['add-section','section']])$('#'+id).onclick=()=>{if(!mayNavigate()||!book||library.role!=='teacher')return;newSectionOptions={};naming=kind;$('#name-heading').textContent=kind==='section'?'New section':'New page';$('#new-name').placeholder=kind==='section'?'e.g. Week 3 · Character study':'e.g. Class summary';$('#new-name').value='';$('#name-error').textContent='';$('#name-dialog').showModal();$('#new-name').focus();};
$('#add-page').onclick=async()=>{
 if(!mayNavigate()||!book||library.role!=='teacher'||!selection?.sectionId)return;
 const button=$('#add-page');button.disabled=true;const id=requestId();
 try{await adapter.create(book.id,{id,title:'Untitled page',sectionId:selection.sectionId});const data=await adapter.book(book.id);selection={...data,sectionId:selection.sectionId};renderLists();await openPage(id);titleField.focus();titleField.select();}
 catch(error){problem(error);}finally{button.disabled=false;}
};
$('#name-cancel').onclick=()=>$('#name-dialog').close();
$('#name-form').onsubmit=async e=>{e.preventDefault();const title=$('#new-name').value.trim();if(!title)return;const submit=e.target.querySelector('[type=submit]'),id=requestId();submit.disabled=true;
  try{if(naming==='section')await adapter.section(book.id,{id,title,...newSectionOptions});else await adapter.create(book.id,{id,title,sectionId:selection.sectionId});const data=await adapter.book(book.id);selection={...data,sectionId:naming==='section'?id:selection.sectionId};$('#name-dialog').close();renderLists();if(naming==='page')await openPage(id);else{closePage();pane('pages');}}
  catch(e){$('#name-error').textContent=e.message;}finally{submit.disabled=false;}};
function downloadDraft(){if(!active)return;const bytes=JSON.stringify({notebook:book.learnerName,page:$('#page-title').value,savedAt:new Date().toISOString(),syncState:encodeState(Y.encodeStateAsUpdate(active.doc)),text:window.InkWireEditor.getText()},null,2);const u=URL.createObjectURL(new Blob([bytes],{type:'application/json'})),a=document.createElement('a');a.href=u;a.download='folio-page-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};

window.addEventListener('beforeunload',e=>{if(pending()&&!locallyRecoverable()){e.preventDefault();e.returnValue='';}});
window.addEventListener('online',()=>{if(active)flush(active);poll();});
function poll({force=false}={}){if(refreshing)return refreshTask;if(!book||!selection||!force&&document.hidden)return;refreshing=true;const currentBook=book,epoch=openEpoch,c=active;refreshTask=(async()=>{
  try{if(c){const {page}=await adapter.page(c.bookId,c.pageId);if(c===active&&page?.syncState){Y.applyUpdate(c.doc,decodeState(page.syncState),'remote');c.version=page.version;window.InkWireEditor?.setEditable(!c.readOnly);saveStatus(c);}}
    const fresh=await adapter.book(currentBook.id);if(book===currentBook&&epoch===openEpoch){syncError='';$('#connection').textContent=practice?'Saved on this device':'Connected';const shape=v=>JSON.stringify({sections:v.sections,pages:v.pages.map(p=>({id:p.id,title:p.title,sectionId:p.sectionId,kind:p.kind,displayMode:p.displayMode,parentId:p.parentId,position:p.position,depth:p.depth}))});const changed=shape(selection)!==shape(fresh);selection={...fresh,sectionId:selection.sectionId,pageId:selection.pageId};const current=selection.pages.find(p=>p.id===selection.pageId);if(titleSession&&(titleSession.dirty||titleSession.saving)&&current)current.title=titleSession.value.trim()||'Untitled page';else if(current?.kind==='note'&&titleSession&&current.title!==titleSession.saved)titleEditing(current);if(changed)renderLists();}
  }catch(e){if(epoch===openEpoch){syncError=e.message;problem(e);$('#connection').textContent=e.status===401?'Sign-in expired':'Reconnecting…';if([401,403,404].includes(e.status))window.InkWireEditor?.setEditable(false);}}
  finally{refreshing=false;cloudSync.render();}})();return refreshTask;}
async function initialize(){
  try{if(practice){adapter=await(await import('./notebook-preview.mjs')).previewAdapter(query.get('role')||'teacher');$('#practice-banner').hidden=false;}
    library=await adapter.list();if(!library.classes.length)library.classes=[...new Map(library.notebooks.map(b=>[b.classId,{id:b.classId,name:b.className}])).values()];$('#view-label').textContent=library.role==='parent'?'Parent · read only':library.role==='student'?'Student notebook':'Teacher workspace';const teacher=library.role==='teacher',home=practice?'studio.html?role='+library.role:'/'+library.role;
    $('#notebook-today').hidden=!teacher;$('#notebook-calendar').hidden=!teacher;$('#notebook-assessment').hidden=!teacher;$('#notebook-assessment').href=home+(practice?'&':'?')+'view=assessment';
    $('#notebook-today').href=home;$('#notebook-calendar').href=home+(practice?'&':'?')+'view=calendar';
    $('#dashboard-link').hidden=false;$('#dashboard-link').textContent=teacher?'Classes':library.role==='parent'?'My children':'My classes';$('#dashboard-link').href=home+(teacher?(practice?'&':'?')+'view=classes':'');$('#notebook-home').href=home;
    $('#notebook-site-nav').setAttribute('aria-label',teacher?'Teacher workspace':library.role==='parent'?'Parent workspace':'Student workspace');
    $('.today-account>summary').setAttribute('aria-label',teacher?'Teacher account':library.role==='parent'?'Parent account':'Student account');
    $('#notebook-join').href=teacher?home+(practice?'&':'?')+'join=1':'/join#'+(library.role==='parent'?'family':'class')+'=';
    $('#notebook-join').textContent=teacher?'Join with an invite code':library.role==='parent'?'Connect to my child':'Join a class';
    $('#notebook-signout').disabled=practice;
    $('#class-filter').innerHTML='<option value="">All classes</option>'+library.classes.map(c=>`<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('');$('#class-filter').value=library.classes.some(c=>c.id===query.get('classId'))?query.get('classId'):'';
    renderLists();const visible=library.notebooks.filter(b=>!$('#class-filter').value||b.classId===$('#class-filter').value),first=initialNotebook(visible,{role:library.role,notebookId:query.get('notebookId'),classId:$('#class-filter').value});if(first)await openBook(first.id,{initial:true});else{pane('notebooks');$('#connection').textContent=visible.length?(practice?'Saved on this device':'Connected'):'No notebooks yet';$('#page-meta').textContent=visible.length?'Choose a notebook to open its sections and pages.':'Add students to a class to see their notebooks here.';}
  }catch(e){problem(e);$('#connection').textContent='Could not load notebooks';if(e.status===401){const a=document.createElement('a');a.href='/account';a.textContent='Sign in to your website account →';$('#page-empty').append(a);}}}
async function offerPrintout(file,point){
  if(!file){$('#printout-file').click();return;}
  if(printoutImport?.busy)return;
  if(!book||!selection||library.role!=='teacher'){problem(Error('Choose a notebook in your teacher view before inserting a PDF.'));return;}
  try{validatePrintout(file);}catch(error){problem(error);return;}
  if(worksheetMount){problem(Error('Open a notebook page to insert this PDF alongside text. Existing imported pages remain available.'));return;}
  if(active?.localFailure){problem(Error('Download your draft before inserting a PDF.'));return;}
  const upload={bookId:book.id,classId:book.classId,learnerId:book.learnerId,pageId:selection.pageId,sectionId:selection.sectionId,id:requestId(),busy:true};printoutImport=upload;$('#add-printout').disabled=true;$('#page-status').textContent='Reading PDF…';
  try{
    const pages=await inspectPrintout(file);
    if(!active){const id=requestId();await adapter.create(upload.bookId,{id,title:'Untitled page',sectionId:upload.sectionId});const data=await adapter.book(upload.bookId);selection={...data,sectionId:upload.sectionId};upload.busy=false;await openPage(id);upload.busy=true;upload.pageId=id;point=null;}
    const current=active;if(!current||current.bookId!==upload.bookId||current.pageId!==upload.pageId)throw Error('The notebook page changed. Drop your PDF again.');
    $('#page-status').textContent='Inserting PDF…';
    if(practice){const {previewPdf}=await import('./notebook-pdf-preview.mjs');await previewPdf(upload.bookId+':'+upload.pageId+':'+upload.id,file);}
    else{const response=await fetch(path(upload.bookId)+'/pages/'+upload.pageId+'/pdfs/'+upload.id,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/pdf'},body:file,signal:AbortSignal.timeout(90000)});if(!response.ok){const result=await response.json().catch(()=>({}));throw Error(result.message||'The PDF could not be inserted. Please try again.');}}
    if(active!==current)throw Error('The notebook page changed. Drop your PDF again.');
    window.InkWireEditor.insertPrintout(upload.id,pages,point);clearProblem();await flush(current);
  }catch(error){problem(error);}
  finally{upload.busy=false;printoutImport=null;$('#add-printout').disabled=false;$('#printout-file').value='';if(active)saveStatus(active);}
}

function chooseOfficeInsert(file){return new Promise(resolve=>{
 const dialog=document.createElement('dialog');dialog.className='notebook-action-dialog';const heading=document.createElement('h2');heading.textContent='Insert '+file.name;
 const description=document.createElement('p');description.textContent='Attach the original file, or show its pages/slides on the notebook canvas so you can write over them.';
 const detail=document.createElement('p');detail.className='muted';detail.textContent='Printouts are converted on this device. First use downloads a large LibreOffice engine (several hundred MB). Your notebook will reopen automatically when the printout is ready.';
 const actions=document.createElement('div');actions.className='notebook-dialog-actions';let chosen=false;
 const finish=value=>{if(chosen)return;chosen=true;dialog.close();dialog.remove();resolve(value);};
 for(const [label,value]of [['Cancel',null],['Attach file','attachment'],['Insert as printout','printout']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>{finish(value);};actions.append(b);}
 dialog.append(heading,description,detail,actions);dialog.oncancel=e=>{e.preventDefault();finish(null);};document.body.append(dialog);dialog.showModal();actions.children[1].focus();
});}
async function queueOfficePrintout(file,point){
 const current=await ensureFilePage();await flush(current);if(current.dirty>current.saved)throw Error('Wait for your page to finish saving before preparing a printout.');
 const id=requestId(),returnUrl=new URL(location.href);returnUrl.searchParams.set('printoutJob',id);
 await cleanOfficeJobs();await officeJob('put',id,{state:'queued',file,fileName:file.name,userId:library.userId||'practice',bookId:book.id,pageId:current.pageId,point,returnUrl:returnUrl.href});
 fileBusy=false;location.assign('/office-converter.html#'+id);
}
async function resumeOfficePrintout(){
 const id=query.get('printoutJob');if(!id)return;const url=new URL(location.href);url.searchParams.delete('printoutJob');history.replaceState(null,'',url);
 try{const job=await officeJob('get',id);if(!job)throw Error('This printout request is no longer available. Insert your file again.');if(job.userId!==(library.userId||'practice')||job.bookId!==book?.id||job.pageId!==selection?.pageId)throw Error('Open the original notebook page with the same account to insert this printout.');
 if(job.state!=='complete'||!job.pdf)throw Error(job.error||'The printout is not ready. Insert the file again.');
 await offerPrintout(new File([job.pdf],job.fileName.replace(/\.[^.]+$/,'.pdf'),{type:'application/pdf'}),job.point);
 }catch(e){problem(e);}finally{await officeJob('delete',id);updateLinks();}
}
async function ensureFilePage(){
 if(active)return active;if(worksheetMount)throw Error('Create a notebook page to insert files alongside text. Your existing PDF page is unchanged.');
 const section=selection?.sections.find(s=>s.id===selection.sectionId);if(!section||section.group||section.locked)throw Error('Choose an unlocked section first.');
 const id=requestId(),sectionId=section.id;await adapter.create(book.id,{id,title:'Untitled page',sectionId});const data=await adapter.book(book.id);selection={...data,sectionId};fileBusy=false;await openPage(id);fileBusy=true;if(!active)throw Error('The new page could not be opened.');return active;
}
async function offerFiles(files,point){
 if(!files){$('#printout-file').click();return;}if(fileBusy||printoutImport?.busy)return;
 if(!Array.isArray(files))files=[files];if(!book||library?.role!=='teacher'){problem(Error('Choose a notebook in your teacher view before inserting files.'));return;}
 if(files.length>20){problem(Error('Insert up to 20 files at a time.'));return;}
 fileBusy=true;$('#add-printout').disabled=true;
 try{for(const file of files){
  if(/\.pdf$/i.test(file.name)||file.type==='application/pdf'){fileBusy=false;await offerPrintout(file,point);fileBusy=true;point=null;continue;}
  const type=notebookFileType(file);let choice=type.image?'attachment':await chooseOfficeInsert(file);if(!choice)continue;
  if(choice==='printout'){if(files.length>1)throw Error('Insert Office printouts one at a time. Attachments and photos can be inserted together.');await queueOfficePrintout(file,point);return;}
  const c=await ensureFilePage(),id=requestId();$('#page-status').textContent='Inserting '+file.name+'…';
  let dimensions={width:320,height:110};if(type.image){const bitmap=await createImageBitmap(file);const scale=Math.min(1,680/bitmap.width,1200/bitmap.height);dimensions={width:Math.max(80,Math.round(bitmap.width*scale)),height:Math.max(60,Math.round(bitmap.height*scale))};bitmap.close();}
  if(practice){const {previewPdf}=await import('./notebook-pdf-preview.mjs');await previewPdf(c.bookId+':'+c.pageId+':file:'+id,file);}
  else{const response=await fetch(path(c.bookId)+'/pages/'+c.pageId+'/assets/'+id,{method:'POST',credentials:'same-origin',headers:{'Content-Type':type.mime,'X-File-Name':encodeURIComponent(file.name),'X-File-Size':String(file.size)},body:file,signal:AbortSignal.timeout(90000)});if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.message||'The file could not be inserted. Try again.');}}
  if(c!==active)throw Error('The page changed. Insert your file again.');window.InkWireEditor.insertFile({assetId:id,fileName:file.name,mime:type.mime,size:file.size,...dimensions,...(point||{})});clearProblem();await flush(c);point=null;
 }}catch(e){problem(e);}finally{fileBusy=false;$('#add-printout').disabled=false;$('#printout-file').value='';if(active)saveStatus(active);}
}

$('#add-printout').onclick=()=>offerFiles();
$('#printout-file').onchange=e=>{if(e.target.files.length)offerFiles([...e.target.files]);};
let fileDragDepth=0;
const fileDrag=e=>Array.from(e.dataTransfer?.types||[]).includes('Files');
document.addEventListener('dragenter',e=>{if(!fileDrag(e))return;e.preventDefault();fileDragDepth++;if(library?.role==='teacher'&&book)$('#pdf-drop-overlay').hidden=false;});
document.addEventListener('dragover',e=>{if(fileDrag(e)){e.preventDefault();e.dataTransfer.dropEffect=library?.role==='teacher'?'copy':'none';}});
document.addEventListener('dragleave',e=>{if(!fileDrag(e))return;if(--fileDragDepth<=0){fileDragDepth=0;$('#pdf-drop-overlay').hidden=true;}});
document.addEventListener('drop',e=>{if(!fileDrag(e))return;e.preventDefault();fileDragDepth=0;$('#pdf-drop-overlay').hidden=true;const root=$('#note-editor .folio-canvas'),r=root?.getBoundingClientRect();const point=r&&e.target.closest('#note-editor')?{x:Math.round(Math.max(0,Math.min(5000,e.clientX-r.left))),y:Math.round(Math.max(0,Math.min(200000,e.clientY-r.top)))}:null;offerFiles([...e.dataTransfer.files],point);});
async function refreshNotebook(){
 if(!book)return;const previousSection=selection?.sectionId,previousPage=selection?.pageId,data=await adapter.book(book.id);
 const page=data.pages.find(p=>p.id===previousPage);if(previousPage&&!page)closePage();
 selection={...data,sectionId:data.sections.some(s=>s.id===previousSection)?previousSection:data.sections[0]?.id,pageId:page?.id};if(page)selection.sectionId=page.sectionId;renderLists();
 if(page){if(!titleSession?.dirty&&!titleSession?.saving)titleEditing(page);}else if(selection.sectionId){$('#page-empty').hidden=false;pane('pages');}
}
const notebookMenus=mountNotebookMenus({getState:()=>({library,book,selection}),adapter:()=>adapter,refresh:refreshNotebook,openBook,openPage,mayNavigate,problem,rename:renameInline,
 createSection(options={}){if(!mayNavigate())return;newSectionOptions=options;naming='section';$('#name-heading').textContent=options.group?'New section group':'New section';$('#new-name').value='';$('#new-name').placeholder=options.group?'e.g. Reading resources':'e.g. Week 3 · Character study';$('#name-error').textContent='';$('#name-dialog').showModal();$('#new-name').focus();},
 createPage(sectionId){if(!mayNavigate())return;selection.sectionId=sectionId;renderLists();$('#add-page').onclick();}
});
$('#notebook-deleted-items').onclick=()=>{if(mayNavigate())notebookMenus.trash().catch(problem);};
$('#distribute-page').onclick=()=>{const page=selection?.pages.find(p=>p.id===selection.pageId);if(page&&mayNavigate())notebookMenus.distribute(page).catch(problem);};
await initialize();await resumeOfficePrintout();setInterval(poll,2000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll();});
