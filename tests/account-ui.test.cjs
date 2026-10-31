const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync('dist/accounts.js', 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });

function fixture({ modal = false, search = '', hash = '', fetch: customFetch } = {}) {
  const handlers = {}, dialogHandlers = {}, fields = {}, calls = [], history = [], redirects = [];
  let openAccount;
  const inert = { focus() {}, setAttribute() {}, classList: { remove() {} } };
  const dialog = modal ? { open: false, setAttribute() {}, querySelector: () => null,
    addEventListener: (name, fn) => { dialogHandlers[name] = fn; }, showModal() { this.open = true; } } : null;
  const root = { html: '', set innerHTML(html) { this.html = html; for (const key of Object.keys(fields)) delete fields[key]; }, get innerHTML() { return this.html; },
    closest: () => dialog, setAttribute() {}, addEventListener: (name, fn) => { handlers[name] = fn; },
    querySelector: selector => fields[selector] || (selector.startsWith('[name=') ? null : inert), querySelectorAll: () => [] };
  const context = { URLSearchParams, AbortSignal, location: { search, hash, pathname: '/account', hostname: 'inkwire-education.com', replace: url => redirects.push(url) },
    history: { replaceState: (_a, _b, url) => history.push(url) },
    FormData: class { constructor(form) { this.values = form.values; } get(k) { return this.values[k] ?? null; } has(k) { return k in this.values; } },
    document: { querySelector: () => root, body: { hasAttribute: () => !modal },
      querySelectorAll: () => modal ? [{ addEventListener: (_name, fn) => { openAccount = fn; }, hasAttribute: () => false }] : [] },
    fetch: async (url, options) => { calls.push({ url, options }); return customFetch ? customFetch(url, options) : response(url === '/api/status' ? { accountsReady: true } : {}, url === '/api/account' ? 401 : 200); } };
  vm.runInNewContext(source, context);
  const click = view => handlers.click({ target: { closest: () => ({ dataset: { view }, hasAttribute: () => false }) } });
  const submit = (action, values) => handlers.submit({ preventDefault() {}, target: { closest: () => ({ dataset: { action }, values, reportValidity: () => true, querySelector: () => ({}) }) } });
  return { root, fields, calls, history, redirects, click, submit, open: () => openAccount({ preventDefault() {} }), close: () => dialogHandlers.close() };
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

test('verified teachers go to their dashboard on sign in and when reopening the account page', async () => {
  const approved = { email: 'teacher@example.invalid', verified: true, role: 'teacher', requestedRole: 'teacher', classroomStatus: 'active', dashboardPath: '/teacher' };
  let signedIn = false;
  const fetch = async url => {
    if (url === '/api/status') return response({ accountsReady: true });
    if (url === '/api/accounts/signin') { signedIn = true; return response({ status: true }); }
    return response(approved, signedIn ? 200 : 401);
  };
  const f = fixture({ fetch }); await flush();
  const rememberInput = f.root.html.match(/<input[^>]*name="rememberMe"[^>]*>/)?.[0];
  assert.ok(rememberInput);
  assert.doesNotMatch(rememberInput, /\bchecked\b/);
  await f.submit('signin', { email: approved.email, password: 'test-only-passphrase', rememberMe: 'on' });
  assert.deepEqual(f.redirects, ['/teacher']);
  assert.equal(JSON.parse(f.calls.find(call => call.url === '/api/accounts/signin').options.body).rememberMe, true);
  const reopened = fixture({ fetch }); await flush();
  assert.deepEqual(reopened.redirects, ['/teacher']);
  const settings = fixture({ fetch, search: '?manage=1' }); await flush();
  assert.deepEqual(settings.redirects, []);
  assert.match(settings.root.html, /Open teacher dashboard/);
  assert.doesNotMatch(settings.root.html, /awaits Matthew/);
  assert.doesNotMatch(settings.root.html, /Back to Ink Wire/); // The page already has its own home link.
});

test('parent accounts stay on their account page; unchecked Remember me sends false', async () => {
  let signedIn = false;
  const f = fixture({ fetch: async url => {
    if (url === '/api/status') return response({ accountsReady: true });
    if (url === '/api/accounts/signin') { signedIn = true; return response({ status: true }); }
    return response({ email: 'pending@example.invalid', verified: true, requestedRole: 'parent', classroomStatus: 'pending' }, signedIn ? 200 : 401);
  } }); await flush();
  await f.submit('signin', { email: 'pending@example.invalid', password: 'test-only-passphrase' });
  assert.deepEqual(f.redirects, []);
  assert.match(f.root.html, /link it to your child/);
  assert.equal(JSON.parse(f.calls.find(call => call.url === '/api/accounts/signin').options.body).rememberMe, false);
});

test('an invitation survives signup, email activation and sign-in without optional browser storage',async()=>{
  const join='family.ABCDEFGHJKLM';
  const f=fixture({search:'?mode=signup',hash:'#join='+join});await flush();
  assert.match(f.root.html,/value="parent" selected/);assert.doesNotMatch(f.root.html,/value="teacher"/);
  f.click('signin');f.click('signup');assert.equal(f.history.at(-1),'/account?mode=signup#join='+join);
  await f.submit('signup',{email:'parent@example.invalid',password:'test-only-passphrase',accountType:'parent'});
  assert.equal(JSON.parse(f.calls.find(c=>c.url==='/api/accounts/signup').options.body).join,join);
  const activated=fixture({hash:'#activate=verification-token&join='+join,fetch:async url=>response(url==='/api/status'?{accountsReady:true}:{verified:true,role:'parent',classroomStatus:'active',dashboardPath:'/parent'})});await flush();
  assert.equal(activated.history[0],'/account#join='+join);await activated.submit('activate',{});await activated.submit('signin',{email:'parent@example.invalid',password:'test-only-passphrase'});
  assert.deepEqual(activated.redirects,['/join#family=ABCDEFGHJKLM']);
  assert.doesNotMatch(source,/localStorage|sessionStorage/);
});

test('verified student and parent accounts open their own dashboards; malicious destinations are rejected',async()=>{
  for(const role of ['student','parent']){
    const f=fixture({fetch:async url=>response(url==='/api/status'?{accountsReady:true}:{verified:true,role,classroomStatus:'active',dashboardPath:'/'+role})});await flush();assert.deepEqual(f.redirects,['/'+role]);
  }
  const f=fixture({hash:'#join=javascript:bad',fetch:async url=>response(url==='/api/status'?{accountsReady:true}:{verified:true,role:'parent',classroomStatus:'active',dashboardPath:'https://evil.invalid'})});await flush();assert.deepEqual(f.redirects,[]);
});
