import test from 'node:test';
import assert from 'node:assert/strict';
import { applyOperation, validateFile, validateAnnotation, translate, lassoContains } from '../src/worksheet-model.js';

const file = { id: crypto.randomUUID(), name: 'Worksheet.pdf', pages: [{ width: 600, height: 800 }, { width: 800, height: 600 }] };
const ink = { kind: 'pen', page: 0, color: '#315d4c', width: 4, points: [[100, 100, .2], [200, 200, .8]] };
const operation = (id = crypto.randomUUID(), value = ink, baseRevision = null) => ({ id, opId: crypto.randomUUID(), pdfId: file.id, action: value ? 'put' : 'delete', baseRevision, value });

test('server assigns layers and rejects read-only writes and cross-layer changes', () => {
  const state = { file, records: {} }, op = operation();
  const answer = applyOperation(state, { ...op, layer: 'teacher', value: { ...ink, layer: 'teacher' } }, 'student');
  assert.equal(answer.layer, 'student'); assert.equal(answer.value.layer, undefined);
  state.records[op.id] = answer;
  assert.throws(() => applyOperation(state, operation(op.id, ink, 1), 'teacher'), /own annotation layer/);
  assert.throws(() => applyOperation(state, operation(), 'viewer'), /read-only/);
  assert.throws(() => applyOperation(state, operation(), undefined), /read-only/);
});

test('revisions and tombstones prevent stale offline updates from resurrecting work', () => {
  const state = { file, records: {} }, op = operation();
  state.records[op.id] = applyOperation(state, op, 'teacher');
  assert.throws(() => applyOperation(state, operation(op.id, ink, null), 'teacher'), /changed on another device/);
  state.records[op.id] = applyOperation(state, operation(op.id, null, 1), 'teacher');
  assert.equal(state.records[op.id].value, null);
  assert.throws(() => applyOperation(state, operation(op.id, ink, 1), 'teacher'), /changed on another device/);
  assert.equal(applyOperation(state, operation(op.id, ink, 2), 'teacher').revision, 3);
  assert.throws(() => applyOperation(state, { ...operation(), pdfId: crypto.randomUUID() }, 'teacher'), /worksheet has changed/);
});

test('invalid geometry, unsafe fields, oversized text and invalid pages are rejected', () => {
  assert.throws(() => validateAnnotation({ ...ink, points: [[Infinity, 1, .5]] }, file));
  assert.throws(() => validateAnnotation({ ...ink, points: [[100, 100, -1]] }, file));
  assert.throws(() => validateAnnotation({ ...ink, page: 2 }, file));
  assert.throws(() => validateAnnotation({ ...ink, color: 'url(javascript:bad)' }, file));
  assert.throws(() => validateAnnotation({ ...ink, points: Array.from({ length: 2049 }, () => [1, 1, 1]) }, file));
  assert.throws(() => validateFile({ ...file, pages: Array(101).fill(file.pages[0]) }));
  assert.throws(() => validateFile({ ...file, pages: [{ width: 10, height: 10000 }] }));
  const text = { ...ink, kind: 'text', points: [[100, 100, .5]], text: 'Well done! ⭐', fontSize: 20, boxWidth: 320 };
  assert.equal(validateAnnotation(text, file).text, text.text);
  assert.throws(() => validateAnnotation({ ...text, text: 'a'.repeat(20001) }, file));
  assert.throws(() => validateAnnotation({ ...text, points: [[995, 100, .5]] }, file));
});

test('page-relative movement clamps to page bounds and lasso selects enclosed strokes', () => {
  const moved = translate(ink, 2000, 2000, file.pages[0]);
  assert.equal(moved.points[1][0], 1000);
  assert.ok(moved.points[1][1] <= 800 / 600 * 1000);
  assert.ok(lassoContains(ink, [[50, 50], [250, 50], [250, 250], [50, 250]]));
  assert.equal(lassoContains(ink, [[300, 300], [400, 300], [400, 400], [300, 400]]), false);
});
