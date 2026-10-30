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

function mount({ element, toolbar, document, text, label, onChange, onRecovery, shared, onStatus, onPeople }) {
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
  const buttons = [];
  function updateToolbar(editor) {
    for (const { button, active, available } of buttons) {
      if (active) button.setAttribute('aria-pressed', String(active(editor)));
      button.disabled = !editor.isEditable || (available ? !available(editor) : false);
    }
  }
  const options = {
    element,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: false, ...(shared ? { undoRedo: false } : {}) }),
      ...(shared ? [
        Collaboration.configure({ document: activeProvider.getYDoc(), field: sharedDocument.field }),
        CollaborationCaret.configure({ provider: activeProvider, user: {
          name: shared.role === 'teacher' ? 'Teacher · demo' : 'Alex · student demo',
          color: shared.role === 'teacher' ? '#8b76b3' : '#29958d',
        } }),
      ] : [])],
    // Never seed a shared document from existing browser-local work.
    ...(shared ? { editable: false } : { content: notebookContent(document, text) }),
    enableContentCheck: true,
    editorProps: {
      attributes: { class: 'inkwire-editor', role: 'textbox', 'aria-label': label,
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
    { label: 'Heading', display: 'H2', active: e => e.isActive('heading', { level: 2 }), run: c => c.toggleHeading({ level: 2 }) },
    { label: 'Bullet list', display: '• List', mark: 'bulletList', run: c => c.toggleBulletList() },
    { label: 'Numbered list', display: '1. List', mark: 'orderedList', run: c => c.toggleOrderedList() },
    { label: 'Quotation', display: '“ Quote', mark: 'blockquote', run: c => c.toggleBlockquote() },
    { label: 'Undo', display: '↶', available: e => e.can().undo(), run: c => c.undo() },
    { label: 'Redo', display: '↷', available: e => e.can().redo(), run: c => c.redo() },
  ];
  toolbar.replaceChildren();
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
  getText: () => activeEditor?.getText() || '' };
