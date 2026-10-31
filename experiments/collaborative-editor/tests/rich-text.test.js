import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRichText, plainRichText, richFromJSON, jsonFromRich } from '../src/rich-text.js';
import { validateAnnotation } from '../src/worksheet-model.js';
const defaults = { fontSize: 20, fontFamily: 'Arial', color: '#315d4c' };
const runs = [{ text: 'Mixed ', fontFamily: 'Georgia', fontSize: 32, color: '#aa3344', highlight: '#fff59d', bold: true, italic: true, underline: true }, { text: 'text ⭐', fontFamily: 'Arial', fontSize: 14, color: '#315d4c' }];
const blocks = [{ align: 'center', indent: 0, list: null, runs }];

test('mixed word formatting survives editor and worksheet serialization', () => {
  const rich = validateRichText(blocks, defaults), text = plainRichText(rich), value = { ...defaults, text, rich };
  assert.deepEqual(richFromJSON(jsonFromRich(value), defaults), rich);
  const result = validateAnnotation({ ...value, kind: 'text', page: 0, width: 2, boxWidth: 320, points: [[100, 100, .5]] }, { pages: [{ width: 600, height: 800 }] });
  assert.deepEqual(result.rich, rich); assert.equal(result.text, 'Mixed text ⭐');
});

test('nested lists, alignment, line breaks, and numbering round-trip', () => {
  const rich = validateRichText([
    { align: 'left', indent: 0, list: 'number', listNumber: 3, runs: [{ text: 'First\ncontinued', ...defaults }] },
    { align: 'right', indent: 1, list: 'bullet', runs: [{ text: 'Nested', ...defaults }] },
    { align: 'left', indent: 0, list: 'number', listNumber: 4, runs: [{ text: 'Second', ...defaults }] },
  ], defaults);
  assert.deepEqual(richFromJSON(jsonFromRich({ ...defaults, text: '', rich }), defaults), rich);
});

test('rich text rejects executable styles, unsupported fonts and oversized inputs', () => {
  assert.throws(() => validateRichText([{ ...blocks[0], runs: [{ ...runs[0], fontFamily: 'url(https://example.com)' }] }], defaults), /Invalid font/);
  assert.throws(() => validateRichText([{ ...blocks[0], runs: [{ ...runs[0], color: 'red;position:fixed' }] }], defaults), /Invalid font/);
  assert.throws(() => validateRichText([{ ...blocks[0], runs: [{ ...runs[0], fontSize: Infinity }] }], defaults));
  assert.throws(() => validateRichText([{ ...blocks[0], runs: [{ ...runs[0], text: 'x'.repeat(20001) }] }], defaults), /20,000/);
  assert.throws(() => validateRichText([{ ...blocks[0], runs: [{ ...runs[0], bold: 'false' }] }], defaults));
  const safe = validateRichText([{ ...blocks[0], onclick: 'unsafe', runs: [{ ...runs[0], html: '<script>bad</script>' }] }], defaults);
  assert.equal(safe[0].onclick, undefined); assert.equal(safe[0].runs[0].html, undefined);
});
