import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn) { for (let i = 0; i < 200; i++) { if (await fn()) return; await sleep(50); } throw Error('Timed out waiting for review/clipboard UI'); }
const digest = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, '0')).join('');
async function paste(locator, html, text) {
  await locator.focus();
  await locator.evaluate((element, data) => {
    const clipboard = new DataTransfer(); clipboard.setData('text/html', data.html); clipboard.setData('text/plain', data.text);
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: clipboard, bubbles: true, cancelable: true }));
  }, { html, text });
}
async function settled(page) {
  await until(async () => (await page.locator('#status').textContent()).includes('All changes saved') && !(await page.locator('[data-ws=status]').textContent()).includes('saving'));
}

test('browser: external paste, plain paste, add/update labels and submit/feedback cycle', { timeout: 90000 }, async () => {
  const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROME_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHROME_CHANNEL } : {}) });
  const errors = [], teacherContext = await browser.newContext({ viewport: { width: 1280, height: 1000 } }), studentContext = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
  const teacher = await teacherContext.newPage(), student = await studentContext.newPage();
  for (const page of [teacher, student]) page.on('pageerror', error => errors.push(error.message));
  try {
    const response = await fetch(base + '/api/documents', { method: 'POST', headers: { Authorization: `Bearer ${process.env.TEST_OWNER_KEY || 'local-development-test'}` } });
    const { id, key } = await response.json();
    await teacher.goto(`${base}/?doc=${id}#key=${key}`);
    await until(async () => !(await teacher.locator('#title').isDisabled()));
    const studentKey = await digest(`${key}:student`); await student.goto(`${base}/?doc=${id}#key=${studentKey}`);
    const docEditor = student.locator('[aria-label="Document content"]');
    await until(async () => await docEditor.getAttribute('contenteditable') === 'true');
    let remoteImage = false; student.on('request', request => { if (request.url().includes('clipboard-image.example')) remoteImage = true; });
    await paste(docEditor, '<p><span style="font-family:Calibri;font-size:11pt;color:red">From <strong>another window</strong></span></p><ol><li>First point</li><li>Second point</li></ol><script>window.clipboardUnsafe=true</script><img src="https://clipboard-image.example/image.png">', 'From another window\nFirst point\nSecond point');
    assert.equal(await docEditor.locator('strong').textContent(), 'another window');
    assert.equal(await docEditor.locator('ol li').count(), 2);
    assert.equal(await docEditor.locator('img,script').count(), 0);
    assert.equal(await student.evaluate(() => window.clipboardUnsafe), undefined);
    await student.locator('#document-text-controls [data-text=plain-paste]').check();
    await docEditor.press('ControlOrMeta+A');
    await paste(docEditor, '<p><strong>Plain pasted answer</strong></p>', 'Plain pasted answer\nA second paragraph');
    assert.ok((await docEditor.textContent()).includes('Plain pasted answer'));
    assert.equal(await docEditor.locator('strong').count(), 0);
    await student.locator('#document-text-controls [data-text=plain-paste]').uncheck();
    const longText = 'A longer pasted paragraph. '.repeat(130);
    await docEditor.press('ControlOrMeta+A'); await paste(docEditor, '', longText);
    assert.ok((await docEditor.textContent()).length > 2000);
    // Import a worksheet, then paste directly onto the focused PDF canvas.
    await teacher.getByRole('tab', { name: 'PDF worksheet' }).click();
    const pdf = await PDFDocument.create(); pdf.addPage([600, 800]).drawText('Clipboard and submission exercise');
    await teacher.locator('[data-ws=file]').setInputFiles({ name: 'exercise.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await pdf.save()) });
    await student.getByRole('tab', { name: 'PDF worksheet' }).click();
    await until(async () => await student.locator('.worksheet-page').count() === 1);
    await paste(student.locator('.worksheet-overlay'), '<p><span style="font-family:Calibri;font-size:12pt;color:blue">Pasted <b>PDF answer</b></span></p><ul><li>With evidence</li></ul>', 'Pasted PDF answer\nWith evidence');
    await until(async () => await student.locator('[data-ws=text-dialog]').isVisible());
    const textEditor = student.locator('[data-ws=text-value] .tiptap');
    assert.equal(await textEditor.locator('strong').textContent(), 'PDF answer');
    assert.equal(await textEditor.locator('ul li').count(), 1);
    await student.getByRole('button', { name: 'Add to worksheet', exact: true }).click();
    await until(async () => (await student.locator('.worksheet-accessible').textContent()).includes('Pasted PDF answer'));
    assert.equal(await student.locator('[data-review=status]').textContent(), 'Draft · not submitted', 'adding text does not submit the assignment');
    // The toolbar Paste button offers a keyboard fallback when read permission is unavailable.
    await student.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { read: async () => { throw Error('Permission denied'); }, readText: async () => { throw Error('Permission denied'); } } }));
    await student.getByRole('button', { name: 'Paste text onto page', exact: true }).click();
    await student.locator('.clipboard-dialog textarea').fill('Pasted using the fallback');
    await student.locator('.clipboard-dialog').getByRole('button', { name: 'Insert text' }).click();
    assert.ok((await textEditor.textContent()).includes('Pasted using the fallback'));
    await student.getByRole('button', { name: 'Add to worksheet', exact: true }).click();
    await settled(student);
    await teacher.locator('[data-review=deadline]').fill('2020-01-01T12:00');
    await teacher.getByRole('button', { name: 'Save deadline', exact: true }).click();
    await until(async () => (await student.locator('[data-review=deadline-label]').textContent()).includes('2020'));
    await student.getByRole('button', { name: 'Submit work', exact: true }).click();
    await until(async () => (await student.locator('[data-review=status]').textContent()).startsWith('Submitted'));
    assert.match(await student.locator('[data-review=status]').textContent(), /Submitted late/);
    assert.equal(await student.locator('[data-review=late-note]').isVisible(), true);
    assert.equal(await student.locator('[data-tool=pen]').isDisabled(), true);
    assert.equal(await docEditor.getAttribute('contenteditable'), 'false');
    assert.equal(await student.locator('#document-text-controls [data-text=paste]').isDisabled(), true);
    assert.equal(await student.getByRole('button', { name: 'Submitted', exact: true }).isDisabled(), true);
    await until(async () => await teacher.locator('[data-review=teacher]').isVisible());
    const feedback = 'Good explanation.\nPlease add one quotation as evidence.';
    await teacher.locator('[data-review=feedback]').fill(feedback);
    await teacher.getByRole('button', { name: 'Save feedback draft', exact: true }).click();
    await until(async () => !(await teacher.locator('[data-review=save]').isDisabled()));
    assert.equal(await student.locator('[data-review=published]').isVisible(), false);
    await teacher.getByRole('button', { name: 'Return feedback', exact: true }).click();
    await until(async () => (await student.locator('[data-review=status]').textContent()).startsWith('Feedback returned'));
    assert.equal(await student.locator('[data-review=comment]').textContent(), feedback);
    assert.equal(await student.locator('[data-tool=pen]').isDisabled(), false);
    assert.equal(await docEditor.getAttribute('contenteditable'), 'true');
    await settled(student);
    await student.getByRole('button', { name: 'Resubmit work', exact: true }).click();
    await until(async () => (await student.locator('[data-review=status]').textContent()).includes('attempt 2'));
    assert.equal(remoteImage, false, 'pasted images are not fetched');
    assert.deepEqual(errors, []);
    if (process.env.TEST_SUBMISSION_SCREENSHOT_PATH) await student.locator('#submission').screenshot({ path: process.env.TEST_SUBMISSION_SCREENSHOT_PATH });
  } catch (error) {
    console.error('Browser errors:', errors);
    for (const page of [teacher, student]) console.error('Review/notice:', await page.locator('[data-review=status]').textContent().catch(() => 'unavailable'), await page.locator('#toast').textContent().catch(() => 'unavailable'));
    throw error;
  } finally { await browser.close(); }
});
