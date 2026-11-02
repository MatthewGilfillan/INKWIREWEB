import {cleanTextStyle} from './text-format.mjs';
// Shared, bounded JSON format. HTML and executable attributes are never persisted.
export function cleanAnnotationDocument(value){
 let chars=0,count=0;
 function node(n,depth=0){
  if(!n||depth>12||++count>1200||!['doc','paragraph','heading','bulletList','orderedList','listItem','blockquote','hardBreak','text'].includes(n.type))throw Error('Invalid annotation text.');
  const out={type:n.type};
  if(n.type==='text'){
   if(typeof n.text!=='string'||!n.text.length||(chars+=n.text.length)>4000)throw Error('Invalid annotation text.');out.text=n.text;
   if(n.marks){if(!Array.isArray(n.marks)||n.marks.length>6)throw Error('Invalid annotation formatting.');out.marks=n.marks.map(m=>{if(m.type==='textStyle')return {type:'textStyle',attrs:cleanTextStyle(m.attrs)};if(!['bold','italic','underline','strike','code'].includes(m.type))throw Error('Invalid annotation formatting.');return {type:m.type};});}
  }else if(n.content){if(!Array.isArray(n.content))throw Error('Invalid annotation text.');out.content=n.content.map(c=>node(c,depth+1));}
  if(n.type==='heading')out.attrs={level:[2,3].includes(n.attrs?.level)?n.attrs.level:2};
  if(n.type==='orderedList')out.attrs={start:Number.isInteger(n.attrs?.start)&&n.attrs.start>0&&n.attrs.start<10000?n.attrs.start:1};
  return out;
 }
 if(value?.type!=='doc'||!Array.isArray(value.content))throw Error('Invalid annotation text.');
 const result=node(value);if(JSON.stringify(result).length>48000)throw Error('Annotation formatting is too large.');return result;
}
export function annotationPlainText(doc){return doc.type==='text'?doc.text:doc.type==='hardBreak'?'\n':(doc.content||[]).map(annotationPlainText).join(['doc','bulletList','orderedList','blockquote'].includes(doc.type)?'\n':'');}
export function annotationDocument(mark){
 if(mark.document)return cleanAnnotationDocument(mark.document);
 const marks=[{type:'textStyle',attrs:{fontFamily:mark.fontFamily||'Calibri',fontSize:(mark.fontSize||16)*.75+'pt',color:mark.color||'#243556',backgroundColor:mark.backgroundColor||null}},...['bold','italic','underline'].filter(k=>mark[k]).map(type=>({type}))];
 return {type:'doc',content:String(mark.text||'').split('\n').map(text=>({type:'paragraph',...(text?{content:[{type:'text',text,marks}]}:{})}))};
}
