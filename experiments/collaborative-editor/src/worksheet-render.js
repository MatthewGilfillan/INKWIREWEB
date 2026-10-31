import { bounds } from './worksheet-model.js';
import { richBlocks } from './rich-text.js';

const font = run => `${run.italic ? 'italic ' : ''}${run.bold ? 'bold ' : ''}${run.fontSize}px "${run.fontFamily || 'Arial'}", sans-serif`;

export function layoutText(context, value) {
  const lines = []; let y = 0;
  for (const block of richBlocks(value)) {
    const indent = block.indent * 25 + (block.list ? 25 : 0), available = Math.max(10, value.boxWidth - indent);
    let spans = [], width = 0, first = true;
    const finish = () => {
      const size = spans.length ? Math.max(...spans.map(span => span.run.fontSize)) : value.fontSize;
      const shift = block.align === 'center' ? (available - width) / 2 : block.align === 'right' ? available - width : 0;
      lines.push({ spans, x: indent + shift, y, height: size * 1.35, size, prefix: first && block.list ? block.list === 'bullet' ? '•' : `${block.listNumber}.` : '', indent });
      y += size * 1.35; spans = []; width = 0; first = false;
    };
    const append = (text, run) => {
      context.font = font(run); const measured = context.measureText(text).width;
      if (width + measured > available && width) finish();
      if (measured > available && Array.from(text).length > 1) {
        for (const character of Array.from(text)) append(character, run);
      } else { spans.push({ text, run, x: width }); width += measured; }
    };
    for (const run of block.runs) {
      const pieces = run.text.split(/(\n|[^\S\n]+)/u);
      for (const piece of pieces) {
        if (piece === '\n') finish();
        else if (piece) append(piece, run);
      }
    }
    finish(); y += value.fontSize * .15;
  }
  return { lines, height: Math.max(value.fontSize * 1.35, y) };
}

export function annotationBounds(value, context) {
  return value.kind === 'text' ? { x: value.points[0][0], y: value.points[0][1], width: value.boxWidth, height: layoutText(context, value).height } : bounds(value);
}

export function textLines(context, text, width) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const character of Array.from(paragraph)) {
      if (line && context.measureText(line + character).width > width) { lines.push(line); line = ''; }
      line += character;
    }
    lines.push(line);
  }
  return lines;
}

export function drawAnnotation(context, value) {
  const { points, width, color, kind } = value;
  const [a, b = a] = points;
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineWidth = width;
  context.lineCap = 'round';
  context.lineJoin = 'round';
  if (kind === 'pen' || kind === 'marker') {
    if (kind === 'marker') { context.globalAlpha = .3; context.globalCompositeOperation = 'multiply'; }
    if (points.length === 1) {
      context.beginPath(); context.arc(a[0], a[1], width / 2, 0, Math.PI * 2); context.fill();
    } else if (kind === 'marker') {
      context.beginPath(); context.moveTo(...a.slice(0, 2));
      for (const p of points.slice(1)) context.lineTo(...p.slice(0, 2));
      context.stroke();
    } else {
      for (let i = 1; i < points.length; i++) {
        const p = points[i - 1], q = points[i];
        context.lineWidth = width * (.35 + .65 * ((p[2] + q[2]) / 2));
        context.beginPath(); context.moveTo(p[0], p[1]); context.lineTo(q[0], q[1]); context.stroke();
      }
    }
  } else if (kind === 'text') {
    context.textBaseline = 'top';
    const layout = layoutText(context, value);
    for (const line of layout.lines) {
      if (line.prefix) { context.font = `${value.fontSize}px "${value.fontFamily || 'Arial'}", sans-serif`; context.fillStyle = value.color; context.fillText(line.prefix, a[0] + line.indent - 23, a[1] + line.y + line.size - value.fontSize); }
      for (const span of line.spans) {
        const { run, text } = span, x = a[0] + line.x + span.x, y = a[1] + line.y + line.size - run.fontSize;
        context.font = font(run);
        const measured = context.measureText(text).width;
        if (run.highlight) { context.fillStyle = run.highlight; context.fillRect(x, y, measured, run.fontSize * 1.15); }
        context.fillStyle = run.color; context.fillText(text, x, y);
        for (const [enabled, offset] of [[run.underline, 1.05], [run.strike, .6]]) if (enabled) {
          context.strokeStyle = run.color; context.lineWidth = Math.max(1, run.fontSize / 16); context.beginPath(); context.moveTo(x, y + run.fontSize * offset); context.lineTo(x + measured, y + run.fontSize * offset); context.stroke();
        }
      }
    }
  } else if (kind === 'rectangle') {
    context.strokeRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
  } else if (kind === 'ellipse') {
    context.beginPath(); context.ellipse((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]) / 2, Math.abs(b[1] - a[1]) / 2, 0, 0, Math.PI * 2); context.stroke();
  } else if (kind === 'arrow') {
    const angle = Math.atan2(b[1] - a[1], b[0] - a[0]), size = Math.max(12, width * 3);
    context.beginPath(); context.moveTo(a[0], a[1]); context.lineTo(b[0], b[1]);
    context.moveTo(b[0] - size * Math.cos(angle - .5), b[1] - size * Math.sin(angle - .5));
    context.lineTo(b[0], b[1]); context.lineTo(b[0] - size * Math.cos(angle + .5), b[1] - size * Math.sin(angle + .5)); context.stroke();
  }
  context.restore();
}

export function drawSelection(context, value) {
  const box = annotationBounds(value, context);
  context.save(); context.strokeStyle = '#166b91'; context.lineWidth = 2; context.setLineDash([5, 4]);
  context.strokeRect(box.x - 4, box.y - 4, box.width + 8, box.height + 8); context.restore();
  if (value.kind === 'text') {
    context.save(); context.fillStyle = '#fff'; context.strokeStyle = '#166b91'; context.lineWidth = 2;
    context.fillRect(box.x + box.width - 5, box.y + box.height - 5, 10, 10); context.strokeRect(box.x + box.width - 5, box.y + box.height - 5, 10, 10); context.restore();
  }
}

export function hitAnnotation(point, value, context) {
  if (['pen', 'marker', 'arrow'].includes(value.kind)) {
    const points = value.points;
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[i + 1] || a;
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(point[0] - a[0] - dx * t, point[1] - a[1] - dy * t) <= value.width / 2 + 8) return true;
    }
    return false;
  }
  const box = context ? annotationBounds(value, context) : bounds(value);
  return point[0] >= box.x - 4 && point[0] <= box.x + box.width + 4 && point[1] >= box.y - 4 && point[1] <= box.y + box.height + 4;
}
