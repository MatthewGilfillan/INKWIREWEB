import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { PDFDocument, degrees, rgb } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';
const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, '0')).join('');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn) { for (let i = 0; i < 240; i++) { if (await fn()) return; await pause(50); } throw Error('Timed out waiting for browser worksheet'); }
async function text(page) { return (await page.locator('.worksheet-accessible').allTextContents()).join('\n'); }
async function addText(page, message, x = 220, y = 170) {
  await page.locator('[data-tool=text]').click();
  await page.locator('.worksheet-overlay').first().click({ position: { x, y } });
  await page.locator('[data-ws=text-value] .tiptap').fill(message);
  await page.locator('[data-ws=text-form] button[type=submit]').click();
  await until(async () => (await text(page)).includes(message));
}
async function stroke(page, tool, points) {
  await page.locator(`[data-tool=${tool}]`).click();
  const overlay = page.locator('.worksheet-overlay').first();
  await overlay.evaluate(element => window.scrollTo(0, window.scrollY + element.getBoundingClientRect().top - 280));
  const box = await overlay.boundingBox();
  await page.mouse.move(box.x + points[0][0], box.y + points[0][1]); await page.mouse.down();
  for (const p of points.slice(1)) await page.mouse.move(box.x + p[0], box.y + p[1], { steps: 8 });
  await page.mouse.up();
}

