import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { notebookContent, textDocument } from './notebook-content.mjs';

let activeEditor;

function destroy() {
  if (activeEditor && !activeEditor.isDestroyed) activeEditor.destroy();
  activeEditor = undefined;
}

function mount({ element, toolbar, document, text, label, onChange, onRecovery }) {
  destroy();
  const buttons = [];
  function updateToolbar(editor) {
    for (const { button, active, available } of buttons) {
      if (active) button.setAttribute('aria-pressed', String(active(editor)));
      button.disabled = available ? !available(editor) : false;
    }
  }
  const options = {
    element,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: false })],
    content: notebookContent(document, text),
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
  } catch {
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
}

window.InkWireEditor = { mount, destroy };
