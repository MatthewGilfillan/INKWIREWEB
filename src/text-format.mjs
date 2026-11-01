import {Mark} from '@tiptap/core';
export const fontChoices=['Calibri','Aptos','Arial','Helvetica','Times New Roman','Georgia','Verdana','Tahoma','Trebuchet MS','Comic Sans MS','Courier New','system-ui'];
export function fontName(value){if(value==null||value==='')return null;const name=String(value).split(',')[0].replace(/["']/g,'').trim();if(!/^[\p{L}\p{N} -]{1,80}$/u.test(name))throw Error('Invalid font name.');return name;}
export function textSize(value){if(value==null||value==='')return null;const match=String(value).trim().match(/^(\d+(?:\.\d+)?)(pt|px)?$/i);if(!match)throw Error('Invalid text size.');const size=Number(match[1])*(match[2]?.toLowerCase()==='px'?0.75:1);if(size<8||size>96)throw Error('Choose a font size from 8 to 96 points.');return Math.round(size*100)/100+'pt';}
export function textColor(value){if(value==null||value===''||value==='transparent')return null;const s=String(value).trim().toLowerCase();if(/^#[a-f0-9]{6}$/.test(s))return s;if(/^#[a-f0-9]{3}$/.test(s))return '#'+s.slice(1).split('').map(c=>c+c).join('');const rgb=s.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/);if(rgb&&rgb.slice(1).every(n=>Number(n)<=255))return '#'+rgb.slice(1).map(n=>Number(n).toString(16).padStart(2,'0')).join('');throw Error('Invalid text color.');}
export function cleanTextStyle(attrs={}){if(!attrs||typeof attrs!=='object'||Array.isArray(attrs)||Object.keys(attrs).some(k=>!['fontFamily','fontSize','color','backgroundColor'].includes(k)))throw Error('Unsupported text formatting.');const out={};for(const [k,clean]of Object.entries({fontFamily:fontName,fontSize:textSize,color:textColor,backgroundColor:textColor})){const v=clean(attrs[k]);if(v!==null)out[k]=v;}return out;}
const parsers={fontFamily:fontName,fontSize:textSize,color:textColor,backgroundColor:textColor};
const css={fontFamily:'font-family',fontSize:'font-size',color:'color',backgroundColor:'background-color'};
export const TextFormat=Mark.create({
 name:'textStyle',
 addAttributes(){return Object.fromEntries(Object.entries(parsers).map(([key,clean])=>[key,{default:null,parseHTML:element=>{try{return clean(element.style[key]);}catch{return null;}},renderHTML:attrs=>{try{const v=clean(attrs[key]);return v?{style:css[key]+': '+v}:{};}catch{return {};}}}]));},
 parseHTML(){return [{tag:'span[style]'}];},
 renderHTML({HTMLAttributes}){return ['span',HTMLAttributes,0];},
});
