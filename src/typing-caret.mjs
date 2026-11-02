import {Editor} from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import {TextFormat} from './text-format.mjs';
// Local UI only: no document ID, persistence, history entry, or network request until input.
export function createTypingCaret({parent,x,y,width=340,onCommit,onDismiss,onSelection}){
 const host=document.createElement('div');host.className='ink-typing-caret';Object.assign(host.style,{left:x+'px',top:y+'px',width:width+'px'});parent.append(host);
 let disposed=false,scheduled=false,editor;
 const commit=()=>{if(disposed||editor.view.composing||!editor.getText().length)return;onCommit(editor.getJSON(),{anchor:editor.state.selection.anchor,head:editor.state.selection.head});};
 const schedule=()=>{if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;if(!disposed)commit();});};
 editor=new Editor({element:host,extensions:[TextFormat,StarterKit.configure({link:false})],content:{type:'doc',content:[{type:'paragraph'}]},editorProps:{attributes:{class:'ink-caret-editor',role:'textbox','aria-label':'Type on page',spellcheck:'true'},handleDOMEvents:{compositionend:()=>{schedule();return false;}},handleKeyDown:(view,event)=>{if(event.key==='Escape'){event.preventDefault();onDismiss();return true;}return false;}},onUpdate:schedule,onSelectionUpdate:()=>onSelection?.(editor)});
 const blur=()=>setTimeout(()=>{if(!disposed&&!host.contains(document.activeElement)&&!document.activeElement?.closest('.note-toolbar,.ws-toolbar'))onDismiss();},0);host.addEventListener('focusout',blur);editor.commands.focus();
 return {editor,destroy(){if(disposed)return;disposed=true;host.removeEventListener('focusout',blur);editor.destroy();host.remove();}};
}
