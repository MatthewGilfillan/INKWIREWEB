const durations=[30,40,45,50,60,90,120];
const pad=n=>String(n).padStart(2,'0');
export function enhanceScheduleInputs(root){
 const widgets=[];
 for(const backing of root.querySelectorAll('[data-day-time],[data-day-minutes],[data-setup="lessonMinutes"]')){
  const time=backing.hasAttribute('data-day-time'),label=backing.getAttribute('aria-label')||(time?'Lesson time':'Default lesson length');
  const wrap=document.createElement('span');wrap.className='schedule-picker';backing.before(wrap);wrap.append(backing);backing.hidden=true;backing.type='hidden';
  const parts=time?[{name:'hour',values:Array.from({length:24},(_,i)=>i),min:0,max:23},{name:'minute',values:[0,15,30,45],min:0,max:59}]:[{name:'duration',values:durations,min:15,max:240}];
  const controls=[];
  const read=part=>time?Number(backing.value.split(':')[part.name==='hour'?0:1]):Number(backing.value);
  const write=(part,value)=>{if(time){const values=(backing.value||'16:00').split(':');values[part.name==='hour'?0:1]=pad(value);backing.value=values.join(':');}else backing.value=String(value);backing.dispatchEvent(new Event('input',{bubbles:true}));backing.dispatchEvent(new Event('change',{bubbles:true}));refresh();};
  for(const [i,part]of parts.entries()){
   if(i){const colon=document.createElement('span');colon.className='schedule-colon';colon.textContent=':';colon.setAttribute('aria-hidden','true');wrap.append(colon);}
   const segment=document.createElement('span');segment.className='schedule-segment';const button=document.createElement('button');button.type='button';button.className='schedule-value';button.setAttribute('aria-label',label+' '+part.name);button.title='Click to scroll · double-click to type';
   const input=document.createElement('input');input.type='text';input.inputMode='numeric';input.maxLength=time?2:3;input.className='schedule-custom';input.hidden=true;input.setAttribute('aria-label','Type '+label+' '+part.name);
   const panel=document.createElement('div');panel.className='schedule-wheel-panel';panel.setAttribute('popover','auto');panel.setAttribute('aria-label',label+' '+part.name+' choices');document.body.append(panel);
   const wheel=document.createElement('div');wheel.className='schedule-wheel';wheel.setAttribute('role','listbox');wheel.setAttribute('aria-label',label+' '+part.name);wheel.tabIndex=0;
   const title=document.createElement('p');title.textContent=time?(part.name==='hour'?'Hour':'Minute'):'Lesson length · minutes';panel.append(title,wheel);
   let timer,opening=false,disposed=false;
   const choose=value=>{write(part,value);for(const option of wheel.children)option.setAttribute('aria-selected',String(Number(option.dataset.value)===value));};
   for(const value of part.values){const option=document.createElement('button');option.type='button';option.className='schedule-wheel-option';option.dataset.value=value;option.setAttribute('role','option');option.textContent=time?pad(value):String(value);option.onclick=()=>{choose(value);close();button.focus();};wheel.append(option);}
   const close=()=>{clearTimeout(timer);if(panel.matches(':popover-open'))panel.hidePopover();button.setAttribute('aria-expanded','false');};
   const edit=()=>{close();button.hidden=true;input.hidden=false;input.value=time?pad(read(part)):String(read(part));input.setCustomValidity('');input.focus();input.select();};
   const custom=document.createElement('button');custom.type='button';custom.className='schedule-wheel-custom';custom.textContent='Custom…';custom.onclick=edit;panel.append(custom);
   function open(){if(backing.disabled)return;if(panel.matches(':popover-open')){close();return;}const rect=button.getBoundingClientRect();panel.style.left=Math.max(8,Math.min(innerWidth-204,rect.left))+'px';panel.style.top=Math.min(rect.bottom+6,innerHeight-290)+'px';panel.showPopover();button.setAttribute('aria-expanded','true');opening=true;const index=part.values.reduce((best,value,i)=>Math.abs(value-read(part))<Math.abs(part.values[best]-read(part))?i:best,0);wheel.scrollTop=index*36;for(const option of wheel.children)option.setAttribute('aria-selected',String(Number(option.dataset.value)===read(part)));wheel.focus();requestAnimationFrame(()=>{opening=false;});}
   button.onclick=open;button.ondblclick=event=>{event.preventDefault();edit();};button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');
   wheel.addEventListener('scroll',()=>{if(opening||!panel.matches(':popover-open'))return;clearTimeout(timer);timer=setTimeout(()=>{if(disposed)return;const index=Math.max(0,Math.min(part.values.length-1,Math.round(wheel.scrollTop/36)));choose(part.values[index]);},100);});
   wheel.onkeydown=event=>{if(event.key==='Escape'){close();button.focus();return;}if(!['ArrowUp','ArrowDown','Home','End','Enter'].includes(event.key))return;event.preventDefault();if(event.key==='Enter'){close();button.focus();return;}let index=part.values.indexOf(read(part));if(event.key==='Home')index=0;else if(event.key==='End')index=part.values.length-1;else index=Math.max(0,Math.min(part.values.length-1,index+(event.key==='ArrowDown'?1:-1)));choose(part.values[index]);wheel.scrollTo({top:index*36});};
   const commit=()=>{if(input.hidden)return true;const value=Number(input.value);if(!/^\d{1,3}$/.test(input.value)||!Number.isInteger(value)||value<part.min||value>part.max){input.setCustomValidity('Enter '+part.min+'–'+part.max+'.');input.reportValidity();return false;}input.setCustomValidity('');write(part,value);input.hidden=true;button.hidden=false;return true;};
   input.oninput=()=>input.setCustomValidity('');input.onblur=commit;input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();if(commit())button.focus();}else if(event.key==='Escape'){event.preventDefault();input.hidden=true;button.hidden=false;input.setCustomValidity('');button.focus();}};
   panel.addEventListener('toggle',()=>button.setAttribute('aria-expanded',String(panel.matches(':popover-open'))));
   segment.append(button,input);wrap.append(segment);controls.push({button,input,part,destroy(){disposed=true;clearTimeout(timer);panel.remove();}});
  }
  function refresh(){for(const c of controls){const value=read(c.part);c.button.textContent=time?pad(value):String(value||'');c.button.disabled=c.input.disabled=backing.disabled;c.button.setAttribute('aria-label',label+' '+c.part.name+': '+c.button.textContent+(time?'':' minutes'));}}
  const observer=new MutationObserver(refresh);observer.observe(backing,{attributes:true,attributeFilter:['disabled']});refresh();widgets.push({refresh,destroy(){observer.disconnect();controls.forEach(c=>c.destroy());}});
 }
 return {refresh(){widgets.forEach(w=>w.refresh());},destroy(){widgets.forEach(w=>w.destroy());}};
}
