import { applyOperation, validateFile, MAX_PDF_BYTES } from '../src/worksheet-model.js';

export class WorksheetStore {
  constructor(ctx, submission) {
    this.ctx = ctx;
    this.submission = submission;
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS worksheet (id INTEGER PRIMARY KEY CHECK(id=1), file TEXT NOT NULL, records TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS worksheet_pdf (part INTEGER PRIMARY KEY, data BLOB NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS worksheet_access (role TEXT PRIMARY KEY, key_hash TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS worksheet_receipts (op_id TEXT PRIMARY KEY, role TEXT NOT NULL, response TEXT NOT NULL, sequence INTEGER NOT NULL)');
  }
  state() {
    const row = this.sql.exec('SELECT file,records FROM worksheet WHERE id=1').toArray()[0];
    return row ? { file: JSON.parse(row.file), records: JSON.parse(row.records) } : { file: null, records: {} };
  }
  broadcast(message, except) {
    const data = JSON.stringify(message);
    for (const peer of this.ctx.getWebSockets()) if (peer !== except) { try { peer.send(data); } catch {} }
  }
  async setupAccess(teacherKey, digest) {
    for (const role of ['student', 'viewer']) {
      const key = await digest(`${teacherKey}:${role}`);
      this.sql.exec('INSERT OR IGNORE INTO worksheet_access(role,key_hash) VALUES (?,?)', role, await digest(key));
    }
  }
  role(hash, teacherHash) {
    if (hash === teacherHash) return 'teacher';
    return this.sql.exec('SELECT role FROM worksheet_access WHERE key_hash=?', hash).toArray()[0]?.role;
  }
  async pdf(request, role) {
    const state = this.state();
    const reply = async (error, status) => {
      // Release a forwarded upload stream before an early error response.
      if (request.body && !request.bodyUsed) await request.body.cancel().catch(() => {});
      return Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
    };
    if (request.method === 'GET') {
      if (!state.file) return reply('No PDF has been added.', 404);
      if (new URL(request.url).searchParams.get('version') !== state.file.id) return reply('The PDF changed. Reopen the worksheet.', 409);
      const chunks = this.sql.exec('SELECT data FROM worksheet_pdf ORDER BY part').toArray();
      return new Response(new Blob(chunks.map(chunk => chunk.data), { type: 'application/pdf' }), {
        headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'attachment; filename="worksheet.pdf"' },
      });
    }
    if (request.method !== 'PUT') return reply('Method not allowed.', 405);
    if (role !== 'teacher') return reply('Only the teacher link can import or replace a PDF.', 403);
    if (this.submission.state().status === 'submitted') return reply('Return the student’s work before replacing the worksheet.', 409);
    if (request.headers.get('Content-Type') !== 'application/pdf') return reply('Choose a PDF file.', 415);
    let file;
    try { file = validateFile(JSON.parse(decodeURIComponent(request.headers.get('X-Worksheet-Metadata') || ''))); }
    catch { return reply('Invalid PDF information.', 400); }
    if (!request.body) return reply('Choose a PDF file.', 400);
    if (Number(request.headers.get('Content-Length')) > MAX_PDF_BYTES) return reply('Choose a PDF smaller than 15 MB.', 413);
    const reader = request.body.getReader(), parts = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_PDF_BYTES) { await reader.cancel(); return reply('Choose a PDF smaller than 15 MB.', 413); }
      parts.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') return reply('This is not a PDF file.', 415);
    // Recheck after reading the stream: another teacher tab may have imported meanwhile.
    if (request.headers.get('If-Match') !== (this.state().file?.id || 'none')) return reply('Another device changed the worksheet. Reopen it before replacing the PDF.', 409);
    this.ctx.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM worksheet_pdf');
      this.sql.exec('DELETE FROM worksheet_receipts');
      for (let i = 0; i < bytes.length; i += 64000) this.sql.exec('INSERT INTO worksheet_pdf(part,data) VALUES (?,?)', i / 64000, bytes.slice(i, i + 64000));
      this.sql.exec('INSERT OR REPLACE INTO worksheet(id,file,records) VALUES (1,?,?)', JSON.stringify(file), '{}');
    });
    this.broadcast({ type: 'worksheet-state', file, records: {} });
    return Response.json({ file, records: {} }, { headers: { 'Cache-Control': 'no-store' } });
  }
  operation(socket, input, role) {
    let result;
    try {
      const receipt = typeof input.opId === 'string' && this.sql.exec('SELECT role,response FROM worksheet_receipts WHERE op_id=?', input.opId).toArray()[0];
      if (receipt) {
        if (receipt.role !== role) throw Error('Invalid operation receipt.');
        socket.send(receipt.response);
        return;
      }
      const state = this.state();
      if (role === 'student' && !this.submission.canEdit(role)) throw Error('Your work is submitted. You can edit again when the teacher returns it.');
      const record = applyOperation(state, input, role);
      result = { type: 'worksheet-result', opId: input.opId, pdfId: state.file.id, record };
      const response = JSON.stringify(result);
      this.ctx.storage.transactionSync(() => {
        this.sql.exec('UPDATE worksheet SET records=? WHERE id=1', JSON.stringify({ ...state.records, [record.id]: record }));
        this.sql.exec('INSERT INTO worksheet_receipts(op_id,role,response,sequence) VALUES (?,?,?,?)', input.opId, role, response, Date.now());
        this.sql.exec('DELETE FROM worksheet_receipts WHERE op_id IN (SELECT op_id FROM worksheet_receipts ORDER BY sequence DESC LIMIT -1 OFFSET 2000)');
      });
      this.broadcast({ type: 'worksheet-change', pdfId: state.file.id, record }, socket);
    } catch (error) {
      result = { type: 'worksheet-result', opId: input.opId, error: error.message,
        pdfId: this.state().file?.id, record: this.state().records[input.id] || null };
    }
    socket.send(JSON.stringify(result));
  }
}
