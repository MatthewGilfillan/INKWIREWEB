import {choices,labels,colors,defaultAvatar,avatarPreset,randomAvatar,avatarSVG,placeholderSVG} from './avatar-model.mjs';
const $=s=>document.querySelector(s);
let avatar={...defaultAvatar},mode='avatar',part='eyes',revision=0,savedKind='none',dirty=false,busy=false,bitmap=null,photoRequest=0,photoLoading=false;
const canvas=document.createElement('canvas');canvas.width=canvas.height=512;canvas.setAttribute('aria-label','Cropped photo preview');canvas.setAttribute('role','img');
const ctx=canvas.getContext('2d');
async function api(path,body){const r=await fetch(path,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok){const e=Error(data.message||'Could not load your picture.');e.status=r.status;throw e;}return data;}
function changed(){dirty=true;$('#profile-message').textContent='Looking good. Save when you’re ready.';$('#profile-error').hidden=true;}
function error(e){$('#profile-error').textContent=e.message;$('#profile-error').hidden=false;if(e.status===409)$('#reload-profile').hidden=false;}
function setBusy(value){busy=value;document.querySelectorAll('#profile-workspace button,#profile-workspace input').forEach(el=>el.disabled=value);$('#save-profile').textContent=value?'Saving…':'Save picture';}
function photoPreview(){if(!bitmap)return;const size=Math.min(bitmap.width,bitmap.height)/Number($('#photo-zoom').value),x=(bitmap.width-size)*Number($('#photo-x').value)/100,y=(bitmap.height-size)*Number($('#photo-y').value)/100;ctx.fillStyle='#fff';ctx.fillRect(0,0,512,512);ctx.drawImage(bitmap,x,y,size,size,0,0,512,512);}
function preview(){
  const target=$('#profile-preview');target.replaceChildren();
  if(mode==='avatar')target.innerHTML=avatarSVG(avatar);
  else if(mode==='photo'&&bitmap){target.append(canvas);photoPreview();}
  else if(mode==='photo'&&savedKind==='photo'){const img=document.createElement('img');img.src='/api/profiles/me/image?v='+revision;img.alt='Your saved profile photo';target.append(img);}
  else target.innerHTML=placeholderSVG;
  $('#preview-caption').textContent=mode==='avatar'?({person:'Hello, you.',worm:'A real bookworm.',bear:'Bear-y good company.',cat:'Curiosity looks good.',rabbit:'Big ears. Big ideas.',robot:'Powered by curiosity.'})[avatar.head]:mode==='photo'?'Your own kind of lovely.':'Make it yours.';
  $('#preview-description').textContent=mode==='avatar'?'Mix a little imagination with a little you.':mode==='photo'?'Your face, your classroom, your choice.':'A friendly face for your next adventure.';
  $('#surprise-avatar').hidden=mode!=='avatar';
}
function option(key,value){const config={...avatar,[key]:value};return `<button type="button" data-choice="${key}" data-value="${value}" aria-label="${labels[value]}" aria-pressed="${avatar[key]===value}">${avatarSVG(config).replace('role="img" aria-label="Cartoon avatar"','aria-hidden="true"')}<span>${labels[value]}</span></button>`;}
function renderParts(){
  if(avatar.head!=='person'&&part==='hair')part='eyes';
  const parts=[...(avatar.head==='person'?[['hair','Hair']]:[]),['eyes','Eyes'],['mouth','Smiles'],['accessory','Extras']];
  $('#avatar-part-tabs').innerHTML=parts.map(([key,label])=>`<button type="button" data-part="${key}" aria-pressed="${key===part}">${label}</button>`).join('');
  $('#avatar-part-options').setAttribute('aria-label',parts.find(([key])=>key===part)?.[1]||'Features');
  $('#avatar-part-options').innerHTML=choices[part].map(v=>option(part,v)).join('');
}
function renderColors(){
  const fields=[['skin',avatar.head==='person'?'Skin tone':'Character colour'],...(avatar.head==='person'?[['hairColor','Hair colour']]:[]),['outfit','Clothes & extras'],['background','Background']];
  $('#avatar-palettes').innerHTML=fields.map(([key,label])=>`<div class="avatar-palette"><span>${label}</span><div class="palette-options" role="group" aria-label="${label}">${choices[key].map(value=>`<button type="button" data-choice="${key}" data-value="${value}" title="${labels[value]}" aria-label="${label}: ${labels[value]}" aria-pressed="${avatar[key]===value}"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="${colors[value]}"/></svg></button>`).join('')}</div></div>`).join('');
}
function renderAvatar(){
  $('#head-options').innerHTML=choices.head.map(head=>`<button type="button" data-head="${head}" aria-label="${labels[head]}" aria-pressed="${avatar.head===head}">${avatarSVG(avatarPreset(head)).replace('role="img" aria-label="Cartoon avatar"','aria-hidden="true"')}<span>${labels[head]}</span></button>`).join('');
  $('#person-starters').hidden=avatar.head!=='person';renderParts();renderColors();
}
function setMode(value){mode=value;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));$('#avatar-controls').hidden=mode!=='avatar';$('#photo-controls').hidden=mode!=='photo';$('#default-controls').hidden=mode!=='none';preview();}
$('#profile-workspace').addEventListener('click',e=>{
  const button=e.target.closest('button');if(!button||busy)return;
  if(button.dataset.mode){setMode(button.dataset.mode);changed();}
  if(button.dataset.head){avatar=avatarPreset(button.dataset.head);changed();renderAvatar();preview();$(`[data-head="${avatar.head}"]`).focus();}
  if(button.dataset.person){avatar={...avatar,hair:button.dataset.person==='girl'?'bob':'swoop'};changed();renderAvatar();preview();$(`[data-person="${button.dataset.person}"]`).focus();}
  if(button.dataset.part){part=button.dataset.part;renderParts();$(`[data-part="${part}"]`).focus();}
  if(button.dataset.choice){const key=button.dataset.choice,value=button.dataset.value;avatar[key]=value;changed();renderParts();renderColors();preview();$(`[data-choice="${key}"][data-value="${value}"]`)?.focus();}
});
$('#surprise-avatar').onclick=()=>{avatar=randomAvatar();changed();renderAvatar();preview();};
$('#reset-profile').onclick=()=>{setMode('none');changed();};
$('#profile-photo').onchange=async e=>{
  const file=e.target.files?.[0];if(!file)return;const ticket=++photoRequest;photoLoading=true;$('#save-profile').disabled=true;$('#profile-error').hidden=true;
  try{
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('Choose a JPG, PNG or WebP photo smaller than 10 MB.');
    const next=await createImageBitmap(file,{imageOrientation:'from-image'});
    if(ticket!==photoRequest){next.close();return;}
    if(next.width*next.height>40000000){next.close();throw Error('This photo is very large. Choose one smaller than 40 megapixels.');}
    bitmap?.close();bitmap=next;$('#photo-zoom').value=1;$('#photo-x').value=$('#photo-y').value=50;$('#photo-crop-controls').hidden=false;changed();preview();
  }catch(e){error(e);}finally{if(ticket===photoRequest){photoLoading=false;$('#save-profile').disabled=false;}}
};
for(const id of ['photo-zoom','photo-x','photo-y'])$('#'+id).oninput=()=>{changed();photoPreview();};
$('#save-profile').onclick=async()=>{
  if(busy||photoLoading)return;
  if(mode==='photo'&&!bitmap){if(savedKind==='photo'){dirty=false;$('#profile-message').textContent='Your photo is already saved.';}else error(Error('Choose a photo first.'));return;}
  setBusy(true);$('#profile-error').hidden=true;
  try{
    const body={kind:mode,revision};
    if(mode==='avatar')body.avatar=avatar;
    if(mode==='photo'){photoPreview();body.photo=canvas.toDataURL('image/jpeg',.86).split(',')[1];if(body.photo.length>273068)body.photo=canvas.toDataURL('image/jpeg',.7).split(',')[1];}
    const result=await api('/api/profiles/me',body);revision=result.revision;savedKind=result.kind;dirty=false;$('#reload-profile').hidden=true;$('#profile-message').textContent='Picture saved. It’s ready for your classroom.';
  }catch(e){error(e);}finally{setBusy(false);}
};
async function load(){
  $('#profile-loading').hidden=false;$('#profile-loading').textContent='Loading your picture…';
  try{const [account,p]=await Promise.all([api('/api/account'),api('/api/profiles/me')]);if(['teacher','student','parent'].includes(account.role))$('#profile-dashboard').href='/'+account.role;revision=p.revision;savedKind=p.kind;avatar=p.avatar||{...defaultAvatar};bitmap?.close();bitmap=null;photoRequest++;photoLoading=false;$('#photo-crop-controls').hidden=true;$('#profile-photo').value='';dirty=false;$('#profile-workspace').hidden=false;$('#profile-loading').hidden=true;$('#profile-error').hidden=true;$('#reload-profile').hidden=true;$('#profile-message').textContent='Your changes are a preview until you save.';renderAvatar();setMode(p.kind==='photo'?'photo':'avatar');}
  catch(e){if(e.status===401){location.replace('/account?manage=1');return;}$('#profile-loading').textContent=e.message;$('#profile-loading').append(document.createElement('br'));const retry=document.createElement('button');retry.className='profile-button secondary';retry.textContent='Try again';retry.onclick=load;$('#profile-loading').append(retry);}
}
$('#reload-profile').onclick=()=>{if(!dirty||confirm('Reload your saved picture and discard this preview?'))load();};
window.addEventListener('beforeunload',e=>{if(dirty||busy){e.preventDefault();e.returnValue='';}});
window.addEventListener('pagehide',e=>{if(!e.persisted){bitmap?.close();bitmap=null;}});
load();
