import { api, escape } from './workspace-shared.js';
import { validateCourse } from './course-model.mjs';

export function createCourseAssistant({ root, form, getClassId, getDraft, applyDraft }) {
  root.className = 'course-assistant';
  root.innerHTML = `<details><summary>Plan with AI <span class="class-badge">Teacher assistant</span></summary>
    <p>Draft a course sequence or develop activities for one lesson, then review the suggestion before using it.</p>
    <p data-ai-connection role="status">Checking AI planning…</p>
    <div class="planner-grid"><div><label for="ai-planning-mode">Help me with</label><select id="ai-planning-mode"><option value="course">A course plan (up to 30 lessons)</option><option value="activities">Activities for one lesson</option></select></div>
    <div data-ai-lesson-wrap hidden><label for="ai-planning-lesson">Lesson</label><select id="ai-planning-lesson"></select></div></div>
    <label for="ai-planning-brief">Teaching brief or unit-plan notes</label><textarea id="ai-planning-brief" maxlength="12000" rows="5" placeholder="For example: Grade 6 literature study of The Hobbit. Build close-reading confidence and include discussion, short writing tasks and support for developing readers."></textarea>
    <p class="planner-hint">Your course content and this brief are sent to OpenAI when you generate a suggestion. Keep student names and personal information out of the brief. Check facts, reading assignments and suitability before use.</p>
    <button type="button" class="teacher-button" data-ai-generate disabled>Generate suggestion</button>
    <p data-ai-progress role="status" aria-live="polite"></p><p class="ai-error" data-ai-error role="alert" hidden></p>
    <section data-ai-preview hidden aria-label="AI planning suggestion"><h3>Review AI suggestion</h3><p>Using this suggestion updates your open draft. Save the course overview when you are ready.</p><div data-ai-result></div>
    <div class="teacher-actions"><button type="button" class="teacher-button" data-ai-apply>Use suggestion in draft</button><button type="button" class="teacher-button secondary" data-ai-discard>Discard suggestion</button></div></section>
    </details>`;
  const $ = selector => root.querySelector(selector);
  let epoch = 0, busy = false, candidate = null, baseline = '', mode = '', selectedIndex, unlock = () => {};
  const error = text => { $('[data-ai-error]').textContent = text; $('[data-ai-error]').hidden = !text; };
  function reset() {
    epoch++; busy = false; unlock(); unlock = () => {}; candidate = null;
    $('[data-ai-preview]').hidden = true; $('[data-ai-result]').replaceChildren();
    $('#ai-planning-brief').value = ''; $('[data-ai-progress]').textContent = ''; error('');
    $('[data-ai-generate]').disabled = true;
  }
  function refreshLessons() {
    const draft = getDraft(), value = $('#ai-planning-lesson').value;
    $('#ai-planning-lesson').innerHTML = draft.lessons.map((lesson, i) => `<option value="${i}">Lesson ${i + 1}: ${escape(lesson.title)}</option>`).join('');
    if ([...$('#ai-planning-lesson').options].some(option => option.value === value)) $('#ai-planning-lesson').value = value;
  }
  $('#ai-planning-mode').onchange = () => {
    $('[data-ai-lesson-wrap]').hidden = $('#ai-planning-mode').value !== 'activities';
    refreshLessons();
  };
  root.querySelector('details').addEventListener('toggle', () => { if (root.querySelector('details').open) refreshLessons(); });
  $('[data-ai-generate]').onclick = async () => {
    if (busy || !form.reportValidity()) return;
    const brief = $('#ai-planning-brief').value.trim();
    if (brief.length < 10) return error('Add a little more detail to your teaching brief (at least 10 characters).');
    let draft;
    try { draft = validateCourse(getDraft()); } catch (e) { return error(e.message); }
    const token = ++epoch;
    baseline = JSON.stringify(draft); mode = $('#ai-planning-mode').value; selectedIndex = Number($('#ai-planning-lesson').value);
    candidate = null; $('[data-ai-preview]').hidden = true; error(''); busy = true;
    const controls = [...form.querySelectorAll('input, textarea, select, button')], disabled = controls.map(control => control.disabled);
    controls.forEach(control => { control.disabled = true; });
    unlock = () => controls.forEach((control, i) => { control.disabled = disabled[i]; });
    $('[data-ai-progress]').textContent = 'Drafting your suggestion… This can take up to 90 seconds.';
    try {
      const response = await api(`/api/classes/${getClassId()}/planning-assistant`, { course: draft, mode, lessonIndex: selectedIndex, brief }, { timeoutMs: 100000 });
      if (token !== epoch) return;
      candidate = validateCourse(response.course);
      const indexes = mode === 'course' ? candidate.lessons.map((_, i) => i) : [selectedIndex];
      const keys = mode === 'course' ? [['goal','Learning goals'],['reading','Reading'],['activities','Activities'],['homework','Homework'],['skills','Skills'],['evidence','Evidence of learning']] : [['activities','Activities'],['skills','Skills'],['evidence','Evidence of learning']];
      $('[data-ai-result]').innerHTML = `${response.reviewNotes ? `<div class="ai-review-notes"><strong>Teacher review notes</strong><p>${escape(response.reviewNotes)}</p></div>` : ''}${mode === 'course' ? `<p>${escape(candidate.description)}</p>` : ''}` + indexes.map(i => `<details class="ai-lesson" ${indexes.length === 1 || i === 0 ? 'open' : ''}><summary>Lesson ${i + 1} · ${escape(candidate.lessons[i].title)}</summary>${keys.filter(([key]) => candidate.lessons[i][key]).map(([key,label]) => `<h4>${label}</h4><p>${escape(candidate.lessons[i][key])}</p>`).join('')}</details>`).join('');
      $('[data-ai-preview]').hidden = false;
      $('[data-ai-progress]').textContent = 'Suggestion ready. Your course draft has not changed.';
      $('[data-ai-preview]').scrollIntoView({ block: 'start', behavior: 'smooth' });
    } catch (e) {
      if (token !== epoch) return;
      error(e.name === 'TimeoutError' ? 'The request took too long. Your course draft has not changed. Wait a minute before trying again.' : e.message);
      $('[data-ai-progress]').textContent = 'Your course draft has not changed.';
    } finally {
      if (token === epoch) { busy = false; unlock(); unlock = () => {}; }
    }
  };
  $('[data-ai-apply]').onclick = () => {
    if (!candidate) return;
    try {
      if (JSON.stringify(validateCourse(getDraft())) !== baseline) throw Error('Your course changed after this suggestion was generated. Generate a new suggestion to keep your latest edits.');
      applyDraft(candidate); candidate = null; $('[data-ai-preview]').hidden = true;
      $('[data-ai-progress]').textContent = 'Suggestion added to your draft. Review the lessons and save the course overview when ready.';
      error('');
    } catch (e) { error(e.message); }
  };
  $('[data-ai-discard]').onclick = () => { candidate = null; $('[data-ai-preview]').hidden = true; $('[data-ai-progress]').textContent = 'Suggestion discarded. Your course draft has not changed.'; };
  return { reset, isBusy: () => busy, async open() {
    reset(); const token = epoch;
    $('#ai-planning-mode').value = 'course'; $('[data-ai-lesson-wrap]').hidden = true;
    refreshLessons(); $('[data-ai-connection]').textContent = 'Checking AI planning…';
    try {
      const result = await api(`/api/classes/${getClassId()}/planning-assistant`);
      if (token !== epoch) return;
      $('[data-ai-generate]').disabled = !result.available;
      $('[data-ai-connection]').textContent = result.available ? 'AI planning is ready. Allow a minute between requests; up to 5 requests per teacher per UTC day, within a shared daily limit.' : 'AI planning is not connected yet. You can still build your course using the tools above.';
    } catch {
      if (token === epoch) $('[data-ai-connection]').textContent = 'AI planning is unavailable. You can still build and save your course manually.';
    }
  } };
}
