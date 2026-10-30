// Convert legacy plain text to Tiptap JSON without interpreting HTML.
export function textDocument(text) {
  return {
    type: 'doc',
    content: String(text ?? '').split(/\r\n|\r|\n/).map(line => ({
      type: 'paragraph',
      ...(line ? { content: [{ type: 'text', text: line }] } : {}),
    })),
  };
}

export function notebookContent(document, text) {
  return document && typeof document === 'object' && document.type === 'doc'
    && Array.isArray(document.content) ? document : textDocument(text);
}
