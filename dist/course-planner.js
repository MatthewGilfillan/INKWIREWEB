import {createCoursePreparation} from './course-preparation.js';
import {createCourseQuizSetup} from './course-resources.js';
import {courseOverviewHTML,courseIcon} from './course-overview.js';
import {createLessonQuiz} from './lesson-quiz.js';
import {createCourseSchedule} from './course-schedule.js';
import {lessonTiming,billingSchedule,applySchedule} from './schedule-model.mjs';
import {createLessonFeedback} from './lesson-feedback.js';
import {lessonKey,lessonEnd} from './lesson-feedback-model.mjs';
import { formats, useFormat } from './course-formats.mjs';
import { api, escape } from './workspace-shared.js';
import { presets, defaults, generateLessons, validateCourse, courseSummary, lessonDate, readCourseFile } from './course-model.mjs';
import { createCourseAssistant } from './course-assistant.js';

export function createCoursePlanner({ list, getClasses, status, problem, onSaved, root }) {
  const dialog = document.createElement(root ? 'section' : 'dialog');
  const isOpen = () => root ? Boolean(currentId) : dialog.open;
  dialog.className = 'course-planner'; dialog.setAttribute('aria-labelledby', 'planner-title');
  dialog.innerHTML = `<button class="teacher-close" type="button" data-planner-close aria-label="Close course overview">×</button>
    <p class="teacher-eyebrow">YOUR COURSE</p><h2 id="planner-title" tabindex="-1">Course overview</h2><p id="planner-class"></p>
    <p id="planner-message" role="status"></p><div class="overview-toolbar" hidden><button type="button" class="teacher-button secondary" data-prepare-course>Prepare Course with AI</button><button type="button" class="teacher-button" data-edit-unit-plan></button><button type="button" class="text-button" data-preview-overview hidden>Back to overview</button></div><div id="course-preparation" hidden></div><div data-course-overview hidden></div><form id="course-form" hidden>
    <div class="planner-intro"><p>Start with a reusable format, paste your own outline, or copy a previous class. Review the lessons before saving your teacher draft.</p><label for="course-format">Teaching format</label><select id="course-format" name="format">${formats.map(f => `<option value="${f.id}">${escape(f.name)}</option>`).join('')}</select><label for="course-pacing">Lesson frequency</label><select id="course-pacing" name="pacing"><option value="weekly">Recurring weekly timetable</option><option value="lessons">Set individual class dates later</option></select><div class="planner-grid three"><div><label for="course-weeks">Total lessons</label><input id="course-weeks" name="lessonCount" type="number" min="1" max="156" required></div><div data-weekly-frequency><label for="course-frequency">Lessons per week</label><input id="course-frequency" name="lessonsPerWeek" type="number" min="1" max="7" required></div><div><label for="course-minutes">Minutes per lesson</label><input id="course-minutes" name="lessonMinutes" type="number" min="15" max="240" required></div></div>
    <div class="planner-grid three"><div data-weekly-start><label for="course-start">Start date <span>(optional)</span></label><input id="course-start" name="startDate" type="date" min="2000-01-01" max="2100-01-01"></div><div data-course-end><label for="course-end">End date <span>(optional)</span></label><input id="course-end" name="endDate" type="date" min="2000-01-01" max="2100-12-31"></div><div><label for="course-time">Default lesson time</label><input id="course-time" name="startTime" type="time" required></div><div><label for="course-zone">Time zone</label><select id="course-zone" name="timeZone"><option value="Asia/Shanghai">Beijing / Shanghai (UTC+8)</option><option value="Asia/Bangkok">Bangkok (UTC+7)</option><option value="Europe/London">London</option><option value="America/New_York">New York</option><option value="UTC">UTC</option></select></div></div>
    <div id="course-scheduling"></div><p class="planner-hint">For a weekly timetable, choose 1–7 lessons per week. Add specific weekly days and times below, or use evenly spaced suggested dates. Each lesson can be cancelled or rescheduled. Individual-date courses keep the lesson sequence without assuming how many weeks it takes.</p><label for="course-preset">Content starting point</label><select id="course-preset" name="preset">${presets.map(p => `<option value="${p.id}">${escape(p.name)}</option>`).join('')}</select><p id="preset-description"></p>
    <div class="planner-grid"><div><label for="course-organization">School / organisation</label><input id="course-organization" name="organization" maxlength="120"></div><div><label for="course-title">Course title</label><input id="course-title" name="title" maxlength="160" required></div></div>
    <label for="course-description">Course overview</label><textarea id="course-description" name="description" maxlength="4000" rows="3" placeholder="What will students read, practise and achieve?"></textarea>
    <div data-primary-writing hidden><label class="planner-checkbox"><input type="checkbox" name="includeWritingActivity" checked> Include Section 8 writing activity</label><p>The author pre-reading and seven main sections share the lesson allocation. Section labels stay separate from lesson numbers.</p></div>
    <details class="planner-source"><summary>Unit overview &amp; teaching details</summary><label for="course-grade">Grade / age band</label><input id="course-grade" name="gradeBand" maxlength="80">${[['themes','Themes'], ['essentialQuestions','Essential questions'], ['enduringUnderstandings','Enduring understandings'], ['sourceNotes','Source & review notes']].map(([key,label]) => `<label for="course-${key}">${label}</label><textarea id="course-${key}" name="${key}" maxlength="6000" rows="3"></textarea>`).join('')}</details>
    <details class="planner-source"><summary>Open a prepared course file</summary><label for="course-file">Ink Wire course file</label><input id="course-file" type="file" accept=".json,application/json"><p>Load a converted unit plan or a course file you saved earlier. Review it here before saving to this class. Opening a file does not upload it. For PDF, Word or spreadsheet resources, use Resources & AI quizzes below.</p></details>
    <details class="planner-source"><summary>Paste an existing outline</summary><label for="course-outline" id="outline-label">One line per week</label><textarea id="course-outline" rows="6" maxlength="30000" placeholder="Week 1: Introducing the novel&#10;Week 2: Character and motivation"></textarea><p>Paste from a document or spreadsheet. Spreadsheet columns: topic, goals, reading, homework. Choose “Generate weekly plan” to apply it.</p></details>
    <details class="planner-source"><summary>Copy from another class</summary><label for="copy-course">Source class</label><select id="copy-course"></select><button type="button" class="teacher-button secondary" id="copy-course-button">Use this overview</button><p>This copies the plan into this class. You can change its dates and content before saving.</p></details>
    <div class="teacher-actions"><button type="button" class="teacher-button" id="generate-course">Generate weekly plan</button><button type="button" class="teacher-button secondary" id="reschedule-course">Update lesson dates</button></div></div>
    <div id="course-ai-planning"></div><div id="course-ai-quizzes"></div>
    <div class="planner-review-heading"><div><h3>Lesson plan</h3><p id="course-summary"></p></div><span class="class-badge">Course outline</span></div>
    <p class="planner-hint">Suggested topics are editable starting points. Add the actual text, chapters and assignments for your students.</p><div id="course-lessons"></div>
    <p class="form-error" role="alert" hidden></p><div class="planner-save"><button type="button" class="teacher-button secondary" id="download-course-file">Save course file</button><button type="button" class="teacher-button secondary" id="download-course">Download outline</button><button type="submit" class="teacher-button">Save course overview</button></div><p class="planner-hint">The saved outline is visible to enrolled students and connected parents. Private source notes and teaching details stay with teachers. Publish each lesson’s Summary &amp; Feedback after class.</p></form>`;
  (root || document.body).append(dialog);
  if (root) dialog.querySelector('[data-planner-close]').hidden = true;
  const $ = selector => dialog.querySelector(selector), form = $('#course-form');
  let currentId = '', revision = 0, course, dirty = false, saving = false, trigger, generation = 0;
  const feedback=createLessonFeedback(); let savedCourse=null, serverTime=Date.now(), localTime=performance.now(), unlockTimer;
  let editorsReady=false, quizStates=null;
  const field = name => form.elements.namedItem(name);
  const message = value => { $('#planner-message').textContent = value; };
  const error = value => { $('.form-error').textContent = value; $('.form-error').hidden = !value; };
  const setDirty = () => { dirty = true; message('Unsaved changes'); updateFeedbackButtons(); };
  const assistant = createCourseAssistant({ root: $('#course-ai-planning'), form, getClassId: () => currentId,
    getDraft: () => currentDraft(), applyDraft: value => { fill(value); setDirty(); } });
  const quizSetup=createCourseQuizSetup({root:$('#course-ai-quizzes'),getClassId:()=>currentId,canGenerate:()=>Boolean(savedCourse) && !dirty && !saving && !assistant.isBusy()});
  const preparation=createCoursePreparation({root:$('#course-preparation'),getClassId:()=>currentId,getRevision:()=>revision,getDraft:currentDraft,applyDraft:value=>{fill(value);setDirty();$('#course-preparation').hidden=true;editPlan();message('Prepared plan loaded. Review or edit it, then save the overview to keep its quiz drafts.');},onBusy:value=>{dialog.querySelectorAll('.overview-toolbar button').forEach(b=>b.disabled=value);}});
  $('[data-prepare-course]').onclick=()=>{if(saving || assistant.isBusy() || quizSetup.isBusy() || preparation.isBusy())return;form.hidden=true;$('[data-course-overview]').hidden=true;$('[data-preview-overview]').hidden=false;preparation.open();};
  const scheduler=createCourseSchedule({root:$('#course-scheduling'),getCourse:currentDraft,onChange:()=>{setDirty();if(course)refreshLessonBadges();},onFrequency:n=>{field('lessonsPerWeek').value=n;},apply:value=>{course=value;renderLessons();setDirty();},});
  function renderQuizStates(){
    for(const label of dialog.querySelectorAll('[data-overview-quiz-status]')){
      const lesson=quizStates?.find(l=>l.id===label.dataset.overviewQuizStatus);
      label.textContent=lesson?.hasDraft?'AI draft · review before assigning':lesson?.assigned?'Assigned':lesson?'Not assigned':'View / set up quiz';
    }
  }
  async function loadQuizStates(){
    if(!savedCourse)return;const token=generation,id=currentId;
    try{const result=await api(`/api/quiz-assistant/classes/${id}`);if(token!==generation)return;quizStates=result.lessons;renderQuizStates();}catch{/* Quiz setup remains available if its status cannot be loaded. */}
  }
  function showOverview(focus=false){
    if(saving || assistant.isBusy() || quizSetup.isBusy() || preparation.isBusy()){message('Wait for the save or AI suggestion to finish before leaving the editor.');return;}
    $('#course-preparation').hidden=true;
    $('[data-course-overview]').innerHTML=courseOverviewHTML(dirty?currentDraft():savedCourse,{draft:dirty});
    $('[data-course-overview]').hidden=false;form.hidden=true;$('.overview-toolbar').hidden=false;
    const edit=$('[data-edit-unit-plan]');edit.hidden=false;
    edit.innerHTML=courseIcon('pencil')+(dirty?'Continue editing':savedCourse?'Edit Unit Plan':'Create Unit Plan');
    edit.setAttribute('aria-label',dirty?'Continue editing unit plan':savedCourse?'Edit Unit Plan':'Create Unit Plan');
    $('[data-preview-overview]').hidden=true;$('#planner-title').textContent='Course overview';
    renderQuizStates();updateFeedbackButtons();
    if(focus){$('#planner-title').focus();$('#planner-title').scrollIntoView({block:'start'});}
  }
  function editPlan(lessonIndex){
    if(!course || saving || assistant.isBusy() || quizSetup.isBusy() || preparation.isBusy())return;
    $('#course-preparation').hidden=true;form.hidden=false;$('[data-course-overview]').hidden=true;$('[data-edit-unit-plan]').hidden=true;$('[data-preview-overview]').hidden=false;
    $('.overview-toolbar').hidden=false;$('#planner-title').textContent=savedCourse?'Edit unit plan':'Create unit plan';
    if(!editorsReady){editorsReady=true;assistant.open();quizSetup.load();}
    if(Number.isInteger(lessonIndex)){
      const row=$(`[data-plan-lesson="${lessonIndex}"]`);if(row){row.open=true;row.querySelector('[data-lesson-field="title"]').focus();row.scrollIntoView({block:'start'});}
    }else{$('#planner-title').focus();$('#planner-title').scrollIntoView({block:'start'});}
  }
  $('[data-edit-unit-plan]').onclick=()=>editPlan();
  $('[data-preview-overview]').onclick=()=>showOverview(true);
  $('[data-course-overview]').addEventListener('click',event=>{
    const edit=event.target.closest('[data-overview-edit]');if(edit){editPlan(Number(edit.dataset.overviewEdit));return;}
    const quiz=event.target.closest('[data-overview-quiz]');if(quiz && !quiz.disabled)createLessonQuiz().open(currentId,quiz.dataset.overviewQuiz,quiz);
    const recap=event.target.closest('[data-feedback-open]');if(recap && !recap.disabled)feedback.open(currentId,recap.dataset.feedbackOpen,recap);
  });
  document.addEventListener('inkwire:quiz-changed',event=>{if(event.detail.classId===currentId)loadQuizStates();});
  function settings() {
    const next = { ...course, ...Object.fromEntries(new FormData(form)), ...scheduler.settings(), lessonCount: Number(field('lessonCount').value), lessonsPerWeek: field('pacing').value === 'lessons' ? 1 : Number(field('lessonsPerWeek').value), lessonMinutes: Number(field('lessonMinutes').value), includeWritingActivity: field('includeWritingActivity').checked };
    next.weeks = Math.ceil(next.lessonCount / next.lessonsPerWeek);
    if (next.pacing === 'lessons') { next.startDate = ''; next.endDate = ''; next.weeklySlots=[]; }
    return next;
  }
  function readLessons() {
    return [...dialog.querySelectorAll('[data-plan-lesson]')].map((row, i) => ({...course.lessons[i],id:lessonKey(course.lessons[i],i),
      ...Object.fromEntries([...row.querySelectorAll('[data-lesson-field]')].map(input=>[input.dataset.lessonField,input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value]))}));
  }
  function refreshLessonBadges(){
    if(!course)return;const current=currentDraft(),billing=billingSchedule(current);scheduler.refresh(current);
    for(const [i,lesson]of current.lessons.entries()){
      const row=$(`[data-plan-lesson="${i}"]`);row.classList.toggle('is-cancelled',lesson.status==='cancelled');
      row.querySelector('[data-lesson-billing]').textContent=billing.get(lessonKey(lesson,i))?.label || '';
      row.querySelector('[data-lesson-state]').textContent=lesson.status==='cancelled'?'Cancelled':lesson.rescheduledFrom?`Rescheduled from ${lesson.rescheduledFrom.date} at ${lesson.rescheduledFrom.startTime}`:'Scheduled';
      row.querySelector('[data-cancel-lesson]').textContent=lesson.status==='cancelled'?'Restore lesson':'Cancel lesson';
      row.querySelector('[data-charge-cancellation]').hidden=lesson.status!=='cancelled';
    }
  }
  function renderLessons() {
    $('#course-summary').textContent = courseSummary(course);
    $('#course-lessons').innerHTML = course.lessons.map((lesson, i) => `<details class="plan-lesson" data-plan-lesson="${i}" ${i === 0 ? 'open' : ''}><summary><span><b>${course.pacing === 'lessons' ? `Lesson ${i + 1}` : `Week ${lesson.week}${course.lessonsPerWeek > 1 ? ` · lesson ${lesson.slot}` : ''}`}</b><span data-topic-label>${escape(lesson.title)}</span></span><span data-date-label>${escape(lesson.date || 'Date to be set')}</span></summary><div class="plan-lesson-body"><div class="lesson-schedule-actions"><span data-lesson-state></span><button type="button" class="text-button" data-reschedule-lesson="${i}">Reschedule</button><button type="button" class="text-button danger-text" data-cancel-lesson="${i}">Cancel lesson</button></div><p class="lesson-billing" data-lesson-billing></p><label class="planner-checkbox" data-charge-cancellation hidden><input type="checkbox" data-lesson-field="chargeCancelled" ${lesson.chargeCancelled?'checked':''}>Count this cancellation for billing / the lesson pack</label><div class="feedback-lesson-actions"><button type="button" class="teacher-button secondary" data-feedback-open="${escape(lessonKey(lesson,i))}" disabled>Summary &amp; Feedback</button><span data-feedback-unlock></span></div><div class="planner-grid"><div><label for="lesson-${i}-title">Topic</label><input id="lesson-${i}-title" data-lesson-field="title" maxlength="160" required value="${escape(lesson.title)}"></div><div><label for="lesson-${i}-date">Lesson date</label><input id="lesson-${i}-date" data-lesson-field="date" type="date" min="2000-01-01" max="2100-12-31" value="${escape(lesson.date)}"></div><div><label for="lesson-${i}-time">Lesson time</label><input id="lesson-${i}-time" data-lesson-field="startTime" type="time" required value="${escape(lesson.startTime || course.startTime)}"></div><div><label for="lesson-${i}-minutes">Minutes</label><input id="lesson-${i}-minutes" data-lesson-field="lessonMinutes" type="number" min="15" max="240" required value="${lesson.lessonMinutes ?? course.lessonMinutes}"></div></div>${[['section','Book section / unit'], ['goal', 'Learning goals / outcomes'], ['reading', 'Reading before class'], ['homework', 'Assignments / homework'], ['skills','Skills'], ['activities','Lesson activities'], ['evidence','Evidence of learning'], ['sourcePages','Source pages']].map(([key, label]) => `<label for="lesson-${i}-${key}">${label}</label><textarea id="lesson-${i}-${key}" data-lesson-field="${key}" maxlength="${key === 'activities' ? 4000 : ['skills','evidence'].includes(key) ? 2000 : key === 'section' ? 160 : key === 'sourcePages' ? 80 : 1200}" rows="2">${escape(lesson[key])}</textarea>`).join('')}</div></details>`).join('');
    refreshLessonBadges();
  }
  function updateFeedbackButtons() {
    clearTimeout(unlockTimer); let next=Infinity;
    for(const button of dialog.querySelectorAll('[data-feedback-open]')) {
      const label=button.nextElementSibling, lesson=savedCourse?.lessons.find((l,i)=>lessonKey(l,i)===button.dataset.feedbackOpen);
      let end=null;try{if(lesson)end=lessonEnd(savedCourse,lesson);}catch{}
      const remaining=end===null?Infinity:end-(serverTime+performance.now()-localTime);
      button.disabled=dirty || saving || !lesson || lesson.status==='cancelled' || end===null || remaining>0;
      label.textContent=lesson?.status==='cancelled'?'Cancelled lessons do not accept feedback.':dirty || !lesson?'Save the course overview first.':end===null?'Set and save this lesson’s date and time.':remaining>0?'Opens '+new Intl.DateTimeFormat('en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:savedCourse.timeZone}).format(end)+' · '+savedCourse.timeZone:'Ready for your lesson recap and student assessments';
      if(remaining>0)next=Math.min(next,remaining);
    }
    if(isOpen() && Number.isFinite(next))unlockTimer=setTimeout(updateFeedbackButtons,Math.min(next+10,2147483647));
  }
  $('#course-lessons').addEventListener('click',event=>{
    const button=event.target.closest('[data-cancel-lesson],[data-reschedule-lesson]');if(!button)return;
    if(button.dataset.rescheduleLesson!==undefined){const row=$(`[data-plan-lesson="${button.dataset.rescheduleLesson}"]`);row.querySelector('[data-lesson-field="date"]').focus();message('Change the lesson date, time or duration, then save course overview. The same lesson keeps its content and pack credit.');return;}
    const i=Number(button.dataset.cancelLesson);course=currentDraft();course.lessons[i].status=course.lessons[i].status==='cancelled'?'scheduled':'cancelled';course.lessons[i].chargeCancelled=false;
    renderLessons();$(`[data-plan-lesson="${i}"]`).open=true;setDirty();
  });
  $('#course-lessons').addEventListener('click',event=>{const button=event.target.closest('[data-feedback-open]');if(button && !button.disabled){event.preventDefault();feedback.open(currentId,button.dataset.feedbackOpen,button);}});
  document.addEventListener('visibilitychange',()=>{if(isOpen())updateFeedbackButtons();});
  function fill(value) {
    course = structuredClone(value);
    for (const key of ['preset', 'organization', 'title', 'description', 'lessonsPerWeek', 'lessonMinutes', 'startDate', 'endDate', 'startTime', 'timeZone', 'gradeBand', 'themes', 'essentialQuestions', 'enduringUnderstandings', 'sourceNotes']) {
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
    scheduler.fill(value); renderLessons(); updateFeedbackButtons();
  }
  function close() {
    if (saving) return;
    if (dirty && !confirm('Close without saving this course overview? Download or save your draft first to keep these changes.')) return;
    dialog.close();
  }
  $('[data-planner-close]').onclick = close;
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => { generation++; clearTimeout(unlockTimer); assistant.reset(); if (trigger?.isConnected) trigger.focus(); });
  form.addEventListener('input', event => {
    if (event.target.closest('.course-assistant, .course-quiz-setup')) return;
    if (event.target.id === 'copy-course' || event.target.id === 'course-file') return;
    setDirty();
    const row = event.target.closest('[data-plan-lesson]');
    if (row && event.target.dataset.lessonField === 'title') row.querySelector('[data-topic-label]').textContent = event.target.value;
    if (row && event.target.dataset.lessonField === 'date') row.querySelector('[data-date-label]').textContent = event.target.value || 'Date to be set';
    if(row && ['date','startTime','lessonMinutes'].includes(event.target.dataset.lessonField)){const lesson=course.lessons[Number(row.dataset.planLesson)];if(lesson.date && !lesson.rescheduledFrom)lesson.rescheduledFrom=lessonTiming(course,lesson);}
    if(row)refreshLessonBadges();
    if(['course-start','course-end','course-time','course-minutes'].includes(event.target.id))scheduler.invalidate();
  });
  function refreshScheduleControls() {
    const manual = field('pacing').value === 'lessons';
    scheduler.setWeekly(!manual);$('[data-course-end]').hidden=manual;
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
      const next = settings(); next.lessons = generateLessons(next, $('#course-outline').value).map(l=>({...l,id:crypto.randomUUID()})); validateCourse(next);
      if (!next.description || presets.some(p => p.overview === next.description)) next.description = presets.find(p => p.id === next.preset).overview;
      if (course.lessons.length && !confirm('Replace the weekly plan below with a new plan? This replaces its topics, dates and assignments in this draft.')) return;
      if(next.weeklySlots?.length && next.pacing!=='lessons'){next.lessons=next.lessons.map(l=>({...l,date:''}));try{Object.assign(next,applySchedule(next));}catch{}}
      course = next; field('description').value = course.description; renderLessons(); error(''); setDirty(); $('#course-lessons').scrollIntoView({ block: 'start' });
    } catch (e) { error(e.message); }
  };
  $('#reschedule-course').onclick = () => {
    if (!form.reportValidity()) return;
    try {
      const next = settings();
      if(next.weeklySlots?.length){scheduler.preview();return;}
      next.lessons = readLessons().map((lesson, i) => ({ ...lesson, week: Math.floor(i / next.lessonsPerWeek) + 1, slot: i % next.lessonsPerWeek + 1, date: lessonDate(next, i),startTime:next.startTime,lessonMinutes:next.lessonMinutes }));
      course = validateCourse(next); renderLessons(); error(''); setDirty();
    } catch (e) { error(e.message); }
  };
  $('#copy-course-button').onclick = async event => {
    const source = $('#copy-course').value, token = generation; if (!source) return;
    const button = event.currentTarget; button.disabled = true;
    try {
      const result = await api(`/api/classes/${source}/overview`);
      if (token !== generation || !isOpen()) return;
      if (!result.course) throw Error('That class has no saved course overview yet.');
      if (dirty && !confirm('Replace this draft with the selected class’s overview?')) return;
      fill({...result.course,lessons:result.course.lessons.map(l=>({...l,id:crypto.randomUUID()}))}); setDirty(); error('');
    } catch (e) { error(e.message); } finally { button.disabled = false; }
  };
  $('#course-file').onchange = async event => {
    const file = event.target.files[0], token = generation; if (!file) return;
    try {
      if (file.size > 131072) throw Error('Choose a course file smaller than 128 KiB.');
      const imported = readCourseFile(JSON.parse(await file.text()));
      if (token !== generation || !isOpen()) return;
      if (dirty && !confirm('Replace this draft with the course file? Save or download the current draft first if you want to keep it.')) return;
      fill({...imported,lessons:imported.lessons.map(l=>({...l,id:crypto.randomUUID()}))}); setDirty(); error(''); message('Course file opened locally. Review its source notes and lessons, then save it to this class.');
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
    event.preventDefault(); if (saving || (assistant.isBusy() || quizSetup.isBusy() || preparation.isBusy())) return;
    let didSave=false;
    try {
      const next = validateCourse(currentDraft());
      saving = true; error(''); message('Saving course overview…');
      form.querySelector('button[type=submit]').disabled = true;
      // Keep the form stable until the save resolves, so a late response cannot
      // silently discard edits made during the request.
      const controls = [...form.querySelectorAll('input, textarea, select, button')]; const disabled = controls.map(el => el.disabled); controls.forEach(el => { el.disabled = true; });
      try {
        const saved = await api(`/api/classes/${currentId}/overview`, { course: next, revision });
        revision = saved.revision; course = saved.course; savedCourse=structuredClone(saved.course); serverTime=saved.serverNow || Date.now(); localTime=performance.now(); dirty = false;
        const classroom = getClasses().find(c => c.id === currentId);
        if (classroom) Object.assign(classroom, { overviewRevision: revision, courseWeeks: course.weeks, courseFrequency: course.lessonsPerWeek, courseMinutes: course.lessonMinutes, coursePacing: course.pacing, courseLessonCount: course.lessonCount });
        message('Course overview saved.'); status.textContent = 'Course overview saved for ' + getClasses().find(c => c.id === currentId)?.name + '.';
        const summary = list.querySelector(`[data-course-status="${currentId}"]`);
        if (summary) summary.textContent = courseSummary(course);
        const button = list.querySelector(`[data-plan-course="${currentId}"]`);
        if (button) button.textContent = 'Edit course overview';
        onSaved?.();
        didSave=true;
        try{const prepared=await preparation.afterSave();if(prepared)message('Course overview saved. '+prepared.saved.length+' quiz drafts saved for review.'+(prepared.skipped.length?' Existing quizzes or edited lessons were kept unchanged.':''));}
        catch(e){message('Overview saved. Quiz drafts remain in Prepare Course with AI; open it and choose Save prepared quiz drafts to retry. '+e.message);}
      } finally { controls.forEach((el, i) => { el.disabled = disabled[i]; }); refreshScheduleControls(); }
    } catch (e) { error(e.message); message('Your draft has not been saved.'); }
    finally { saving = false; form.querySelector('button[type=submit]').disabled = false; if(didSave){fill(savedCourse);showOverview(true);loadQuizStates();} updateFeedbackButtons(); }
  });
  async function open(classId, button, lessonIndex) {
    if (root && currentId === classId && course) {
      if (Number.isInteger(lessonIndex)) editPlan(lessonIndex);
      return;
    }
    assistant.reset(); quizSetup.reset(); preparation.reset();
    trigger = button; currentId = classId; revision = 0; dirty = false; const token = ++generation; course = null;
    form.hidden = true; $('[data-course-overview]').hidden=true;$('.overview-toolbar').hidden=true;editorsReady=false;quizStates=null;error(''); message('Loading course overview…');
    $('#planner-class').textContent = getClasses().find(c => c.id === classId)?.name || '';
    $('#copy-course').innerHTML = '<option value="">Choose another class</option>' + getClasses().filter(c => c.id !== classId && c.overviewRevision).map(c => `<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('');
    if (!root) dialog.showModal();
    try {
      const result = await api(`/api/classes/${classId}/overview`); if (generation !== token || !isOpen()) return;
      revision = result.revision; savedCourse=result.course?structuredClone(result.course):null; serverTime=result.serverNow || Date.now();localTime=performance.now();
      const initial = result.course || useFormat(defaults(getClasses().find(c => c.id === classId)?.name), 'full');
      if (!result.course) initial.lessons = generateLessons(initial).map(l=>({...l,id:crypto.randomUUID()}));
      fill(initial);showOverview();loadQuizStates();
      message('');
      const summary = list.querySelector(`[data-course-status="${classId}"]`); if (result.course && summary) summary.textContent = courseSummary(result.course);
      if (Number.isInteger(lessonIndex)) {
        editPlan(lessonIndex);
      }
    } catch (e) { if (generation !== token) return; message(e.message + (root ? ' Select Course overview again to retry.' : ' Close and reopen to try again.')); if (e.status === 401) problem(e); }
  }
  if (!root) list.addEventListener('click', event => { const button = event.target.closest('[data-plan-course]'); if (button) open(button.dataset.planCourse, button); });
  window.addEventListener('beforeunload', event => { if (dirty && isOpen()) { event.preventDefault(); event.returnValue = ''; } });
  return { isOpen, open, hasUnsavedChanges: () => dirty || saving || assistant.isBusy() || quizSetup.isBusy() || preparation.isBusy(),
    canLeave() {
      if (saving || (assistant.isBusy() || quizSetup.isBusy() || preparation.isBusy())) { status.textContent = 'Wait for the course save or AI suggestion to finish before switching classes.'; return false; }
      return !dirty || confirm('Switch classes without saving this course overview? Your unsaved changes will be lost.');
    },
    reset() { generation++; clearTimeout(unlockTimer); assistant.reset(); quizSetup.reset(); preparation.reset(); currentId = ''; course = null; savedCourse=null;quizStates=null;editorsReady=false;dirty = false; form.hidden = true; $('[data-course-overview]').replaceChildren();$('[data-course-overview]').hidden=true;$('.overview-toolbar').hidden=true; }
  };
}
