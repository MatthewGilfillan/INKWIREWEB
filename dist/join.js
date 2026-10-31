import {api,escape} from './workspace-shared.js';
const root=document.querySelector('#join-root');
const params=new URLSearchParams(location.hash.slice(1));
let kind=['class','student','family'].find(k=>params.has(k)) || 'class';
let code=(params.get(kind)||'').replace(/[\s-]/g,'').toUpperCase();
let account=null;
const valid=()=>new RegExp(`^[A-HJ-NP-Z2-9]{${kind==='class'?8:12}}$`).test(code);
const destination=()=>kind==='family'?'/parent':'/student';
const accountURL=mode=>'/account'+(mode==='signup'?'?mode=signup':'')+'#join='+kind+'.'+code;
function entry(message=''){
  root.innerHTML=`<h1>${kind==='family'?'Connect to your child':'Join a class'}</h1><p>Enter the invitation code your teacher shared.</p>${message?`<p class="form-error" role="alert">${escape(message)}</p>`:''}<form id="code-form"><label for="code-kind">Invitation type</label><select id="code-kind" name="kind"><option value="class" ${kind==='class'?'selected':''}>Class join code</option><option value="student" ${kind==='student'?'selected':''}>Individual student invitation</option><option value="family" ${kind==='family'?'selected':''}>Parent invitation</option></select><label for="join-code">Invitation code</label><input id="join-code" name="code" required maxlength="20" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${escape(code)}"><button type="submit" class="teacher-button">Continue</button></form>`;
  root.querySelector('form').addEventListener('submit',event=>{event.preventDefault();const data=new FormData(event.currentTarget);kind=data.get('kind');code=data.get('code').replace(/[\s-]/g,'').toUpperCase();history.replaceState(null,'','/join#'+kind+'='+code);initialise();});
}
async function initialise(){
  if(!valid())return entry(code?'Please check the invitation type and code.':'');
  root.innerHTML='<h1>Your invitation</h1><p>Checking your invitation…</p>';
  try{account=await api('/api/account');}
  catch(error){
    if(error.status!==401){root.innerHTML=`<h1>Your invitation</h1><p role="alert">${escape(error.message)}</p><button class="teacher-button" id="retry">Try again</button>`;root.querySelector('#retry').onclick=initialise;return;}
    const role=kind==='family'?'Parent':'Student';
    root.innerHTML=`<h1>${role} invitation</h1><p>${kind==='family'?'Connect your parent account to your child.':'Connect your student account to your class.'} Sign in or create a ${role.toLowerCase()} account to continue.</p><div class="teacher-actions"><a class="teacher-button" href="${accountURL('signin')}">Sign in</a><a class="teacher-button secondary" href="${accountURL('signup')}">Create account</a></div><p>You’ll return to this invitation after signing in. New accounts must verify their email first.</p>`;
    document.querySelector('[data-session-signout]').hidden=true;return;
  }
  document.querySelector('[data-session-signout]').hidden=false;
  try{
    const invitation=await api('/api/enrollment/preview',{kind,code});
    const heading=kind==='family'?'Connect to '+invitation.studentName:'Join '+invitation.className;
    root.innerHTML=`<h1>${escape(heading)}</h1><p>${kind==='family'?`You’ll see ${escape(invitation.studentName)}’s classes and progress from your parent dashboard.`:kind==='student'?`Connect your account as ${escape(invitation.studentName)}.`:escape(invitation.subject || 'Your class invitation is ready.')}</p><p>Signed in as ${escape(account.email)}</p>${invitation.alreadyJoined?`<a class="teacher-button" href="${destination()}">Open dashboard</a>`:`<form id="accept-invitation">${kind==='student'?'':`<label for="join-name">${kind==='family'?'Your name':'Student’s name'}</label><input id="join-name" name="name" maxlength="80" required autocomplete="given-name" placeholder="First name or preferred name">`}<p class="form-error" role="alert" hidden></p><button class="teacher-button" type="submit">${kind==='family'?'Connect to my child':'Join class'}</button></form>`}`;
    root.querySelector('form')?.addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget,button=form.querySelector('button'),error=form.querySelector('.form-error');if(button.disabled)return;button.disabled=true;error.hidden=true;try{await api('/api/enrollment/join',{kind,code,name:new FormData(form).get('name')});location.replace(destination());}catch(problem){error.textContent=problem.message;error.hidden=false;button.disabled=false;}});
  }catch(error){root.innerHTML=`<h1>Check your invitation</h1><p role="alert">${escape(error.message)}</p>${error.code==='ROLE_MISMATCH'?'<p>Use Sign out above, then reopen your invitation with the correct account.</p>':'<p>Ask your teacher for a new invitation if this one has expired.</p>'}<button id="different-code" class="teacher-button secondary">Enter another code</button>`;root.querySelector('#different-code').onclick=()=>{code='';entry();};}
}
const signout=document.querySelector('[data-session-signout]');
signout.addEventListener('click',async()=>{signout.disabled=true;try{await api('/api/accounts/signout',{});account=null;await initialise();}catch(error){root.textContent=error.message;}finally{signout.disabled=false;}});
window.addEventListener('hashchange',()=>location.reload());
initialise();
