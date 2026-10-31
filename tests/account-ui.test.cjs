const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync('dist/accounts.js', 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });

function fixture({ modal = false, search = '', hash = '', fetch: customFetch } = {}) {
  const handlers = {}, dialogHandlers = {}, fields = {}, calls = [], history = [];
  let openAccount;
  const inert = { focus() {}, setAttribute() {}, classList: { remove() {} } };
  const dialog = modal ? { open: false, setAttribute() {}, querySelector: () => null,
    addEventListener: (name, fn) => { dialogHandlers[name] = fn; }, showModal() { this.open = true; } } : null;
  const root = { html: '', set innerHTML(html) { this.html = html; for (const key of Object.keys(fields)) delete fields[key]; }, get innerHTML() { return this.html; },
    closest: () => dialog, setAttribute() {}, addEventListener: (name, fn) => { handlers[name] = fn; },
    querySelector: selector => fields[selector] || (selector.startsWith('[name=') ? null : inert), querySelectorAll: () => [] };
  const context = { URLSearchParams, AbortSignal, location: { search, hash, pathname: '/account', hostname: 'inkwire-education.com' },
    history: { replaceState: (_a, _b, url) => history.push(url) },
    FormData: class { constructor(form) { this.values = form.values; } get(k) { return this.values[k] ?? null; } has(k) { return k in this.values; } },
    document: { querySelector: () => root, body: { hasAttribute: () => !modal },
      querySelectorAll: () => modal ? [{ addEventListener: (_name, fn) => { openAccount = fn; }, hasAttribute: () => false }] : [] },
    fetch: async (url, options) => { calls.push({ url, options }); return customFetch ? customFetch(url, options) : response(url === '/api/status' ? { accountsReady: true } : {}, url === '/api/account' ? 401 : 200); } };
  vm.runInNewContext(source, context);
  const click = view => handlers.click({ target: { closest: () => ({ dataset: { view }, hasAttribute: () => false }) } });
  const submit = (action, values) => handlers.submit({ preventDefault() {}, target: { closest: () => ({ dataset: { action }, values, reportValidity: () => true, querySelector: () => ({}) }) } });
  return { root, fields, calls, history, click, submit, open: () => openAccount({ preventDefault() {} }), close: () => dialogHandlers.close() };
}

test('signup deep link survives readiness checks; switching keeps email and selected account type', async () => {
  const f = fixture({ search: '?mode=signup' }); await flush();
  assert.match(f.root.html, /data-action="signup"/);
  f.fields['[name="email"]'] = { value: ' parent@example.invalid ' };
  f.fields['[name="accountType"]'] = { value: 'parent' };
  f.click('signin'); f.click('signup');
  assert.match(f.root.html, /value="parent@example.invalid"/);
  assert.match(f.root.html, /value="parent" selected/);
  assert.equal(f.history.at(-1), '/account?mode=signup');
});

test('unavailable accounts show a disabled form and cannot send credentials', async () => {
  const f = fixture({ fetch: async () => response({ accountsReady: false }) }); await flush();
  f.click('signup');
  assert.match(f.root.html, /<fieldset disabled>/);
  await f.submit('signup', { email: 'test@example.invalid', password: 'test-only-passphrase', accountType: 'student' });
  assert.equal(f.calls.length, 1);
});

test('closing and reopening the modal ignores an older registration result', async () => {
  let finish;
  const f = fixture({ modal: true, fetch: async url => {
    if (url === '/api/accounts/signup') return new Promise(resolve => { finish = resolve; });
    return response(url === '/api/status' ? { accountsReady: true } : {}, url === '/api/account' ? 401 : 200);
  } });
  f.open(); await flush(); f.click('signup');
  const pending = f.submit('signup', { email: 'test@example.invalid', password: 'test-only-passphrase', accountType: 'student' });
  f.close(); f.open(); await flush();
  finish(response({ status: true })); await pending;
  assert.match(f.root.html, /data-action="signin"/);
  assert.doesNotMatch(f.root.html, /registration request was received/);
});

test('activation token is removed from the address bar and waits for an explicit action', async () => {
  const f = fixture({ hash: '#activate=test-only-token' }); await flush();
  assert.equal(f.history[0], '/account');
  assert.match(f.root.html, /data-action="activate"/);
  assert.equal(f.calls.length, 1);
});
