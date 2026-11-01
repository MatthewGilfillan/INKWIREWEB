import { formats, useFormat } from './course-formats.mjs';
import { api, escape } from './workspace-shared.js';
import { presets, defaults, generateLessons, validateCourse, courseSummary, lessonDate, readCourseFile } from './course-model.mjs';
import { createCourseAssistant } from './course-assistant.js';

export function createCoursePlanner({ list, getClasses, status, problem, onSaved }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'course-planner'; dialog.setAttribute('aria-labelledby', 'planner-title');
  dialog.innerHTML = `<button class="teacher-close" type="button" data-planner-close aria-label="Close course overview">×</button>
    <p class="teacher-eyebrow">COURSE PLANNING</p><h2 id="planner-title">Build course overview</h2><p id="planner-class"></p>
    <p id="planner-message" role="status"></p><form id="course-form" hidden>
    <div class="planner-intro"><p>Start with a reusable format, paste your own outline, or copy a previous class. Review the lessons before saving your teacher draft.</p><label for="course-format">Teaching format</label><select id="course-format" name="format">${formats.map(f => `<option value="${f.id}">${escape(f.name)}</option>`).join('')}</select><label for="course-pacing">Lesson frequency</label><select id="course-pacing" name="pacing"><option value="weekly">Recurring weekly timetable</option><option value="lessons">Set individual class dates later</option></select><div class="planner-grid three"><div><label for="course-weeks">Total lessons</label><input id="course-weeks" name="lessonCount" type="number" min="1" max="156" required></div><div data-weekly-frequency><label for="course-frequency">Lessons per week</label><input id="course-frequency" name="lessonsPerWeek" type="number" min="1" max="7" required></div><div><label for="course-minutes">Minutes per lesson</label><input id="course-minutes" name="lessonMinutes" type="number" min="15" max="240" required></div></div>
    <div class="planner-grid three"><div data-weekly-start><label for="course-start">First lesson <span>(optional)</span></label><input id="course-start" name="startDate" type="date" min="2000-01-01" max="2100-01-01"></div><div><label for="course-time">Lesson time</label><input id="course-time" name="startTime" type="time" required></div><div><label for="course-zone">Time zone</label><select id="course-zone" name="timeZone"><option value="Asia/Shanghai">Beijing / Shanghai (UTC+8)</option><option value="Asia/Bangkok">Bangkok (UTC+7)</option><option value="Europe/London">London</option><option value="America/New_York">New York</option><option value="UTC">UTC</option></select></div></div>
    <p class="planner-hint">For a weekly timetable, choose 1–7 lessons per week. Suggested lesson dates are spaced across the week and remain editable. Individual-date courses keep the lesson sequence without assuming how many weeks it takes.</p><label for="course-preset">Content starting point</label><select id="course-preset" name="preset">${presets.map(p => `<option value="${p.id}">${escape(p.name)}</option>`).join('')}</select><p id="preset-description"></p>
    <div class="planner-grid"><div><label for="course-organization">School / organisation</label><input id="course-organization" name="organization" maxlength="120"></div><div><label for="course-title">Course title</label><input id="course-title" name="title" maxlength="160" required></div></div>
    <label for="course-description">Course overview</label><textarea id="course-description" name="description" maxlength="4000" rows="3" placeholder="What will students read, practise and achieve?"></textarea>
    <div data-primary-writing hidden><label class="planner-checkbox"><input type="checkbox" name="includeWritingActivity" checked> Include Section 8 writing activity</label><p>The author pre-reading and seven main sections share the lesson allocation. Section labels stay separate from lesson numbers.</p></div>
    <details class="planner-source"><summary>Unit overview &amp; teaching details</summary><label for="course-grade">Grade / age band</label><input id="course-grade" name="gradeBand" maxlength="80">${[['themes','Themes'], ['essentialQuestions','Essential questions'], ['enduringUnderstandings','Enduring understandings'], ['sourceNotes','Source & review notes']].map(([key,label]) => `<label for="course-${key}">${label}</label><textarea id="course-${key}" name="${key}" maxlength="6000" rows="3"></textarea>`).join('')}</details>
    <details class="planner-source"><summary>Open a prepared course file</summary><label for="course-file">Ink Wire course file</label><input id="course-file" type="file" accept=".json,application/json"><p>Load a converted unit plan or a course file you saved earlier. Review it here before saving to this class. Opening a file does not upload it. PDF conversion is a separate step.</p></details>
    <details class="planner-source"><summary>Paste an existing outline</summary><label for="course-outline" id="outline-label">One line per week</label><textarea id="course-outline" rows="6" maxlength="30000" placeholder="Week 1: Introducing the novel&#10;Week 2: Character and motivation"></textarea><p>Paste from a document or spreadsheet. Spreadsheet columns: topic, goals, reading, homework. Choose “Generate weekly plan” to apply it.</p></details>
    <details class="planner-source"><summary>Copy from another class</summary><label for="copy-course">Source class</label><select id="copy-course"></select><button type="button" class="teacher-button secondary" id="copy-course-button">Use this overview</button><p>This copies the plan into this class. You can change its dates and content before saving.</p></details>
    <div class="teacher-actions"><button type="button" class="teacher-button" id="generate-course">Generate weekly plan</button><button type="button" class="teacher-button secondary" id="reschedule-course">Update lesson dates</button></div></div>
    <div id="course-ai-planning"></div>
    <div class="planner-review-heading"><div><h3>Lesson plan</h3><p id="course-summary"></p></div><span class="class-badge">Teacher draft</span></div>
    <p class="planner-hint">Suggested topics are editable starting points. Add the actual text, chapters and assignments for your students.</p><div id="course-lessons"></div>
    <p class="form-error" role="alert" hidden></p><div class="planner-save"><button type="button" class="teacher-button secondary" id="download-course-file">Save course file</button><button type="button" class="teacher-button secondary" id="download-course">Download outline</button><button type="submit" class="teacher-button">Save course overview</button></div><p class="planner-hint">Saved for this class and its teachers. Student publication is not connected yet.</p></form>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector), form = $('#course-form');
  let currentId = '', revision = 0, course, dirty = false, saving = false, trigger, generation = 0;
  const field = name => form.elements.namedItem(name);
  const message = value => { $('#planner-message').textContent = value; };
  const error = value => { $('.form-error').textContent = value; $('.form-error').hidden = !value; };
  const setDirty = () => { dirty = true; message('Unsaved changes'); };
  const assistant = createCourseAssistant({ root: $('#course-ai-planning'), form, getClassId: () => currentId,
    getDraft: () => currentDraft(), applyDraft: value => { fill(value); setDirty(); } });
  function settings() {
    const next = { ...course, ...Object.fromEntries(new FormData(form)), lessonCount: Number(field('lessonCount').value), lessonsPerWeek: field('pacing').value === 'lessons' ? 1 : Number(field('lessonsPerWeek').value), lessonMinutes: Number(field('lessonMinutes').value), includeWritingActivity: field('includeWritingActivity').checked };
    next.weeks = Math.ceil(next.lessonCount / next.lessonsPerWeek);
    if (next.pacing === 'lessons') next.startDate = '';
    return next;
  }
  function readLessons() {
    return [...dialog.querySelectorAll('[data-plan-lesson]')].map((row, i) => ({ week: course.lessons[i].week, slot: course.lessons[i].slot,
      ...Object.fromEntries([...row.querySelectorAll('[data-lesson-field]')].map(input => [input.dataset.lessonField, input.value])) }));
  }
  function renderLessons() {
    $('#course-summary').textContent = courseSummary(course);
    $('#course-lessons').innerHTML = course.lessons.map((lesson, i) => `<details class="plan-lesson" data-plan-lesson="${i}" ${i === 0 ? 'open' : ''}><summary><span><b>${course.pacing === 'lessons' ? `Lesson ${i + 1}` : `Week ${lesson.week}${course.lessonsPerWeek > 1 ? ` · lesson ${lesson.slot}` : ''}`}</b><span data-topic-label>${escape(lesson.title)}</span></span><span data-date-label>${escape(lesson.date || 'Date to be set')}</span></summary><div class="plan-lesson-body"><div class="planner-grid"><div><label for="lesson-${i}-title">Topic</label><input id="lesson-${i}-title" data-lesson-field="title" maxlength="160" required value="${escape(lesson.title)}"></div><div><label for="lesson-${i}-date">Lesson date</label><input id="lesson-${i}-date" data-lesson-field="date" type="date" min="2000-01-01" max="2100-12-31" value="${escape(lesson.date)}"></div></div>${[['section','Book section / unit'], ['goal', 'Learning goals / outcomes'], ['reading', 'Reading before class'], ['homework', 'Assignments / homework'], ['skills','Skills'], ['activities','Lesson activities'], ['evidence','Evidence of learning'], ['sourcePages','Source pages']].map(([key, label]) => `<label for="lesson-${i}-${key}">${label}</label><textarea id="lesson-${i}-${key}" data-lesson-field="${key}" maxlength="${key === 'activities' ? 4000 : ['skills','evidence'].includes(key) ? 2000 : key === 'section' ? 160 : key === 'sourcePages' ? 80 : 1200}" rows="2">${escape(lesson[key])}</textarea>`).join('')}</div></details>`).join('');
  }
  function fill(value) {
    course = structuredClone(value);
    for (const key of ['preset', 'organization', 'title', 'description', 'lessonsPerWeek', 'lessonMinutes', 'startDate', 'startTime', 'timeZone', 'gradeBand', 'themes', 'essentialQuestions', 'enduringUnderstandings', 'sourceNotes']) {
      if (key === 'timeZone' && ![...field(key).options].some(o => o.value === value[key])) field(key).add(new Option(value[key], value[key]));
      field(key).value = value[key] ?? '';
    }
    field('format').value = value.format || 'custom';
    field('pacing').value = value.pacing || 'weekly';
    field('lessonCount').value = value.lessonCount ?? value.weeks * value.lessonsPerWeek;
    field('includeWritingActivity').checked = value.includeWritingActivity !== false;
    refreshScheduleControls();
    $('#course-outline').value = '';
    $('#preset-description').textContent = presets.find(p => p.id === course.preset)?.description || '';
    renderLessons();
  }
  function close() {
    if (saving) return;
    if (dirty && !confirm('Close without saving this course overview? Download or save your draft first to keep these changes.')) return;
    dialog.close();
  }
  $('[data-planner-close]').onclick = close;
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => { generation++; assistant.reset(); if (trigger?.isConnected) trigger.focus(); });
  form.addEventListener('input', event => {
    if (event.target.closest('.course-assistant')) return;
    if (event.target.id === 'copy-course' || event.target.id === 'course-file') return;
    setDirty();
    const row = event.target.closest('[data-plan-lesson]');
    if (row && event.target.dataset.lessonField === 'title') row.querySelector('[data-topic-label]').textContent = event.target.value;
    if (row && event.target.dataset.lessonField === 'date') row.querySelector('[data-date-label]').textContent = event.target.value || 'Date to be set';
  });
  function refreshScheduleControls() {
    const manual = field('pacing').value === 'lessons';
    $('[data-weekly-frequency]').hidden = manual; $('[data-weekly-start]').hidden = manual;
    field('lessonsPerWeek').disabled = manual;
    $('#reschedule-course').disabled = manual;
    $('[data-primary-writing]').hidden = field('preset').value !== 'upper-primary';
    $('#outline-label').textContent = manual ? 'One line per lesson' : 'One line per week';
  }
  field('pacing').addEventListener('change', refreshScheduleControls);
  field('preset').addEventListener('change', () => { $('#preset-description').textContent = presets.find(p => p.id === field('preset').value).description; refreshScheduleControls(); });
  field('format').addEventListener('change', () => {
    const next = useFormat(settings(), field('format').value);
    for (const key of ['pacing','lessonCount','lessonsPerWeek','lessonMinutes','preset','gradeBand']) if (next[key] !== undefined) field(key).value = next[key];
    field('includeWritingActivity').checked = next.includeWritingActivity !== false;
    refreshScheduleControls(); setDirty();
  });
  $('#generate-course').onclick = () => {
    if (!form.reportValidity()) return;
    try {
      const next = settings(); next.lessons = generateLessons(next, $('#course-outline').value); validateCourse(next);
      if (!next.description || presets.some(p => p.overview === next.description)) next.description = presets.find(p => p.id === next.preset).overview;
      if (course.lessons.length && !confirm('Replace the weekly plan below with a new plan? This replaces its topics, dates and assignments in this draft.')) return;
      course = next; field('description').value = course.description; renderLessons(); error(''); setDirty(); $('#course-lessons').scrollIntoView({ block: 'start' });
    } catch (e) { error(e.message); }
  };
  $('#reschedule-course').onclick = () => {
    if (!form.reportValidity()) return;
    try {
      const next = settings();
      next.lessons = readLessons().map((lesson, i) => ({ ...lesson, week: Math.floor(i / next.lessonsPerWeek) + 1, slot: i % next.lessonsPerWeek + 1, date: lessonDate(next, i) }));
      course = validateCourse(next); renderLessons(); error(''); setDirty();
    } catch (e) { error(e.message); }
  };
  $('#copy-course-button').onclick = async event => {
    const source = $('#copy-course').value, token = generation; if (!source) return;
    const button = event.currentTarget; button.disabled = true;
    try {
      const result = await api(`/api/classes/${source}/overview`);
      if (token !== generation || !dialog.open) return;
      if (!result.course) throw Error('That class has no saved course overview yet.');
      if (dirty && !confirm('Replace this draft with the selected class’s overview?')) return;
      fill(result.course); setDirty(); error('');
    } catch (e) { error(e.message); } finally { button.disabled = false; }
  };
  $('#course-file').onchange = async event => {
    const file = event.target.files[0], token = generation; if (!file) return;
    try {
      if (file.size > 131072) throw Error('Choose a course file smaller than 128 KiB.');
      const imported = readCourseFile(JSON.parse(await file.text()));
      if (token !== generation || !dialog.open) return;
      if (dirty && !confirm('Replace this draft with the course file? Save or download the current draft first if you want to keep it.')) return;
      fill(imported); setDirty(); error(''); message('Course file opened locally. Review its source notes and lessons, then save it to this class.');
    } catch (e) { error(e.message); } finally { event.target.value = ''; }
  };
  function currentDraft() {
    const next = settings();
    next.lessons = readLessons().map((lesson, i) => ({ ...lesson, week: Math.floor(i / next.lessonsPerWeek) + 1, slot: i % next.lessonsPerWeek + 1 }));
    return next;
  }
  function saveFile(text, name, type) {
    const url = URL.createObjectURL(new Blob([text], { type })), link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $('#download-course-file').onclick = () => {
    try { saveFile(JSON.stringify({ type: 'inkwire-course', version: 1, course: validateCourse(currentDraft()) }), 'inkwire-course.inkwire-course.json', 'application/json'); error(''); }
    catch(e) { error(e.message); }
  };
  function download() {
    const next = currentDraft();
    const text = `${next.title}\n${next.organization}\n${courseSummary(next)}\n${next.timeZone} · ${next.startTime}\n\n${next.description}\n\n` + ['gradeBand','themes','essentialQuestions','enduringUnderstandings','sourceNotes'].filter(k => next[k]).map(k => k + ':\n' + next[k]).join('\n\n') + '\n\n' + next.lessons.map((l, i) => `Lesson ${i + 1} · ${l.date || 'Date to be set'}\n${l.title}\n` + ['section','goal','reading','homework','skills','activities','evidence','sourcePages'].filter(k => l[k]).map(k => k + ': ' + l[k]).join('\n')).join('\n\n');
    saveFile(text, 'inkwire-course-overview.txt', 'text/plain;charset=utf-8');
  }
  $('#download-course').onclick = download;
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (saving || assistant.isBusy()) return;
    try {
      const next = validateCourse(currentDraft());
      saving = true; error(''); message('Saving course overview…');
      form.querySelector('button[type=submit]').disabled = true;
      // Keep the form stable until the save resolves, so a late response cannot
      // silently discard edits made during the request.
      const controls = [...form.querySelectorAll('input, textarea, select, button')]; const disabled = controls.map(el => el.disabled); controls.forEach(el => { el.disabled = true; });
      try {
        const saved = await api(`/api/classes/${currentId}/overview`, { course: next, revision });
        revision = saved.revision; course = saved.course; dirty = false;
        const classroom = getClasses().find(c => c.id === currentId);
        if (classroom) Object.assign(classroom, { overviewRevision: revision, courseWeeks: course.weeks, courseFrequency: course.lessonsPerWeek, courseMinutes: course.lessonMinutes, coursePacing: course.pacing, courseLessonCount: course.lessonCount });
        message('Course overview saved.'); status.textContent = 'Course overview saved for ' + getClasses().find(c => c.id === currentId)?.name + '.';
        list.querySelector(`[data-course-status="${currentId}"]`).textContent = courseSummary(course);
        list.querySelector(`[data-plan-course="${currentId}"]`).textContent = 'Edit course overview';
        onSaved?.();
      } finally { controls.forEach((el, i) => { el.disabled = disabled[i]; }); refreshScheduleControls(); }
    } catch (e) { error(e.message); message('Your draft has not been saved.'); }
    finally { saving = false; form.querySelector('button[type=submit]').disabled = false; }
  });
  async function open(classId, button, lessonIndex) {
    assistant.reset();
    trigger = button; currentId = classId; revision = 0; dirty = false; const token = ++generation;
    form.hidden = true; error(''); message('Loading course overview…');
    $('#planner-class').textContent = getClasses().find(c => c.id === classId)?.name || '';
    $('#copy-course').innerHTML = '<option value="">Choose another class</option>' + getClasses().filter(c => c.id !== classId && c.overviewRevision).map(c => `<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('');
    dialog.showModal();
    try {
      const result = await api(`/api/classes/${classId}/overview`); if (generation !== token || !dialog.open) return;
      revision = result.revision;
      const initial = result.course || useFormat(defaults(getClasses().find(c => c.id === classId)?.name), 'full');
      if (!result.course) initial.lessons = generateLessons(initial);
      fill(initial); form.hidden = false;
      assistant.open();
      message(result.course ? 'Saved teacher draft. Make changes below.' : 'Rivendell starting format · 15 weeks · one 120-minute lesson each week.');
      if (result.course) list.querySelector(`[data-course-status="${classId}"]`).textContent = courseSummary(result.course);
      if (Number.isInteger(lessonIndex)) {
        const row = $('#course-lessons').querySelector(`[data-plan-lesson="${lessonIndex}"]`);
        if (row) { row.open = true; row.querySelector('input').focus(); row.scrollIntoView({ block: 'start' }); }
      }
    } catch (e) { message(e.message + ' Close and reopen to try again.'); if (e.status === 401) problem(e); }
  }
  list.addEventListener('click', event => { const button = event.target.closest('[data-plan-course]'); if (button) open(button.dataset.planCourse, button); });
  window.addEventListener('beforeunload', event => { if (dirty && dialog.open) { event.preventDefault(); event.returnValue = ''; } });
  return { isOpen: () => dialog.open, open };
}
