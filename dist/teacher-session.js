import {createMemberCourse} from './member-course.js';
import {api,escape,copy,signOut,requestId} from './workspace-shared.js';
import {createCoursePlanner} from './course-planner.js';
import {createTeacherCalendar} from './teacher-calendar.js';
import {courseSummary} from './course-model.mjs';
import {createTranscriptSummary} from './transcript-summary.js';
const $=selector=>document.querySelector(selector);
const list=$('#class-list'),status=$('#dashboard-status'),retry=$('#retry-classes');
let loading=false,createRequestId='',addRequestId='',classrooms=[],returnFocus,addingClass='',sharing=null;
const rosters=new Map();
let currentView='classes',deletingClass='';
function problem(error) {status.textContent=error.message;if(error.status===401){list.replaceChildren();location.replace('/account');}}
function openDialog(id,button){returnFocus=button;document.getElementById(id).showModal();}
document.querySelectorAll('[data-open]').forEach(button=>button.addEventListener('click',()=>openDialog(button.dataset.open,button)));
document.querySelectorAll('dialog').forEach(dialog=>{
  dialog.querySelector('[data-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus();});
});
function renderClasses(){
  const opened=new Set([...list.querySelectorAll('details.class-card[open]')].map(card=>card.dataset.classId));
  list.innerHTML=classrooms.length ? classrooms.map(c=>`<details class="class-card" data-class-id="${escape(c.id)}" ${opened.has(c.id)?'open':''}><summary><span><h2>${escape(c.name)}</h2><small>${escape(c.subject || 'Class details')}</small></span></summary><div class="class-details"><section class="class-course"><div><p class="teacher-eyebrow">COURSE OVERVIEW</p><h3>Plan the term</h3><p data-course-status="${escape(c.id)}">${c.overviewRevision?escape(courseSummary({weeks:c.courseWeeks,lessonsPerWeek:c.courseFrequency,lessonMinutes:c.courseMinutes,pacing:c.coursePacing,lessonCount:c.courseLessonCount ?? undefined})):'Start with a 15-week Rivendell format, paste an outline, or reuse another class.'}</p></div><button type="button" class="teacher-button" data-plan-course="${escape(c.id)}">${c.overviewRevision?'Edit course overview':'Build course overview'}</button></section><div class="teacher-actions"><button type="button" class="teacher-button secondary" data-teacher-timeline="${escape(c.id)}">Course timeline</button><button type="button" class="text-button" data-demo-parents="${escape(c.id)}">Set up demo parent profiles</button></div><div class="roster-heading"><h3>Students &amp; families</h3><span class="class-badge">${c.membership==='owner'?'Class owner':'Teacher'}</span></div><div class="teacher-actions"><button type="button" class="teacher-button" data-add-student="${escape(c.id)}">+ Add student</button><button type="button" class="teacher-button secondary" data-share-kind="class" data-class="${escape(c.id)}">Invite students</button></div><div data-roster="${escape(c.id)}" class="roster"><p>Loading students…</p></div>${c.membership==='owner'?`<details class="invite-settings"><summary>Class settings</summary><p>Invite another teacher to manage this class.</p><button class="teacher-button secondary" type="button" data-invite="${escape(c.id)}">Create teacher invite</button><button type="button" class="text-button danger-text" data-delete-class="${escape(c.id)}">Delete class</button></details>`:''}</div></details>`).join(''):'<div class="empty-classes"><h2>No classes yet</h2><p>Create your first class, or join one with an invite code.</p></div>';
}
const coursePlanner=createCoursePlanner({list,getClasses:()=>classrooms,status,problem,onSaved:()=>calendar.refresh()});
createTranscriptSummary();
const teacherTimeline=createMemberCourse({teacher:true});
const calendar=createTeacherCalendar({root:$('#teacher-calendar'),getClasses:()=>classrooms,openCourse:(...args)=>coursePlanner.open(...args),problem});
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
  try{await api('/api/classes/'+deletingClass+'/delete',{});rosters.delete(deletingClass);$('#delete-class').close();await loadClasses();status.textContent='Class moved to Trash. You can restore it from Trash.';}
  catch(e){error.textContent=e.message;error.hidden=false;}finally{button.disabled=false;}
});
async function loadRoster(classId){
  const target=list.querySelector(`[data-roster="${classId}"]`);if(!target)return;
  try{
    const {students}=await api('/api/enrollment/classes/'+classId+'/roster');rosters.set(classId,students);
    if(!target.isConnected)return;
    target.innerHTML=students.length?students.map(s=>`<article class="student-slot"><div class="slot-heading"><h4>${escape(s.name)}</h4><button type="button" class="text-button small" data-remove="${escape(s.id)}" data-class="${classId}">Remove from class</button></div><div class="slot-views"><section><h5>Student view</h5><p class="connection-status">${s.connected?'● Account connected':'○ Not connected yet'}</p>${s.connected?'':`<button type="button" class="teacher-button secondary" data-share-kind="student" data-learner="${escape(s.id)}" data-class="${classId}">Invite student</button>`}</section><section><h5>Parent view</h5>${s.parents.length?s.parents.map(p=>`<p class="connection-status">● ${escape(p.name)} <button type="button" class="text-button small" data-disconnect="${escape(p.id)}" data-learner="${escape(s.id)}" data-class="${classId}">Disconnect</button></p>`).join(''):'<p class="connection-status">○ No parent connected</p>'}<button type="button" class="teacher-button secondary" data-share-kind="family" data-learner="${escape(s.id)}" data-class="${classId}">${s.parents.length?'Invite another parent':'Invite parent'}</button>${s.demoParent?`<p class="connection-status">◉ Demo parent profile · no email</p><button type="button" class="teacher-button secondary" data-demo-parent="${escape(s.id)}" data-class="${classId}">Open demo parent dashboard</button>`:''}</section></div></article>`).join(''):'<p class="roster-empty">No students yet. Add a student to create their student and parent invitations, or share the class join code.</p>';
  }catch(error){if(target.isConnected)target.innerHTML='<p>Could not load students.</p><button type="button" class="text-button" data-retry-roster="'+classId+'">Try again</button>';problem(error);}
}
list.addEventListener('toggle',event=>{if(event.target.matches('details.class-card')&&event.target.open)loadRoster(event.target.dataset.classId);},true);
async function loadClasses(){
  if(loading||coursePlanner.isOpen())return;loading=true;retry.hidden=true;status.textContent='Loading your classes…';
  try{classrooms=(await api('/api/classes')).classes;renderClasses();calendar.refresh();if(currentView==='trash')await loadTrash();status.textContent='';}
  catch(error){problem(error);retry.hidden=false;}finally{loading=false;}
}
for(const [id,route]of[['create-form','/api/classes'],['join-form','/api/classes/join']]){
  const form=document.getElementById(id);
  form.addEventListener('submit',async event=>{
    event.preventDefault();const submit=form.querySelector('[type="submit"]'),error=form.querySelector('.form-error');if(submit.disabled)return;submit.disabled=true;error.hidden=true;
    const body=Object.fromEntries(new FormData(form));if(id==='create-form'){createRequestId ||= requestId();body.requestId=createRequestId;}
    try{const result=await api(route,body);form.closest('dialog').close();form.reset();if(id==='create-form')createRequestId='';await loadClasses();const card=list.querySelector(`[data-class-id="${result.classroom.id}"]`);if(card){card.open=true;card.querySelector('summary').focus();}status.textContent=id==='create-form'?'Class created. Add students or share its invitation.':'You have joined the class.';}
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
    if(button.dataset.deleteClass){deletingClass=button.dataset.deleteClass;$('#delete-class-name').textContent=classrooms.find(c=>c.id===deletingClass)?.name||'';$('#delete-class-form .form-error').hidden=true;openDialog('delete-class',button);}
    if(button.dataset.teacherTimeline)await teacherTimeline.open(button.dataset.teacherTimeline,null,button);
    if(button.dataset.demoParent)await teacherTimeline.open(button.dataset.class,button.dataset.demoParent,button,{demo:true});
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
retry.addEventListener('click',loadClasses);window.addEventListener('pageshow',loadClasses);window.addEventListener('pagehide',()=>{list.replaceChildren();rosters.clear();calendar.clear();$('#trash-list').replaceChildren();document.querySelectorAll('dialog[open]').forEach(d=>d.close());});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!document.querySelector('dialog[open]'))loadClasses();});
loadClasses();
