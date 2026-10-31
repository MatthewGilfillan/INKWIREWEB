import { Extension } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';
import { FONT_FAMILIES } from './rich-text.js';

export function cleanPastedHTML(html) {
  const source = document.createElement('template'), output = document.createElement('div');
  source.innerHTML = html;
  const colourContext = document.createElement('canvas').getContext('2d');
  const normalColour = value => {
    if (!value || value === 'transparent' || /rgba\([^)]*,\s*0\s*\)/.test(value)) return '';
    colourContext.fillStyle = '#000000'; colourContext.fillStyle = value;
    const parsed = colourContext.fillStyle;
    const rgb = parsed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    return rgb ? '#' + rgb.slice(1).map(n => Number(n).toString(16).padStart(2, '0')).join('') : parsed;
  };
  const allowed = new Set(['P', 'DIV', 'SPAN', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE', 'MARK', 'H1', 'H2', 'H3', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'PRE', 'CODE']);
  const drop = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'SVG', 'MATH', 'IMG', 'VIDEO', 'AUDIO', 'LINK', 'META', 'HEAD']);
  const walk = (node, parent) => {
    if (node.nodeType === Node.TEXT_NODE) { parent.append(document.createTextNode(node.textContent.replaceAll('\u00a0', ' '))); return; }
    if (node.nodeType !== Node.ELEMENT_NODE || drop.has(node.tagName)) return;
    const tag = node.tagName === 'TR' ? 'P' : ['TD', 'TH'].includes(node.tagName) ? 'SPAN' : allowed.has(node.tagName) ? node.tagName : null;
    const target = tag ? document.createElement(tag.toLowerCase()) : parent;
    if (tag) {
      const style = node.style;
      const family = style.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
      if (family) target.style.fontFamily = FONT_FAMILIES.find(font => font.toLowerCase() === family.toLowerCase()) || 'Arial';
      if (style.fontSize) {
        const raw = Number.parseFloat(style.fontSize), px = style.fontSize.endsWith('pt') ? raw * 4 / 3 : raw;
        if (Number.isFinite(px)) target.style.fontSize = `${Math.max(8, Math.min(96, px))}px`;
      }
      for (const name of ['color', 'backgroundColor']) if (normalColour(style[name])) target.style[name] = normalColour(style[name]);
      for (const name of ['fontWeight', 'fontStyle', 'textDecoration']) if (style[name]) target.style[name] = style[name];
      if (['left', 'center', 'right'].includes(style.textAlign)) target.style.textAlign = style.textAlign;
      if (tag === 'MARK' && !style.backgroundColor) target.style.backgroundColor = '#fff59d';
      if (tag === 'OL' && /^\d{1,3}$/.test(node.getAttribute('start') || '')) target.setAttribute('start', node.getAttribute('start'));
      if (tag === 'A') {
        try { const url = new URL(node.getAttribute('href')); if (['http:', 'https:', 'mailto:'].includes(url.protocol)) target.setAttribute('href', url.href); } catch {}
      }
      parent.append(target);
    }
    for (const child of node.childNodes) walk(child, target);
    if (['TD', 'TH'].includes(node.tagName)) target.append(document.createTextNode('\t'));
  };
  for (const node of source.content.childNodes) walk(node, output);
  return output.innerHTML;
}

export function insertPlainText(editor, text) {
  if (!editor.isEditable) return false;
  const content = text.replace(/\r\n?/g, '\n').split('\n').map(line => ({ type: 'paragraph', ...(line ? { content: [{ type: 'text', text: line }] } : {}) }));
  return editor.chain().focus().insertContent(content).run();
}

export const ClipboardSupport = Extension.create({
  name: 'inkwireClipboard',
  addStorage: () => ({ plain: false }),
  addProseMirrorPlugins() {
    const editor = this.editor;
    return [new Plugin({ props: {
      transformPastedHTML: html => cleanPastedHTML(html),
      handlePaste: (view, event) => {
        if (!editor.isEditable) return true;
        if (editor.storage.inkwireClipboard.plain || event.shiftKey) {
          const text = event.clipboardData?.getData('text/plain');
          if (text !== undefined) { insertPlainText(editor, text); return true; }
        }
        return false;
      },
    } })];
  },
});

export async function pasteFromClipboard(editor) {
  try {
    if (!editor.isEditable) return;
    if (!editor.storage.inkwireClipboard.plain && navigator.clipboard?.read) {
      const items = await navigator.clipboard.read();
      const item = items.find(value => value.types.includes('text/html'));
      if (item) { editor.chain().focus().insertContent(cleanPastedHTML(await (await item.getType('text/html')).text())).run(); return; }
    }
    insertPlainText(editor, await navigator.clipboard.readText());
  } catch {
    // Keyboard paste works without programmatic clipboard permission. This
    // fallback also works inside the worksheet's existing text dialog.
    const dialog = document.createElement('dialog'); dialog.className = 'clipboard-dialog';
    dialog.innerHTML = '<form><h2>Paste text</h2><p>Paste here with ⌘V on Mac or Ctrl+V on Windows, then choose Insert text.</p><textarea aria-label="Text to paste" rows="7"></textarea><div class="actions"><button type="button">Cancel</button><button type="submit" class="primary">Insert text</button></div></form>';
    document.body.append(dialog);
    dialog.querySelector('button[type=button]').onclick = () => dialog.close();
    dialog.querySelector('form').onsubmit = event => { event.preventDefault(); insertPlainText(editor, dialog.querySelector('textarea').value); dialog.close(); };
    dialog.onclose = () => dialog.remove(); dialog.showModal(); dialog.querySelector('textarea').focus();
  }
}