test('browser: import, annotation tools, roles, offline sync, zoom, export and editable recovery', { timeout: 120000 }, async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROME_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHROME_CHANNEL } : {}) });
  const teacherContext = await browser.newContext({ viewport: { width: 1280, height: 1000 }, acceptDownloads: true });
  const studentContext = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const viewerContext = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const errors = [];
  const observe = page => page.on('pageerror', error => errors.push(error.message));
  try {
    const creation = await fetch(base + '/api/documents', { method: 'POST', headers: { Authorization: `Bearer ${process.env.TEST_OWNER_KEY || 'local-development-test'}` } });
    const { id, key } = await creation.json();
    const teacher = await teacherContext.newPage(); observe(teacher);
    await teacher.goto(`${base}/?doc=${id}#key=${key}`);
    await teacher.getByRole('tab', { name: 'PDF worksheet' }).click();
    await until(async () => !(await teacher.locator('[data-ws=import]').isDisabled()));
    const pdf = await PDFDocument.create();
    pdf.addPage([600, 800]).drawText('Worksheet: write or draw an answer', { x: 40, y: 750, size: 18 });
    const rotated = pdf.addPage([600, 800]); rotated.setRotation(degrees(90)); rotated.drawRectangle({ x: 30, y: 30, width: 250, height: 250, color: rgb(.9, .95, .9) });
    const bytes = await pdf.save();
    await teacher.locator('[data-ws=file]').setInputFiles({ name: 'browser-worksheet.pdf', mimeType: 'application/pdf', buffer: Buffer.from(bytes) });
    await until(async () => await teacher.locator('.worksheet-page').count() === 2);
    await addText(teacher, 'Clear reasoning ⭐');
    // Select just the first word and apply mixed formatting through the UI.
    await teacher.locator('[data-tool=select]').click();
    await teacher.locator('.worksheet-overlay').first().click({ position: { x: 230, y: 180 } });
    await teacher.locator('[data-ws=edit]').click();
    const textEditor = teacher.locator('[data-ws=text-value] .tiptap'), textToolbar = teacher.locator('[data-ws=text-toolbar]');
    await textEditor.dblclick({ position: { x: 35, y: 30 } });
    assert.equal(await teacher.evaluate(() => window.getSelection().toString()), 'Clear');
    await textToolbar.locator('[data-text=bold]').click();
    await textToolbar.locator('[data-text=underline]').click();
    await textToolbar.locator('[data-text=font]').selectOption('Georgia');
    await textToolbar.locator('[data-text=size]').fill('32'); await textToolbar.locator('[data-text=size]').press('Tab');
    await textToolbar.locator('[data-text=color]').evaluate(input => { input.value = '#9c3152'; input.dispatchEvent(new Event('input', { bubbles: true })); });
    await textToolbar.locator('[data-text=highlight]').click();
    await textToolbar.locator('[data-text=align]').selectOption('center');
    await teacher.locator('[data-ws=box-width]').fill('260');
    if (process.env.TEST_TEXT_SCREENSHOT_PATH) await teacher.locator('[data-ws=text-dialog]').screenshot({ path: process.env.TEST_TEXT_SCREENSHOT_PATH });
    await teacher.locator('[data-ws=text-form] button[type=submit]').click();
    await until(async () => !(await teacher.locator('[data-ws=text-dialog]').isVisible()));
    await teacher.locator('[data-tool=select]').click();
    await teacher.locator('.worksheet-overlay').first().click({ position: { x: 230, y: 180 } });
    await stroke(teacher, 'select', [[441, 211], [501, 211]]);
    await stroke(teacher, 'pen', [[80, 80], [120, 110], [170, 80]]);
    await until(async () => (await text(teacher)).includes('teacher: pen'));
    await stroke(teacher, 'marker', [[80, 130], [180, 130]]);
    await stroke(teacher, 'rectangle', [[350, 80], [450, 140]]);
    await stroke(teacher, 'arrow', [[350, 220], [450, 280]]);
    await until(async () => (await text(teacher)).includes('teacher: arrow'));
    await teacher.locator('[data-ws=undo]').click(); await until(async () => !(await text(teacher)).includes('teacher: arrow'));
    await teacher.locator('[data-ws=redo]').click(); await until(async () => (await text(teacher)).includes('teacher: arrow'));
    // Lasso the pen stroke, move it, and erase it at its new position.
    await stroke(teacher, 'lasso', [[60, 60], [190, 60], [190, 120], [60, 120], [60, 60]]);
    assert.equal(await teacher.locator('[data-ws=delete]').isDisabled(), false);
    await stroke(teacher, 'select', [[120, 100], [150, 300]]);
    await stroke(teacher, 'eraser', [[110, 280], [150, 300], [200, 280]]);
    await until(async () => !(await text(teacher)).includes('teacher: pen'));
    await teacher.locator('[data-ws=undo]').click(); await until(async () => (await text(teacher)).includes('teacher: pen'));
    await teacher.getByRole('tab', { name: 'Document', exact: true }).click();
    const documentEditor = teacher.locator('[aria-label="Document content"]'), documentToolbar = teacher.locator('#document-text-controls');
    await documentEditor.fill('A formatted document'); await documentEditor.press('ControlOrMeta+A');
    await documentToolbar.locator('[data-text=font]').selectOption('Georgia');
    await documentToolbar.locator('[data-text=size]').fill('24'); await documentToolbar.locator('[data-text=size]').press('Tab');
    await documentToolbar.locator('[data-text=align]').selectOption('right');
    await documentToolbar.locator('[data-text=highlight]').click();
    assert.ok((await documentEditor.locator('p').getAttribute('style')).includes('text-align: right'));
    assert.ok((await documentEditor.locator('span').first().getAttribute('style')).includes('font-family: Georgia'));
    await teacher.getByRole('tab', { name: 'PDF worksheet' }).click();
    const studentKey = await digest(`${key}:student`), viewerKey = await digest(`${key}:viewer`);
    const student = await studentContext.newPage(), viewer = await viewerContext.newPage(); observe(student); observe(viewer);
    await student.goto(`${base}/?doc=${id}#key=${studentKey}`); await viewer.goto(`${base}/?doc=${id}#key=${viewerKey}`);
    for (const page of [student, viewer]) { await page.getByRole('tab', { name: 'PDF worksheet' }).click(); await until(async () => await page.locator('.worksheet-page').count() === 2); }
    await until(async () => (await text(viewer)).includes('Clear reasoning ⭐'));
    assert.equal(await student.locator('[data-ws=import]').isDisabled(), true);
    assert.equal(await viewer.locator('[data-tool=pen]').isDisabled(), true);
    assert.equal(await viewer.locator('#title').isDisabled(), true);
    await viewer.getByRole('tab', { name: 'Document', exact: true }).click();
    await until(async () => (await viewer.locator('[aria-label="Document content"]').textContent()).includes('A formatted document'));
    assert.equal(await viewer.locator('#document-text-controls [data-text=font]').isDisabled(), true);
    await viewer.getByRole('tab', { name: 'PDF worksheet' }).click();
    await addText(student, 'My answer is 42.', 220, 350);
    await until(async () => (await text(teacher)).includes('My answer is 42.'));
    await student.locator('[data-ws=show-teacher]').uncheck();
    assert.equal((await text(student)).includes('Clear reasoning ⭐'), false);
    await student.locator('[data-ws=show-teacher]').check();
    await studentContext.setOffline(true);
    await until(async () => (await student.locator('[data-ws=status]').textContent()).includes('Offline'));
    await addText(student, 'Offline addition', 220, 450);
    await until(async () => (await student.locator('[data-ws=status]').textContent()).includes('waiting to sync'));
    await addText(teacher, 'Feedback while student is offline', 220, 540);
    await studentContext.setOffline(false);
    await until(async () => (await text(teacher)).includes('Offline addition') && (await text(student)).includes('Feedback while student is offline'));
    await until(async () => (await student.locator('[data-ws=status]').textContent()).includes('Annotations saved'));
    await student.reload(); await student.getByRole('tab', { name: 'PDF worksheet' }).click();
    await until(async () => (await text(student)).includes('Offline addition'));
    // Zoom changes display dimensions without changing annotation coordinates.
    const width = (await teacher.locator('.worksheet-overlay').first().boundingBox()).width;
    await teacher.locator('[data-ws=zoom]').selectOption('1.5');
    await until(async () => (await teacher.locator('.worksheet-overlay').first().boundingBox()).width > width * 1.4);
    assert.ok((await text(teacher)).includes('Clear reasoning ⭐'));
    await teacher.locator('[data-ws=zoom]').selectOption('1');
    const exported = teacher.waitForEvent('download'); await teacher.locator('[data-ws=export]').click();
    const pdfDownload = await exported, marked = await PDFDocument.load(await readFile(await pdfDownload.path()));
    assert.equal(marked.getPageCount(), 2); assert.equal(marked.getPage(1).getWidth(), 800); assert.equal(marked.getPage(1).getHeight(), 600);
    const backupEvent = teacher.waitForEvent('download'); await teacher.locator('[data-ws=backup]').click();
    const backupDownload = await backupEvent, backup = await readFile(await backupDownload.path());
    const saved = JSON.parse(backup); assert.equal(saved.format, 'inkwire-worksheet-v1');
    assert.ok(Object.values(saved.records).some(r => r.value?.text === 'Offline addition'));
    const formatted = Object.values(saved.records).find(r => r.value?.text === 'Clear reasoning ⭐').value;
    assert.ok(formatted.boxWidth > 320, 'text box resize handle changes the stored width');
    assert.equal(formatted.rich[0].align, 'center');
    assert.ok(formatted.rich.flatMap(block => block.runs).some(run => run.text === 'Clear' && run.bold && run.underline && run.fontFamily === 'Georgia' && run.fontSize === 32 && run.color === '#9c3152' && run.highlight === '#fff59d'));
    assert.ok(formatted.rich.flatMap(block => block.runs).some(run => run.text.includes('reasoning') && !run.bold && run.fontFamily === 'Arial'));
    const local = await teacherContext.newPage(); observe(local); await local.goto(base); await local.getByRole('tab', { name: 'PDF worksheet' }).click();
    await local.locator('[data-ws=backup-file]').setInputFiles({ name: 'worksheet.inkwire.json', mimeType: 'application/json', buffer: backup });
    await until(async () => (await text(local)).includes('Offline addition'));
    await local.reload(); await local.getByRole('tab', { name: 'PDF worksheet' }).click();
    await until(async () => (await text(local)).includes('Clear reasoning ⭐'));
    await teacher.locator('.worksheet-page').first().scrollIntoViewIfNeeded();
    if (process.env.TEST_SCREENSHOT_PATH) await teacher.screenshot({ path: process.env.TEST_SCREENSHOT_PATH, fullPage: false });
    // Narrow screens keep controls accessible and scroll PDF pages inside the viewport.
    await local.setViewportSize({ width: 390, height: 844 });
    await local.locator('[data-ws=zoom]').selectOption('1');
    await until(async () => (await local.locator('.worksheet-page').first().boundingBox()).width <= 390);
    assert.equal(await local.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
    assert.deepEqual(errors, []);
  } catch (error) {
    console.error('Browser errors:', errors);
    for (const page of [...teacherContext.pages(), ...studentContext.pages(), ...viewerContext.pages()]) {
      console.error('Worksheet status:', await page.locator('[data-ws=status]').textContent().catch(() => 'unavailable'));
      console.error('Notice:', await page.locator('#toast').textContent().catch(() => 'unavailable'));
      console.error('Page count / annotations:', await page.locator('.worksheet-page').count(), await text(page));
      if (process.env.TEST_SCREENSHOT_PATH) await page.screenshot({ path: process.env.TEST_SCREENSHOT_PATH }).catch(() => {});
    }
    throw error;
  } finally { await browser.close(); }
});
