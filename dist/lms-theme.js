// A device preference shared by the LMS workspaces. Apply before first paint.
(() => {
 const key='inkwire.appearance.v1',root=document.documentElement;
 const normalize=value=>value==='dark'?'dark':'light';
 let theme='light';
 function read(){try{return normalize(localStorage.getItem(key));}catch{return theme;}}
 function apply(value){
  theme=normalize(value);root.dataset.lmsTheme=theme;
  document.querySelectorAll('[data-lms-theme-toggle]').forEach(button=>{
   button.setAttribute('aria-checked',String(theme==='dark'));
   button.title=theme==='dark'?'Switch to light mode':'Switch to dark mode';
  });
 }
 apply(read());
 function mount(){
  document.querySelectorAll('.workspace-header').forEach(header=>{
   if(header.querySelector('[data-lms-theme-toggle]'))return;
   const account=header.querySelector('.today-account'),tools=document.createElement('div'),button=document.createElement('button');
   tools.className='workspace-header-tools';button.type='button';button.className='lms-theme-toggle';
   button.dataset.lmsThemeToggle='';button.setAttribute('role','switch');button.setAttribute('aria-label','Dark mode');
   button.innerHTML='<svg class="theme-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 13.5A9 9 0 0 1 10.5 3.2 9 9 0 1 0 20.8 13.5Z"/></svg><span class="theme-switch-track" aria-hidden="true"><span></span></span><svg class="theme-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
   button.addEventListener('click',()=>{apply(theme==='dark'?'light':'dark');try{localStorage.setItem(key,theme);}catch{}});
   if(account)account.before(tools);else header.append(tools);
   tools.append(button);if(account)tools.append(account);
  });
  apply(theme);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
 window.addEventListener('storage',event=>{if(event.key===key||event.key===null)apply(event.newValue);});
 window.addEventListener('pageshow',()=>apply(read()));
})();
