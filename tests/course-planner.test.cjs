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
