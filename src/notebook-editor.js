import {PdfPrintout,printoutNodes} from './printout-node.mjs';
import {InkStroke} from './ink-stroke.mjs';
import {addColorPalette,addSizePresets,addDeviceFonts} from './text-tools.mjs';
import {TextFrame,placeCanvasCaret,ensureCanvasCaret,wrapPositionedParagraph} from './text-frame.mjs';
import {TextFormat,fontChoices,fontName,textSize,textColor} from './text-format.mjs';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { createClient } from '@liveblocks/client';
import { getYjsProviderForRoom } from '@liveblocks/yjs';
import { notebookContent, textDocument } from './notebook-content.mjs';
import { publicApiKey, demoDocument, sharedStatus } from './liveblocks-config.mjs';

let activeEditor;
let cleanup = () => {};
let activeProvider;
let client;

function hasPendingChanges() {
  return activeProvider?.getStatus() === 'synchronizing';
}

function destroy() {
  if (activeEditor && !activeEditor.isDestroyed) activeEditor.destroy();
  activeEditor = undefined;
  cleanup();
  cleanup = () => {};
  activeProvider = undefined;
}

function mount({ element, toolbar, document, text, label, onChange, onRecovery, shared, onStatus, onPeople, ydoc, loadPdf, readOnly = false }) {
  destroy();
  let connection;
  const sharedDocument = shared && demoDocument(shared.key);
  if (shared && !sharedDocument) throw new Error('Only the fictional demo notebook can be shared.');
  if (sharedDocument) {
    client ||= createClient({ publicApiKey, preventUnsavedChanges: true });
    connection = client.enterRoom(sharedDocument.roomId, { initialPresence: { role: shared.role } });
    activeProvider = getYjsProviderForRoom(connection.room);
    cleanup = connection.leave;
  }
  const buttons = [],formatControls=[],toolWidgets=[];
  const currentEditor=()=>activeEditor;
  const showCaret=(attrs={x:24,y:24,width:340,height:30})=>{if(activeEditor?.isEditable)placeCanvasCaret(activeEditor.view,attrs);};
  const placeCaret=(view,event)=>{
    if(!view.editable||view.dom.dataset.tool&&view.dom.dataset.tool!=='text'||event.button!==0||event.target.closest('.folio-text-frame,button,input,select,textarea'))return false;
    const empty=view.state.doc.childCount===1&&view.state.doc.firstChild.type.name==='paragraph'&&!view.state.doc.firstChild.content.size;
    const paragraph=event.target.closest('.ink-paragraph');const blank=paragraph&&!paragraph.classList.contains('folio-text-frame')&&!paragraph.querySelector('.ink-paragraph-content')?.textContent;
    if(event.target!==view.dom&&!empty&&!blank)return false;
    event.preventDefault();const r=view.dom.getBoundingClientRect(),width=Math.min(340,Math.max(140,r.width-20));
    showCaret({x:Math.max(0,Math.min(r.width-width,event.clientX-r.left)),y:Math.max(0,event.clientY-r.top),width,height:30});return true;
  };

  function updateToolbar(editor) {
    const attrs=editor.getAttributes('textStyle');for(const c of formatControls){c.input.disabled=!editor.isEditable;if(window.document.activeElement!==c.input)c.input.value=c.key==='fontSize'?parseFloat(attrs.fontSize)||16:attrs[c.key]||c.fallback;c.widget?.sync?.();}
    for (const { button, active, available } of buttons) {
      if (active) button.setAttribute('aria-pressed', String(active(editor)));
      button.disabled = !editor.isEditable || (available ? !available(editor) : false);
    }
  }
  const options = {
    element,
    extensions: [PdfPrintout.configure({loadPdf}),InkStroke,TextFrame.configure({canvas:!!ydoc,onEmpty:attrs=>{if(activeEditor?.view.hasFocus())showCaret(attrs);}}),TextFormat,StarterKit.configure({ heading: { levels: [2, 3] }, link: false, ...((shared || ydoc) ? { undoRedo: false } : {}) }),
      ...(ydoc ? [Collaboration.configure({document:ydoc,field:"document"})] : shared ? [
        Collaboration.configure({ document: activeProvider.getYDoc(), field: sharedDocument.field }),
        CollaborationCaret.configure({ provider: activeProvider, user: {
          name: shared.role === 'teacher' ? 'Teacher · demo' : 'Alex · student demo',
          color: shared.role === 'teacher' ? '#8b76b3' : '#29958d',
        } }),
      ] : [])],
    // Never seed a shared document from existing browser-local work.
    ...(shared ? { editable: false } : ydoc ? { editable: !readOnly } : { editable: !readOnly, content: notebookContent(document, text) }),
    enableContentCheck: true,
    editorProps: {
      handleDOMEvents:ydoc?{mousedown:placeCaret,keydown:(view,event)=>{if(event.key==='Escape'){event.preventDefault();view.dom.blur();return true;}return false;}}:{},
      attributes: { class: 'inkwire-editor'+(ydoc?' folio-canvas':''), role: 'textbox', 'aria-label': label,
        'aria-multiline': 'true', spellcheck: 'true' },
    },
    onContentError: ({ error }) => { throw error; },
    onUpdate: ({ editor }) => onChange({ document: editor.getJSON(), text: editor.getText() }),
    onTransaction: ({ editor }) => updateToolbar(editor),
  };
  try {
    activeEditor = new Editor(options);
  } catch (error) {
    if (shared) { destroy(); throw error; }
    element.replaceChildren();
    activeEditor = new Editor({ ...options, content: textDocument(text), onContentError: undefined });
    onRecovery?.();
  }
  const items = [
    { label: 'Bold', display: 'B', mark: 'bold', run: c => c.toggleBold() },
    { label: 'Italic', display: 'I', mark: 'italic', run: c => c.toggleItalic() },
    { label: 'Underline', display: 'U', mark: 'underline', run: c => c.toggleUnderline() },
    { label:'Strikethrough',display:'S̶',mark:'strike',run:c=>c.toggleStrike() },
    { label: 'Heading', display: 'H2', active: e => e.isActive('heading', { level: 2 }), run: c => c.toggleHeading({ level: 2 }) },
    { label: 'Bullet list', display: '• List', mark: 'bulletList', run: c => c.toggleBulletList() },
    { label: 'Numbered list', display: '1. List', mark: 'orderedList', run: c => c.toggleOrderedList() },
    { label: 'Quotation', display: '“ Quote', mark: 'blockquote', run: c => c.toggleBlockquote() },
    { label: 'Undo', display: '↶', available: e => e.can().undo(), run: c => c.undo() },
    { label: 'Redo', display: '↷', available: e => e.can().redo(), run: c => c.redo() },
  ];
  toolbar.replaceChildren();
  const panel=window.document.createElement('details');panel.className='note-format-panel';const summary=window.document.createElement('summary');summary.textContent='Aa';summary.setAttribute('aria-label','Text formatting');summary.title='Text formatting';const formatBody=window.document.createElement('div');formatBody.className='note-format-content';panel.append(summary,formatBody);toolbar.append(panel);
  const closePanel=event=>{if(!panel.contains(event.target))panel.open=false;};window.document.addEventListener('pointerdown',closePanel);const panelCleanup=cleanup;cleanup=()=>{window.document.removeEventListener('pointerdown',closePanel);panelCleanup();};
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){panel.open=false;summary.focus();event.stopPropagation();}});
  const fonts=window.document.createElement('datalist');fonts.id='folio-font-families';for(const name of fontChoices){const option=window.document.createElement('option');option.value=name;fonts.append(option);}formatBody.append(fonts);
  for(const spec of [{key:'fontFamily',label:'Font family',type:'text',fallback:'Calibri',clean:fontName},{key:'fontSize',label:'Font size',type:'number',fallback:'16',clean:textSize},{key:'color',label:'Text color',type:'color',fallback:'#243556',clean:textColor},{key:'backgroundColor',label:'Text highlight color',type:'color',fallback:'#fff176',clean:textColor}]){
    const label=window.document.createElement('label');label.className='format-control';label.textContent=spec.label;const input=window.document.createElement('input');input.type=spec.type;input.setAttribute('aria-label',spec.label);input.value=spec.fallback;
    if(spec.key==='fontFamily'){input.setAttribute('list',fonts.id);input.placeholder='Font name';}if(spec.type==='number'){input.min='8';input.max='96';input.step='0.5';}
    input.addEventListener('change',()=>{try{const value=spec.clean(input.value);input.setCustomValidity('');currentEditor().chain().focus().setMark('textStyle',{[spec.key]:value}).run();}catch(error){input.setCustomValidity(error.message);input.reportValidity();}});label.append(input);formatBody.append(label);let widget;if(spec.type==='color'){widget=addColorPalette(input,{label:spec.label,highlight:spec.key==='backgroundColor'});input.addEventListener('clear-text-color',()=>currentEditor().chain().focus().setMark('textStyle',{[spec.key]:spec.key==='color'?'#243556':null}).run());}else if(spec.key==='fontSize')widget=addSizePresets(input);else if(spec.key==='fontFamily')widget=addDeviceFonts(input,fonts,fontChoices);if(widget)toolWidgets.push(widget);formatControls.push({...spec,input,widget});
  }
  const clear=window.document.createElement('button');clear.type='button';clear.textContent='Clear highlight';clear.addEventListener('mousedown',e=>e.preventDefault());clear.onclick=()=>currentEditor().chain().focus().setMark('textStyle',{backgroundColor:null}).run();formatBody.append(clear);buttons.push({button:clear});

  for (const item of items) {
    const button = window.document.createElement('button');
    button.type = 'button';
    button.textContent = item.display;
    button.title = item.label;
    button.setAttribute('aria-label', item.label);
    button.dataset.format = item.mark || item.label.toLowerCase();
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', () => {if(['Heading','Bullet list','Numbered list','Quotation'].includes(item.label))wrapPositionedParagraph(activeEditor);item.run(currentEditor().chain().focus()).run();});
    buttons.push({ button, active: item.active || (item.mark ? e => e.isActive(item.mark) : null), available: item.available });
    (['Bold','Italic','Underline','Undo','Redo'].includes(item.label)?toolbar:formatBody).append(button);
  }
  if(ydoc&&!readOnly){
    const editor=activeEditor,root=editor.view.dom,ns='http://www.w3.org/2000/svg';let tool='text',color='#18395d';
    const modes=[];for(const [value,label] of [['text','Text'],['pen','Pen'],['highlight','Highlighter'],['eraser','Eraser']]){const b=window.document.createElement('button');b.type='button';b.textContent=label;b.setAttribute('aria-pressed',String(value===tool));b.onmousedown=e=>e.preventDefault();b.onclick=()=>{tool=value;root.dataset.tool=value;editor.storage.inkStroke.tool=value;modes.forEach(([v,button])=>button.setAttribute('aria-pressed',String(v===value)));if(value==='text')ensureCanvasCaret(editor.view);else root.blur();};modes.push([value,b]);toolbar.append(b);}
    const ink=window.document.createElement('input');ink.type='color';ink.value=color;ink.setAttribute('aria-label','Ink color');ink.onchange=()=>{color=ink.value;};toolbar.append(ink);
    const draw=event=>{if(!editor.isEditable||!['pen','highlight'].includes(tool)||event.button!==0||event.target.closest('button'))return;event.preventDefault();event.stopPropagation();
      const bounds=root.getBoundingClientRect(),point=e=>[Math.round(Math.max(0,Math.min(10000,e.clientX-bounds.left))*10)/10,Math.round(Math.max(0,Math.min(200000,e.clientY-bounds.top))*10)/10],points=[point(event)],svg=window.document.createElementNS(ns,'svg'),line=window.document.createElementNS(ns,'polyline'),size=tool==='highlight'?16:2,highlight=tool==='highlight',strokeColor=highlight&&color==='#18395d'?'#ffe45c':color;
      svg.classList.add('ink-stroke','ink-stroke-preview');svg.append(line);line.setAttribute('stroke',strokeColor);line.setAttribute('stroke-width',size);line.setAttribute('fill','none');line.setAttribute('stroke-linecap','round');line.setAttribute('stroke-linejoin','round');line.setAttribute('opacity',highlight?'.32':'1');element.append(svg);const r=element.getBoundingClientRect();Object.assign(svg.style,{left:bounds.left-r.left+element.scrollLeft+'px',top:bounds.top-r.top+element.scrollTop+'px'});root.setPointerCapture(event.pointerId);
      const motion=e=>{if(points.length<1500)points.push(point(e));line.setAttribute('points',points.map(p=>p.join(',')).join(' '));};
      const finish=e=>{root.removeEventListener('pointermove',motion,true);root.removeEventListener('pointerup',finish,true);root.removeEventListener('pointercancel',cancel,true);svg.remove();if(root.hasPointerCapture(e.pointerId))root.releasePointerCapture(e.pointerId);if(points.length===1)points.push([points[0][0]+.1,points[0][1]]);if(!editor.isDestroyed)editor.view.dispatch(editor.state.tr.insert(editor.state.doc.content.size,editor.schema.nodes.inkStroke.create({points,color:strokeColor,size,highlight})));ensureCanvasCaret(editor.view);};
      const cancel=e=>{points.length=0;root.removeEventListener('pointermove',motion,true);root.removeEventListener('pointerup',finish,true);root.removeEventListener('pointercancel',cancel,true);svg.remove();if(root.hasPointerCapture(e.pointerId))root.releasePointerCapture(e.pointerId);};root.addEventListener('pointermove',motion,true);root.addEventListener('pointerup',finish,true);root.addEventListener('pointercancel',cancel,true);
    };root.addEventListener('pointerdown',draw,true);const previous=cleanup;cleanup=()=>{root.removeEventListener('pointerdown',draw,true);previous();};
  }
  updateToolbar(activeEditor);
  if(ydoc&&!readOnly)ensureCanvasCaret(activeEditor.view);
  activeEditor.focusPage=()=>showCaret();
  if (shared) {
    const editor = activeEditor, provider = activeProvider, { room, leave } = connection;
    let failed = false;
    const refresh = () => {
      const status = room.getStatus(), sync = provider.getStatus();
      editor.setEditable(!failed && status === 'connected' && sync !== 'loading', false);
      updateToolbar(editor);
      onStatus?.(sharedStatus(status, sync, failed));
    };
    const people = () => onPeople?.(room.getStatus() === 'connected' ? 1 + room.getOthers().length : 0);
    const unsubs = [room.subscribe('status', () => { if (room.getStatus() === 'connected') failed = false; refresh(); people(); }),
      room.subscribe('others', people), room.subscribe('error', () => { failed = true; refresh(); })];
    provider.on('status', refresh);
    cleanup = () => { provider.off('status', refresh); unsubs.forEach(fn => fn()); leave(); };
    refresh(); people();
  }
  const previousCleanup=cleanup;cleanup=()=>{toolWidgets.forEach(w=>w.destroy());previousCleanup();};
}

function insertPrintout(assetId,pages,point){
 const editor=activeEditor;if(!editor?.isEditable)return false;
 let bottom=24;editor.state.doc.descendants(node=>{const a=node.type.name==='pdfPrintout'?node.attrs:node.attrs?.inkFrame;if(a)bottom=Math.max(bottom,a.y+(a.height||40)+24);});
 const nodes=printoutNodes(assetId,pages,point||{x:24,y:bottom});
 const pos=editor.state.doc.content.size;editor.view.dispatch(editor.state.tr.insert(pos,nodes.map(n=>editor.schema.nodeFromJSON(n))));ensureCanvasCaret(editor.view);return true;
}
window.InkWireEditor = { mount, insertPrintout, destroy, hasPendingChanges,
  focusPage:()=>activeEditor?.focusPage?.(), getText: () => activeEditor?.getText() || '', setEditable: value => activeEditor?.setEditable(value) };
