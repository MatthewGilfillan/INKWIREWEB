export const sizeChoices=[8,9,9.5,10,10.5,11,11.5,12,14,16,18,20,24,28,32,36,48,72,96];
export const standardColors=[['Red','#ff0000'],['Orange','#ed7d31'],['Yellow','#ffff00'],['Light green','#92d050'],['Green','#008000'],['Teal','#008080'],['Sky blue','#00b0f0'],['Blue','#0070c0'],['Navy','#002060'],['Purple','#7030a0']];
const themes=[['Black','#000000'],['White','#ffffff'],['Charcoal','#404040'],['Grey','#808080'],['Ink','#243556'],['Slate','#52647c'],['Mint','#64e6be'],['Lavender','#b39ac7'],['Rose','#e39aa5'],['Gold','#bf9000']];
let deviceFamilies=[];
function css(){if(document.querySelector('link[data-text-tools]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='/text-tools.css?v=20261105-unified-fonts';link.dataset.textTools='';document.head.append(link);}
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
export function addColorPalette(input,{label=input.getAttribute('aria-label')||'Color',highlight=false,ink=false,onChoose}={}){
  css();const wrap=document.createElement('span');wrap.className='text-color-control';input.replaceWith(wrap);input.classList.add('text-custom-color');
  const trigger=document.createElement('button');trigger.type='button';trigger.className='text-color-trigger';trigger.setAttribute('aria-label',label);trigger.title=label;trigger.innerHTML='<span aria-hidden="true">'+(ink?'✎':highlight?'▰':'A')+'</span><span aria-hidden="true">⌄</span>';trigger.style.setProperty('--chosen-color',input.value);wrap.append(trigger);
  const menu=popup(trigger),heading=document.createElement('p');heading.textContent='Theme colours';menu.panel.append(heading);
  function swatches(colors){const grid=document.createElement('div');grid.className='text-colour-grid';for(const [name,color]of colors){const button=document.createElement('button');button.type='button';button.className='text-colour-swatch';button.style.backgroundColor=color;button.title=name;button.setAttribute('aria-label',label+': '+name);button.addEventListener('mousedown',e=>e.preventDefault());button.onclick=()=>{input.value=color;trigger.style.setProperty('--chosen-color',color);menu.close();input.dispatchEvent(new Event('change',{bubbles:true}));};grid.append(button);}menu.panel.append(grid);}
  const shades=[.8,.6,.4,-.25,-.5].flatMap(amount=>themes.map(([name,color])=>{const channels=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));const mixed='#'+channels.map(n=>Math.round(amount>0?n+(255-n)*amount:n*(1+amount)).toString(16).padStart(2,'0')).join('');return [name+(amount>0?' lighter ':' darker ')+Math.round(Math.abs(amount)*100)+'%',mixed];}));
  swatches([...themes,...shades]);const standard=document.createElement('p');standard.textContent='Standard colours';menu.panel.append(standard);swatches(standardColors);
  const clear=document.createElement('button');clear.type='button';clear.className='text-colour-reset';clear.textContent=highlight?'No highlight':'Automatic';clear.addEventListener('mousedown',e=>e.preventDefault());clear.onclick=()=>{menu.close();input.dispatchEvent(new CustomEvent('clear-text-color'));};menu.panel.append(clear);
  const more=document.createElement('label');more.className='text-more-colours';more.textContent='More colours…';const custom=document.createElement('input');custom.type='color';custom.value=input.value;custom.className='text-custom-color';custom.setAttribute('aria-label','More colours for '+label);more.append(custom);menu.panel.append(more);input.hidden=true;wrap.append(input);custom.addEventListener('change',()=>{input.value=custom.value;input.dispatchEvent(new Event('change',{bubbles:true}));});menu.panel.addEventListener('beforetoggle',()=>{custom.value=input.value;});input.addEventListener('change',()=>{trigger.style.setProperty('--chosen-color',input.value);menu.close();onChoose?.();});
  const unwatch=watchDisabled(input,trigger);return {sync(){trigger.style.setProperty('--chosen-color',input.value);},destroy(){unwatch();menu.destroy();}};
}
export function addSizePresets(input){
  css();input.step='any';input.classList.add('text-size-input');const wrapper=document.createElement('span');wrapper.className='text-size-control';input.replaceWith(wrapper);
  const smaller=document.createElement('button'),larger=document.createElement('button');for(const [button,label,text]of [[smaller,'Decrease font size','−'],[larger,'Increase font size','+']]){button.type='button';button.className='text-size-step';button.textContent=text;button.title=label;button.setAttribute('aria-label',label);button.addEventListener('mousedown',e=>e.preventDefault());}
  const field=document.createElement('span');field.className='text-size-field';field.append(input);wrapper.append(smaller,field,larger);
  const change=direction=>{if(input.disabled)return;const value=Number(input.value),next=direction>0?sizeChoices.find(size=>size>value):[...sizeChoices].reverse().find(size=>size<value);if(next!==undefined){input.value=String(next);input.dispatchEvent(new Event('change',{bubbles:true}));}sync();};smaller.onclick=()=>change(-1);larger.onclick=()=>change(1);
  const trigger=document.createElement('button');trigger.type='button';trigger.className='text-size-trigger';trigger.textContent='⌄';trigger.title='Font size presets';trigger.setAttribute('aria-label','Font size presets');field.append(trigger);const menu=popup(trigger);menu.panel.classList.add('text-size-options');
  for(const size of sizeChoices){const b=document.createElement('button');b.type='button';b.textContent=String(size);b.setAttribute('aria-label',size+' points');b.addEventListener('mousedown',e=>e.preventDefault());b.onclick=()=>{input.value=String(size);menu.close();input.dispatchEvent(new Event('change',{bubbles:true}));sync();};menu.panel.append(b);}
  function sync(){const value=Number(input.value);smaller.disabled=input.disabled||value<=sizeChoices[0];larger.disabled=input.disabled||value>=sizeChoices.at(-1);trigger.disabled=input.disabled;}
  input.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();change(event.key==='ArrowUp'?1:-1);}});
  input.addEventListener('change',sync);const observer=new MutationObserver(sync);observer.observe(input,{attributes:true,attributeFilter:['disabled']});sync();return {sync,destroy(){input.removeEventListener('change',sync);observer.disconnect();menu.destroy();}};
}
let fontPickerId=0;
const fontPickers=new Set();
let fontRequest;
async function installedFonts(){
  fontRequest ||= window.queryLocalFonts().then(fonts=>{
    deviceFamilies=[...new Set(fonts.map(font=>font.family))];
    for(const refresh of fontPickers)refresh();
  }).finally(()=>{fontRequest=null;});
  return fontRequest;
}
export function addFontPicker(input,datalist,defaultNames){
  css();input.hidden=true;input.removeAttribute('list');datalist.remove();
  const label=input.parentElement;label.classList.add('font-picker-label');
  // Keep the existing input as the formatting value, with one visible control.
  for(const node of label.childNodes)if(node.nodeType===3)node.textContent='';
  const choose=document.createElement('button');choose.type='button';choose.className='text-font-picker';choose.setAttribute('aria-label','Fonts');choose.setAttribute('aria-haspopup','dialog');
  const value=document.createElement('span'),arrow=document.createElement('span');arrow.textContent='⌄';arrow.setAttribute('aria-hidden','true');choose.append(value,arrow);label.append(choose);
  const menu=popup(choose);menu.panel.classList.add('text-font-options');menu.panel.setAttribute('role','dialog');menu.panel.setAttribute('aria-label','Fonts');
  const search=document.createElement('input');search.type='search';search.placeholder='Search fonts';search.setAttribute('aria-label','Search fonts');search.className='text-font-search';search.maxLength=80;
  const list=document.createElement('div');list.className='text-font-list';list.setAttribute('role','listbox');list.setAttribute('aria-label','Fonts');list.id='font-list-'+(++fontPickerId);search.setAttribute('aria-controls',list.id);
  const footer=document.createElement('div');footer.className='text-font-footer';
  const access=document.createElement('button');access.type='button';access.textContent='Fonts';access.className='text-font-access';access.title='Include fonts installed on this device';
  const status=document.createElement('p');status.className='text-font-status';status.setAttribute('role','status');footer.append(access,status);menu.panel.append(search,list,footer);
  let disposed=false,permissionGranted=false;
  function select(name){input.value=name;menu.close();input.dispatchEvent(new Event('change',{bubbles:true}));sync();}
  function fill(){
    if(disposed)return;list.replaceChildren();const query=search.value.trim(),unique=new Map();
    for(const name of [...defaultNames,...deviceFamilies,input.value])if(name&&!unique.has(name.toLocaleLowerCase()))unique.set(name.toLocaleLowerCase(),name);
    const names=[...unique.values()].sort((a,b)=>a.localeCompare(b)).filter(name=>name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
    if(query&&!names.length)names.push(query);
    for(const name of names){const row=document.createElement('button');row.type='button';row.textContent=name;row.setAttribute('role','option');row.setAttribute('aria-selected',String(name===input.value));row.style.fontFamily='"'+name.replace(/[^\p{L}\p{N} ._+&()-]/gu,'')+'",sans-serif';row.addEventListener('mousedown',event=>event.preventDefault());row.onclick=()=>select(name);list.append(row);}
    access.hidden=typeof window.queryLocalFonts!=='function'||permissionGranted||deviceFamilies.length>0;
    footer.hidden=access.hidden&&!status.textContent;
    if(!access.hidden&&!status.textContent)status.textContent='Include fonts installed on this device.';
  }
  function sync(){value.textContent=input.value||'Calibri';choose.title=input.value||'Fonts';choose.disabled=input.disabled;}
  async function load(granted=false){
    access.disabled=true;
    try{await installedFonts();if(disposed)return;permissionGranted=true;status.textContent='Installed fonts included.';fill();}
    catch{if(!disposed&&!granted)status.textContent='Font access was not granted. Search or enter a font name instead.';}
    finally{if(!disposed)access.disabled=false;}
  }
  access.onclick=()=>load();
  menu.panel.addEventListener('toggle',()=>{if(menu.panel.matches(':popover-open')){search.value='';fill();search.focus();}});
  search.addEventListener('input',fill);
  menu.panel.addEventListener('keydown',event=>{
    const rows=[...list.children],index=rows.indexOf(document.activeElement);
    if(event.key==='Escape'){event.preventDefault();menu.close();choose.focus();}
    else if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();if(rows.length)rows[(index+(event.key==='ArrowDown'?1:-1)+rows.length)%rows.length].focus();}
    else if(event.key==='Enter'&&document.activeElement===search){event.preventDefault();rows[0]?.click();}
  });
  input.addEventListener('change',sync);const observer=new MutationObserver(sync);observer.observe(input,{attributes:true,attributeFilter:['disabled']});
  if(Array.isArray(window.inkNoteFontFamilies))deviceFamilies=window.inkNoteFontFamilies;
  fontPickers.add(fill);fill();sync();
  // Reuse an existing grant without prompting when a notebook opens.
  if(typeof window.queryLocalFonts==='function')navigator.permissions?.query({name:'local-fonts'}).then(permission=>{if(!disposed&&permission.state==='granted')load(true);}).catch(()=>{});
  return {sync,destroy(){disposed=true;fontPickers.delete(fill);input.removeEventListener('change',sync);observer.disconnect();menu.destroy();}};
}
