import {TextFrame,placeTextFrame} from './text-frame.mjs';
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

function mount({ element, toolbar, document, text, label, onChange, onRecovery, shared, onStatus, onPeople, ydoc, readOnly = false }) {
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
  const buttons = [],formatControls=[];
  function updateToolbar(editor) {
    const attrs=editor.getAttributes('textStyle');for(const c of formatControls){c.input.disabled=!editor.isEditable;if(window.document.activeElement!==c.input)c.input.value=c.key==='fontSize'?parseFloat(attrs.fontSize)||16:attrs[c.key]||c.fallback;}
    for (const { button, active, available } of buttons) {
      if (active) button.setAttribute('aria-pressed', String(active(editor)));
      button.disabled = !editor.isEditable || (available ? !available(editor) : false);
    }
  }
  const options = {
    element,
    extensions: [TextFrame,TextFormat,StarterKit.configure({ heading: { levels: [2, 3] }, link: false, ...((shared || ydoc) ? { undoRedo: false } : {}) }),
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
      handleDOMEvents:ydoc?{pointerdown:placeTextFrame}:{},
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
  const fonts=window.document.createElement('datalist');fonts.id='folio-font-families';for(const name of fontChoices){const option=window.document.createElement('option');option.value=name;fonts.append(option);}toolbar.append(fonts);
  for(const spec of [{key:'fontFamily',label:'Font family',type:'text',fallback:'Calibri',clean:fontName},{key:'fontSize',label:'Font size',type:'number',fallback:'16',clean:textSize},{key:'color',label:'Text color',type:'color',fallback:'#243556',clean:textColor},{key:'backgroundColor',label:'Text highlight color',type:'color',fallback:'#fff176',clean:textColor}]){
    const label=window.document.createElement('label');label.className='format-control';label.textContent=spec.label;const input=window.document.createElement('input');input.type=spec.type;input.setAttribute('aria-label',spec.label);input.value=spec.fallback;
    if(spec.key==='fontFamily'){input.setAttribute('list',fonts.id);input.placeholder='Font name';}if(spec.type==='number'){input.min='8';input.max='96';input.step='1';}
    input.addEventListener('change',()=>{try{const value=spec.clean(input.value);input.setCustomValidity('');activeEditor.chain().focus().setMark('textStyle',{[spec.key]:value}).run();}catch(error){input.setCustomValidity(error.message);input.reportValidity();}});label.append(input);toolbar.append(label);formatControls.push({...spec,input});
  }
  const clear=window.document.createElement('button');clear.type='button';clear.textContent='Clear highlight';clear.addEventListener('mousedown',e=>e.preventDefault());clear.onclick=()=>activeEditor.chain().focus().setMark('textStyle',{backgroundColor:null}).run();toolbar.append(clear);buttons.push({button:clear});

  for (const item of items) {
    const button = window.document.createElement('button');
    button.type = 'button';
    button.textContent = item.display;
    button.title = item.label;
    button.setAttribute('aria-label', item.label);
    button.dataset.format = item.mark || item.label.toLowerCase();
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', () => item.run(activeEditor.chain().focus()).run());
    buttons.push({ button, active: item.active || (item.mark ? e => e.isActive(item.mark) : null), available: item.available });
    toolbar.append(button);
  }
  updateToolbar(activeEditor);
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
}

window.InkWireEditor = { mount, destroy, hasPendingChanges,
  getText: () => activeEditor?.getText() || '', setEditable: value => activeEditor?.setEditable(value) };
