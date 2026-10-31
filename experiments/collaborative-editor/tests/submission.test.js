import test from 'node:test';
import assert from 'node:assert/strict';
import * as Y from 'yjs';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';
const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, '0')).join('');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn) { for (let i = 0; i < 200; i++) { if (fn()) return; await sleep(25); } throw Error('Timed out waiting for submission test'); }
async function client(id, key) {
  const messages = [], doc = new Y.Doc(), ws = new WebSocket(base.replace(/^http/, 'ws') + `/api/documents/${id}/connect`, ['folio', key]); ws.binaryType = 'arraybuffer';
  ws.onmessage = event => { if (typeof event.data === 'string') messages.push(JSON.parse(event.data)); else Y.applyUpdate(doc, new Uint8Array(event.data)); };
  await until(() => messages.some(m => m.type === 'ready')); return { ws, messages, doc };
}

test('submission locks answers, protects teacher drafts, returns feedback and permits resubmission', async () => {
  const creation = await fetch(base + '/api/documents', { method: 'POST', headers: { Authorization: `Bearer ${process.env.TEST_OWNER_KEY || 'local-development-test'}` } });
  const { id, key } = await creation.json(), teacher = await client(id, key), studentKey = await digest(`${key}:student`), viewerKey = await digest(`${key}:viewer`);
  const student = await client(id, studentKey), viewer = await client(id, viewerKey), sockets = [teacher, student, viewer];
  const request = (access, input) => fetch(base + `/api/documents/${id}/submission`, { method: input ? 'POST' : 'GET', headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' }, ...(input ? { body: JSON.stringify(input) } : {}) });
  const action = (name, revision, feedback = '') => ({ id: crypto.randomUUID(), action: name, revision, feedback });
  try {
    const submit = action('submit', 0);
    assert.equal((await request(key, submit)).status, 403);
    assert.equal((await request(viewerKey, submit)).status, 403);
    // Save a document answer and a PDF answer before handing in.
    student.doc.getText('answer').insert(0, 'Original answer'); student.ws.send(Y.encodeStateAsUpdate(student.doc));
    await until(() => teacher.doc.getText('answer').toString() === 'Original answer');
    const file = { id: crypto.randomUUID(), name: 'Worksheet.pdf', pages: [{ width: 600, height: 800 }] };
    const upload = await fetch(base + `/api/documents/${id}/pdf`, { method: 'PUT', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/pdf', 'X-Worksheet-Metadata': encodeURIComponent(JSON.stringify(file)), 'If-Match': 'none' }, body: '%PDF-test' });
    assert.equal(upload.status, 200);
    const submitted = await request(studentKey, submit); assert.equal(submitted.status, 200); const state = await submitted.json();
    assert.equal(state.status, 'submitted'); assert.equal(state.attempt, 1); assert.ok(state.submittedAt);
    assert.deepEqual(await (await request(studentKey, submit)).json(), state, 'submission retry is idempotent');
    await until(() => teacher.messages.some(m => m.type === 'submission-state' && m.submission.status === 'submitted'));
    student.doc.getText('answer').insert(0, 'Not handed in '); student.ws.send(Y.encodeStateAsUpdate(student.doc));
    await until(() => student.messages.some(m => m.type === 'submission-locked'));
    assert.equal(teacher.doc.getText('answer').toString(), 'Original answer');
    const annotation = { type: 'worksheet-op', opId: crypto.randomUUID(), id: crypto.randomUUID(), pdfId: file.id, baseRevision: null, action: 'put', value: { kind: 'pen', page: 0, color: '#315d4c', width: 4, points: [[100, 100, .5]] } };
    student.ws.send(JSON.stringify(annotation));
    await until(() => student.messages.some(m => m.type === 'worksheet-result' && m.opId === annotation.opId));
    assert.match(student.messages.find(m => m.opId === annotation.opId).error, /submitted/);
    const teacherAnnotation = { ...annotation, opId: crypto.randomUUID(), id: crypto.randomUUID() }; teacher.ws.send(JSON.stringify(teacherAnnotation));
    await until(() => teacher.messages.some(m => m.type === 'worksheet-result' && m.opId === teacherAnnotation.opId));
    assert.equal(teacher.messages.find(m => m.opId === teacherAnnotation.opId).record.layer, 'teacher');
    const feedback = 'Good argument.\nPlease add evidence from the text.';
    assert.equal((await request(studentKey, action('return', 1, feedback))).status, 403);
    const saved = await (await request(key, action('save-feedback', 1, feedback))).json(); assert.equal(saved.revision, 2); assert.equal(saved.feedbackDraft, feedback);
    const studentView = await (await request(studentKey)).json(), viewerView = await (await request(viewerKey)).json();
    assert.equal(studentView.feedbackDraft, undefined); assert.equal(viewerView.feedbackDraft, undefined); assert.equal(studentView.feedbackPublished, '');
    assert.ok(student.messages.filter(m => m.type === 'submission-state').every(m => m.submission.feedbackDraft === undefined));
    assert.equal((await request(key, action('return', 1, feedback))).status, 409, 'stale teacher actions are rejected');
    const returned = await (await request(key, action('return', 2, feedback))).json(); assert.equal(returned.status, 'returned'); assert.equal(returned.feedbackPublished, feedback);
    student.ws.send(Y.encodeStateAsUpdate(student.doc)); await until(() => teacher.doc.getText('answer').toString().includes('Not handed in'));
    const second = await (await request(studentKey, action('submit', 3))).json(); assert.equal(second.status, 'submitted'); assert.equal(second.attempt, 2);
    const fresh = await client(id, studentKey); sockets.push(fresh); const ready = fresh.messages.find(m => m.type === 'ready'); assert.equal(ready.submission.status, 'submitted'); assert.equal(ready.submission.feedbackDraft, undefined);
  } finally { for (const client of sockets) { client.ws.close(); client.doc.destroy(); } }
});
