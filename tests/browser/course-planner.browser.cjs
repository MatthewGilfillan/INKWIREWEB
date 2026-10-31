const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const first = '11111111-1111-4111-8111-111111111111', second = '22222222-2222-4222-8222-222222222222';
test('teacher builds, pastes, saves, reopens and reuses a course overview on desktop and mobile', async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROME_CHANNEL ? {channel: process.env.PLAYWRIGHT_CHROME_CHANNEL} : {}) });
  const context = await browser.newContext(); const page = await context.newPage(), errors = [], storage = new Map();
  let conflict = false;
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/classes') return route.fulfill({ json: { classes: [first,second].map((id,i) => ({ id, name: i ? 'Next term' : 'Rivendell literature', subject: 'Literature & essay writing', membership: 'owner', ...(storage.has(id) ? { overviewRevision: storage.get(id).revision, courseWeeks: storage.get(id).course.weeks, courseFrequency: storage.get(id).course.lessonsPerWeek, courseMinutes: storage.get(id).course.lessonMinutes } : {}) })) } });
    if (path.endsWith('/roster')) return route.fulfill({ json: { students: [] } });
    const match = path.match(/\/classes\/([^/]+)\/overview$/);
    if (match) {
      const id = match[1];
      if (route.request().method() === 'POST') {
        if (conflict) return route.fulfill({ status: 409, json: { message: 'Another teacher saved changes. Your draft is still open.' } });
        const body = route.request().postDataJSON(); storage.set(id, { course: body.course, revision: body.revision + 1 });
      }
      return route.fulfill({ json: storage.get(id) || { course: null, revision: 0 } });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  try {
    await page.goto('http://127.0.0.1:8788/teacher.html');
    await page.locator(`[data-class-id="${first}"]>summary`).click();
    await page.getByRole('button', { name: 'Build course overview' }).first().click();
    await page.locator('#course-form').waitFor({ state: 'visible' });
    assert.equal(await page.locator('[data-plan-lesson]').count(), 15);
    assert.match(await page.locator('#course-summary').innerText(), /30 teaching hours/);
    await page.locator('#course-start').fill('2027-01-06');
    page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Generate weekly plan' }).click();
    assert.equal(await page.locator('#lesson-14-date').inputValue(), '2027-04-14');
    await page.locator('#lesson-0-reading').fill('The Hobbit, chapter 1');
    await page.locator('#course-start').fill('2027-01-13');
    await page.getByRole('button', { name: 'Update lesson dates', exact: true }).click();
    assert.equal(await page.locator('#lesson-0-date').inputValue(), '2027-01-13');
    assert.equal(await page.locator('#lesson-0-reading').inputValue(), 'The Hobbit, chapter 1');
    await page.getByRole('button', { name: 'Save course overview', exact: true }).click();
    await page.getByText('Course overview saved.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Close course overview' }).click();
    await page.reload();
    await page.locator(`[data-class-id="${first}"]>summary`).click();
    await page.getByRole('button', { name: 'Edit course overview' }).click();
    await page.locator('#course-form').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#lesson-0-reading').inputValue(), 'The Hobbit, chapter 1');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#course-lessons').scrollIntoViewIfNeeded();
    await page.locator('.course-planner').screenshot({ path: '/tmp/inkwire-course-weeks.png' });
    await page.getByRole('button', { name: 'Close course overview' }).click();
    await page.locator(`[data-class-id="${second}"]>summary`).click();
    await page.getByRole('button', { name: 'Build course overview' }).click();
    await page.locator('#course-form').waitFor({ state: 'visible' });
    await page.getByText('Copy from another class', { exact: true }).click();
    await page.locator('#copy-course').selectOption(first);
    await page.getByRole('button', { name: 'Use this overview' }).click();
    await page.waitForFunction(() => document.querySelector('#lesson-0-reading').value === 'The Hobbit, chapter 1');
    await page.getByText('Paste an existing outline', { exact: true }).click();
    await page.locator('#course-outline').fill('Week 1: <img src=x onerror=alert(1)>\tNarrative voice\tChapter 2\tWrite one paragraph\nWeek 2: Evidence');
    page.once('dialog', d => d.accept()); await page.getByRole('button', { name: 'Generate weekly plan' }).click();
    assert.equal(await page.locator('#lesson-0-title').inputValue(), '<img src=x onerror=alert(1)>');
    assert.equal(await page.locator('#lesson-0-goal').inputValue(), 'Narrative voice');
    assert.equal(await page.locator('#course-lessons img').count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('.course-planner').evaluate(el => { el.scrollTop = 0; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.equal(await page.locator('.course-planner').evaluate(el => el.scrollWidth <= el.clientWidth), true);
    await page.locator('.course-planner').screenshot({ path: '/tmp/inkwire-course-planner-mobile.png' });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('.course-planner').evaluate(el => { el.scrollTop = 0; });
    await page.locator('.course-planner').screenshot({ path: process.env.TEST_COURSE_SCREENSHOT || '/tmp/inkwire-course-planner.png' });
    conflict = true;
    await page.getByRole('button', { name: 'Save course overview', exact: true }).click();
    await page.locator('.course-planner .form-error').waitFor({ state: 'visible' });
    assert.match(await page.locator('.course-planner .form-error').innerText(), /draft is still open/);
    assert.equal(await page.locator('#lesson-0-homework').inputValue(), 'Write one paragraph');
    const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download outline' }).click();
    assert.equal((await download).suggestedFilename(), 'inkwire-course-overview.txt');
    assert.deepEqual(errors, []);
  } finally { await context.close(); await browser.close(); }
});
