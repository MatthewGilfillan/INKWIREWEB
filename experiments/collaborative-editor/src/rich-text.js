// A small, explicitly validated format shared by the canvas and server.
// No user-provided HTML or CSS is stored in worksheet annotations.
export const FONT_FAMILIES = ['Arial', 'Georgia', 'Verdana', 'Trebuchet MS', 'Times New Roman', 'Courier New'];
const color = value => /^#[0-9a-f]{6}$/i.test(value);
export function validateRichText(blocks, defaults) {
  if (!Array.isArray(blocks) || !blocks.length || blocks.length > 500) throw Error('Text has too many paragraphs.');
  let characters = 0, runs = 0;
  const result = blocks.map(block => {
    if (!block || !['left', 'center', 'right'].includes(block.align) || !Number.isInteger(block.indent) || block.indent < 0 || block.indent > 3
      || ![null, 'bullet', 'number'].includes(block.list) || !Array.isArray(block.runs) || block.runs.length > 500) throw Error('Invalid text formatting.');
    const listNumber = block.list === 'number' ? block.listNumber : 1;
    if (!Number.isInteger(listNumber) || listNumber < 1 || listNumber > 999) throw Error('Invalid list numbering.');
    const output = { align: block.align, indent: block.indent, list: block.list, listNumber, runs: block.runs.map(run => {
      if (!run || typeof run.text !== 'string') throw Error('Invalid text run.');
      characters += run.text.length; runs++;
      const family = run.fontFamily || defaults.fontFamily || 'Arial', size = run.fontSize ?? defaults.fontSize;
      if (!FONT_FAMILIES.includes(family) || !Number.isFinite(size) || size < 8 || size > 96 || !color(run.color || defaults.color)
        || (run.highlight != null && !color(run.highlight))) throw Error('Invalid font, size or text colour.');
      const result = { text: run.text, fontFamily: family, fontSize: size, color: (run.color || defaults.color).toLowerCase(), highlight: run.highlight?.toLowerCase() || null };
      for (const mark of ['bold', 'italic', 'underline', 'strike']) {
        if (run[mark] !== undefined && typeof run[mark] !== 'boolean') throw Error('Invalid text emphasis.');
        result[mark] = run[mark] || false;
      }
      return result;
    }) };
    output.runs = output.runs.reduce((merged, run) => {
      const previous = merged.at(-1);
      if (previous && ['fontFamily', 'fontSize', 'color', 'highlight', 'bold', 'italic', 'underline', 'strike'].every(key => previous[key] === run[key])) previous.text += run.text;
      else merged.push(run);
      return merged;
    }, []);
    return output;
  });
  if (characters + result.length - 1 > 20000 || runs > 500) throw Error('Keep text boxes within 20,000 characters and 500 formatting runs.');
  return result;
}

export const plainRichText = blocks => blocks.map(block => block.runs.map(run => run.text).join('')).join('\n');
export function richBlocks(value) {
  return value.rich || value.text.split('\n').map(text => ({ align: 'left', indent: 0, list: null, listNumber: 1,
    runs: [{ text, fontFamily: value.fontFamily || 'Arial', fontSize: value.fontSize, color: value.color, highlight: null }] }));
}

export function richFromJSON(json, defaults) {
  const blocks = [];
  const readRuns = (nodes, base) => (nodes || []).flatMap(node => {
    if (node.type === 'hardBreak') return [{ ...base, text: '\n' }];
    if (node.type !== 'text') return [];
    const run = { ...base, text: node.text };
    for (const mark of node.marks || []) {
      if (['bold', 'italic', 'underline', 'strike'].includes(mark.type)) run[mark.type] = true;
      if (mark.type === 'textStyle') {
        const attrs = mark.attrs || {};
        if (attrs.fontFamily) run.fontFamily = attrs.fontFamily.replace(/^["']|["']$/g, '');
        if (attrs.fontSize) run.fontSize = Number.parseFloat(attrs.fontSize);
        if (attrs.color) run.color = cssColor(attrs.color);
        if (attrs.backgroundColor) run.highlight = cssColor(attrs.backgroundColor);
      }
      if (mark.type === 'highlight') run.highlight = cssColor(mark.attrs?.color || '#fff59d');
    }
    return [run];
  });
  const visit = (node, context = { indent: 0, list: null, listNumber: 1 }) => {
    if (['paragraph', 'heading'].includes(node.type)) {
      const fontSize = node.type === 'heading' ? ({ 1: 36, 2: 28, 3: 24 })[node.attrs?.level] || 24 : defaults.fontSize;
      blocks.push({ align: node.attrs?.textAlign || 'left', ...context,
        runs: readRuns(node.content, { fontFamily: defaults.fontFamily || 'Arial', fontSize, color: defaults.color, ...(node.type === 'heading' ? { bold: true } : {}) }) });
    } else if (['bulletList', 'orderedList'].includes(node.type)) {
      const list = node.type === 'bulletList' ? 'bullet' : 'number';
      (node.content || []).forEach((item, i) => {
        (item.content || []).forEach((child, paragraph) => visit(child, { indent: Math.min(3, context.indent + (context.list ? 1 : 0)), list: paragraph === 0 || ['bulletList', 'orderedList'].includes(child.type) ? list : null, listNumber: (node.attrs?.start || 1) + i }));
      });
    } else for (const child of node.content || []) visit(child, context);
  };
  visit(json);
  return validateRichText(blocks.length ? blocks : [{ align: 'left', indent: 0, list: null, runs: [] }], defaults);
}

export function jsonFromRich(value) {
  const paragraph = block => ({ type: 'paragraph', attrs: { textAlign: block.align }, content: block.runs.flatMap(run => {
    const marks = ['bold', 'italic', 'underline', 'strike'].filter(mark => run[mark]).map(type => ({ type }));
    marks.push({ type: 'textStyle', attrs: { fontFamily: run.fontFamily, fontSize: `${run.fontSize}px`, color: run.color } });
    if (run.highlight) marks.push({ type: 'highlight', attrs: { color: run.highlight } });
    return run.text.split('\n').flatMap((text, index) => [...(index ? [{ type: 'hardBreak' }] : []), ...(text ? [{ type: 'text', text, marks }] : [])]);
  }) });
  const content = [], lists = [];
  for (const block of richBlocks(value)) {
    if (!block.list) { lists.length = 0; content.push(paragraph(block)); continue; }
    const depth = Math.min(block.indent, lists.length), type = block.list === 'bullet' ? 'bulletList' : 'orderedList';
    lists.length = Math.min(lists.length, depth + 1);
    if (!lists[depth] || lists[depth].node.type !== type) {
      const node = { type, attrs: block.list === 'number' ? { start: block.listNumber || 1 } : {}, content: [] };
      (depth ? lists[depth - 1].item.content : content).push(node);
      lists[depth] = { node };
    }
    const item = { type: 'listItem', content: [paragraph(block)] };
    lists[depth].node.content.push(item); lists[depth].item = item;
  }
  return { type: 'doc', content };
}

function cssColor(value) {
  if (color(value)) return value;
  const rgb = value.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i);
  return rgb ? '#' + rgb.slice(1).map(n => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0')).join('') : value;
}
