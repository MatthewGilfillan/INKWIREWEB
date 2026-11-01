export const sizeChoices=[8,9,9.5,10,10.5,11,11.5,12,14,16,18,20,22,24,26,28,36,48,72,96];
export const standardColors=[['Red','#ff0000'],['Orange','#ed7d31'],['Yellow','#ffff00'],['Light green','#92d050'],['Green','#008000'],['Teal','#008080'],['Sky blue','#00b0f0'],['Blue','#0070c0'],['Navy','#002060'],['Purple','#7030a0']];
const themes=[['Black','#000000'],['White','#ffffff'],['Charcoal','#404040'],['Grey','#808080'],['Ink','#243556'],['Slate','#52647c'],['Mint','#64e6be'],['Lavender','#b39ac7'],['Rose','#e39aa5'],['Gold','#bf9000']];
let deviceFamilies=[];
function css(){if(document.querySelector('link[data-text-tools]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='/text-tools.css';link.dataset.textTools='';document.head.append(link);}
function popup(trigger){
  const panel=document.createElement('div');panel.className='text-tools-popover';panel.setAttribute('popover','auto');panel.setAttribute('aria-label',trigger.getAttribute('aria-label')+' options');
  document.body.append(panel);trigger.setAttribute('aria-expanded','false');
  const close=()=>{if(panel.matches(':popover-open'))panel.hidePopover();};
  trigger.addEventListener('mousedown',e=>e.preventDefault());
  trigger.addEventListener('click',()=>{if(trigger.disabled)return;if(panel.matches(':popover-open')){close();return;}const rect=trigger.getBoundingClientRect();panel.style.left=Math.max(8,Math.min(rect.left,innerWidth-300))+'px';panel.style.top=Math.min(rect.bottom+7,Math.max(8,innerHeight-410))+'px';panel.showPopover();});
  panel.addEventListener('toggle',()=>trigger.setAttribute('aria-expanded',String(panel.matches(':popover-open'))));
  return {panel,close,destroy:()=>panel.remove()};
}
function watchDisabled(input,button){button.disabled=input.disabled;const observer=new MutationObserver(()=>{button.disabled=input.disabled;});observer.observe(input,{attributes:true,attributeFilter:['disabled']});return ()=>observer.disconnect();}
export function addColorPalette(input,{label=input.getAttribute('aria-label')||'Color',highlight=false,onChoose}={}){
  css();const wrap=document.createElement('span');wrap.className='text-color-control';input.replaceWith(wrap);input.classList.add('text-custom-color');
  const trigger=document.createElement('button');trigger.type='button';trigger.className='text-color-trigger';trigger.setAttribute('aria-label',label);trigger.title=label;trigger.innerHTML='<span aria-hidden="true">'+(highlight?'▰':'A')+'</span><span aria-hidden="true">⌄</span>';trigger.style.setProperty('--chosen-color',input.value);wrap.append(trigger);
  const menu=popup(trigger),heading=document.createElement('p');heading.textContent='Theme colours';menu.panel.append(heading);
  function swatches(colors){const grid=document.createElement('div');grid.className='text-colour-grid';for(const [name,color]of colors){const button=document.createElement('button');button.type='button';button.className='text-colour-swatch';button.style.backgroundColor=color;button.title=name;button.setAttribute('aria-label',label+': '+name);button.addEventListener('mousedown',e=>e.preventDefault());button.onclick=()=>{input.value=color;trigger.style.setProperty('--chosen-color',color);menu.close();input.dispatchEvent(new Event('change',{bubbles:true}));};grid.append(button);}menu.panel.append(grid);}
  const shades=[.8,.6,.4,-.25,-.5].flatMap(amount=>themes.map(([name,color])=>{const channels=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));const mixed='#'+channels.map(n=>Math.round(amount>0?n+(255-n)*amount:n*(1+amount)).toString(16).padStart(2,'0')).join('');return [name+(amount>0?' lighter ':' darker ')+Math.round(Math.abs(amount)*100)+'%',mixed];}));
  swatches([...themes,...shades]);const standard=document.createElement('p');standard.textContent='Standard colours';menu.panel.append(standard);swatches(standardColors);
  const clear=document.createElement('button');clear.type='button';clear.className='text-colour-reset';clear.textContent=highlight?'No highlight':'Automatic';clear.addEventListener('mousedown',e=>e.preventDefault());clear.onclick=()=>{menu.close();input.dispatchEvent(new CustomEvent('clear-text-color'));};menu.panel.append(clear);
  const more=document.createElement('label');more.className='text-more-colours';more.textContent='More colours…';const custom=document.createElement('input');custom.type='color';custom.value=input.value;custom.className='text-custom-color';custom.setAttribute('aria-label','More colours for '+label);more.append(custom);menu.panel.append(more);input.hidden=true;wrap.append(input);custom.addEventListener('change',()=>{input.value=custom.value;input.dispatchEvent(new Event('change',{bubbles:true}));});menu.panel.addEventListener('beforetoggle',()=>{custom.value=input.value;});input.addEventListener('change',()=>{trigger.style.setProperty('--chosen-color',input.value);menu.close();onChoose?.();});
  const unwatch=watchDisabled(input,trigger);return {sync(){trigger.style.setProperty('--chosen-color',input.value);},destroy(){unwatch();menu.destroy();}};
}
export function addSizePresets(input){
  css();input.step='0.5';const wrapper=document.createElement('span');wrapper.className='text-size-control';input.replaceWith(wrapper);wrapper.append(input);const trigger=document.createElement('button');trigger.type='button';trigger.className='text-size-trigger';trigger.textContent='⌄';trigger.title='Font size presets';trigger.setAttribute('aria-label','Font size presets');wrapper.append(trigger);const menu=popup(trigger);menu.panel.classList.add('text-size-options');
  for(const size of sizeChoices){const b=document.createElement('button');b.type='button';b.textContent=String(size);b.setAttribute('aria-label',size+' points');b.addEventListener('mousedown',e=>e.preventDefault());b.onclick=()=>{input.value=String(size);menu.close();input.dispatchEvent(new Event('change',{bubbles:true}));};menu.panel.append(b);}
  const unwatch=watchDisabled(input,trigger);return {destroy(){unwatch();menu.destroy();}};
}
export function addDeviceFonts(input,datalist,defaultNames){
  css();const button=document.createElement('button');button.type='button';button.className='device-fonts-button';button.textContent='Device fonts';button.title='Add installed font families to this list';input.parentElement.append(button);const status=document.createElement('span');status.className='text-font-status';status.setAttribute('role','status');input.parentElement.append(status);
  function fill(){datalist.replaceChildren();for(const name of [...new Set([...defaultNames,...deviceFamilies])].sort((a,b)=>a.localeCompare(b))){const option=document.createElement('option');option.value=name;datalist.append(option);}}
  fill();
  if(!('queryLocalFonts' in window)){button.hidden=true;input.title='Type any installed font family name. This browser cannot list device fonts.';}
  else button.onclick=async()=>{button.disabled=true;try{const fonts=await window.queryLocalFonts();deviceFamilies=[...new Set(fonts.map(f=>f.family))];fill();status.textContent=deviceFamilies.length+' device font families available. Other devices need the same font.';button.textContent='Fonts loaded';}catch{status.textContent='Font access was not granted. You can still type an installed font name.';}finally{button.disabled=input.disabled;}};
  const unwatch=watchDisabled(input,button);return {destroy(){unwatch();}};
}
