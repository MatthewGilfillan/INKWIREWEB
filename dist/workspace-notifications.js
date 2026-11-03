import {api,escape} from './workspace-shared.js';
export function mountNotifications(tools){
 if(tools.querySelector('[data-notifications-toggle]'))return;
 const wrap=document.createElement('div');wrap.className='workspace-notifications';
 wrap.innerHTML='<button type="button" class="notifications-toggle" data-notifications-toggle aria-label="Notifications" aria-expanded="false" aria-controls="workspace-notifications-panel"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg><span class="notifications-badge" hidden></span></button><section id="workspace-notifications-panel" class="workspace-notifications-panel" aria-label="Notifications" hidden><header><h2 tabindex="-1">Notifications</h2><button type="button" data-read-all disabled>Mark all read</button></header><div data-notification-list></div></section>';
 const account=tools.querySelector('.today-account');if(account)account.before(wrap);else tools.append(wrap);
 const button=wrap.querySelector('[data-notifications-toggle]'),panel=wrap.querySelector('section'),list=wrap.querySelector('[data-notification-list]'),badge=wrap.querySelector('.notifications-badge');
 let items=[],busy=false,loaded=false;
 function render(){
  const unread=items.filter(item=>!item.read).length;badge.hidden=!unread;badge.textContent=unread>99?'99+':String(unread);button.setAttribute('aria-label',unread?`Notifications, ${unread} unread`:'Notifications');
  wrap.querySelector('[data-read-all]').disabled=!unread;
  list.innerHTML=items.length?items.map(item=>`<a class="notification-item ${item.read?'':'is-unread'}" data-notification-id="${escape(item.id)}" href="/teacher?${new URLSearchParams({view:'classes',notificationClass:item.classId,...(item.lessonIndex>=0?{notificationLesson:String(item.lessonIndex)}:{})})}"><span class="notification-type" aria-hidden="true">${item.type==='cancellation'?'×':'✓'}</span><span><strong>${escape(item.title)}</strong><span>${escape(item.detail)}</span><small>${item.type==='cancellation'?'Schedule updated ':''}${escape(new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.at)))}</small></span>${item.read?'':'<span class="notification-unread" aria-label="Unread"></span>'}</a>`).join(''):'<p class="notifications-empty">You’re all caught up. New submissions and class updates will appear here.</p>';
 }
 async function refresh(){
  if(busy||document.hidden)return;busy=true;
  try{const result=await api('/api/notifications');items=result.items||[];loaded=true;render();}
  catch{if(!loaded){list.innerHTML='<p class="notifications-empty">Notifications could not be loaded.</p><button type="button" data-notifications-retry>Try again</button>';}}
  finally{busy=false;}
 }
 function close(){panel.hidden=true;button.setAttribute('aria-expanded','false');}
 button.addEventListener('click',()=>{const open=panel.hidden;panel.hidden=!open;button.setAttribute('aria-expanded',String(open));if(open){if(!loaded)list.innerHTML='<p class="notifications-empty">Loading notifications…</p>';refresh();panel.querySelector('h2').focus({preventScroll:true});}});
 wrap.addEventListener('click',async event=>{
  if(event.target.closest('[data-notifications-retry]'))refresh();
  const all=event.target.closest('[data-read-all]'),link=event.target.closest('[data-notification-id]');if(!all&&!link)return;
  if(link&&(event.ctrlKey||event.metaKey||event.shiftKey||event.altKey))return;
  if(link)event.preventDefault();const href=link?.href;
  const ids=all?items.map(item=>item.id):[link.dataset.notificationId];if(all)all.disabled=true;
  try{await api('/api/notifications',{ids});items=items.map(item=>ids.includes(item.id)?{...item,read:true}:item);render();}catch{if(all)all.disabled=false;}finally{if(href)location.assign(href);}
 });
 document.addEventListener('click',event=>{if(!wrap.contains(event.target))close();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!panel.hidden){close();button.focus({preventScroll:true});}});
 window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});setInterval(refresh,60000);refresh();
}
