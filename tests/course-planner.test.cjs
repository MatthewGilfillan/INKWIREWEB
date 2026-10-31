const { test } = require('node:test');
const assert = require('node:assert/strict');

test('Rivendell presets generate 15 weekly two-hour lessons and retain an editable sequence', async () => {
  const { defaults, generateLessons, validateCourse, courseSummary, presets } = await import('../dist/course-model.mjs');
  for (const preset of presets) {
    const course = { ...defaults(), preset: preset.id, startDate: '2027-01-06' };
    course.lessons = generateLessons(course);
    assert.equal(course.lessons.length, 15);
    assert.equal(course.lessons[0].date, '2027-01-06');
    assert.equal(course.lessons.at(-1).date, '2027-04-14');
    assert.match(courseSummary(course), /15 weeks · 1 lesson\/week · 120 min · 30 teaching hours/);
    assert.deepEqual(validateCourse(course), course);
    if (preset.id === 'essay') assert.match(course.lessons.at(-1).title, /Final essay/);
  }
});

test('pasted spreadsheet outlines retain goals, reading and homework; excess rows cannot disappear', async () => {
  const { defaults, generateLessons } = await import('../dist/course-model.mjs');
  const course = { ...defaults(), weeks: 2 };
  const lessons = generateLessons(course, 'Week 1: The novel\tExplore voice\tChapter 1\tWrite a paragraph\nWeek 2: Evidence');
  assert.equal(lessons[0].title, 'The novel');
  assert.equal(lessons[0].goal, 'Explore voice');
  assert.equal(lessons[0].reading, 'Chapter 1');
  assert.equal(lessons[0].homework, 'Write a paragraph');
  assert.equal(lessons[1].title, 'Evidence');
  assert.throws(() => generateLessons(course, 'one\ntwo\nthree'), /no rows have been discarded/);
});

test('course validation rejects invalid calendar dates, time zones and inconsistent lesson counts', async () => {
  const { defaults, generateLessons, validateCourse, validDate } = await import('../dist/course-model.mjs');
  const course = defaults(); course.lessons = generateLessons(course);
  for (const date of ['2027-02-29', '2027-13-01', '2027-00-01']) assert.equal(validDate(date), false);
  assert.equal(validDate('2028-02-29'), true);
  assert.throws(() => validateCourse({ ...course, weeks: 16 }), /Generate the weekly plan/);
  assert.throws(() => validateCourse({ ...course, timeZone: 'Nowhere' }), /time zone/);
  assert.throws(() => validateCourse({ ...course, lessonMinutes: 0 }), /lesson length/);
  assert.throws(() => validateCourse({ ...course, startDate: '2027-02-30' }), /valid start date/);
});

test('custom weekly frequency retains a partial final week and uses the actual lesson count for teaching hours', async () => {
  const { defaults, generateLessons, validateCourse, courseSummary } = await import('../dist/course-model.mjs');
  const { useFormat } = await import('../dist/course-formats.mjs');
  const course = { ...useFormat(defaults(), 'custom'), lessonCount: 13, weeks: 5, lessonsPerWeek: 3, lessonMinutes: 50, pacing: 'weekly', startDate: '2027-01-04' };
  course.lessons = generateLessons(course);
  assert.equal(course.lessons.length, 13);
  assert.equal(course.lessons.at(-1).week, 5); assert.equal(course.lessons.at(-1).slot, 1);
  assert.equal(course.lessons.at(-1).date, '2027-02-01');
  assert.match(courseSummary(course), /10.8 teaching hours/);
  assert.deepEqual(validateCourse(course), course);
});

test('summer and upper primary formats retain lesson sequences without assuming weekly dates', async () => {
  const { defaults, generateLessons, validateCourse, courseSummary } = await import('../dist/course-model.mjs');
  const { useFormat } = await import('../dist/course-formats.mjs');
  const summer = useFormat(defaults(), 'summer'); summer.lessons = generateLessons(summer);
  assert.equal(summer.lessons.length, 10); assert.equal(summer.lessonMinutes, 90);
  assert.ok(summer.lessons.every(l => l.date === '')); assert.match(courseSummary(summer), /15 teaching hours/);
  const primary = useFormat(defaults(), 'upper-primary'); primary.lessons = generateLessons(primary);
  assert.equal(primary.lessonMinutes, 50); assert.equal(primary.lessons.length, 15);
  assert.match(primary.lessons[0].section, /About the author/);
  assert.match(primary.lessons.at(-1).section, /Section 8/);
  for (let i = 1; i <= 7; i++) assert.ok(primary.lessons.some(l => l.section === `Section ${i}`));
  assert.deepEqual(validateCourse(primary), primary);
  primary.includeWritingActivity = false; primary.lessons = generateLessons(primary);
  assert.equal(primary.lessons.length, 15); assert.ok(primary.lessons.every(l => !l.section.includes('Section 8')));
  assert.throws(() => generateLessons(primary, 'My pasted outline'), /blank content/);
});

test('prepared course files preserve original teaching fields and validate untrusted imported values', async () => {
  const { defaults, generateLessons, readCourseFile } = await import('../dist/course-model.mjs');
  const course = { ...defaults(), themes: 'Theme A', essentialQuestions: 'Whose perspective?', enduringUnderstandings: 'Evidence supports interpretation.', sourceNotes: 'Prepared draft. Review assignments.' };
  course.lessons = generateLessons(course);
  Object.assign(course.lessons[0], { section: 'Section 1', skills: 'Close reading', activities: 'Discussion', evidence: 'Exit ticket', sourcePages: '2–3' });
  assert.deepEqual(readCourseFile({ type: 'inkwire-course', version: 1, course }), course);
  assert.throws(() => readCourseFile({ type: 'other', version: 1, course }), /Ink Wire course file/);
  assert.throws(() => readCourseFile({ type: 'inkwire-course', version: 1, course: { ...course, themes: 'x'.repeat(6001) } }), /themes/);
});
