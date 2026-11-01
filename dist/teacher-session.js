import {createMemberCourse} from './member-course.js';
import {api,escape,copy,signOut,requestId} from './workspace-shared.js';
import {createCoursePlanner} from './course-planner.js';
import {createTeacherCalendar} from './teacher-calendar.js';
import {createTranscriptSummary} from './transcript-summary.js';
const $=selector=>document.querySelector(selector);
const list=$('#class-list'),status=$('#dashboard-status'),retry=$('#retry-classes');
let loading=false,createRequestId='',addRequestId='',classrooms=[],returnFocus,addingClass='',sharing=null;
const rosters=new Map();
let currentView='classes',deletingClass='',activeClassId='',activeTab='students';
const classTabs=new Map();
function problem(error) {status.textContent=error.message;if(error.status===401){list.replaceChildren();location.replace('/account');}}
function openDialog(id,button){returnFocus=button;document.getElementById(id).showModal();}
document.querySelectorAll('[data-open]').forEach(button=>button.addEventListener('click',()=>openDialog(button.dataset.open,button)));
document.querySelectorAll('dialog').forEach(dialog=>{
  dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus();});
});
const tabs=[['students','Students'],['overview','Course overview'],['calendar','Calendar'],['timeline','Timeline']];
list.innerHTML=`<div id="class-empty" class="empty-classes" hidden><h2>No classes yet</h2><p>Create your first class, or join one with an invite code.</p></div><div id="class-workspace" hidden>
  <div class="class-workspace-heading"><div><label for="selected-class">Class</label><select id="selected-class"></select><p id="selected-class-detail"></p></div><span class="class-badge" id="class-membership"></span></div>
  <div class="class-tab-list" role="tablist" aria-label="Class workspace">${tabs.map(([id,label])=>`<button type="button" role="tab" id="class-tab-${id}" aria-controls="class-panel-${id}" aria-selected="${id==='students'}" tabindex="${id==='students'?0:-1}" data-class-tab="${id}">${label}</button>`).join('')}</div>
  ${tabs.map(([id,label])=>`<section id="class-panel-${id}" role="tabpanel" aria-labelledby="class-tab-${id}" ${id==='students'?'':'hidden'}>${id==='students'?`<div class="roster-heading"><div><h2>Students</h2><p id="roster-count"></p></div><div class="teacher-actions"><button type="button" class="teacher-button" id="class-add-student">+ Add student</button><button type="button" class="teacher-button secondary" id="class-invite-students">Invite students</button></div></div><label class="roster-search" for="student-search">Find a student<input id="student-search" type="search" placeholder="Search by name" autocomplete="off"></label><p class="roster-key">Attendance is based on published lesson assessments. Unrecorded lessons are excluded. Homework completion will appear when submission tracking is connected.</p><div id="selected-roster" aria-live="polite"></div><div class="teacher-actions roster-footer"><button type="button" class="text-button" id="class-demo-parents">Set up demo parent profiles</button><button type="button" class="text-button" id="class-refresh-roster">Refresh students</button></div>`:''}</section>`).join('')}
  <details class="invite-settings" id="selected-class-settings"><summary>Class settings</summary><p>Invite another teacher to manage this class.</p><button class="teacher-button secondary" type="button" id="class-teacher-invite">Create teacher invite</button><button type="button" class="text-button danger-text" id="class-delete">Delete class</button></details>
</div>`;
const coursePlanner=createCoursePlanner({list,root:$('#class-panel-overview'),getClasses:()=>classrooms,status,problem,onSaved:()=>{calendar.refresh();classCalendar.refresh();}});
createTranscriptSummary();
const teacherTimeline=createMemberCourse({teacher:true,root:$('#class-panel-timeline'),onEditLesson:openCourseTab});
const demoTimeline=createMemberCourse({teacher:true});
const calendar=createTeacherCalendar({root:$('#teacher-calendar'),getClasses:()=>classrooms,openCourse:openCourseTab,problem});
const classCalendar=createTeacherCalendar({root:$('#class-panel-calendar'),getClasses:()=>classrooms,getClassId:()=>activeClassId,openCourse:openCourseTab,problem});
function renderClasses(){
  $('#selected-class').innerHTML=classrooms.map(c=>`<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('');
  $('#class-empty').hidden=Boolean(classrooms.length);$('#class-workspace').hidden=!classrooms.length;
  if(classrooms.some(c=>c.id===activeClassId)){$('#selected-class').value=activeClassId;renderClassHeading();loadRoster(activeClassId);if(activeTab==='overview' && !coursePlanner.isOpen())showClassTab('overview');}
  else {coursePlanner.reset();teacherTimeline.clear();activeClassId='';if(classrooms.length)selectClass(classrooms[0].id);}
}
function renderClassHeading(){
  const c=classrooms.find(c=>c.id===activeClassId);if(!c)return;
  $('#selected-class').value=c.id;$('#selected-class-detail').textContent=c.subject || 'Class workspace';
  $('#class-membership').textContent=c.membership==='owner'?'Class owner':'Teacher';
  $('#class-add-student').dataset.addStudent=c.id;
  Object.assign($('#class-invite-students').dataset,{shareKind:'class',class:c.id});
  $('#class-demo-parents').dataset.demoParents=c.id;$('#class-refresh-roster').dataset.retryRoster=c.id;
  $('#class-teacher-invite').dataset.invite=c.id;$('#class-delete').dataset.deleteClass=c.id;
  $('#selected-class-settings').hidden=c.membership!=='owner';
}
async function selectClass(id){
  if(id===activeClassId)return true;
  if(!coursePlanner.canLeave()){$('#selected-class').value=activeClassId;return false;}
  coursePlanner.reset();teacherTimeline.clear();classCalendar.clear();
  activeClassId=id;$('#student-search').value='';$('#selected-roster').textContent='Loading students…';$('#roster-count').textContent='';renderClassHeading();
  await showClassTab(classTabs.get(id)||'students');if(activeClassId!==id)return false;if(activeTab!=='students')loadRoster(id);return true;
}
async function showClassTab(tab,button,lessonIndex){
  if(!activeClassId)return;activeTab=tab;classTabs.set(activeClassId,tab);
  for(const [id]of tabs){const selected=id===tab;$('#class-tab-'+id).setAttribute('aria-selected',String(selected));$('#class-tab-'+id).tabIndex=selected?0:-1;$('#class-panel-'+id).hidden=!selected;}
  if(tab==='students')await loadRoster(activeClassId);
  if(tab==='overview')await coursePlanner.open(activeClassId,button,lessonIndex);
  if(tab==='calendar')await classCalendar.refresh();
  if(tab==='timeline')await teacherTimeline.open(activeClassId,null,button);
}
async function openCourseTab(id,button,lessonIndex){
  if(!await selectClass(id))return;showView('classes');await showClassTab('overview',button,lessonIndex);
}
$('#selected-class').onchange=event=>selectClass(event.target.value);
list.querySelector('[role=tablist]').addEventListener('click',event=>{const button=event.target.closest('[data-class-tab]');if(button)showClassTab(button.dataset.classTab,button);});
list.querySelector('[role=tablist]').addEventListener('keydown',event=>{
  const button=event.target.closest('[data-class-tab]');if(!button || !['ArrowRight','ArrowLeft','Home','End'].includes(event.key))return;
  event.preventDefault();const index=tabs.findIndex(([id])=>id===button.dataset.classTab),next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;
  const target=$('#class-tab-'+tabs[next][0]);target.focus();showClassTab(tabs[next][0],target);
});
$('#student-search').oninput=()=>renderRoster(activeClassId);
async function loadTrash(){
  $('#retry-trash').hidden=true;$('#trash-list').textContent='Loading deleted classes…';
  try{
    const result=await api('/api/classes/trash');
    $('#trash-list').innerHTML=result.classes.length?result.classes.map(c=>`<article class="trash-class"><div><h2>${escape(c.name)}</h2><p>${escape(c.subject)}</p></div><button type="button" class="teacher-button secondary" data-restore-class="${escape(c.id)}">Restore class</button></article>`).join(''):'<div class="calendar-empty">Trash is empty.</div>';
  }catch(error){$('#trash-list').textContent=error.message;$('#retry-trash').hidden=false;if(error.status===401)problem(error);}
}
function showView(view){
  $('.teacher-heading h1').textContent=view==='calendar'?'Class calendar':view==='trash'?'Deleted classes':'My classes';
  currentView=view;list.hidden=view!=='classes';$('#teacher-calendar').hidden=view!=='calendar';$('#class-trash').hidden=view!=='trash';
  document.querySelectorAll('[data-teacher-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.teacherView===view)));
  if(view==='calendar')calendar.refresh();if(view==='trash')loadTrash();
}
document.querySelectorAll('[data-teacher-view]').forEach(b=>b.onclick=()=>showView(b.dataset.teacherView));
$('#retry-trash').onclick=loadTrash;
$('#class-trash').addEventListener('click',async event=>{
  const button=event.target.closest('[data-restore-class]');if(!button||button.disabled)return;button.disabled=true;
  try{await api('/api/classes/'+button.dataset.restoreClass+'/restore',{});await loadClasses();status.textContent='Class restored with its course plan and roster.';}catch(error){problem(error);}finally{button.disabled=false;}
});
$('#delete-class-form').addEventListener('submit',async event=>{
  event.preventDefault();const button=event.target.querySelector('[type=submit]'),error=event.target.querySelector('.form-error');if(button.disabled)return;button.disabled=true;error.hidden=true;
  try{await api('/api/classes/'+deletingClass+'/delete',{});rosters.delete(deletingClass);coursePlanner.reset();$('#delete-class').close();await loadClasses();status.textContent='Class moved to Trash. You can restore it from Trash.';}
  catch(e){error.textContent=e.message;error.hidden=false;}finally{button.disabled=false;}
});
function renderRoster(classId){
  if(classId!==activeClassId)return;
  const students=rosters.get(classId)||[],query=$('#student-search').value.trim().toLocaleLowerCase(),filtered=students.filter(s=>s.name.toLocaleLowerCase().includes(query));
  $('#roster-count').textContent=`${students.length} student${students.length===1?'':'s'} · ${students.filter(s=>s.parents.length).length} with a parent linked`;
  const target=$('#selected-roster');
  if(!students.length){target.innerHTML='<p class="roster-empty">No students yet. Add a student or share the class join code.</p>';return;}
  if(!filtered.length){target.innerHTML='<p class="roster-empty">No students match your search.</p>';return;}
  target.innerHTML=`<div class="student-table-scroll" role="region" aria-label="Student quick facts" tabindex="0"><table class="student-table"><caption class="visually-hidden">Students and course progress</caption><thead><tr><th scope="col">Student</th><th scope="col">Courses you teach</th><th scope="col">Attendance<small>This class</small></th><th scope="col">Homework<small>Completion rate</small></th><th scope="col">Student account</th><th scope="col">Parent account</th><th scope="col">Actions</th></tr></thead><tbody>${filtered.map(s=>{
    const a=s.attendance,attendance=a?.recorded?`<strong class="roster-rate">${a.rate}%</strong><small>${a.present} / ${a.recorded} recorded lessons · ${a.absent} absent</small>`:'<span class="roster-muted">Not recorded yet</span>';
    return `<tr data-student-row="${escape(s.id)}"><th scope="row">${escape(s.name)}</th><td>${(s.courses||[]).map(c=>`<span class="course-tag">${escape(c.name)}</span>`).join('')||escape(classrooms.find(c=>c.id===classId)?.name||'')}</td><td>${attendance}</td><td><span class="roster-muted">Not tracked yet</span></td><td><span class="connection-pill ${s.connected?'linked':''}">${s.connected?'Connected':'Not connected'}</span></td><td><span class="connection-pill ${s.parents.length?'linked':''}">${s.parents.length?`${s.parents.length} linked`:'Not linked'}</span>${s.parents.length?`<small>${s.parents.map(p=>escape(p.name)).join(', ')}</small>`:''}${s.demoParent?'<small class="demo-parent-label">Demo preview available</small>':''}</td><td><details class="student-row-actions"><summary>Manage<span class="visually-hidden"> ${escape(s.name)}</span></summary><div>${s.connected?'':`<button type="button" class="text-button" data-share-kind="student" data-learner="${escape(s.id)}" data-class="${classId}">Invite student</button>`}<button type="button" class="text-button" data-share-kind="family" data-learner="${escape(s.id)}" data-class="${classId}">${s.parents.length?'Invite another parent':'Invite parent'}</button>${s.demoParent?`<button type="button" class="text-button" data-demo-parent="${escape(s.id)}" data-class="${classId}">Open demo parent dashboard</button>`:''}${s.parents.map(p=>`<button type="button" class="text-button" data-disconnect="${escape(p.id)}" data-learner="${escape(s.id)}" data-class="${classId}">Disconnect ${escape(p.name)}</button>`).join('')}<button type="button" class="text-button danger-text" data-remove="${escape(s.id)}" data-class="${classId}">Remove from class</button></div></details></td></tr>`;
  }).join('')}</tbody></table></div><p class="table-scroll-hint">On smaller screens, scroll across the table for all columns.</p>`;
}
let rosterRequest=0;
async function loadRoster(classId){
  const token=++rosterRequest;$('#selected-roster').setAttribute('aria-busy','true');
  try{
    const {students}=await api('/api/enrollment/classes/'+classId+'/roster');if(token!==rosterRequest || classId!==activeClassId)return;
    rosters.set(classId,students);renderRoster(classId);
  }catch(error){if(token!==rosterRequest || classId!==activeClassId)return;$('#selected-roster').innerHTML='<p>Could not load students.</p><button type="button" class="text-button" data-retry-roster="'+classId+'">Try again</button>';problem(error);}
  finally{if(token===rosterRequest && classId===activeClassId)$('#selected-roster').setAttribute('aria-busy','false');}
}
async function loadClasses(force=false){
  if(loading||(!force && coursePlanner.hasUnsavedChanges()))return;loading=true;retry.hidden=true;status.textContent='Loading your classes…';
  try{classrooms=(await api('/api/classes')).classes;renderClasses();calendar.refresh();if(currentView==='trash')await loadTrash();status.textContent='';}
  catch(error){problem(error);retry.hidden=false;}finally{loading=false;}
}
for(const [id,route]of[['create-form','/api/classes'],['join-form','/api/classes/join']]){
  const form=document.getElementById(id);
  form.addEventListener('submit',async event=>{
    event.preventDefault();const submit=form.querySelector('[type="submit"]'),error=form.querySelector('.form-error');if(submit.disabled)return;submit.disabled=true;error.hidden=true;
    const body=Object.fromEntries(new FormData(form));if(id==='create-form'){createRequestId ||= requestId();body.requestId=createRequestId;}
    try{const result=await api(route,body);form.closest('dialog').close();form.reset();if(id==='create-form')createRequestId='';await loadClasses(true);await selectClass(result.classroom.id);showView('classes');$('#selected-class').focus();status.textContent=id==='create-form'?'Class created. Add students or share its invitation.':'You have joined the class.';}
    catch(problem){error.textContent=problem.message;error.hidden=false;}finally{submit.disabled=false;}
  });
}
function showInvitation(invitation){
  sharing.invitation=invitation;
  const kind=invitation.kind;
  $('#learning-invite-title').textContent=kind==='family'?'Invite a parent':kind==='student'?'Invite student':'Invite students';
  $('#learning-invite-subtitle').textContent=invitation.studentName || classrooms.find(c=>c.id===sharing.classId)?.name || '';
  $('#learning-invite-description').textContent=kind==='family'?'Connect a parent to this student across their classes. Share privately with one parent.':kind==='student'?'Connect the student’s account to this roster entry. Share privately with the student or their parent.':'Students join this class after signing in or creating a Student account. For a student already on your roster, use their individual invitation.';
  $('#learning-code').value=invitation.code.match(/.{4}/g).join('-');$('#learning-link').value=invitation.link;
  $('#learning-expiry').textContent='Expires '+new Date(invitation.expiresAt).toLocaleString()+'.'+(kind==='class'?'':' One account per invitation.');
  $('#learning-copy-status').textContent='';$('#download-qr').href=window.InkWireQR($('#invite-qr'),invitation.link);
  $('#download-qr').download='inkwire-'+kind+'-invitation.png';
}
async function generateShare(reset=false){
  const invitation=await api('/api/enrollment/classes/'+sharing.classId+'/invite',{kind:sharing.kind,learnerId:sharing.learnerId,action:reset?'reset':'open'});showInvitation(invitation);
}
list.addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button||button.disabled)return;button.disabled=true;
  try{
    if(button.dataset.deleteClass){if(!coursePlanner.canLeave())return;deletingClass=button.dataset.deleteClass;$('#delete-class-name').textContent=classrooms.find(c=>c.id===deletingClass)?.name||'';$('#delete-class-form .form-error').hidden=true;openDialog('delete-class',button);}
    if(button.dataset.demoParent)await demoTimeline.open(button.dataset.class,button.dataset.demoParent,button,{demo:true});
    if(button.dataset.demoParents){await api('/api/lesson-feedback/classes/'+button.dataset.demoParents+'/demo-parents',{});await loadRoster(button.dataset.demoParents);status.textContent='Demo parent profiles are ready for every student currently on this roster. These previews are visible only to class teachers.';}
    if(button.dataset.retryRoster)await loadRoster(button.dataset.retryRoster);
    if(button.dataset.addStudent){
      addingClass=button.dataset.addStudent;addRequestId='';$('#add-student-form').reset();$('#new-student-name').hidden=false;$('#student-name').required=true;$('#add-student-form .form-error').hidden=true;
      const {learners}=await api('/api/enrollment/learners');const already=new Set((rosters.get(addingClass)||[]).map(s=>s.id));
      $('#existing-learner').innerHTML='<option value="">Add a new student</option>'+learners.filter(l=>!already.has(l.id)).map(l=>`<option value="${escape(l.id)}">${escape(l.name)} · already in your classes</option>`).join('');
      openDialog('add-student',button);
    }
    if(button.dataset.shareKind){sharing={classId:button.dataset.class,kind:button.dataset.shareKind,learnerId:button.dataset.learner};await generateShare();openDialog('learning-invite',button);}
    if(button.dataset.remove&&confirm('Remove this student from this class? Their account and parent connections will remain.')){
      await api('/api/enrollment/classes/'+button.dataset.class+'/remove',{learnerId:button.dataset.remove});await loadRoster(button.dataset.class);
    }
    if(button.dataset.disconnect&&confirm('Disconnect this parent from the student? This removes their access to the student across all classes.')){
      await api('/api/enrollment/classes/'+button.dataset.class+'/disconnect',{learnerId:button.dataset.learner,parentId:button.dataset.disconnect});await loadRoster(button.dataset.class);
    }
    if(button.dataset.invite){
      const invitation=await api('/api/classes/'+button.dataset.invite+'/invite',{});$('#created-code').value=invitation.code.match(/.{4}/g).join('-');$('#invite-class-name').textContent=classrooms.find(c=>c.id===button.dataset.invite)?.name||'';$('#invite-expiry').textContent='Expires '+new Date(invitation.expiresAt).toLocaleString()+'.';$('#copy-status').textContent='';openDialog('teacher-invite',button);
    }
  }catch(error){problem(error);}finally{button.disabled=false;}
});
$('#existing-learner').addEventListener('change',()=>{const existing=Boolean($('#existing-learner').value);$('#new-student-name').hidden=existing;$('#student-name').required=!existing;});
$('#add-student-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]'),error=form.querySelector('.form-error');if(button.disabled)return;button.disabled=true;error.hidden=true;addRequestId ||= requestId();
  try{await api('/api/enrollment/classes/'+addingClass+'/students',{...Object.fromEntries(new FormData(form)),requestId:addRequestId});form.closest('dialog').close();await loadRoster(addingClass);status.textContent='Student added. Invite their student and parent accounts from the roster.';}
  catch(problem){error.textContent=problem.message;error.hidden=false;}finally{button.disabled=false;}
});
$('#copy-code').addEventListener('click',()=>copy($('#created-code').value,$('#created-code'),$('#copy-status')));
for(const kind of ['code','link'])$('#copy-learning-'+kind).addEventListener('click',()=>copy($('#learning-'+kind).value,$('#learning-'+kind),$('#learning-copy-status')));
for(const [id,action]of[['reset-learning-invite','reset'],['disable-learning-invite','disable']])$('#'+id).addEventListener('click',async event=>{
  if(!confirm(action==='reset'?'Replace this invitation? The previous code and QR will stop working.':'Close this invitation? Existing class members and parent connections keep their access.'))return;
  const button=event.currentTarget;button.disabled=true;
  try{if(action==='reset')await generateShare(true);else{await api('/api/enrollment/classes/'+sharing.classId+'/invite',{kind:sharing.kind,learnerId:sharing.learnerId,action:'disable'});$('#learning-invite').close();status.textContent='Invitation closed. You can create another when needed.';}}
  catch(error){$('#learning-copy-status').textContent=error.message;}finally{button.disabled=false;}
});
signOut($('[data-session-signout]'),status);
retry.addEventListener('click',()=>loadClasses());window.addEventListener('pageshow',()=>loadClasses());window.addEventListener('pagehide',()=>{rosters.clear();coursePlanner.reset();teacherTimeline.clear();classCalendar.clear();calendar.clear();$('#selected-roster').replaceChildren();$('#trash-list').replaceChildren();document.querySelectorAll('dialog[open]').forEach(d=>d.close());});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!document.querySelector('dialog[open]'))loadClasses();});
loadClasses();
