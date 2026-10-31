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
  for (const name of ['0001_auth.sql', '0002_account_access.sql']) db.exec(readFileSync(path.join(__dirname, '../cloudflare/migrations', name), 'utf8'));
  const DB = { prepare(sql) {
    const statement = db.prepare(sql); let args = [];
    return { bind(...values) { args = values; return this; }, async run() { return statement.run(...args); }, async first() { return statement.get(...args) || null; } };
  } };
  const mail = [];
  const env = { DB, AUTH_DB: db, APP_ORIGIN: ORIGIN, ACCOUNT_EMAIL: 'accounts@inkwire-education.com', ACCOUNTS_ENABLED: 'true', BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    EMAIL: { async send(message) { mail.push(message); return { messageId: 'test-mail-only' }; } },
    ASSETS: { async fetch() { return new Response('<!doctype html><title>Account</title>'); } },
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
    assert.deepEqual(await account.json(), { email: EMAIL, verified: true, requestedRole: 'teacher', classroomStatus: 'pending' });
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
