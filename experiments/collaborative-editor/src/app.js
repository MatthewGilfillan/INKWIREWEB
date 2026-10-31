import './style.css';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const room = params.get('doc');
const key = new URLSearchParams(location.hash.slice(1)).get('key');
if (params.get('embed') === '1') document.body.classList.add('embedded');
const doc = new Y.Doc();
const metadata = doc.getMap('metadata');
const persistence = new IndexeddbPersistence(`folio-${room || 'local'}`, doc);
let socket, connected = false, retry, stopped = false, pending = 0;
function status(text) { $('status').textContent = text; }
function toast(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').hidden = true, 5000); }
await persistence.whenSynced;
$('editor').replaceChildren();
const editor = new Editor({ element: $('editor'), extensions: [StarterKit.configure({ undoRedo: false, link: { openOnClick: false } }), Collaboration.configure({ document: doc })], editorProps: { attributes: { 'aria-label': 'Document content', spellcheck: 'true' } } });
editor.on('update', refresh);
editor.on('selectionUpdate', refreshToolbar);
if (!room && editor.isEmpty) {
  metadata.set('title', 'A little space for big ideas');
  editor.commands.setContent('<h1>A little space for big ideas.</h1><p>Every good document starts with a thought. This is a place to give yours room to grow.</p><h2>Make it your own</h2><p>Select some text to try <strong>bold</strong>, <em>italics</em>, or a heading. Add a list, link to a reference, or let your ideas run onto the next page.</p><blockquote>Start with what you want to say. The right words will follow.</blockquote><h2>Write together</h2><p>Choose <strong>New shared document</strong> to create a live document on your Cloudflare server, then share its editing link with your team.</p><ul><li>Changes merge as you type, even when people edit at once.</li><li>Your browser keeps an offline copy for reconnection.</li><li>Export your work as HTML or print it to PDF.</li></ul>');
}
$('title').value = metadata.get('title') || 'Untitled document';
metadata.observe(() => { if (document.activeElement !== $('title')) $('title').value = metadata.get('title') || 'Untitled document'; });
$('title').addEventListener('input', () => metadata.set('title', $('title').value));
doc.on('update', (update, origin) => {
  if (origin === 'remote') return;
  if (connected) { pending++; status('Saving…'); socket.send(update); }
  else status(room ? 'Offline — changes kept on this device' : 'Local draft — kept on this device');
});
persistence.on('synced', () => { if (!room) status('Local draft — kept on this device'); });
function connect() {
  if (!room) { status('Local draft — kept on this device'); return; }
  if (!key || !/^[a-f0-9]{64}$/.test(key)) { status('Editing key missing — use the full shared link'); editor.setEditable(false); $('title').disabled = true; return; }
  status('Connecting…');
  const url = new URL(`/api/documents/${encodeURIComponent(room)}/connect`, location.origin); url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(url, ['folio', key]); socket.binaryType = 'arraybuffer';
  socket.onmessage = event => {
    if (typeof event.data !== 'string') { Y.applyUpdate(doc, new Uint8Array(event.data), 'remote'); return; }
    const message = JSON.parse(event.data);
    if (message.type === 'ready') { connected = true; pending = 1; socket.send(Y.encodeStateAsUpdate(doc)); status('Saving…'); }
    if (message.type === 'saved') { pending = Math.max(0, pending - 1); status(pending ? 'Saving…' : 'All changes saved'); }
    if (message.type === 'presence') $('presence').textContent = `${message.count} ${message.count === 1 ? 'person' : 'people'} connected`;
    if (message.type === 'error') { status(message.message); toast(message.message); stopped = true; socket.close(); }
  };
  socket.onclose = event => { connected = false; $('presence').textContent = 'Disconnected'; if ([1007,1009].includes(event.code)) stopped = true; if (!stopped) { status('Disconnected — retrying; changes kept on this device'); retry = setTimeout(connect, 3000); } };
  socket.onerror = () => status('Cannot connect — check the server and editing link');
  $('mode').textContent = 'Shared document';
}
connect();
function refreshToolbar() {
  document.querySelectorAll('[data-cmd]').forEach(button => { const command = button.dataset.cmd; const active = editor.isActive(command); button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
  $('style').value = editor.isActive('heading') ? String(editor.getAttributes('heading').level) : 'paragraph';
}
function refresh() {
  const text = editor.getText().trim(); $('count').textContent = `${text ? text.split(/\s+/).length : 0} words · ${text.length} characters`;
  $('outline').replaceChildren();
  const headings = [...$('editor').querySelectorAll('h1,h2,h3')];
  headings.forEach(heading => { const button = document.createElement('button'); button.textContent = heading.textContent || 'Untitled heading'; button.style.paddingLeft = heading.tagName === 'H1' ? '0' : '10px'; button.onclick = () => heading.scrollIntoView({ behavior: 'smooth', block: 'center' }); $('outline').append(button); });
  if (!headings.length) $('outline').textContent = 'Your headings appear here.';
  refreshToolbar();
}
const commands = { bold: 'toggleBold', italic: 'toggleItalic', underline: 'toggleUnderline', strike: 'toggleStrike', bulletList: 'toggleBulletList', orderedList: 'toggleOrderedList', blockquote: 'toggleBlockquote', horizontalRule: 'setHorizontalRule', undo: 'undo', redo: 'redo' };
document.querySelectorAll('[data-cmd]').forEach(button => { button.addEventListener('mousedown', e => e.preventDefault()); button.onclick = async () => { const cmd = button.dataset.cmd; if (cmd === 'link') { const href = await requestText('Link URL (leave blank to remove)', editor.getAttributes('link').href || 'https://'); if (href === null) return; if (!href) editor.chain().focus().extendMarkRange('link').unsetLink().run(); else { try { const url = new URL(href); if (!['http:', 'https:', 'mailto:'].includes(url.protocol)) throw Error(); editor.chain().focus().extendMarkRange('link').setLink({ href: url.href }).run(); } catch { toast('Enter a valid https:// or mailto: link.'); } } } else editor.chain().focus()[commands[cmd]]().run(); }; });
$('style').onchange = () => $('style').value === 'paragraph' ? editor.chain().focus().setParagraph().run() : editor.chain().focus().setHeading({ level: Number($('style').value) }).run();
$('print').onclick = () => window.print();
function escape(text) { const e = document.createElement('div'); e.textContent = text; return e.innerHTML; }
$('export').onclick = () => { const title = metadata.get('title') || 'Untitled document'; const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escape(title)}</title><body>${editor.getHTML()}</body></html>`; const url = URL.createObjectURL(new Blob([html], { type: 'text/html' })); const a = document.createElement('a'); a.href = url; a.download = title.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 80) + '.html'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
$('import').onclick = () => $('file').click();
$('file').onchange = async () => { const file = $('file').files[0]; if (!file) return; if (file.size > 100000) { toast('Choose a text file smaller than 100 KB.'); return; } const text = await file.text(); editor.chain().focus().insertContent(text.split(/\r?\n/).map(line => `<p>${escape(line)}</p>`).join('')).run(); $('file').value = ''; };
$('create').onclick = async () => { const ownerKey = await requestText('Document creation key', '', true); if (!ownerKey) return; $('create').disabled = true; try { const response = await fetch('/api/documents', { method: 'POST', headers: { Authorization: `Bearer ${ownerKey}` } }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not create document'); location.href = `/?doc=${result.id}#key=${result.key}`; } catch (error) { toast(error.message); } finally { $('create').disabled = false; } };
function sharedURL(embed = false) { const url = new URL(location.href); if (embed) url.searchParams.set('embed', '1'); else url.searchParams.delete('embed'); return url.href; }
$('share').onclick = async () => { if (!room) return toast('Create a shared document first.'); try { await navigator.clipboard.writeText(sharedURL()); toast('Editing link copied. Anyone with it can edit.'); } catch { await requestText('Copy this editing link:', sharedURL()); } };
$('embed').onclick = () => { if (!room) return toast('Create a shared document first.'); $('snippet').value = `<iframe src="${sharedURL(true).replaceAll('&', '&amp;')}" title="Shared document" style="width:100%;height:850px;border:0" allow="clipboard-write"></iframe>`; $('embed-dialog').showModal(); };
$('copy').onclick = async () => { try { await navigator.clipboard.writeText($('snippet').value); toast('Embed code copied'); } catch { $('snippet').select(); toast('Select and copy the embed code.'); } };
window.addEventListener('beforeunload', event => { if (room && (!connected || pending > 0)) { event.preventDefault(); event.returnValue = ''; } });
refresh();

function requestText(label, value = '', secret = false) {
  return new Promise(resolve => {
    const dialog = $('input-dialog'); const input = $('input-value');
    $('input-label').textContent = label; input.type = secret ? 'password' : 'text'; input.value = value;
    const finish = result => { dialog.close(); input.value = ''; resolve(result); };
    $('input-form').onsubmit = event => { event.preventDefault(); finish(input.value); };
    $('input-cancel').onclick = () => finish(null);
    dialog.oncancel = event => { event.preventDefault(); finish(null); };
    dialog.showModal(); input.focus(); input.select();
  });
}
$('title').addEventListener('blur', () => $('title').value = metadata.get('title') || 'Untitled document');
