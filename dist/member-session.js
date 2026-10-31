import {api,escape,signOut} from './workspace-shared.js';
const role=document.body.dataset.memberRole,list=document.querySelector('#class-list'),status=document.querySelector('#dashboard-status'),retry=document.querySelector('#retry-classes');
let loading=false;
const card=c=>`<article class="member-class"><span class="class-badge">Enrolled</span><h2>${escape(c.name)}</h2><p>${escape(c.subject || 'Class')}</p><p>Lesson content will appear here when it is published.</p></article>`;
async function load(){
  if(loading)return;loading=true;retry.hidden=true;
  try{
    const data=await api('/api/enrollment/mine');
    if(role==='student')list.innerHTML=data.classes.length?data.classes.map(card).join(''):'<div class="empty-classes"><h2>No classes yet</h2><p>Use your teacher’s invitation link or join code to connect to your class.</p></div>';
    else list.innerHTML=data.children.length?data.children.map(child=>`<h2 class="child-heading">${escape(child.name)}</h2>${child.classes.length?child.classes.map(card).join(''):'<p>Your parent connection is active. This student has no classes yet.</p>'}`).join(''):'<div class="empty-classes"><h2>Connect to your child</h2><p>Use the parent invitation your teacher shared. You’ll see your child’s classes here once connected.</p></div>';
    status.textContent='';
  }catch(error){list.replaceChildren();if(error.status===401)location.replace('/account');status.textContent=error.message;retry.hidden=false;}finally{loading=false;}
}
signOut(document.querySelector('[data-session-signout]'),status);retry.addEventListener('click',load);window.addEventListener('pageshow',load);window.addEventListener('pagehide',()=>list.replaceChildren());document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')load();});load();
