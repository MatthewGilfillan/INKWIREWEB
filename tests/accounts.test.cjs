const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { readFileSync } = require('node:fs');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const ORIGIN = 'https://inkwire-education.com';
const EMAIL = 'learner@example.invalid';
const PASSWORD = 'An original test passphrase 42!';

async function fixture() {
  const { default: worker } = await import('../cloudflare/worker.mjs');
  const db = new DatabaseSync(':memory:');
  for (const name of ['0001_auth.sql', '0002_account_access.sql', '0003_teacher_access.sql']) db.exec(readFileSync(path.join(__dirname, '../cloudflare/migrations', name), 'utf8'));
  const DB = { prepare(sql) {
    const statement = db.prepare(sql); let args = [];
    return { bind(...values) { args = values; return this; }, async run() { return statement.run(...args); }, async first() { return statement.get(...args) || null; }, async all() { return { results: statement.all(...args) }; } };
  } };
  const mail = [];
  const env = { DB, AUTH_DB: db, APP_ORIGIN: ORIGIN, ACCOUNT_EMAIL: 'accounts@inkwire-education.com', ACCOUNTS_ENABLED: 'true', BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    EMAIL: { async send(message) { mail.push(message); return { messageId: 'test-mail-only' }; } },
    ASSETS: { async fetch(request) { return new Response(readFileSync(path.join(__dirname, new URL(request.url).pathname === '/teacher' ? '../dist/teacher.html' : '../dist/account.html'), 'utf8')); } },
  };
  const request = (route, body, extra = {}) => worker.fetch(new Request(ORIGIN + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'cf-connecting-ip': '192.0.2.10', ...extra },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }), env);
  const post = (action, body = {}, extra) => request('/api/accounts/' + action, body, extra);
  const token = mode => new URL(mail.at(-1).text.match(/https:\/\/\S+/)[0]).hash.slice(1).split('=')[1];
  const signup = () => post('signup', { email: EMAIL, password: PASSWORD, accountType: 'student' });
  const activate = () => post('activate', { token: decodeURIComponent(token('activate')) });
  const cookie = response => response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
  return { db, env, mail, request, post, token, signup, activate, cookie };
}

test('account creation, one-use activation, secure sign in, and sign out', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.request('/api/status')).status, 200);
    const created = await f.post('signup', { email: '  LEARNER@example.invalid  ', password: PASSWORD, accountType: 'teacher', role: 'teacher', name: '<script>bad()</script>', callbackURL: 'https://evil.invalid' });
    assert.equal(created.status, 200, await created.clone().text());
    assert.equal(created.headers.get('Set-Cookie'), null);
    assert.equal(f.mail.length, 1);
    assert.equal(f.mail[0].to, EMAIL);
    assert.equal(f.mail[0].from.email, 'accounts@inkwire-education.com');
    assert.ok(f.mail[0].text.includes(ORIGIN + '/account.html#activate='));
    assert.ok(!f.mail[0].text.includes('evil.invalid'));
    const user = f.db.prepare('SELECT * FROM user').get();
    assert.equal(user.name, 'Ink Wire member');
    assert.equal(user.emailVerified, 0);
    assert.equal(user.requestedRole, 'teacher');
    assert.notEqual(f.db.prepare('SELECT password FROM account').get().password, PASSWORD);
    assert.equal((await f.post('signin', { email: EMAIL, password: PASSWORD })).status, 403);
    const activation = decodeURIComponent(f.token());
    assert.equal((await f.request('/account.html')).headers.get('Location'), ORIGIN + '/account');
    assert.equal((await f.request('/account')).status, 200);
    assert.equal(f.db.prepare('SELECT emailVerified FROM user').get().emailVerified, 0);
    assert.equal((await f.post('activate', { token: activation })).status, 200);
    assert.equal((await f.post('activate', { token: activation })).status, 400);
    const signedIn = await f.post('signin', { email: EMAIL, password: PASSWORD });
    assert.equal(signedIn.status, 200, await signedIn.clone().text());
    assert.deepEqual(await signedIn.clone().json(), { status: true });
    assert.match(signedIn.headers.get('Set-Cookie'), /HttpOnly/i);
    assert.match(signedIn.headers.get('Set-Cookie'), /Secure/);
    assert.match(signedIn.headers.get('Set-Cookie'), /SameSite=Lax/i);
    const cookies = f.cookie(signedIn);
    const account = await f.request('/api/account', undefined, { Cookie: cookies });
    assert.deepEqual(await account.json(), { email: EMAIL, verified: true, requestedRole: 'teacher', classroomStatus: 'active', role: 'teacher', dashboardPath: '/teacher' });
    assert.equal((await f.request('/api/auth/get-session', undefined, { Cookie: cookies })).status, 404);
    assert.equal((await f.post('signout', {}, { Cookie: cookies })).status, 200);
    assert.equal((await f.request('/api/account', undefined, { Cookie: cookies })).status, 401);
  } finally { f.db.close(); }
});

