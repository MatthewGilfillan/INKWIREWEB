// Coordinates are page-relative: x is 0..1000; y uses the same scale.
import { validateRichText, plainRichText, FONT_FAMILIES } from './rich-text.js';
export const MAX_PDF_BYTES = 15 * 1024 * 1024;
export const MAX_PAGES = 100;
export const MAX_RECORDS = 4000;
export const MAX_ANNOTATION_BYTES = 2 * 1024 * 1024;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const finite = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
const kinds = new Set(['pen', 'marker', 'text', 'arrow', 'rectangle', 'ellipse']);

export function validateFile(file) {
  if (!file || !UUID.test(file.id) || typeof file.name !== 'string' || file.name.length > 180
    || !Array.isArray(file.pages) || !file.pages.length || file.pages.length > MAX_PAGES
    || file.pages.some(p => !finite(p.width, 10, 10000) || !finite(p.height, 10, 10000)
      || p.height / p.width > 10 || p.width / p.height > 10)) throw Error('Invalid PDF page information.');
  return { id: file.id, name: file.name, pages: file.pages.map(({ width, height }) => ({ width, height })) };
}

export function validateAnnotation(value, file) {
  if (!value || !kinds.has(value.kind) || !Number.isInteger(value.page) || !file?.pages[value.page]
    || !/^#[0-9a-f]{6}$/i.test(value.color) || !finite(value.width, 1, 40)
    || !Array.isArray(value.points) || !value.points.length || value.points.length > 2048) throw Error('Invalid annotation.');
  const height = file.pages[value.page].height / file.pages[value.page].width * 1000;
  const points = value.points.map(p => {
    if (!Array.isArray(p) || p.length !== 3 || !finite(p[0], 0, 1000) || !finite(p[1], 0, height)
      || !finite(p[2], 0, 1)) throw Error('Annotation is outside the PDF page.');
    return [...p];
  });
  const result = { kind: value.kind, page: value.page, color: value.color.toLowerCase(), width: value.width, points };
  if (value.kind === 'text') {
    if (points.length !== 1 || typeof value.text !== 'string' || !value.text.trim() || value.text.length > 2000
      || !finite(value.fontSize, 8, 96) || !finite(value.boxWidth, 30, 1000)) throw Error('Invalid text box.');
    Object.assign(result, { text: value.text, fontSize: value.fontSize, boxWidth: Math.min(value.boxWidth, 1000 - points[0][0]) });
    if (value.fontFamily !== undefined) {
      if (!FONT_FAMILIES.includes(value.fontFamily)) throw Error('Choose a supported font.');
      result.fontFamily = value.fontFamily;
    }
    if (value.rich !== undefined) {
      result.rich = validateRichText(value.rich, value);
      result.text = plainRichText(result.rich);
      if (!result.text.trim()) throw Error('Write something in the text box.');
    }
    if (result.boxWidth < 30) throw Error('Move the text box away from the page edge.');
  } else if (!['pen', 'marker'].includes(value.kind) && points.length !== 2) throw Error('A shape needs two points.');
  return result;
}

// This function is also used by the server. Layer/role always comes from a
// verified connection, never from a browser's requested annotation attributes.
export function applyOperation({ file, records }, operation, role) {
  if (!['teacher', 'student'].includes(role)) throw Error('This link is read-only.');
  if (!file || operation.pdfId !== file.id) throw Error('The worksheet has changed. Reopen it before editing.');
  if (!UUID.test(operation.opId) || !UUID.test(operation.id) || !['put', 'delete'].includes(operation.action)) throw Error('Invalid worksheet operation.');
  const previous = records[operation.id];
  if (previous && previous.layer !== role) throw Error('You can only change your own annotation layer.');
  if (operation.baseRevision !== (previous?.revision ?? null)) throw Error('This annotation changed on another device. Your other work is safe.');
  if (!previous && Object.keys(records).length >= MAX_RECORDS) throw Error('This worksheet has reached its annotation limit.');
  if (operation.action === 'delete' && !previous?.value) throw Error('This annotation has already been removed.');
  const record = { id: operation.id, layer: role, revision: (previous?.revision || 0) + 1,
    order: previous?.order ?? Math.max(0, ...Object.values(records).map(record => record.order || 0)) + 1,
    value: operation.action === 'delete' ? null : validateAnnotation(operation.value, file) };
  const next = { ...records, [record.id]: record };
  if (new TextEncoder().encode(JSON.stringify(next)).byteLength > MAX_ANNOTATION_BYTES) throw Error('This worksheet is full. Export a copy before continuing.');
  return record;
}

export function compareRecords(a, b) {
  return a.layer === b.layer ? (a.order || 0) - (b.order || 0) || a.id.localeCompare(b.id) : a.layer === 'teacher' ? 1 : -1;
}

export function bounds(value) {
  const xs = value.points.map(p => p[0]), ys = value.points.map(p => p[1]);
  const pad = value.kind === 'marker' ? value.width : value.width / 2;
  const fontSize = value.rich ? Math.max(value.fontSize, ...value.rich.flatMap(block => block.runs.map(run => run.fontSize))) : value.fontSize;
  return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad,
    width: Math.max(...xs) - Math.min(...xs) + 2 * pad + (value.kind === 'text' ? value.boxWidth : 0),
    height: Math.max(...ys) - Math.min(...ys) + 2 * pad + (value.kind === 'text' ? fontSize * 1.35 * (value.text.split('\n').length + Math.ceil(value.text.length * fontSize * .6 / value.boxWidth)) : 0) };
}

export function translate(value, dx, dy, page) {
  const xs = value.points.map(p => p[0]), ys = value.points.map(p => p[1]);
  const right = Math.max(...xs) + (value.kind === 'text' ? value.boxWidth : 0);
  dx = Math.max(-Math.min(...xs), Math.min(dx, 1000 - right));
  dy = Math.max(-Math.min(...ys), Math.min(dy, page.height / page.width * 1000 - Math.max(...ys)));
  return { ...value, points: value.points.map(([x, y, p]) => [x + dx, y + dy, p]) };
}

export function inside(point, polygon) {
  let result = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [x, y] = polygon[i], [px, py] = polygon[j];
    if (((y > point[1]) !== (py > point[1])) && point[0] < (px - x) * (point[1] - y) / (py - y) + x) result = !result;
  }
  return result;
}

export function lassoContains(value, polygon) {
  if (polygon.length < 3) return false;
  const b = bounds(value);
  // Include a shape when its centre or any sampled stroke point is enclosed.
  return inside([b.x + b.width / 2, b.y + b.height / 2], polygon) || value.points.some(p => inside(p, polygon));
}
