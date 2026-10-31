import { DurableObject } from 'cloudflare:workers';
import * as Y from 'yjs';
import { WorksheetStore } from './worksheet.js';
import { MAX_PDF_BYTES } from '../src/worksheet-model.js';
const MAX_BYTES = 1024 * 1024;
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/documents' && request.method === 'POST') {
      if (!env.OWNER_KEY) return json({ error: 'Document creation is not configured. Set the OWNER_KEY Worker secret.' }, 503);
      const supplied = request.headers.get('Authorization')?.replace(/^Bearer /, '') || '';
      if (await digest(supplied) !== await digest(env.OWNER_KEY)) return json({ error: 'Invalid creation key.' }, 401);
      const id = crypto.randomUUID();
      const key = [...crypto.getRandomValues(new Uint8Array(32))].map(x => x.toString(16).padStart(2, '0')).join('');
      const room = env.DOCUMENTS.get(env.DOCUMENTS.idFromName(id));
      const response = await room.fetch(new Request('https://internal/initialize', { method: 'POST', body: await digest(key) }));
      if (!response.ok) return json({ error: 'Could not create document.' }, 500);
      return json({ id, key }, 201);
    }
    const match = url.pathname.match(/^\/api\/documents\/([0-9a-f-]{36})\/(connect|pdf)$/);
    if (match) {
      const target = env.DOCUMENTS.get(env.DOCUMENTS.idFromName(match[1]));
      if (match[2] === 'pdf' && request.method === 'PUT' && request.body) {
        // Buffer a bounded upload before crossing the Durable Object boundary.
        // An early authorization rejection must not leave an in-flight proxy
        // reading the incoming request after the response has been returned.
        const reader = request.body.getReader(), chunks = []; let length = 0;
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          length += value.byteLength;
          if (length > MAX_PDF_BYTES) { await reader.cancel(); return json({ error: 'Choose a PDF smaller than 15 MB.' }, 413); }
          chunks.push(value);
        }
        const body = new Uint8Array(length); let offset = 0;
        for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
        return target.fetch(new Request(request, { body }));
      }
      return target.fetch(request);
    }
    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404);
    return env.ASSETS.fetch(request);
  },
};
export class DocumentRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
    this.worksheet = new WorksheetStore(ctx);
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS document (id INTEGER PRIMARY KEY CHECK(id=1), key_hash TEXT NOT NULL, state BLOB)');
  }
  row() { return this.ctx.storage.sql.exec('SELECT * FROM document WHERE id=1').toArray()[0]; }
  async fetch(request) {
    if (new URL(request.url).pathname === '/initialize' && request.method === 'POST') {
      if (this.row()) return new Response('Exists', { status: 409 });
      const keyHash = await request.text();
      if (!/^[a-f0-9]{64}$/.test(keyHash)) return new Response('Invalid', { status: 400 });
      const doc = new Y.Doc();
      doc.getMap('metadata').set('title', 'Untitled document');
      this.ctx.storage.sql.exec('INSERT INTO document (id,key_hash,state) VALUES (1,?,?)', keyHash, Y.encodeStateAsUpdate(doc));
      doc.destroy();
      return new Response('Created', { status: 201 });
    }
    const row = this.row();
    if (!row) return new Response('Not found', { status: 404 });
    const protocols = (request.headers.get('Sec-WebSocket-Protocol') || '').split(',').map(x => x.trim());
    const isPdf = new URL(request.url).pathname.endsWith('/pdf');
    const key = isPdf ? (request.headers.get('Authorization') || '').replace(/^Bearer /, '') : protocols.find(x => /^[a-f0-9]{64}$/.test(x)) || '';
    const keyHash = await digest(key);
    const role = this.worksheet.role(keyHash, row.key_hash);
    if (!role) {
      if (request.body && !request.bodyUsed) await request.body.cancel().catch(() => {});
      return new Response('Invalid document key', { status: 403 });
    }
    if (role === 'teacher') await this.worksheet.setupAccess(key, digest);
    if (isPdf) return this.worksheet.pdf(request, role);
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('WebSocket required', { status: 426 });
    if (this.ctx.getWebSockets().length >= 30) return new Response('Room full', { status: 429 });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ role });
    server.send(row.state);
    server.send(JSON.stringify({ type: 'worksheet-state', ...this.worksheet.state() }));
    server.send(JSON.stringify({ type: 'ready', role }));
    this.presence();
    return new Response(null, { status: 101, webSocket: client, headers: { 'Sec-WebSocket-Protocol': 'folio' } });
  }
  webSocketMessage(socket, message) {
    const role = socket.deserializeAttachment()?.role || 'viewer';
    if (typeof message === 'string') {
      if (new TextEncoder().encode(message).byteLength > 180000) { socket.close(1009, 'Annotation update is too large'); return; }
      try {
        const input = JSON.parse(message);
        if (input.type !== 'worksheet-op') throw Error();
        this.worksheet.operation(socket, input, role);
      } catch { socket.close(1007, 'Invalid worksheet operation'); }
      return;
    }
    if (role === 'viewer') { socket.close(1008, 'This link is read-only'); return; }
    if (message.byteLength > MAX_BYTES) { socket.close(1009, 'Document update is too large'); return; }
    const doc = new Y.Doc();
    try {
      const row = this.row();
      Y.applyUpdate(doc, new Uint8Array(row.state));
      Y.applyUpdate(doc, new Uint8Array(message));
      const state = Y.encodeStateAsUpdate(doc);
      if (state.byteLength > MAX_BYTES) { socket.send(JSON.stringify({ type: 'error', message: 'Document exceeds the 1 MB starter limit. Export a copy.' })); return; }
      this.ctx.storage.sql.exec('UPDATE document SET state=? WHERE id=1', state);
      for (const peer of this.ctx.getWebSockets()) if (peer !== socket) { try { peer.send(message); } catch {} }
      socket.send(JSON.stringify({ type: 'saved' }));
    } catch { socket.close(1007, 'Invalid document update'); }
    finally { doc.destroy(); }
  }
  presence(exclude) {
    const peers = this.ctx.getWebSockets().filter(x => x !== exclude);
    for (const peer of peers) { try { peer.send(JSON.stringify({ type: 'presence', count: peers.length })); } catch {} }
  }
  webSocketClose(socket, code, reason, wasClean) { try { socket.close(1000, 'Closed'); } catch {} this.presence(socket); }
  webSocketError(socket) { try { socket.close(1011, 'Connection error'); } catch {} this.presence(socket); }
}
