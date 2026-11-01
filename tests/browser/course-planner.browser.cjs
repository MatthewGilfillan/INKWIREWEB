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
    await page.locator('#selected-class').selectOption(first);
    await page.getByRole('tab', {name:'Course overview',exact:true}).click();
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
    await page.getByRole('tab',{name:'Students',exact:true}).click();
    await page.reload();
    await page.locator('#selected-class').selectOption(first);
    await page.getByRole('tab', {name:'Course overview',exact:true}).click();
    await page.locator('#course-form').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#lesson-0-reading').inputValue(), 'The Hobbit, chapter 1');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#course-lessons').scrollIntoViewIfNeeded();
    await page.locator('.course-planner').screenshot({ path: '/tmp/inkwire-course-weeks.png' });
    await page.getByRole('tab',{name:'Students',exact:true}).click();
    await page.locator('#selected-class').selectOption(second);
    await page.getByRole('tab', {name:'Course overview',exact:true}).click();
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

test('custom timetable, primary sections and prepared course files retain their structure', async () => {
  const { defaults, generateLessons } = await import('../../dist/course-model.mjs');
  const { useFormat } = await import('../../dist/course-formats.mjs');
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROME_CHANNEL ? {channel: process.env.PLAYWRIGHT_CHROME_CHANNEL} : {}) });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } }); const errors = []; let saved = null, posts = 0;
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/classes') return route.fulfill({ json: { classes: [{id:first,name:'A new class',membership:'owner'}] } });
    if (path.endsWith('/roster')) return route.fulfill({ json: {students:[]} });
    if (path.endsWith('/overview')) {
      if (route.request().method() === 'POST') { posts++; saved = route.request().postDataJSON().course; }
      return route.fulfill({ json: {course:saved,revision:saved?1:0} });
    }
    return route.fulfill({ status:404,json:{} });
  });
  try {
    await page.goto('http://127.0.0.1:8788/teacher.html');
    await page.locator('#selected-class').selectOption(first);
    await page.getByRole('tab', {name:'Course overview',exact:true}).click();
    await page.locator('#course-form').waitFor({state:'visible'});
    await page.locator('#course-format').selectOption('custom');
    await page.locator('#course-weeks').fill('13'); await page.locator('#course-frequency').fill('3');
    await page.locator('#course-minutes').fill('45'); await page.locator('#course-start').fill('2027-01-04');
    page.once('dialog',d=>d.accept()); await page.getByRole('button',{name:'Generate weekly plan'}).click();
    assert.equal(await page.locator('[data-plan-lesson]').count(),13);
    assert.equal(await page.locator('#lesson-12-date').inputValue(),'2027-02-01');
    assert.match(await page.locator('#course-summary').textContent(),/5 weeks · 3 lessons\/week · 45 min · 9.8 teaching hours/);
    await page.locator('#course-format').selectOption('upper-primary');
    assert.equal(await page.locator('#course-minutes').inputValue(),'50');
    assert.equal(await page.locator('#course-weeks').inputValue(),'15');
    assert.equal(await page.locator('#course-frequency').isVisible(),false);
    page.once('dialog',d=>d.accept()); await page.getByRole('button',{name:'Generate weekly plan'}).click();
    assert.equal(await page.locator('[data-plan-lesson]').count(),15);
    assert.equal(await page.locator('#lesson-0-section').inputValue(),'About the author · pre-reading');
    assert.equal(await page.locator('#lesson-14-section').inputValue(),'Section 8 · writing activity');
    await page.locator('[name=includeWritingActivity]').uncheck();
    page.once('dialog',d=>d.accept()); await page.getByRole('button',{name:'Generate weekly plan'}).click();
    assert.equal(await page.locator('#lesson-14-section').inputValue(),'Section 7');
    const imported=useFormat(defaults('Prepared summer unit'),'summer'); imported.lessons=generateLessons(imported);
    imported.themes='<img src=x onerror=alert(1)> A theme'; imported.sourceNotes='Source draft; dates are unconfirmed.';
    Object.assign(imported.lessons[4],{activities:'First part. Continued on next page.',skills:'Close reading',evidence:'A revised paragraph',sourcePages:'2–3'});
    await page.getByText('Open a prepared course file',{exact:true}).click();
    page.once('dialog',d=>d.accept());
    await page.locator('#course-file').setInputFiles({name:'summer.inkwire-course.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({type:'inkwire-course',version:1,course:imported}))});
    await page.waitForFunction(()=>document.querySelector('#course-title').value==='Prepared summer unit');
    assert.equal(posts,0,'opening a file does not upload or save it');
    assert.match(await page.locator('#course-summary').textContent(),/10 lessons · dates to arrange · 90 min · 15 teaching hours/);
    assert.equal(await page.locator('#lesson-4-activities').inputValue(),'First part. Continued on next page.');
    assert.equal(await page.locator('.course-planner img').count(),0);
    await page.getByRole('button',{name:'Save course overview',exact:true}).click();
    await page.getByText('Course overview saved.',{exact:true}).waitFor();
    assert.equal(saved.lessons[4].evidence,'A revised paragraph'); assert.equal(saved.themes,imported.themes);
    await page.locator('#course-format').selectOption('custom');
    await page.locator('#course-pacing').selectOption('weekly'); await page.locator('#course-frequency').fill('2');
    await page.locator('#course-start').fill('2027-01-04'); await page.getByRole('button',{name:'Update lesson dates'}).click();
    assert.equal(await page.locator('#lesson-9-date').inputValue(),'2027-02-04');
    assert.equal(await page.locator('#lesson-4-activities').inputValue(),'First part. Continued on next page.');
    const downloading=page.waitForEvent('download'); await page.getByRole('button',{name:'Save course file',exact:true}).click();
    const download=await downloading;
    const roundtrip=JSON.parse(require('node:fs').readFileSync(await download.path(),'utf8'));
    assert.equal(roundtrip.course.lessonCount,10); assert.equal(roundtrip.course.lessonsPerWeek,2); assert.equal(roundtrip.course.lessons[4].sourcePages,'2–3');
    await page.setViewportSize({width:390,height:844}); await page.locator('.course-planner').evaluate(el=>{el.scrollTop=0});
    assert.equal(await page.locator('.course-planner').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
    await page.locator('.course-planner').screenshot({path:'/tmp/inkwire-custom-course-mobile.png'});
    await page.setViewportSize({width:1440,height:1000}); await page.locator('.course-planner').evaluate(el=>{el.scrollTop=0});
    await page.locator('.course-planner').screenshot({path:'/tmp/inkwire-custom-course.png'});
    if(process.env.TEST_PRIVATE_COURSE_DIR) {
      for (const file of require('node:fs').readdirSync(process.env.TEST_PRIVATE_COURSE_DIR).filter(f=>f.endsWith('.inkwire-course.json'))) {
        const data=JSON.parse(require('node:fs').readFileSync(require('node:path').join(process.env.TEST_PRIVATE_COURSE_DIR,file),'utf8'));
        page.once('dialog',d=>d.accept());
        const chooser=page.locator('#course-file'); await chooser.setInputFiles(require('node:path').join(process.env.TEST_PRIVATE_COURSE_DIR,file));
        await page.waitForFunction(title=>document.querySelector('#course-title').value===title,data.course.title);
        assert.equal(await page.locator('[data-plan-lesson]').count(),data.course.lessons.length);
        for (let i=0;i<data.course.lessons.length;i++) for(const key of ['title','goal','homework','skills','activities','evidence','sourcePages']) {
          if(data.course.lessons[i][key]!==undefined) assert.equal(await page.locator(`#lesson-${i}-${key}`).inputValue(),data.course.lessons[i][key]);
        }
      }
    }
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
});
