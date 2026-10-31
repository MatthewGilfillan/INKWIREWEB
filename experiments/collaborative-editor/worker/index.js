import { DurableObject } from 'cloudflare:workers';
import * as Y from 'yjs';
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
    const match = url.pathname.match(/^\/api\/documents\/([0-9a-f-]{36})\/connect$/);
    if (match) return env.DOCUMENTS.get(env.DOCUMENTS.idFromName(match[1])).fetch(request);
    if (url.pathname.startsWith('/api/')) return json({ error: 'Not found' }, 404);
    return env.ASSETS.fetch(request);
  },
};
export class DocumentRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx = ctx;
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
    const key = protocols.find(x => /^[a-f0-9]{64}$/.test(x)) || '';
    if (await digest(key) !== row.key_hash) return new Response('Invalid document key', { status: 403 });
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('WebSocket required', { status: 426 });
    if (this.ctx.getWebSockets().length >= 30) return new Response('Room full', { status: 429 });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.send(row.state);
    server.send(JSON.stringify({ type: 'ready' }));
    this.presence();
    return new Response(null, { status: 101, webSocket: client, headers: { 'Sec-WebSocket-Protocol': 'folio' } });
  }
  webSocketMessage(socket, message) {
    if (typeof message === 'string' || message.byteLength > MAX_BYTES) { socket.close(1009, 'Document update is too large'); return; }
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
