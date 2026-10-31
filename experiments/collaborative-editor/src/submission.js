export class SubmissionPanel {
  constructor({ root, room, key, toast, pending, onChange }) {
    Object.assign(this, { root, room, key, toast, pending, onChange });
    this.role = 'viewer'; this.online = false; this.state = { status: 'draft', revision: 0, attempt: 0 }; this.busy = false;
    root.className = 'submission-panel';
    root.innerHTML = `<div class="submission-heading"><div><strong data-review="status">Draft</strong><p data-review="help">Save your work as you go. Submit hands in the whole document and worksheet.</p></div><button data-review="submit" class="primary" hidden>Submit work</button></div>
      <p data-review="deadline-label" class="small"></p><p data-review="late-note" class="late-note" hidden>Homework submitted late. Teacher feedback before class isn’t guaranteed.</p>
      <div data-review="deadline-settings" hidden><label for="submission-deadline">Homework deadline · Bangkok time (UTC+7)</label><div class="actions"><input id="submission-deadline" data-review="deadline" type="datetime-local"><button data-review="save-deadline">Save deadline</button></div><p class="small">Optional. Clear the field to remove the deadline. Late submissions are always accepted.</p></div>
      <div data-review="teacher" hidden><label for="teacher-feedback">Teacher feedback</label><textarea id="teacher-feedback" data-review="feedback" maxlength="10000" rows="3" placeholder="Write or paste your feedback here…"></textarea><div class="actions"><button data-review="save">Save feedback draft</button><button data-review="return" class="primary">Return feedback</button></div><p class="small">Saving keeps this comment private. Returning shares it and lets the student revise their work.</p></div>
      <div data-review="published" hidden><strong>Teacher feedback</strong><p data-review="comment" class="published-feedback"></p></div>`;
    this.$ = name => root.querySelector(`[data-review="${name}"]`);
    this.$('submit').onclick = () => this.perform('submit');
    this.$('save').onclick = () => this.perform('save-feedback');
    this.$('return').onclick = () => this.perform('return');
    this.$('feedback').oninput = () => { this.dirty = true; };
    this.$('deadline').oninput = () => { this.deadlineDirty = true; };
    this.$('save-deadline').onclick = () => this.perform('set-deadline');
    this.refresh();
  }
  connect(role) { this.role = role; this.online = true; this.refresh(); }
  disconnect() { this.online = false; this.refresh(); }
  receive(state) {
    if (!state || state.revision < this.state.revision) return;
    this.state = state;
    if (this.role === 'teacher' && !this.dirty) this.$('feedback').value = state.feedbackDraft || '';
    if (!this.deadlineDirty) this.$('deadline').value = state.dueAt ? new Date(Date.parse(state.dueAt) + 7 * 3600000).toISOString().slice(0, 16) : '';
    this.refresh(); this.onChange(state, this.busy);
  }
  refresh() {
    const submitted = this.state.status === 'submitted', returned = this.state.status === 'returned';
    this.$('status').textContent = submitted ? `Submitted${this.state.isLate ? ' late' : ''} · attempt ${this.state.attempt}` : returned ? `Feedback returned${this.state.isLate ? ' · submitted late' : ''} · ready to revise` : 'Draft · not submitted';
    this.$('help').textContent = !this.room ? 'This is a local draft. Create a shared notebook to hand work to a teacher.'
      : submitted ? this.role === 'teacher' ? 'The student’s answers are locked for review. Add feedback, then return the work.' : 'Your work has been handed in. You can edit again when the teacher returns it.'
        : returned ? 'The student can make changes and submit again. The previous submission is kept separately.' : 'Add and update text as you work. Submit hands in the whole document and worksheet.';
    this.$('submit').hidden = !this.room || this.role !== 'student';
    this.$('submit').textContent = submitted ? 'Submitted' : returned ? 'Resubmit work' : 'Submit work';
    this.$('submit').disabled = submitted || !this.online || this.busy;
    this.$('teacher').hidden = !this.room || this.role !== 'teacher' || !submitted;
    for (const name of ['save', 'return', 'feedback']) this.$(name).disabled = !this.online || this.busy;
    this.$('published').hidden = !this.state.feedbackPublished;
    this.$('comment').textContent = this.state.feedbackPublished || '';
    this.$('deadline-label').textContent = this.state.dueAt ? 'Deadline: ' + new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(this.state.dueAt)) + ' · Bangkok (UTC+7). Late work is accepted.' : 'No homework deadline set.';
    this.$('late-note').hidden = !this.state.isLate;
    this.$('deadline-settings').hidden = !this.room || this.role !== 'teacher';
    for (const name of ['deadline', 'save-deadline']) this.$(name).disabled = !this.online || this.busy;
  }
  async perform(action) {
    if (!this.room || !this.online || this.busy) return;
    if (action !== 'set-deadline' && this.pending()) return this.toast('Wait for your changes to finish saving before submitting or returning work.');
    this.busy = true; this.refresh(); this.onChange(this.state, true);
    try {
      const response = await fetch(`/api/documents/${this.room}/submission`, { method: 'POST', headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: crypto.randomUUID(), action, revision: this.state.revision, ...(action === 'set-deadline' ? { dueAt: this.$('deadline').value ? new Date(this.$('deadline').value + ':00+07:00').toISOString() : null } : action === 'submit' ? {} : { feedback: this.$('feedback').value }) }) });
      const result = await response.json();
      if (!response.ok) { if (result.submission) this.receive(result.submission); throw Error(result.error || 'Could not update review status.'); }
      if (action === 'set-deadline') this.deadlineDirty = false; else this.dirty = false;
      this.receive(result);
      this.toast(action === 'set-deadline' ? 'Deadline saved. Late submissions are still accepted.' : action === 'submit' ? result.isLate ? 'Homework submitted late. Feedback before class isn’t guaranteed.' : 'Work submitted to the teacher.' : action === 'return' ? 'Feedback returned. The student can revise and submit again.' : 'Feedback draft saved. It is private until you return the work.');
    } catch (error) { this.toast(error.message); }
    finally { this.busy = false; this.refresh(); this.onChange(this.state, false); }
  }
}
