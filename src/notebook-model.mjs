import {cleanTextStyle} from './text-format.mjs';
export const PRINT_SECTION = 'printouts';
export const emptyDocument = () => ({type:'doc',content:[{type:'paragraph'}]});
export function cleanDocument(value) {
  let count=0,chars=0;
  const types=new Set(['doc','paragraph','heading','text','bulletList','orderedList','listItem','blockquote','horizontalRule','hardBreak','codeBlock']);
  function node(n,depth=0) {
    if(!n||typeof n!=='object'||!types.has(n.type)||depth>20||++count>5000)throw Error('This page is too large or contains unsupported formatting.');
    const out={type:n.type};
    const allowedAttrs=n.type==='heading'?['level']:n.type==='orderedList'?['start','type']:n.type==='codeBlock'?['language']:[];
    if(n.attrs&&(typeof n.attrs!=='object'||Array.isArray(n.attrs)||Object.keys(n.attrs).some(k=>!allowedAttrs.includes(k))))throw Error('Unsupported page attributes.');
    if(n.type==='text') {
      if(typeof n.text!=='string'||!n.text)throw Error('Invalid text.');
      chars+=n.text.length;if(chars>100000)throw Error('This page is too large.');out.text=n.text;
      if(n.marks){if(!Array.isArray(n.marks))throw Error('Invalid formatting.');out.marks=n.marks.map(m=>{if(m?.type==='textStyle')return {type:'textStyle',attrs:cleanTextStyle(m.attrs||{})};if(!['bold','italic','underline','strike','code'].includes(m?.type)||m.attrs&&Object.keys(m.attrs).length)throw Error('Invalid formatting.');return {type:m.type};});}
    } else if(n.content!==undefined) {if(!Array.isArray(n.content))throw Error('Invalid page.');out.content=n.content.map(c=>node(c,depth+1));}
    if(n.type==='heading'){if(n.attrs?.level!==undefined&&![2,3].includes(n.attrs.level))throw Error('Invalid heading level.');out.attrs={level:n.attrs?.level??2};}
    if(n.type==='orderedList'){const start=n.attrs?.start??1,type=n.attrs?.type??null;if(!Number.isInteger(start)||start<1||start>=10000||type!==null&&!['1','a','A','i','I'].includes(type))throw Error('Invalid list formatting.');out.attrs={start,type};}
    if(n.type==='codeBlock'&&n.attrs?.language){if(typeof n.attrs.language!=='string'||n.attrs.language.length>40)throw Error('Invalid code language.');out.attrs={language:n.attrs.language};}
    return out;
  }
  if(value?.type!=='doc'||!Array.isArray(value.content))throw Error('Invalid page.');
  const result=node(value);if(JSON.stringify(result).length>128000)throw Error('This page is too large.');return result;
}
export function documentText(doc) {return doc.type==='text'?doc.text:(doc.content||[]).map(documentText).join(['doc','blockquote','bulletList','orderedList'].includes(doc.type)?'\n':'');}
export function notebookKey(classId,learnerId) {return `${classId}.${learnerId}`;}
export function catalogPages(worksheets,pages) {
  const linked=new Set(pages.filter(p=>p.kind==='worksheet').map(p=>p.id));
  return [...pages.map(p=>p.kind==='worksheet'?{...p,displayMode:worksheets.find(w=>w.id===p.id)?.displayMode||'printout'}:p),...worksheets.filter(w=>!linked.has(w.id)).map(w=>({id:w.id,title:w.title,sectionId:PRINT_SECTION,kind:'worksheet',displayMode:w.displayMode||'printout',version:0,updatedAt:w.createdAt||0}))];
}
