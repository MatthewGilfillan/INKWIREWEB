const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..', 'dist');
const classId = '18c0a2cb-5ce8-4dbd-87bc-d23140efb84c';
const boardId = 'b6440c82-68a4-49a8-80da-764267337b52';
const base = '/api/class-boards/classes/' + classId;
const route = base + '/' + boardId;
let revision = 1, writes = 0;
const post = (id, text) => ({ id, text, title: '', authorName: 'Demo Learner', appearance: {}, stage: 's1', createdAt: 1, version: 1, comments: [], editable: true, own: false });
const board = {
  id: boardId, title: 'Classroom display test', prompt: 'Fictional board', template: 'venn-diagram',
  layout: 'activity', audience: 'class', published: true, open: true, archived: false,
  background: 'plain', backgroundImageId: '', settingsVersion: 1, revision, createdAt: 1,
  className: 'Fictional class', canWrite: true, reactions: true, replies: true, sectionLabels: {},
  rankingItems: [], rankings: [], teams: [], snapshots: [], closedSnapshotId: '', standards: [],
  reviews: [{ feedback: 'SECRET PRIVATE ASSESSMENT' }], reflections: [{ answer: 'SECRET PRIVATE REFLECTION' }],
  roster: [{ id: 'private-student', name: 'Private roster' }], posts: [post('first', 'Shared classroom idea')]
};
const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const json = (value, status = 200, headers = {}) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers }); res.end(JSON.stringify(value)); };
  if (url.pathname === '/test-control') {
    if (url.searchParams.get('change') === 'add') board.posts.push(post('second', 'A newly synced classroom idea'));
    if (url.searchParams.get('change') === 'private') board.audience = 'teachers';
    revision++; json({ writes }); return;
  }
  if (url.pathname === route) {
    if (req.method !== 'GET') { writes++; json({ message: 'Unexpected write' }, 405); return; }
    const etag = '"' + revision + '"';
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag }); res.end(); return; }
    json({ userId: 'fixture-teacher', teacher: true, board: { ...board, revision } }, 200, { ETag: etag }); return;
  }
  if (url.pathname === base) { json({ userId: 'fixture-teacher', teacher: true }); return; }
  if (url.pathname === '/notebooks') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<html><head><title>Fictional teacher workspace</title></head><body><h1>Teacher workspace</h1><p>PRIVATE TEACHER NOTES</p><div class="notebook-live-board"><iframe title="Classroom display test" src="/board-embed.html?classId=${classId}&boardId=${boardId}&sourcePageId=private-page" width="700" height="500"></iframe></div></body></html>`); return;
  }
  if (url.pathname === '/teacher') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<h1>PRIVATE TEACHER ASSESSMENT</h1>'); return; }
  const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream' });
  fs.createReadStream(target).pipe(res);
});
server.listen(0, '127.0.0.1', () => fs.writeFileSync(process.argv[2], String(server.address().port)));
