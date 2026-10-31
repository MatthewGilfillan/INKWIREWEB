import { api, escape } from './workspace-shared.js';
import { presets, defaults, generateLessons, validateCourse, courseSummary, addDays } from './course-model.mjs';

export function createCoursePlanner({ list, getClasses, status, problem }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'course-planner'; dialog.setAttribute('aria-labelledby', 'planner-title');
  dialog.innerHTML = `<button class="teacher-close" type="button" data-planner-close aria-label="Close course overview">×</button>
    <p class="teacher-eyebrow">COURSE PLANNING</p><h2 id="planner-title">Build course overview</h2><p id="planner-class"></p>
    <p id="planner-message" role="status"></p><form id="course-form" hidden>
    <div class="planner-intro"><p>Start with a reusable format, paste your own outline, or copy a previous class. Review the weeks before saving your teacher draft.</p><label for="course-preset">Starting point</label><select id="course-preset" name="preset">${presets.map(p => `<option value="${p.id}">${escape(p.name)}</option>`).join('')}</select><p id="preset-description"></p>
    <div class="planner-grid"><div><label for="course-organization">School / organisation</label><input id="course-organization" name="organization" maxlength="120"></div><div><label for="course-title">Course title</label><input id="course-title" name="title" maxlength="160" required></div></div>
    <label for="course-description">Course overview</label><textarea id="course-description" name="description" maxlength="4000" rows="3" placeholder="What will students read, practise and achieve?"></textarea>
    <div class="planner-grid three"><div><label for="course-weeks">Number of weeks</label><input id="course-weeks" name="weeks" type="number" min="1" max="52" required></div><div><label for="course-frequency">Lessons per week</label><input id="course-frequency" name="lessonsPerWeek" type="number" min="1" max="3" required></div><div><label for="course-minutes">Minutes per lesson</label><input id="course-minutes" name="lessonMinutes" type="number" min="15" max="240" required></div></div>
    <div class="planner-grid three"><div><label for="course-start">First lesson <span>(optional)</span></label><input id="course-start" name="startDate" type="date" min="2000-01-01" max="2100-01-01"></div><div><label for="course-time">Lesson time</label><input id="course-time" name="startTime" type="time" required></div><div><label for="course-zone">Time zone</label><select id="course-zone" name="timeZone"><option value="Asia/Shanghai">Beijing / Shanghai (UTC+8)</option><option value="Asia/Bangkok">Bangkok (UTC+7)</option><option value="Europe/London">London</option><option value="America/New_York">New York</option><option value="UTC">UTC</option></select></div></div>
    <p class="planner-hint">Dates repeat weekly. With more than one lesson per week, suggested days are spaced across the week; edit them below for holidays or a different timetable. Times use the selected time zone.</p>
    <details class="planner-source"><summary>Paste an existing outline</summary><label for="course-outline">One line per week</label><textarea id="course-outline" rows="6" maxlength="30000" placeholder="Week 1: Introducing the novel&#10;Week 2: Character and motivation"></textarea><p>Paste from a document or spreadsheet. Spreadsheet columns: topic, goals, reading, homework. Choose “Generate weekly plan” to apply it.</p></details>
    <details class="planner-source"><summary>Copy from another class</summary><label for="copy-course">Source class</label><select id="copy-course"></select><button type="button" class="teacher-button secondary" id="copy-course-button">Use this overview</button><p>This copies the plan into this class. You can change its dates and content before saving.</p></details>
    <div class="teacher-actions"><button type="button" class="teacher-button" id="generate-course">Generate weekly plan</button><button type="button" class="teacher-button secondary" id="reschedule-course">Update lesson dates</button></div></div>
    <div class="planner-review-heading"><div><h3>Weekly plan</h3><p id="course-summary"></p></div><span class="class-badge">Teacher draft</span></div>
    <p class="planner-hint">Suggested topics are editable starting points. Add the actual text, chapters and assignments for your students.</p><div id="course-lessons"></div>
    <p class="form-error" role="alert" hidden></p><div class="planner-save"><button type="button" class="teacher-button secondary" id="download-course">Download outline</button><button type="submit" class="teacher-button">Save course overview</button></div><p class="planner-hint">Saved for this class and its teachers. Student publication is not connected yet.</p></form>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector), form = $('#course-form');
  let currentId = '', revision = 0, course, dirty = false, saving = false, trigger, generation = 0;
  const field = name => form.elements.namedItem(name);
  const message = value => { $('#planner-message').textContent = value; };
  const error = value => { $('.form-error').textContent = value; $('.form-error').hidden = !value; };
  const setDirty = () => { dirty = true; message('Unsaved changes'); };
  function settings() {
    return { ...course, ...Object.fromEntries(new FormData(form)), weeks: Number(field('weeks').value), lessonsPerWeek: Number(field('lessonsPerWeek').value), lessonMinutes: Number(field('lessonMinutes').value) };
  }
  function readLessons() {
    return [...dialog.querySelectorAll('[data-plan-lesson]')].map((row, i) => ({ week: course.lessons[i].week, slot: course.lessons[i].slot,
      ...Object.fromEntries([...row.querySelectorAll('[data-lesson-field]')].map(input => [input.dataset.lessonField, input.value])) }));
  }
  function renderLessons() {
    $('#course-summary').textContent = courseSummary(course);
    $('#course-lessons').innerHTML = course.lessons.map((lesson, i) => `<details class="plan-lesson" data-plan-lesson="${i}" ${i === 0 ? 'open' : ''}><summary><span><b>Week ${lesson.week}${course.lessonsPerWeek > 1 ? ` · lesson ${lesson.slot}` : ''}</b><span data-topic-label>${escape(lesson.title)}</span></span><span data-date-label>${escape(lesson.date || 'Date to be set')}</span></summary><div class="plan-lesson-body"><div class="planner-grid"><div><label for="lesson-${i}-title">Topic</label><input id="lesson-${i}-title" data-lesson-field="title" maxlength="160" required value="${escape(lesson.title)}"></div><div><label for="lesson-${i}-date">Lesson date</label><input id="lesson-${i}-date" data-lesson-field="date" type="date" min="2000-01-01" max="2100-12-31" value="${escape(lesson.date)}"></div></div>${[['goal', 'Learning goals'], ['reading', 'Reading before class'], ['homework', 'Homework after class']].map(([key, label]) => `<label for="lesson-${i}-${key}">${label}</label><textarea id="lesson-${i}-${key}" data-lesson-field="${key}" maxlength="1200" rows="2">${escape(lesson[key])}</textarea>`).join('')}</div></details>`).join('');
  }
  function fill(value) {
    course = structuredClone(value);
    for (const key of ['preset', 'organization', 'title', 'description', 'weeks', 'lessonsPerWeek', 'lessonMinutes', 'startDate', 'startTime', 'timeZone']) {
      if (key === 'timeZone' && ![...field(key).options].some(o => o.value === value[key])) field(key).add(new Option(value[key], value[key]));
      field(key).value = value[key];
    }
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
  dialog.addEventListener('close', () => { generation++; if (trigger?.isConnected) trigger.focus(); });
  form.addEventListener('input', event => {
    if (event.target.id === 'copy-course') return;
    setDirty();
    const row = event.target.closest('[data-plan-lesson]');
    if (row && event.target.dataset.lessonField === 'title') row.querySelector('[data-topic-label]').textContent = event.target.value;
    if (row && event.target.dataset.lessonField === 'date') row.querySelector('[data-date-label]').textContent = event.target.value || 'Date to be set';
  });
  field('preset').addEventListener('change', () => { $('#preset-description').textContent = presets.find(p => p.id === field('preset').value).description; });
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
      next.lessons = readLessons().map(lesson => ({ ...lesson, date: addDays(next.startDate, (lesson.week - 1) * 7 + Math.floor((lesson.slot - 1) * 7 / next.lessonsPerWeek)) }));
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
  function download() {
    const next = { ...settings(), lessons: readLessons() };
    const text = `${next.title}\n${next.organization}\n${courseSummary(next)}\n${next.timeZone} · ${next.startTime}\n\n${next.description}\n\n` + next.lessons.map(l => `Week ${l.week} · lesson ${l.slot} · ${l.date || 'Date to be set'}\n${l.title}\nGoals: ${l.goal}\nReading: ${l.reading}\nHomework: ${l.homework}`).join('\n\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' })), link = document.createElement('a'); link.href = url; link.download = 'inkwire-course-overview.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $('#download-course').onclick = download;
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (saving) return;
    try {
      const next = validateCourse({ ...settings(), lessons: readLessons() });
      saving = true; error(''); message('Saving course overview…');
      form.querySelector('button[type=submit]').disabled = true;
      // Keep the form stable until the save resolves, so a late response cannot
      // silently discard edits made during the request.
      const controls = [...form.querySelectorAll('input, textarea, select, button')]; const disabled = controls.map(el => el.disabled); controls.forEach(el => { el.disabled = true; });
      try {
        const saved = await api(`/api/classes/${currentId}/overview`, { course: next, revision });
        revision = saved.revision; course = saved.course; dirty = false;
        const classroom = getClasses().find(c => c.id === currentId);
        if (classroom) Object.assign(classroom, { overviewRevision: revision, courseWeeks: course.weeks, courseFrequency: course.lessonsPerWeek, courseMinutes: course.lessonMinutes });
        message('Course overview saved.'); status.textContent = 'Course overview saved for ' + getClasses().find(c => c.id === currentId)?.name + '.';
        list.querySelector(`[data-course-status="${currentId}"]`).textContent = courseSummary(course);
        list.querySelector(`[data-plan-course="${currentId}"]`).textContent = 'Edit course overview';
      } finally { controls.forEach((el, i) => { el.disabled = disabled[i]; }); }
    } catch (e) { error(e.message); message('Your draft has not been saved.'); }
    finally { saving = false; form.querySelector('button[type=submit]').disabled = false; }
  });
  async function open(classId, button) {
    trigger = button; currentId = classId; revision = 0; dirty = false; const token = ++generation;
    form.hidden = true; error(''); message('Loading course overview…');
    $('#planner-class').textContent = getClasses().find(c => c.id === classId)?.name || '';
    $('#copy-course').innerHTML = '<option value="">Choose another class</option>' + getClasses().filter(c => c.id !== classId && c.overviewRevision).map(c => `<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('');
    dialog.showModal();
    try {
      const result = await api(`/api/classes/${classId}/overview`); if (generation !== token || !dialog.open) return;
      revision = result.revision;
      const initial = result.course || defaults(getClasses().find(c => c.id === classId)?.name);
      if (!result.course) initial.lessons = generateLessons(initial);
      fill(initial); form.hidden = false;
      message(result.course ? 'Saved teacher draft. Make changes below.' : 'Rivendell starting format · 15 weeks · one 120-minute lesson each week.');
      if (result.course) list.querySelector(`[data-course-status="${classId}"]`).textContent = courseSummary(result.course);
    } catch (e) { message(e.message + ' Close and reopen to try again.'); if (e.status === 401) problem(e); }
  }
  list.addEventListener('click', event => { const button = event.target.closest('[data-plan-course]'); if (button) open(button.dataset.planCourse, button); });
  window.addEventListener('beforeunload', event => { if (dirty && dialog.open) { event.preventDefault(); event.returnValue = ''; } });
  return { isOpen: () => dialog.open };
}
