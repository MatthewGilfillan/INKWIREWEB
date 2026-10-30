const dialog=document.querySelector('#signin-dialog');
document.querySelectorAll('[data-signin]').forEach(button=>button.addEventListener('click',()=>dialog.showModal()));
document.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
const menu=document.querySelector('.menu-toggle'),nav=document.querySelector('#site-nav');
menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));menu.setAttribute('aria-label',open?'Close navigation':'Open navigation');});
nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false');menu.setAttribute('aria-label','Open navigation');}));
document.querySelectorAll('[data-interest]').forEach(a=>a.addEventListener('click',()=>{document.querySelector('#interest').value=a.dataset.interest;}));
document.querySelector('#enquiry').addEventListener('submit',event=>{
event.preventDefault();const d=new FormData(event.target);
const subject='Ink Wire enquiry: '+d.get('interest');
const body='Hello Matthew,\n\nI would like to discuss learning support.\n\nName: '+d.get('name')+'\nEmail: '+d.get('email')+'\nStudent grade: '+d.get('grade')+'\nInterested in: '+d.get('interest')+'\n\nLearning goals:\n'+d.get('goals')+'\n\nThank you,\n'+d.get('name');
const url='mailto:matthew@inkwire.online?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
const status=document.querySelector('#enquiry-status');status.hidden=false;status.textContent='Your enquiry is ready to open in your email app. If no draft opens, email matthew@inkwire.online directly. Nothing has been sent from this website.';
location.href=url;
});
// Keep older workspace bookmarks functional after introducing the homepage.
if(['dashboard','timeline','notebook','quiz','feedback','teacher','parent'].includes(location.hash.slice(1))){
const route=location.hash.slice(1),role=route==='teacher'?'teacher':route==='parent'?'parent':'student';
location.replace('studio.html?role='+role+'#'+route);
}


if(new URLSearchParams(location.search).get('signin')==='1')dialog.showModal();
