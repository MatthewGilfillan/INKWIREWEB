import {createClassFiles} from './class-files.js';
import {createMemberCourse} from './member-course.js?v=20261108-timeline-actions';
import {api,escape,signOut} from './workspace-shared.js';
const role=document.body.dataset.memberRole,list=document.querySelector('#class-list'),status=document.querySelector('#dashboard-status'),retry=document.querySelector('#retry-classes');
let loading=false;
const accountMenu=document.querySelector('.today-account');
document.addEventListener('click',event=>{if(accountMenu && !accountMenu.contains(event.target))accountMenu.open=false;});
document.addEventListener('keydown',event=>{if(event.key==='Escape' && accountMenu)accountMenu.open=false;});
const fileDialog=document.createElement('dialog');fileDialog.className='class-files-dialog';fileDialog.setAttribute('aria-label','Class files');fileDialog.innerHTML='<button type="button" class="teacher-close" aria-label="Close class files">×</button><div data-member-files></div>';document.body.append(fileDialog);fileDialog.querySelector('button').onclick=()=>fileDialog.close();const files=createClassFiles({root:fileDialog.querySelector('[data-member-files]')});fileDialog.addEventListener('close',()=>files.clear());
const learningRoot=role==='student'?document.querySelector('#student-course-workspace'):null;
const timeline=createMemberCourse({parent:role==='parent',root:learningRoot});
let enrolled=[],openedClass='',enrolledLearner='';
async function openCourse(id,learner,button){
  if(learningRoot){openedClass=id;learningRoot.hidden=false;list.hidden=true;document.querySelector('[data-student-overview]').hidden=true;document.querySelector('[data-student-course-back]').hidden=false;}
  await timeline.open(id,learner,button);
  if(learningRoot)document.querySelector('#student-course-title')?.focus({preventScroll:true});
}
function showClasses(){if(!learningRoot){timeline.clear();return;}openedClass='';timeline.clear();learningRoot.hidden=true;list.hidden=false;document.querySelector('[data-student-overview]').hidden=false;document.querySelector('[data-student-course-back]').hidden=true;}
document.querySelector('[data-student-course-back]')?.addEventListener('click',showClasses);
document.querySelector('[data-student-home]')?.addEventListener('click',event=>{event.preventDefault();showClasses();});
const card=(c,learnerId='',i=0)=>`<article class="member-class"><span class="member-class-icon tone-${i%3}" aria-hidden="true">${escape(Array.from(c.name)[0] || 'C')}</span><div class="member-class-copy"><h2>${escape(c.name)}</h2><p>${escape(c.subject || 'Class')}</p></div><div class="member-class-actions"><button type="button" class="teacher-button" data-member-course="${escape(c.id)}" data-learner="${escape(learnerId)}">Open course <span aria-hidden="true">→</span></button><a class="text-button" href="/notebooks?classId=${escape(c.id)}${learnerId?'&amp;notebookId='+escape(c.id)+'.'+escape(learnerId):''}">${role==='parent'?'View notebook':'My notebook'} ↗</a><button type="button" class="text-button member-files-button" data-member-files-open="${escape(c.id)}">Class files</button></div></article>`;
async function load(){
  if(loading)return;loading=true;retry.hidden=true;
  try{
    const data=await api('/api/enrollment/mine');
    if(role==='student'){enrolled=data.classes;enrolledLearner=data.learner?.id || '';if(openedClass && !enrolled.some(c=>c.id===openedClass))showClasses();list.innerHTML=data.classes.length?data.classes.map((c,i)=>card(c,enrolledLearner,i)).join(''):'<div class="empty-classes"><h2>No classes yet</h2><p>Use your teacher’s invitation link or join code to connect to your class.</p></div>';}
    else list.innerHTML=data.children.length?data.children.map(child=>`<h2 class="child-heading"><img class="profile-face" src="/api/profiles/learners/${encodeURIComponent(child.id)}/image" alt="" loading="lazy">${escape(child.name)}</h2>${child.classes.length?child.classes.map(c=>card(c,child.id)).join(''):'<p>Your parent connection is active. This student has no classes yet.</p>'}`).join(''):'<div class="empty-classes"><h2>Connect to your child</h2><p>Use the parent invitation your teacher shared. You’ll see your child’s classes here once connected.</p></div>';
    status.textContent='';
  }catch(error){list.replaceChildren();if(error.status===401)location.replace('/account');status.textContent=error.message;retry.hidden=false;}finally{loading=false;}
}
signOut(document.querySelector('[data-session-signout]'),status);retry.addEventListener('click',load);window.addEventListener('pageshow',load);window.addEventListener('pagehide',()=>{list.replaceChildren();showClasses();});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load();});load();

list.addEventListener('click',event=>{const button=event.target.closest('[data-member-course]');if(button)openCourse(button.dataset.memberCourse,button.dataset.learner,button);});

list.addEventListener('click',event=>{const button=event.target.closest('[data-member-files-open]');if(button){fileDialog.showModal();files.open(button.dataset.memberFilesOpen);}});
