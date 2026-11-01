// Original Ink Wire artwork. Only allow-listed choices enter the SVG renderer.
export const choices = {
  head: ['person','worm','bear','cat','rabbit','robot'],
  hair: ['none','crop','swoop','curls','bob','long','puffs'],
  eyes: ['bright','happy','wink','sleepy','sparkle','lashes'],
  mouth: ['smile','grin','tiny','surprised','tongue'],
  accessory: ['none','glasses','round-glasses','bow','cap'],
  skin: ['peach','tan','brown','deep','mint','pink','gold','blue','lilac'],
  hairColor: ['ink','chocolate','copper','gold','pink','blue','white'],
  outfit: ['navy','teal','coral','gold','lilac','blue'],
  background: ['mint','lavender','peach','sky','cream'],
};
export const labels = {person:'Person',worm:'Bookworm',bear:'Bear',cat:'Cat',rabbit:'Rabbit',robot:'Robot',none:'None',crop:'Short',swoop:'Side sweep',curls:'Curly',bob:'Bob',long:'Long',puffs:'Puffs',bright:'Bright',happy:'Happy',wink:'Wink',sleepy:'Dreamy',sparkle:'Starry',lashes:'Lashes',smile:'Smile',grin:'Big grin',tiny:'Little smile',surprised:'Surprised',tongue:'Cheeky',glasses:'Glasses','round-glasses':'Round glasses',bow:'Bow',cap:'Cap',peach:'Peach',tan:'Tan',brown:'Brown',deep:'Deep brown',mint:'Mint',pink:'Rose',gold:'Honey',blue:'Blue',lilac:'Lilac',ink:'Ink',chocolate:'Chocolate',copper:'Copper',white:'White',navy:'Navy',teal:'Teal',coral:'Coral',lavender:'Lavender',sky:'Sky',cream:'Cream'};
export const colors = {peach:'#f7c5a5',tan:'#dca071',brown:'#a86b4a',deep:'#704736',mint:'#9ed6bc',pink:'#edafc5',gold:'#ecc36d',blue:'#8ebed9',lilac:'#b8a3db',ink:'#253449',chocolate:'#69473b',copper:'#b96742',white:'#f4eee2',navy:'#15365e',teal:'#398c88',coral:'#d57e70',lavender:'#e9deef',sky:'#d8eaf2',cream:'#f5edda'};
export const defaultAvatar = Object.freeze({head:'person',hair:'swoop',eyes:'bright',mouth:'smile',accessory:'none',skin:'peach',hairColor:'chocolate',outfit:'teal',background:'mint'});
export function validAvatar(value) {
  return !!value && typeof value==='object' && !Array.isArray(value) && Object.keys(value).length===Object.keys(choices).length && Object.entries(choices).every(([key,values])=>values.includes(value[key]));
}
export function avatarPreset(head, look='boy') {
  return {...defaultAvatar,head,hair:head==='person'?(look==='girl'?'bob':'swoop'):'none',skin:({worm:'mint',bear:'tan',cat:'gold',rabbit:'pink',robot:'blue'})[head]||'peach'};
}
export function randomAvatar() {
  const result=Object.fromEntries(Object.entries(choices).map(([key,values])=>[key,values[Math.floor(Math.random()*values.length)]]));
  if(result.head!=='person')result.hair='none';
  return result;
}
export function avatarSVG(input) {
  const a=validAvatar(input)?input:defaultAvatar,s=colors[a.skin],h=colors[a.hairColor],o=colors[a.outfit],line='#203956';
  const path=(d,fill='none',extra='')=>`<path d="${d}" fill="${fill}" ${extra}/>`;
  const circle=(x,y,r,fill,extra='')=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${extra}/>`;
  let art='';
  if(a.head==='person') {
    if(['long','bob'].includes(a.hair))art+=`<rect x="62" y="65" width="132" height="${a.hair==='long'?153:116}" rx="61" fill="${h}"/>`;
    art+=path('M48 258v-17q0-50 59-58h42q59 8 59 58v17',o)+path('M111 170v22q17 17 34 0v-22',s);
    art+=circle(65,128,13,s)+circle(191,128,13,s)+`<rect x="68" y="60" width="120" height="131" rx="56" fill="${s}"/>`;
    art+=path('M101 207q27 15 54 0','none','stroke="#fff" stroke-opacity=".5"');
  } else if(a.head==='worm') {
    art+=path('M48 255q-3-36 32-46q-16-29 13-48h68q35 23 10 47q38 16 33 47',s);
    art+=path('M87 211q40 16 82-2M83 235q45 16 87-2','none','stroke-opacity=".3"');
    art+=path('M100 67q-15-25-28-17M156 67q15-25 28-17')+circle(70,48,7,o)+circle(186,48,7,o);
    art+=`<ellipse cx="128" cy="123" rx="65" ry="61" fill="${s}"/>`;
    art+=path('M90 185q38 20 76 0l-2 21q-35 18-74-1Z',o);
  } else if(a.head==='robot') {
    art+=path('M59 256v-42q0-28 30-28h78q30 0 30 28v42',o)+circle(128,222,12,'#e8f6ee');
    art+=path('M128 67V44')+circle(128,36,9,o)+`<rect x="50" y="109" width="20" height="35" rx="7" fill="${o}"/><rect x="186" y="109" width="20" height="35" rx="7" fill="${o}"/><rect x="64" y="64" width="128" height="124" rx="33" fill="${s}"/><rect x="76" y="86" width="104" height="86" rx="24" fill="#f0f8f2"/>`;
  } else {
    art+=path('M50 257v-30q0-46 78-46t78 46v30',o);
    if(a.head==='bear')art+=circle(77,74,23,s)+circle(179,74,23,s)+circle(77,74,11,'#f7d5bc','stroke="none"')+circle(179,74,11,'#f7d5bc','stroke="none"');
    if(a.head==='cat')art+=path('M66 109 65 43q25 5 40 31M151 74q15-26 40-31l-1 66',s)+path('m75 77 1-19 18 17m68 0 18-17 1 19','#edb7b4','stroke="none"');
    if(a.head==='rabbit')art+=`<ellipse cx="93" cy="61" rx="18" ry="45" transform="rotate(-12 93 61)" fill="${s}"/><ellipse cx="163" cy="61" rx="18" ry="45" transform="rotate(12 163 61)" fill="${s}"/><path d="m88 35 8 46m72-46-8 46" stroke="#d68e9d" stroke-width="11"/>`;
    art+=`<ellipse cx="128" cy="128" rx="67" ry="61" fill="${s}"/>`;
    if(a.head==='bear')art+=`<ellipse cx="128" cy="148" rx="31" ry="25" fill="#f5d8b7" stroke="none"/>`;
    art+=path('m122 136 6 5 6-5q-6-7-12 0Z',line,'stroke-width="2"');
    if(a.head==='cat')art+=path('m50 137 27 4m-27 12 26-5m130-11-27 4m27 12-26-5','none','stroke-width="3"');
  }
  if(a.head==='person') {
    const hair={none:'',crop:path('M68 111q-8-58 55-60q67-2 65 58l-22-28-20 11-24-11-21 10-18-8Z',h),swoop:path('M65 119q-14-67 56-69q52-7 70 33l-8 39-15-34q-41 23-82 5l-9 26Z',h),curls:Array.from({length:7},(_,i)=>circle(70+i*19,78-Math.sin(i/6*Math.PI)*22,19,h)).join(''),bob:path('M63 120q-4-70 65-70t65 70l-21-39q-18 23-69 18L83 83l-4 37Z',h),long:path('M63 120q-4-70 65-70t65 70l-20-40q-34 22-80 14l-17 27Z',h),puffs:circle(57,77,25,h)+circle(199,77,25,h)+path('M67 101q-3-51 61-51t61 51l-22-22q-35 18-78 3Z',h)};
    art+=hair[a.hair];
  }
  art+=`<g stroke-width="4" stroke="${line}">`;
  const eye=(x,kind)=>kind==='happy'?path(`M${x-8} 120q8-13 16 0`):kind==='sleepy'?path(`M${x-8} 115q8 11 16 0`):kind==='sparkle'?path(`m${x} 108 3 6 7 2-5 5 1 7-6-4-6 4 1-7-5-5 7-2Z`,line,'stroke-width="1"'):`<ellipse cx="${x}" cy="118" rx="6" ry="9" fill="${line}" stroke="none"/>${circle(x+2,115,2,'white','stroke="none"')}${kind==='lashes'?path(`m${x-5} 112-5-5m10 3v-6`):''}`;
  art+=eye(103,a.eyes==='wink'?'bright':a.eyes)+eye(153,a.eyes==='wink'?'happy':a.eyes);
  art+=`<ellipse cx="87" cy="140" rx="9" ry="5" fill="#de8292" opacity=".45" stroke="none"/><ellipse cx="169" cy="140" rx="9" ry="5" fill="#de8292" opacity=".45" stroke="none"/>`;
  const y=a.head==='person'||a.head==='robot'?149:154;
  art+=({smile:path(`M115 ${y}q13 15 26 0`),grin:path(`M113 ${y-2}h30q-1 23-15 23t-15-23Z`,'#fff','stroke-width="3"'),tiny:path(`M122 ${y+3}q6 5 12 0`),surprised:`<ellipse cx="128" cy="${y+5}" rx="7" ry="9" fill="${line}"/>`,tongue:path(`M115 ${y}q13 14 26 0`)+path(`M128 ${y+6}v6q8 11 13-1v-10`,'#e998a8','stroke-width="2"')})[a.mouth];
  if(a.accessory==='glasses')art+=`<rect x="82" y="103" width="40" height="30" rx="9" fill="none"/><rect x="134" y="103" width="40" height="30" rx="9" fill="none"/>`+path('M122 115q6-6 12 0M75 110l7 2m92 0 7-2');
  if(a.accessory==='round-glasses')art+=circle(103,118,21,'none')+circle(153,118,21,'none')+path('M124 116h8M76 109l6 3m92 0 6-3');
  if(a.accessory==='bow')art+=path('M154 65q-13-24-24-8q-7 14 18 16q14 22 24 8q8-14-18-16Z',o)+circle(150,69,5,'#fff');
  if(a.accessory==='cap')art+=path('M78 82q0-40 48-40q44 0 50 40Z',o)+path('M78 82q57 14 113-2q-14-12-39-4Z',o);
  art+='</g>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256" role="img" aria-label="Cartoon avatar"><rect width="256" height="256" rx="40" fill="${colors[a.background]}"/><circle cx="207" cy="46" r="8" fill="#fff" opacity=".6"/><path d="M32 163v12m-6-6h12" stroke="#fff" stroke-width="4" stroke-linecap="round"/><g stroke="${line}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">${art}</g></svg>`;
}
export const placeholderSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="#e9deef"/><circle cx="40" cy="29" r="13" fill="#476382"/><path d="M15 74v-8a25 25 0 0 1 50 0v8" fill="#476382"/></svg>`;
