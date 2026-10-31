export const submittedLate = (submittedAt, dueAt) => !!dueAt && Date.parse(submittedAt) > Date.parse(dueAt);
const initial = () => ({ status: 'draft', revision: 0, attempt: 0, submittedAt: null, returnedAt: null, dueAt: null, isLate: false, attempts: [], feedbackDraft: '', feedbackPublished: '' });
export class SubmissionStore {
  constructor(ctx) {
    this.ctx = ctx; this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS submission (id INTEGER PRIMARY KEY CHECK(id=1), state TEXT NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS submission_snapshots (attempt INTEGER NOT NULL, kind TEXT NOT NULL, part INTEGER NOT NULL, data BLOB NOT NULL, PRIMARY KEY(attempt,kind,part))');
  }
  state() { const row = this.sql.exec('SELECT state FROM submission WHERE id=1').toArray()[0]; return row ? { ...initial(), ...JSON.parse(row.state) } : initial(); }
  forRole(role) { const { feedbackDraft, lastAction, ...state } = this.state(); return role === 'teacher' ? { ...state, feedbackDraft } : state; }
  canEdit(role) { return role === 'teacher' || (role === 'student' && this.state().status !== 'submitted'); }
  broadcast() {
    for (const peer of this.ctx.getWebSockets()) {
      try { peer.send(JSON.stringify({ type: 'submission-state', submission: this.forRole(peer.deserializeAttachment()?.role || 'viewer') })); } catch {}
    }
  }
  saveParts(attempt, kind, bytes) {
    for (let offset = 0; offset < bytes.byteLength; offset += 64000) this.sql.exec('INSERT INTO submission_snapshots(attempt,kind,part,data) VALUES (?,?,?,?)', attempt, kind, offset / 64000, bytes.slice(offset, offset + 64000));
  }
  async request(request, role, documentState, worksheet) {
    const reply = (value, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
    if (request.method === 'GET') return reply(this.forRole(role));
    if (request.method !== 'POST') return reply({ error: 'Method not allowed.' }, 405);
    let input;
    try { input = JSON.parse(await request.text()); } catch { return reply({ error: 'Invalid submission request.' }, 400); }
    try {
      const state = this.state();
      if (!input || !/^[0-9a-f-]{36}$/.test(input.id) || !['submit', 'save-feedback', 'return', 'set-deadline'].includes(input.action)) throw Error('Invalid submission request.');
      if ((input.action === 'submit' && role !== 'student') || (input.action !== 'submit' && role !== 'teacher')) return reply({ error: 'This link cannot perform that action.' }, 403);
      if (state.lastAction?.id === input.id && state.lastAction.role === role) return reply(this.forRole(role));
      if (input.revision !== state.revision) return reply({ error: 'The review status changed on another device. Check the latest status and try again.', submission: this.forRole(role) }, 409);
      const next = { ...state, revision: state.revision + 1, lastAction: { id: input.id, role } };
      if (input.action === 'submit') {
        if (state.status === 'submitted') throw Error('This work has already been submitted.');
        if (state.attempt >= 20) throw Error('This notebook has reached its submission limit. Start a new notebook.');
        next.status = 'submitted'; next.attempt++; next.submittedAt = new Date().toISOString(); next.returnedAt = null;
        next.isLate = submittedLate(next.submittedAt, next.dueAt);
        next.attempts = [...state.attempts, { attempt: next.attempt, submittedAt: next.submittedAt, dueAt: next.dueAt, isLate: next.isLate }];
      } else if (input.action === 'set-deadline') {
        if (input.dueAt !== null && (typeof input.dueAt !== 'string' || input.dueAt.length > 40 || !/^\d{4}-\d\d-\d\dT/.test(input.dueAt) || !Number.isFinite(Date.parse(input.dueAt)))) throw Error('Choose a valid deadline, or clear it.');
        next.dueAt = input.dueAt === null ? null : new Date(input.dueAt).toISOString();
        next.isLate = state.submittedAt ? submittedLate(state.submittedAt, next.dueAt) : false;
        // Extending or removing a deadline also corrects the current late label.
        // Earlier attempts keep their original submission-time deadline record.
        next.attempts = state.attempts.map(item => item.attempt === state.attempt ? { ...item, dueAt: next.dueAt, isLate: next.isLate } : item);
      } else {
        if (state.status !== 'submitted') throw Error('The student needs to submit their work before you can return feedback.');
        if (typeof input.feedback !== 'string' || input.feedback.length > 10000) throw Error('Keep feedback within 10,000 characters.');
        next.feedbackDraft = input.feedback;
        if (input.action === 'return') { next.status = 'returned'; next.feedbackPublished = input.feedback; next.returnedAt = new Date().toISOString(); }
      }
      this.ctx.storage.transactionSync(() => {
        if (input.action === 'submit') {
          // Keep the handed-in document and annotation state independently of
          // later teacher edits and student revisions. PDF identity is included.
          this.saveParts(next.attempt, 'document', new Uint8Array(documentState()));
          this.saveParts(next.attempt, 'worksheet', new TextEncoder().encode(JSON.stringify(worksheet())));
        }
        this.sql.exec('INSERT OR REPLACE INTO submission(id,state) VALUES (1,?)', JSON.stringify(next));
      });
      this.broadcast();
      return reply(this.forRole(role));
    } catch (error) { return reply({ error: error.message }, 400); }
  }
}