test('password reset is single-use, invalidates old sessions, and replaces the password', async () => {
  const f = await fixture();
  try {
    await f.signup(); await f.activate();
    const login = await f.post('signin', { email: EMAIL, password: PASSWORD });
    const cookie = f.cookie(login);
    const forgot = await f.post('forgot', { email: EMAIL, redirectTo: 'https://evil.invalid' });
    assert.equal(forgot.status, 200, await forgot.clone().text());
    const token = decodeURIComponent(f.token());
    assert.ok(f.mail.at(-1).text.includes('#reset='));
    assert.ok(!JSON.stringify(f.db.prepare('SELECT * FROM verification').all()).includes(token));
    const newPassword = 'A completely different test password 99!';
    assert.equal((await f.post('reset', { token, newPassword })).status, 200);
    assert.equal((await f.post('reset', { token, newPassword })).status, 400);
    assert.equal((await f.request('/api/account', undefined, { Cookie: cookie })).status, 401);
    assert.equal((await f.post('signin', { email: EMAIL, password: PASSWORD })).status, 401);
    assert.equal((await f.post('signin', { email: EMAIL, password: newPassword })).status, 200);
  } finally { f.db.close(); }
});

test('account type is required and duplicate signup cannot change an existing preference', async () => {
  const f = await fixture();
  try {
    for (const accountType of [undefined, 'admin']) {
      const rejected = await f.post('signup', { email: EMAIL, password: PASSWORD, accountType });
      assert.equal(rejected.status, 400);
      assert.equal((await rejected.json()).code, 'INVALID_ACCOUNT_TYPE');
    }
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM user').get().n, 0);
    assert.equal((await f.post('signup', { email: EMAIL, password: PASSWORD, accountType: 'parent' })).status, 200);
    assert.equal((await f.post('signup', { email: EMAIL, password: PASSWORD, accountType: 'teacher' })).status, 200);
    assert.equal(f.db.prepare('SELECT requestedRole FROM user').get().requestedRole, 'parent');
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM user').get().n, 1);
  } finally { f.db.close(); }
});

