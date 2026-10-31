import './style.css';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import { Worksheet } from './worksheet.js';
import { formattingExtensions, mountTextFormatting } from './text-formatting.js';
import { SubmissionPanel } from './submission.js';
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const room = params.get('doc');
const key = new URLSearchParams(location.hash.slice(1)).get('key');
if (params.get('embed') === '1') document.body.classList.add('embedded');
const doc = new Y.Doc();
const metadata = doc.getMap('metadata');
const capabilityScope = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(key || 'local')))].map(x => x.toString(16).padStart(2, '0')).join('');
const persistence = new IndexeddbPersistence(room ? `folio-${room}-${capabilityScope}` : 'folio-local', doc);
let socket, connected = false, retry, stopped = false, pending = 0;
let accessRole = room ? 'viewer' : 'teacher';
let submissionState = { status: 'draft', revision: 0, attempt: 0 }, synchronizingReady = false;
$('title').disabled = !!room;
function status(text) { $('status').textContent = text; }
function toast(text) { $('toast').textContent = text; $('toast').hidden = false; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').hidden = true, 5000); }
await persistence.whenSynced;
$('editor').replaceChildren();
const editor = new Editor({ element: $('editor'), editable: !room, extensions: [StarterKit.configure({ undoRedo: false, link: { openOnClick: false } }), ...formattingExtensions(), Collaboration.configure({ document: doc })], editorProps: { attributes: { 'aria-label': 'Document content', spellcheck: 'true' } } });
const textControls = document.createElement('div'); textControls.id = 'document-text-controls'; document.querySelector('#document-panel .toolbar').append(textControls);
const documentFormatting = mountTextFormatting(textControls, editor);
const worksheet = new Worksheet({ root: $('worksheet'), room, key, toast, send: message => { if (socket?.readyState === WebSocket.OPEN && connected) socket.send(JSON.stringify(message)); else worksheet.disconnected(); } });
const reviewRoot = document.createElement('section'); reviewRoot.id = 'submission'; document.querySelector('.page-tabs').before(reviewRoot);
const review = new SubmissionPanel({ root: reviewRoot, room, key, toast, pending: () => pending > 0 || worksheet.hasPendingChanges(), onChange: (state, busy) => {
  const reopened = submissionState.status === 'submitted' && state.status === 'returned';
  submissionState = state; updateAccess(busy);
  if (reopened && accessRole === 'student' && connected && !synchronizingReady) { pending++; socket.send(Y.encodeStateAsUpdate(doc)); }
} });
function updateAccess(busy = review.busy) {
  const editable = !room || (accessRole !== 'viewer' && !(accessRole === 'student' && (submissionState.status === 'submitted' || busy)));
  editor.setEditable(editable); $('title').disabled = !editable; $('import').disabled = !editable;
  worksheet.setSubmission(submissionState, busy); refreshToolbar(); documentFormatting.refresh();
}
function selectTab(kind) {
  const isWorksheet = kind === 'worksheet';
  $('document-panel').hidden = isWorksheet; $('worksheet').hidden = !isWorksheet;
  $('document-tab').setAttribute('aria-selected', String(!isWorksheet)); $('worksheet-tab').setAttribute('aria-selected', String(isWorksheet));
  if (isWorksheet) requestAnimationFrame(() => worksheet.resize());
}
$('document-tab').onclick = () => selectTab('document'); $('worksheet-tab').onclick = () => selectTab('worksheet');
$('document-tab').disabled = false; $('worksheet-tab').disabled = false;
await worksheet.ready;
review.receive(worksheet.submission || submissionState);
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
  if (origin === 'remote' || (room && !editor.isEditable)) return;
  if (connected) { pending++; status('Saving…'); socket.send(update); }
  else status(room ? 'Offline — changes kept on this device' : 'Local draft — kept on this device');
});
persistence.on('synced', () => { if (!room) status('Local draft — kept on this device'); });
function connect() {
  if (!room) { status('Local draft — kept on this device'); return; }
  if (!navigator.onLine) { worksheet.disconnected(); status('Offline — changes kept on this device'); return; }
  if (!key || !/^[a-f0-9]{64}$/.test(key)) { status('Editing key missing — use the full shared link'); editor.setEditable(false); $('title').disabled = true; return; }
  status('Connecting…');
  const url = new URL(`/api/documents/${encodeURIComponent(room)}/connect`, location.origin); url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(url, ['folio', key]); socket.binaryType = 'arraybuffer';
  const currentSocket = socket;
  socket.onmessage = async event => {
    if (socket !== currentSocket) return;
    if (typeof event.data !== 'string') { Y.applyUpdate(doc, new Uint8Array(event.data), 'remote'); return; }
    const message = JSON.parse(event.data);
    if (message.type === 'ready') {
      connected = true; accessRole = message.role || 'teacher'; synchronizingReady = true;
      review.connect(accessRole); review.receive(message.submission || submissionState); synchronizingReady = false;
      if (editor.isEditable) { pending = 1; socket.send(Y.encodeStateAsUpdate(doc)); status('Saving…'); }
      else { pending = 0; status(accessRole === 'student' ? 'Submitted · waiting for teacher feedback' : 'Read-only · all changes saved'); }
      await worksheet.receive(message);
    }
    if (message.type === 'submission-state') review.receive(message.submission);
    if (message.type === 'submission-locked') { pending = 0; review.receive(message.submission); status('Submitted · local unsent edits remain on this device'); toast('The submitted work is locked. Export your document if you need to keep edits made before the lock arrived.'); }
    if (message.type.startsWith('worksheet-')) await worksheet.receive(message);
    if (message.type === 'saved') { pending = Math.max(0, pending - 1); status(pending ? 'Saving…' : 'All changes saved'); }
    if (message.type === 'presence') $('presence').textContent = `${message.count} ${message.count === 1 ? 'person' : 'people'} connected`;
    if (message.type === 'error') { status(message.message); toast(message.message); stopped = true; socket.close(); }
  };
  socket.onclose = event => { if (socket !== currentSocket) return; connected = false; worksheet.disconnected(); review.disconnect(); $('presence').textContent = 'Disconnected'; if ([1007,1008,1009].includes(event.code)) stopped = true; if (!stopped) { status('Disconnected — retrying; changes kept on this device'); retry = setTimeout(connect, 3000); } };
  socket.onerror = () => { if (socket === currentSocket) status('Cannot connect — check the server and editing link'); };
  $('mode').textContent = 'Shared document';
}
connect();
window.addEventListener('offline', () => { connected = false; worksheet.disconnected(); review.disconnect(); socket?.close(); });
window.addEventListener('online', () => { if (room && !connected && !stopped) { clearTimeout(retry); connect(); } });
function refreshToolbar() {
  document.querySelectorAll('[data-cmd]').forEach(button => { const command = button.dataset.cmd; const active = editor.isActive(command); button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); button.disabled = !editor.isEditable; });
  $('style').disabled = !editor.isEditable;
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
$('print').onclick = () => $('worksheet').hidden ? window.print() : worksheet.exportPDF();
function escape(text) { const e = document.createElement('div'); e.textContent = text; return e.innerHTML; }
$('export').onclick = () => { const title = metadata.get('title') || 'Untitled document'; const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escape(title)}</title><body>${editor.getHTML()}</body></html>`; const url = URL.createObjectURL(new Blob([html], { type: 'text/html' })); const a = document.createElement('a'); a.href = url; a.download = title.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 80) + '.html'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
$('import').onclick = () => $('file').click();
$('file').onchange = async () => { const file = $('file').files[0]; if (!file) return; if (file.size > 100000) { toast('Choose a text file smaller than 100 KB.'); return; } const text = await file.text(); editor.chain().focus().insertContent(text.split(/\r?\n/).map(line => `<p>${escape(line)}</p>`).join('')).run(); $('file').value = ''; };
$('create').onclick = async () => { const ownerKey = await requestText('Document creation key', '', true); if (!ownerKey) return; $('create').disabled = true; try { const response = await fetch('/api/documents', { method: 'POST', headers: { Authorization: `Bearer ${ownerKey}` } }); const result = await response.json(); if (!response.ok) throw new Error(result.error || 'Could not create document'); location.href = `/?doc=${result.id}#key=${result.key}`; } catch (error) { toast(error.message); } finally { $('create').disabled = false; } };
function sharedURL(embed = false) { const url = new URL(location.href); if (embed) url.searchParams.set('embed', '1'); else url.searchParams.delete('embed'); return url.href; }
$('share').onclick = () => {
  if (!room) return toast('Create a shared document first.');
  for (const role of ['teacher', 'student', 'viewer']) $('share-' + role).hidden = accessRole !== 'teacher' && role !== accessRole;
  $('share-dialog').showModal();
};
for (const role of ['teacher', 'student', 'viewer']) $('share-' + role).onclick = async () => {
  const sharedKey = accessRole === 'teacher' && role !== 'teacher' ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${key}:${role}`)))].map(x => x.toString(16).padStart(2, '0')).join('') : key;
  const url = new URL(sharedURL()); url.hash = new URLSearchParams({ key: sharedKey }).toString();
  try { await navigator.clipboard.writeText(url.href); toast(`${role === 'viewer' ? 'Read-only' : role} link copied.`); }
  catch { $('share-dialog').close(); await requestText('Copy this notebook link:', url.href); }
};
$('share-close').onclick = () => $('share-dialog').close();
$('embed').onclick = () => { if (!room) return toast('Create a shared document first.'); $('snippet').value = `<iframe src="${sharedURL(true).replaceAll('&', '&amp;')}" title="Shared document" style="width:100%;height:850px;border:0" allow="clipboard-write"></iframe>`; $('embed-dialog').showModal(); };
$('copy').onclick = async () => { try { await navigator.clipboard.writeText($('snippet').value); toast('Embed code copied'); } catch { $('snippet').select(); toast('Select and copy the embed code.'); } };
window.addEventListener('beforeunload', event => { if (worksheet.hasPendingChanges() || (room && accessRole !== 'viewer' && (!connected || pending > 0))) { event.preventDefault(); event.returnValue = ''; } });
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
