export const classPalettes=[
 {id:'mint',name:'Sea glass',colors:['#2b8978','#8cdbc5','#e4f6f0']},
 {id:'periwinkle',name:'Periwinkle',colors:['#6454b8','#b4b9ef','#efedfc']},
 {id:'ocean',name:'Ocean',colors:['#2774b8','#8cc9ef','#e7f3fc']},
 {id:'peach',name:'Peach',colors:['#b65e40','#efb59c','#fff0e8']},
 {id:'rose',name:'Rose',colors:['#a84674','#e5a1bd','#fcecf3']},
 {id:'gold',name:'Golden hour',colors:['#99701d','#e9ca75','#fff6db']},
 {id:'forest',name:'Forest',colors:['#4f7b44','#accb8a','#edf5e5']},
 {id:'slate',name:'Slate',colors:['#536d87','#a9bdd0','#edf2f7']},
];
export function cleanClassPalette(value){
 if(value==null||value.id==='auto')return null;
 if(classPalettes.some(p=>p.id===value.id))return {id:value.id};
 if(value.id!=='cover'||!Array.isArray(value.colors)||value.colors.length!==3||value.colors.some(c=>typeof c!=='string'||!/^#[0-9a-f]{6}$/i.test(c)))throw Error('Choose a class palette or a book cover.');
 return {id:'cover',colors:value.colors.map(c=>c.toLowerCase())};
}
const rgb=hex=>hex.slice(1).match(/../g).map(x=>parseInt(x,16));
const hex=values=>'#'+values.map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');
const mix=(color,target,amount)=>hex(rgb(color).map((x,i)=>x*(1-amount)+rgb(target)[i]*amount));
function automaticPalette(hash){
 const hue=hash%360,chroma=.52*(1-Math.abs(2*.43-1)),x=chroma*(1-Math.abs(hue/60%2-1)),m=.43-chroma/2;
 const channels=hue<60?[chroma,x,0]:hue<120?[x,chroma,0]:hue<180?[0,chroma,x]:hue<240?[0,x,chroma]:hue<300?[x,0,chroma]:[chroma,0,x],seed=hex(channels.map(c=>(c+m)*255));
 return {id:'auto',name:'Automatic',colors:[seed,mix(seed,'#ffffff',.48),mix(seed,'#ffffff',.9)]};
}
export function classPalette(value,id=''){
 let hash=0;for(const c of id)hash=(hash*31+c.charCodeAt(0))>>>0;
 let selected;try{selected=cleanClassPalette(value);}catch{}
 const palette=selected?.id==='cover'?{...selected,name:'Book cover'}:classPalettes.find(p=>p.id===selected?.id)||(id?automaticPalette(hash):classPalettes[0]);
 const seed=palette.colors[0],ink=mix(seed,'#071a30',.58);
 return {...palette,accent:mix(seed,'#142c45',.2),surface:mix(seed,'#ffffff',.91),border:mix(seed,'#ffffff',.66),ink,dark:mix(seed,'#0b1628',.8),darkInk:mix(seed,'#ffffff',.7)};
}
export function classPaletteStyle(value,id=''){
 const p=classPalette(value,id);return `--class-accent:${p.accent};--class-surface:${p.surface};--class-border:${p.border};--class-ink:${p.ink};--class-dark:${p.dark};--class-dark-ink:${p.darkInk}`;
}
// Dominant, distinct colours rather than the cover's average muddy colour.
export function paletteFromPixels(pixels){
 const bins=new Map();for(let i=0;i<pixels.length;i+=4){if(pixels[i+3]<180)continue;const color=[pixels[i],pixels[i+1],pixels[i+2]],max=Math.max(...color),min=Math.min(...color);if(max>238&&min>220||max<35)continue;const key=color.map(x=>Math.min(255,Math.round(x/32)*32)).join(',');bins.set(key,(bins.get(key)||0)+1);}
 const ranked=[...bins].map(([key,count])=>({color:key.split(',').map(Number),count})).sort((a,b)=>b.count-a.count),chosen=[];
 for(const {color}of ranked){if(chosen.every(other=>color.reduce((sum,x,i)=>sum+(x-other[i])**2,0)>3600))chosen.push(color);if(chosen.length===3)break;}
 if(!chosen.length)chosen.push([83,109,135]);while(chosen.length<3)chosen.push(chosen[0].map(x=>Math.min(255,x+45*chosen.length)));
 return {id:'cover',colors:chosen.map(hex)};
}