test('account links follow the Static Assets canonical URL without a redirect loop', async () => {
  const f = await fixture();
  try {
    f.env.ASSETS.fetch = async request => new URL(request.url).pathname === '/account.html'
      ? Response.redirect(ORIGIN + '/account', 307)
      : new Response('<title>Your account</title>');
    const entry = await f.request('/account.html');
    assert.equal(entry.status, 302);
    assert.equal(entry.headers.get('Location'), ORIGIN + '/account');
    const signupEntry = await f.request('/account.html?mode=signup');
    assert.equal(signupEntry.headers.get('Location'), ORIGIN + '/account?mode=signup');
    const canonical = await f.request('/account');
    assert.equal(canonical.status, 200);
    assert.equal(canonical.headers.get('Cache-Control'), 'no-store');
    assert.match(canonical.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
  } finally { f.db.close(); }
});

test('expired links and unverified access are rejected; unknown reset requests are private', async () => {
  const f = await fixture();
  try {
    await f.signup();
    const token = decodeURIComponent(f.token());
    f.db.prepare('UPDATE activation_links SET expires_at = 0').run();
    assert.equal((await f.post('activate', { token })).status, 400);
    assert.equal((await f.request('/api/account')).status, 401);
    const before = f.mail.length;
    assert.equal((await f.post('forgot', { email: 'unknown@example.invalid' })).status, 200);
    assert.equal(f.mail.length, before);
    await f.post('forgot', { email: EMAIL });
    const reset = decodeURIComponent(f.token());
    f.db.prepare('UPDATE verification SET expiresAt = 0').run();
    assert.equal((await f.post('reset', { token: reset, newPassword: PASSWORD })).status, 400);
    assert.equal(f.db.prepare('SELECT emailVerified FROM user').get().emailVerified, 0);
  } finally { f.db.close(); }
});

test('CSRF, input sizes, raw auth endpoints, and weak passwords are blocked', async () => {
  const f = await fixture();
  try {
    assert.equal((await f.post('signup', { email: EMAIL, password: PASSWORD }, { Origin: 'https://other.invalid' })).status, 403);
    assert.equal((await f.post('signup', { email: EMAIL, password: PASSWORD }, { Origin: '' })).status, 403);
    assert.equal((await f.post('signup', { email: EMAIL, password: 'short' })).status, 400);
    assert.equal((await f.post('signup', { email: EMAIL, password: 'x'.repeat(9000) })).status, 400);
    assert.equal((await f.post('signup', { email: EMAIL, password: PASSWORD }, { 'Content-Type': 'text/plain' })).status, 400);
    assert.equal((await f.request('/api/auth/sign-up/email', { email: EMAIL, password: PASSWORD, name: 'bypass' })).status, 404);
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM user').get().n, 0);
    assert.equal(f.mail.length, 0);
  } finally { f.db.close(); }
});

test('email and sign-in throttles persist between requests', async () => {
  const f = await fixture();
  try {
    for (let i = 0; i < 5; i++) assert.equal((await f.post('forgot', { email: EMAIL }, { 'cf-connecting-ip': `192.0.2.${20 + i}` })).status, 200);
    assert.equal((await f.post('forgot', { email: EMAIL }, { 'cf-connecting-ip': '192.0.2.99' })).status, 429);
    for (let i = 0; i < 5; i++) assert.equal((await f.post('signin', { email: EMAIL, password: PASSWORD })).status, 401);
    assert.equal((await f.post('signin', { email: EMAIL, password: PASSWORD })).status, 429);
  } finally { f.db.close(); }
});

test('missing configuration fails closed, and provider failure is not reported as success', async () => {
  const f = await fixture();
  try {
    const secret = f.env.BETTER_AUTH_SECRET;
    f.env.BETTER_AUTH_SECRET = '';
    assert.deepEqual(await (await f.request('/api/status')).json(), { accountsReady: false });
    assert.equal((await f.signup()).status, 503);
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM user').get().n, 0);
    f.env.BETTER_AUTH_SECRET = secret;
    f.env.EMAIL.send = async () => { throw new Error('Simulated delivery outage'); };
    assert.equal((await f.signup()).status, 503);
    assert.equal(f.db.prepare('SELECT emailVerified FROM user').get().emailVerified, 0);
  } finally { f.db.close(); }
});

test('verified teachers open their dashboard immediately; student roles and signed-out requests cannot', async () => {
  const f = await fixture();
  try {
    for (const route of ['/teacher', '/teacher.html', '/teacher/', '/teacher.html/']) {
      const response = await f.request(route);
      assert.equal(response.headers.get('Location'), '/account');
      assert.equal(response.headers.get('Cache-Control'), 'no-store');
    }
    await f.post('signup', { email: EMAIL, password: PASSWORD, accountType: 'teacher' });
    await f.activate();
    const login = await f.post('signin', { email: EMAIL, password: PASSWORD });
    const headers = { Cookie: f.cookie(login) };
    const account = await (await f.request('/api/account', undefined, headers)).json();
    assert.equal(account.dashboardPath, '/teacher');
    const dashboard = await f.request('/teacher?role=student', undefined, headers);
    assert.equal(dashboard.status, 200);
    assert.equal(dashboard.headers.get('Cache-Control'), 'no-store');
    assert.match(dashboard.headers.get('Content-Security-Policy'), /frame-ancestors 'none'/);
    const html = await dashboard.text();
    assert.match(html, /data-teacher-workspace/);
    assert.match(html, /Create a class/);
    assert.match(html, /Join with an invite code/);
    assert.equal((await f.request('/teacher.html', undefined, headers)).headers.get('Location'), '/teacher');
    assert.deepEqual((await (await f.request('/api/classes', undefined, headers)).json()).classes, []);
    f.db.prepare("UPDATE user SET requestedRole = 'student' WHERE email = ?").run(EMAIL);
    assert.equal((await f.request('/teacher?role=teacher', undefined, headers)).headers.get('Location'), '/account?manage=1');
    assert.equal((await f.request('/api/classes', undefined, headers)).status, 403);
  } finally { f.db.close(); }
});

test('Remember me adds a seven-day persistent session cookie only for an explicit boolean true', async () => {
  const f = await fixture();
  try {
    await f.signup(); await f.activate();
    for (const [rememberMe, persistent] of [[undefined, false], [false, false], ['true', false], [true, true]]) {
      const login = await f.post('signin', { email: EMAIL, password: PASSWORD, rememberMe });
      assert.equal(login.status, 200);
      const sessionCookie = login.headers.getSetCookie().find(cookie => cookie.startsWith('__Secure-better-auth.session_token='));
      assert.ok(sessionCookie);
      if (persistent) assert.match(sessionCookie, /Max-Age=604800/i);
      else assert.doesNotMatch(sessionCookie, /Max-Age=|Expires=/i);
    }
  } finally { f.db.close(); }
});

async function signInAs(f, email, accountType = 'teacher') {
  assert.equal((await f.post('signup', { email, password: PASSWORD, accountType })).status, 200);
  await f.activate();
  const signedIn = await f.post('signin', { email, password: PASSWORD });
  assert.equal(signedIn.status, 200);
  return { Cookie: f.cookie(signedIn) };
}
const newClass = (f, headers, name = 'Literature') => f.request('/api/classes', { name, subject: 'An Inspector Calls', requestId: crypto.randomUUID() }, headers);

test('classes persist, are isolated by membership, and can be joined only using a valid teacher invite', async () => {
  const f = await fixture();
  try {
    const owner = await signInAs(f, 'owner@example.invalid');
    const guest = await signInAs(f, 'guest@example.invalid');
    const student = await signInAs(f, 'student@example.invalid', 'student');
    assert.equal((await f.request('/api/classes')).status, 401);
    assert.equal((await newClass(f, student)).status, 403);
    const created = await newClass(f, owner, '<script>test</script>');
    assert.equal(created.status, 201);
    const { classroom } = await created.json();
    assert.equal(classroom.membership, 'owner');
    assert.equal((await (await f.request('/api/classes', undefined, owner)).json()).classes[0].name, '<script>test</script>');
    assert.deepEqual((await (await f.request('/api/classes', undefined, guest)).json()).classes, []);
    assert.equal((await f.request('/api/classes/'+classroom.id+'/invite', {}, guest)).status, 404);
    const invite = await (await f.request('/api/classes/'+classroom.id+'/invite', {}, owner)).json();
    assert.match(invite.code, /^[A-HJ-NP-Z2-9]{12}$/);
    assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM class_invites').get()).includes(invite.code), false);
    assert.equal((await f.request('/api/classes/join', {code:invite.code}, student)).status, 403);
    assert.equal((await f.request('/api/classes/join', {code:'AAAAAAAAAAAA'}, guest)).status, 400);
    const joined = await f.request('/api/classes/join', {code:invite.code.toLowerCase().match(/.{4}/g).join('-')}, guest);
    assert.equal(joined.status, 200);
    assert.equal((await joined.json()).classroom.membership, 'teacher');
    assert.equal((await (await f.request('/api/classes', undefined, guest)).json()).classes.length, 1);
    assert.equal((await f.request('/api/classes/join', {code:invite.code}, guest)).status, 200);
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM class_teachers').get().n, 1);
    assert.equal((await f.request('/api/classes/'+classroom.id+'/invite', {}, guest)).status, 404);
    await newClass(f, owner, 'Private class');
    assert.equal((await (await f.request('/api/classes', undefined, guest)).json()).classes.length, 1);
  } finally { f.db.close(); }
});

test('class mutations reject cross-site requests, enforce limits, and retries do not duplicate a class', async () => {
  const f = await fixture();
  try {
    const teacher = await signInAs(f, 'teacher@example.invalid');
    const body = {name:'Writing', subject:'', requestId:crypto.randomUUID()};
    assert.equal((await f.request('/api/classes', body, {...teacher, Origin:'https://evil.invalid'})).status, 403);
    assert.equal((await f.request('/api/classes', body, {...teacher, 'Content-Type':'text/plain'})).status, 400);
    assert.equal((await f.request('/api/classes', {...body, name:' '.repeat(20)}, teacher)).status, 400);
    for (let i=0;i<2;i++) assert.equal((await f.request('/api/classes', body, teacher)).status, 201);
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM classes').get().n, 1);
    for (let i=0;i<10;i++) assert.equal((await f.request('/api/classes/join', {code:'ZZZZZZZZZZZZ'}, teacher)).status, 400);
    assert.equal((await f.request('/api/classes/join', {code:'ZZZZZZZZZZZZ'}, teacher)).status, 429);
  } finally { f.db.close(); }
});

test('new invite codes replace old codes, expired invites fail, and removing membership revokes class visibility', async () => {
  const f = await fixture();
  try {
    const owner = await signInAs(f, 'owner@example.invalid');
    const guest = await signInAs(f, 'guest@example.invalid');
    const {classroom} = await (await newClass(f, owner)).json();
    const route = '/api/classes/'+classroom.id+'/invite';
    const old = await (await f.request(route, {}, owner)).json();
    const next = await (await f.request(route, {}, owner)).json();
    assert.notEqual(old.code, next.code);
    assert.equal((await f.request('/api/classes/join', {code:old.code}, guest)).status, 400);
    f.db.prepare('UPDATE class_invites SET expires_at = 1').run();
    assert.equal((await f.request('/api/classes/join', {code:next.code}, guest)).status, 400);
    const current = await (await f.request(route, {}, owner)).json();
    assert.equal((await f.request('/api/classes/join', {code:current.code}, guest)).status, 200);
    f.db.prepare('DELETE FROM class_teachers').run();
    assert.deepEqual((await (await f.request('/api/classes', undefined, guest)).json()).classes, []);
  } finally { f.db.close(); }
});
