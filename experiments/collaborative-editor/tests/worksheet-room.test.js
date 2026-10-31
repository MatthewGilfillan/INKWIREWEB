import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, degrees } from 'pdf-lib';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';
const ownerKey = process.env.TEST_OWNER_KEY || 'local-development-test';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, '0')).join('');
async function until(fn) { for (let i = 0; i < 200; i++) { if (fn()) return; await sleep(25); } throw Error('Timed out waiting for worksheet sync'); }
async function client(id, key) {
  const ws = new WebSocket(base.replace(/^http/, 'ws') + `/api/documents/${id}/connect`, ['folio', key]);
  const messages = []; ws.binaryType = 'arraybuffer';
  ws.addEventListener('message', event => { if (typeof event.data === 'string') messages.push(JSON.parse(event.data)); });
  await until(() => messages.some(m => m.type === 'ready'));
  return { ws, messages, role: messages.find(m => m.type === 'ready').role,
    snapshot: () => messages.filter(m => m.type === 'worksheet-state').at(-1),
    async op(operation) {
      const start = messages.length;
      ws.send(JSON.stringify({ type: 'worksheet-op', ...operation }));
      await until(() => messages.slice(start).some(m => m.type === 'worksheet-result' && m.opId === operation.opId));
      return messages.slice(start).find(m => m.type === 'worksheet-result' && m.opId === operation.opId);
    } };
}

test('worksheet PDFs, role enforcement, concurrent edits, retries, offline recovery and replacement', async () => {
  const creation = await fetch(base + '/api/documents', { method: 'POST', headers: { Authorization: `Bearer ${ownerKey}` } });
  assert.equal(creation.status, 201); const { id, key } = await creation.json();
  const teacher = await client(id, key), studentKey = await digest(`${key}:student`), viewerKey = await digest(`${key}:viewer`);
  const student = await client(id, studentKey), viewer = await client(id, viewerKey), sockets = [teacher.ws, student.ws, viewer.ws];
  try {
    assert.equal(teacher.role, 'teacher'); assert.equal(student.role, 'student'); assert.equal(viewer.role, 'viewer');
    const pdf = await PDFDocument.create(); pdf.addPage([600, 800]).drawText('Worksheet test'); pdf.addPage([600, 800]).setRotation(degrees(90));
    const bytes = await pdf.save();
    const file = { id: crypto.randomUUID(), name: 'Worksheet ⭐.pdf', pages: [{ width: 600, height: 800 }, { width: 800, height: 600 }] };
    const upload = (access, metadata = file, match = 'none', body = bytes) => fetch(base + `/api/documents/${id}/pdf`, { method: 'PUT', headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/pdf', 'X-Worksheet-Metadata': encodeURIComponent(JSON.stringify(metadata)), 'If-Match': match }, body });
    assert.equal((await upload(studentKey)).status, 403);
    assert.equal((await upload(viewerKey)).status, 403);
    assert.equal((await upload(key, file, 'none', new TextEncoder().encode('not a PDF'))).status, 415);
    assert.equal((await upload(key)).status, 200);
    await until(() => student.snapshot().file?.id === file.id && viewer.snapshot().file?.id === file.id);
    const savedPDF = await fetch(base + `/api/documents/${id}/pdf?version=${file.id}`, { headers: { Authorization: `Bearer ${viewerKey}` } });
    assert.deepEqual(new Uint8Array(await savedPDF.arrayBuffer()), bytes);
    assert.equal((await fetch(base + `/api/documents/${id}/pdf?version=${file.id}`)).status, 403);
    assert.equal((await upload(key)).status, 409);
    const value = { kind: 'text', page: 0, color: '#315d4c', width: 2, points: [[100, 100, .5]], text: 'Student answer', fontSize: 20, boxWidth: 320 };
    const operation = (value, recordId = crypto.randomUUID(), baseRevision = null) => ({ opId: crypto.randomUUID(), id: recordId, pdfId: file.id, action: value ? 'put' : 'delete', baseRevision, value });
    const answerOp = operation(value), answer = await student.op(answerOp);
    assert.equal(answer.record.layer, 'student'); assert.equal(answer.record.revision, 1);
    await until(() => teacher.messages.some(m => m.type === 'worksheet-change' && m.record.id === answerOp.id));
    assert.match((await teacher.op(operation(value, answerOp.id, 1))).error, /own annotation layer/);
    assert.match((await viewer.op(operation(value))).error, /read-only/);
    const feedback = await teacher.op(operation({ ...value, text: 'Teacher feedback ⭐' }));
    assert.equal(feedback.record.layer, 'teacher');
    assert.match((await student.op(operation(value, feedback.record.id, 1))).error, /own annotation layer/);
    assert.deepEqual(await student.op(answerOp), answer, 'retry is idempotent');
    const edited = await student.op(operation({ ...value, text: 'New answer' }, answerOp.id, 1));
    assert.equal(edited.record.revision, 2);
    assert.match((await student.op(operation(value, answerOp.id, 1))).error, /another device/);
    student.ws.close(); await sleep(100);
    const offline = operation({ ...value, text: 'Offline answer' }, answerOp.id, 2);
    const reconnected = await client(id, studentKey); sockets.push(reconnected.ws);
    assert.equal(reconnected.snapshot().records[feedback.record.id].value.text, 'Teacher feedback ⭐');
    assert.equal((await reconnected.op(offline)).record.revision, 3);
    const fresh = await client(id, viewerKey); sockets.push(fresh.ws);
    assert.equal(fresh.snapshot().records[answerOp.id].value.text, 'Offline answer');
    // A read-only client cannot bypass the UI using the document's binary protocol.
    let closeCode; fresh.ws.addEventListener('close', event => { closeCode = event.code; }); fresh.ws.send(new Uint8Array([0, 0]));
    await until(() => closeCode); assert.equal(closeCode, 1008);
    const replacement = { ...file, id: crypto.randomUUID() };
    assert.equal((await upload(key, replacement, file.id)).status, 200);
    assert.match((await reconnected.op(operation(value))).error, /worksheet has changed/);
    assert.equal((await fetch(base + `/api/documents/${id}/pdf?version=${file.id}`, { headers: { Authorization: `Bearer ${key}` } })).status, 409);
    const replaced = await client(id, key); sockets.push(replaced.ws); assert.deepEqual(replaced.snapshot().records, {});
  } finally { for (const ws of sockets) ws.close(); }
});
