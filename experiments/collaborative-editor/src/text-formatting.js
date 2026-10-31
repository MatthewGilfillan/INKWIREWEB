import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { FONT_FAMILIES } from './rich-text.js';

export const formattingExtensions = () => [TextStyleKit, TextAlign.configure({ types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right'] }), Highlight.configure({ multicolor: true })];

export function mountTextFormatting(root, editor, { full = false, defaultSize = 17, defaultFont = 'Arial', defaultColor = '#233e36' } = {}) {
  root.classList.add('text-formatting'); root.setAttribute('role', 'toolbar'); root.setAttribute('aria-label', 'Text formatting');
  root.innerHTML = `<label>Font <select data-text="font">${FONT_FAMILIES.map(font => `<option>${font}</option>`).join('')}</select></label>
    <label>Size <input data-text="size" aria-label="Font size" type="number" min="8" max="96" step="1" value="${defaultSize}"></label>
    ${full ? '<button type="button" data-text="bold" aria-label="Bold"><b>B</b></button><button type="button" data-text="italic" aria-label="Italic"><i>I</i></button><button type="button" data-text="underline" aria-label="Underline"><u>U</u></button><button type="button" data-text="strike" aria-label="Strikethrough"><s>S</s></button>' : ''}
    <label>Text colour <input data-text="color" type="color" value="${defaultColor}"></label>
    <label>Highlight colour <input data-text="highlight-color" type="color" value="#fff59d"></label><button type="button" data-text="highlight">Highlight text</button>
    <label>Alignment <select data-text="align"><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select></label>
    ${full ? '<button type="button" data-text="bulletList">• List</button><button type="button" data-text="orderedList">1. List</button>' : ''}
    <button type="button" data-text="indent" title="Indent list item">Indent</button><button type="button" data-text="outdent" title="Outdent list item">Outdent</button>
    <button type="button" data-text="clear">Clear formatting</button>`;
  const $ = name => root.querySelector(`[data-text="${name}"]`);
  const apply = command => { if (editor.isEditable) command(editor.chain().focus()).run(); };
  $('font').onchange = () => apply(chain => chain.setFontFamily($('font').value));
  $('font').value = defaultFont;
  $('size').onchange = () => {
    const size = Number($('size').value);
    if (Number.isFinite(size) && size >= 8 && size <= 96) apply(chain => chain.setFontSize(`${size}px`));
    else { $('size').value = Number.parseFloat(editor.getAttributes('textStyle').fontSize) || defaultSize; }
  };
  $('color').oninput = () => apply(chain => chain.setColor($('color').value));
  $('highlight-color').oninput = () => { if (editor.isActive('highlight')) apply(chain => chain.setHighlight({ color: $('highlight-color').value })); };
  $('align').onchange = () => apply(chain => chain.setTextAlign($('align').value));
  const commands = { bold: c => c.toggleBold(), italic: c => c.toggleItalic(), underline: c => c.toggleUnderline(), strike: c => c.toggleStrike(),
    bulletList: c => c.toggleBulletList(), orderedList: c => c.toggleOrderedList(), highlight: c => c.toggleHighlight({ color: $('highlight-color').value }),
    indent: c => c.sinkListItem('listItem'), outdent: c => c.liftListItem('listItem'), clear: c => c.unsetAllMarks().clearNodes().setTextAlign('left') };
  for (const [name, command] of Object.entries(commands)) if ($(name)) {
    $(name).onmousedown = event => event.preventDefault(); $(name).onclick = () => apply(command);
  }
  const refresh = () => {
    const attributes = editor.getAttributes('textStyle');
    if (document.activeElement !== $('font')) $('font').value = attributes.fontFamily?.replace(/^["']|["']$/g, '') || defaultFont;
    if (document.activeElement !== $('size')) $('size').value = Number.parseFloat(attributes.fontSize) || defaultSize;
    if (document.activeElement !== $('color')) $('color').value = attributes.color || defaultColor;
    $('align').value = editor.getAttributes('paragraph').textAlign || editor.getAttributes('heading').textAlign || 'left';
    for (const element of root.querySelectorAll('button,input,select')) element.disabled = !editor.isEditable;
    for (const name of ['bold', 'italic', 'underline', 'strike', 'bulletList', 'orderedList', 'highlight']) if ($(name)) $(name).setAttribute('aria-pressed', String(editor.isActive(name)));
    $('indent').disabled = !editor.isEditable || !editor.can().sinkListItem('listItem');
    $('outdent').disabled = !editor.isEditable || !editor.can().liftListItem('listItem');
  };
  editor.on('selectionUpdate', refresh); editor.on('transaction', refresh); refresh();
  return { refresh, destroy: () => { editor.off('selectionUpdate', refresh); editor.off('transaction', refresh); root.replaceChildren(); } };
}
