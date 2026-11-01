const { test } = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { readFileSync, readdirSync } = require('node:fs');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const ORIGIN = 'https://inkwire-education.com';
const EMAIL = 'learner@example.invalid';
const PASSWORD = 'An original test passphrase 42!';

async function fixture() {
  const { default: worker } = await import('../cloudflare/worker.mjs');
  const db = new DatabaseSync(':memory:');
  for (const name of readdirSync(path.join(__dirname, '../cloudflare/migrations')).filter(name => name.endsWith('.sql')).sort()) db.exec(readFileSync(path.join(__dirname, '../cloudflare/migrations', name), 'utf8'));
  const DB = { prepare(sql) {
    const statement = db.prepare(sql); let args = [];
    return { bind(...values) { args = values; return this; }, async run() { return statement.run(...args); }, async first() { return statement.get(...args) || null; }, async all() { return { results: statement.all(...args) }; } };
  } };
  const mail = [];
  const env = { DB, AUTH_DB: db, APP_ORIGIN: ORIGIN, ACCOUNT_EMAIL: 'accounts@inkwire-education.com', ACCOUNTS_ENABLED: 'true', BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
    EMAIL: { async send(message) { mail.push(message); return { messageId: 'test-mail-only' }; } },
    ASSETS: { async fetch(request) { return new Response(readFileSync(path.join(__dirname, ['/teacher','/student','/parent','/join'].includes(new URL(request.url).pathname) ? '../dist' + new URL(request.url).pathname + '.html' : '../dist/account.html'), 'utf8')); } },
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

test('AI planning requires class access and origin, uses a private projection, and never saves a generated draft', async () => {
  const { defaults, generateLessons } = await import('../dist/course-model.mjs');
  const f = await fixture(), originalFetch = global.fetch;
  let calls = 0, payload;
  try {
    const owner = await signInAs(f, 'ai-owner@example.invalid'), stranger = await signInAs(f, 'ai-other@example.invalid');
    const student = await signInAs(f, 'ai-student@example.invalid', 'student');
    const { classroom } = await (await newClass(f, owner, 'Private class name')).json();
    const route = `/api/classes/${classroom.id}/planning-assistant`;
    const course = { ...defaults('A fictional literature course'), weeks: 2, organization: 'Private organisation', sourceNotes: 'Private source note', startDate: '2027-01-05' };
    course.lessons = generateLessons(course); course.lessons[0].sourcePages = 'Teacher reference';
    const body = { course, mode: 'course', brief: 'Plan a literature and essay writing course for Grade 6.' };
    assert.deepEqual(await (await f.request(route, undefined, owner)).json(), {available:false});
    assert.equal((await f.request(route, body, owner)).status, 503);
    f.env.OPENAI_API_KEY = 'test-key-never-sent-to-a-network'; f.env.OPENAI_PLANNING_ENABLED = 'true';
    global.fetch = async (url, init) => {
      calls++; assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(init.headers.Authorization, 'Bearer test-key-never-sent-to-a-network');
      payload = JSON.parse(init.body);
      const prompt = JSON.parse(payload.input);
      const result = { description: 'A generated editable course.', reviewNotes: 'Confirm reading assignments.', lessons: prompt.lessons.map(lesson => ({...lesson, title:'Generated lesson '+lesson.number, goal:'Analyse a passage.', reading:'Teacher-selected passage', homework:'Revise a paragraph', skills:'Evidence selection', activities:'10 min: retrieve ideas\n90 min: discussion and writing\n20 min: reflection', evidence:'Exit response'})) };
      return Response.json({ status:'completed', output:[{type:'message', content:[{type:'output_text', text:JSON.stringify(result)}]}] });
    };
    assert.equal((await f.request(route, body)).status, 401);
    assert.equal((await f.request(route, body, student)).status, 403);
    assert.equal((await f.request(route, body, stranger)).status, 404);
    assert.equal((await f.request(route, body, {...owner,Origin:'https://evil.invalid'})).status, 403);
    assert.equal((await f.request(route, {...body,brief:'x'}, owner)).status, 400);
    assert.equal((await f.request(route, {...body,course:{...course,lessons:[]}}, owner)).status, 400);
    assert.equal(calls, 0);
    const response = await f.request(route, body, owner);
    assert.equal(response.status, 200, await response.clone().text());
    const result = await response.json();
    assert.equal(result.course.lessons[0].title,'Generated lesson 1');
    assert.equal(result.course.lessons[0].date,'2027-01-05');
    assert.equal(result.course.lessons[0].sourcePages,'Teacher reference');
    assert.equal(result.course.organization,'Private organisation');
    assert.equal(result.course.sourceNotes,'Private source note');
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM course_overviews').get().n,0);
    assert.equal(payload.store,false); assert.equal(payload.text.format.strict,true); assert.equal(payload.model,'gpt-6-sol');
    for (const privateValue of ['Private organisation','Private source note','Teacher reference','2027-01-05','ai-owner','Private class name']) assert.ok(!payload.input.includes(privateValue));
    assert.equal((await f.request(route, body, owner)).status,429);
    assert.equal(calls,1);
    f.db.prepare('UPDATE ai_planning_limits SET next_at=0').run();
    const activityResponse = await f.request(route,{...body,mode:'activities',lessonIndex:1},owner);
    assert.equal(activityResponse.status,200);
    const activity = await activityResponse.json();
    assert.deepEqual(activity.course.lessons[0],course.lessons[0]);
    for(const key of ['title','goal','reading','homework','date'])assert.equal(activity.course.lessons[1][key],course.lessons[1][key]);
    assert.match(activity.course.lessons[1].activities,/retrieve/);
    f.db.prepare('UPDATE ai_planning_limits SET next_at=0, count=30 WHERE key LIKE ?').run('site:%');
    f.db.prepare('UPDATE ai_planning_limits SET next_at=0 WHERE key LIKE ?').run('teacher:%');
    assert.equal((await f.request(route,body,owner)).status,429); assert.equal(calls,2);
    await f.request(`/api/classes/${classroom.id}/delete`,{},owner);
    assert.equal((await f.request(route,undefined,owner)).status,404);
    assert.equal((await f.request(route,body,owner)).status,404); assert.equal(calls,2);
  } finally { global.fetch=originalFetch; f.db.close(); }
});

test('AI provider errors, refusals and incomplete or malformed drafts preserve the saved course', async () => {
  const { defaults, generateLessons } = await import('../dist/course-model.mjs');
  const f=await fixture(), originalFetch=global.fetch;
  try {
    const owner=await signInAs(f,'ai-errors@example.invalid');
    const {classroom}=await(await newClass(f,owner)).json();
    const course={...defaults('Unchanged saved course'),weeks:1};course.lessons=generateLessons(course);
    await f.request(`/api/classes/${classroom.id}/overview`,{course,revision:0},owner);
    f.env.OPENAI_API_KEY='test-only';f.env.OPENAI_PLANNING_ENABLED='true';
    const body={course,mode:'course',brief:'Create a course plan for this fictional book.'};
    const route=`/api/classes/${classroom.id}/planning-assistant`;
    const cases=[
      [()=>new Response('private-provider-error',{status:500}),502,'AI_PROVIDER_ERROR'],
      [()=>new Response('private-quota',{status:429}),429,'AI_PROVIDER_ERROR'],
      [()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'refusal',refusal:'Private reason'}]}]}),422,'AI_REFUSAL'],
      [()=>Response.json({status:'incomplete',output:[]}),502,'AI_INCOMPLETE'],
      [()=>Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'not JSON'}]}]}),502,'AI_GENERATION_FAILED'],
      [()=>{throw Error('secret test-only');},502,'AI_GENERATION_FAILED'],
    ];
    for (const [respond,status,code] of cases) {
      f.db.prepare('DELETE FROM ai_planning_limits').run();global.fetch=async()=>respond();
      const response=await f.request(route,body,owner);
      assert.equal(response.status,status);const result=await response.json();assert.equal(result.code,code);
      assert.ok(!JSON.stringify(result).includes('private-'));assert.ok(!JSON.stringify(result).includes('test-only'));
      const saved=await(await f.request(`/api/classes/${classroom.id}/overview`,undefined,owner)).json();
      assert.deepEqual(saved.course,course);assert.equal(saved.revision,1);
    }
    f.db.prepare('DELETE FROM ai_planning_limits').run();
    global.fetch=async()=>{throw Error('must not be called');};
    const teacherId=f.db.prepare('SELECT id FROM user WHERE email=?').get('ai-errors@example.invalid').id;
    const day=Math.floor(Date.now()/86400000);
    f.db.prepare('INSERT INTO ai_planning_limits VALUES (?,5,0,?)').run(`teacher:${teacherId}:${day}`,Date.now()+86400000);
    assert.equal((await f.request(route,body,owner)).status,429);
  } finally {global.fetch=originalFetch;f.db.close();}
});

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
  const extra = {'cf-connecting-ip': '192.0.2.' + (40 + f.db.prepare('SELECT count(*) AS n FROM user').get().n)};
  assert.equal((await f.post('signup', { email, password: PASSWORD, accountType }, extra)).status, 200);
  assert.equal((await f.post('activate', {token:decodeURIComponent(f.token())}, extra)).status, 200);
  const signedIn = await f.post('signin', { email, password: PASSWORD }, extra);
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

const enroll = (f, path, body, headers) => f.request('/api/enrollment'+path,body,headers);
const addLearner = async (f,teacher,classId,name='Sample learner') => {
  const response=await enroll(f,'/classes/'+classId+'/students',{name,requestId:crypto.randomUUID()},teacher);
  assert.equal(response.status,201,await response.clone().text());return (await response.json()).learnerId;
};
const inviteLearner = async (f,teacher,classId,kind,learnerId,action='open') => {
  const response=await enroll(f,'/classes/'+classId+'/invite',{kind,learnerId,action},teacher);
  assert.equal(response.status,200,await response.clone().text());return response.json();
};
const joinLearner = (f,headers,invitation,name='Sample person') => enroll(f,'/join',{kind:invitation.kind,code:invitation.code,name},headers);

test('one learner roster entry connects student and parent accounts; parents follow the child across classes',async()=>{
  const f=await fixture();try{
    const teacher=await signInAs(f,'owner@example.invalid');
    const parent=await signInAs(f,'parent@example.invalid','parent');
    const student=await signInAs(f,'student@example.invalid','student');
    const stranger=await signInAs(f,'stranger@example.invalid');
    const first=(await (await newClass(f,teacher,'Reading')).json()).classroom.id;
    const second=(await (await newClass(f,teacher,'Writing')).json()).classroom.id;
    const learnerId=await addLearner(f,teacher,first,'Example learner');
    let roster=await (await enroll(f,'/classes/'+first+'/roster',undefined,teacher)).json();
    assert.equal(roster.students[0].connected,0);assert.deepEqual(roster.students[0].parents,[]);
    assert.equal((await enroll(f,'/classes/'+first+'/roster',undefined,stranger)).status,404);
    assert.equal((await enroll(f,'/classes/'+first+'/roster',undefined,parent)).status,404);
    const family=await inviteLearner(f,teacher,first,'family',learnerId);
    assert.equal((await joinLearner(f,parent,family,'Example parent')).status,200);
    const personal=await inviteLearner(f,teacher,first,'student',learnerId);
    assert.equal((await joinLearner(f,student,personal)).status,200);
    assert.equal((await joinLearner(f,student,personal)).status,200);
    assert.equal((await enroll(f,'/classes/'+second+'/students',{learnerId},teacher)).status,201);
    const mine=await (await enroll(f,'/mine',undefined,parent)).json();
    assert.equal(mine.children.length,1);assert.equal(mine.children[0].classes.length,2);
    assert.equal((await (await enroll(f,'/mine',undefined,student)).json()).classes.length,2);
    roster=await (await enroll(f,'/classes/'+second+'/roster',undefined,teacher)).json();
    assert.equal(roster.students[0].connected,1);assert.equal(roster.students[0].parents[0].name,'Example parent');
    assert.equal((await enroll(f,'/classes/'+first+'/remove',{learnerId},teacher)).status,200);
    assert.equal((await (await enroll(f,'/mine',undefined,parent)).json()).children[0].classes.length,1);
    assert.equal((await enroll(f,'/classes/'+second+'/disconnect',{learnerId,parentId:roster.students[0].parents[0].id},teacher)).status,200);
    assert.deepEqual((await (await enroll(f,'/mine',undefined,parent)).json()).children,[]);
    assert.equal((await joinLearner(f,parent,family)).status,400);
  }finally{f.db.close();}
});

test('class codes are generated automatically, reusable for verified students, isolated from personal and teacher codes',async()=>{
  const f=await fixture();try{
    const teacher=await signInAs(f,'teacher@example.invalid');
    const student=await signInAs(f,'student@example.invalid','student');
    const parent=await signInAs(f,'parent@example.invalid','parent');
    const {classroom}=await (await newClass(f,teacher)).json();
    assert.equal(f.db.prepare("SELECT count(*) AS n FROM learning_invites WHERE kind='class'").get().n,1);
    const invitation=await inviteLearner(f,teacher,classroom.id,'class');
    assert.match(invitation.code,/^[A-HJ-NP-Z2-9]{8}$/);assert.equal(invitation.link,ORIGIN+'/join#class='+invitation.code);
    assert.equal((await inviteLearner(f,teacher,classroom.id,'class')).code,invitation.code);
    assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM learning_invites').get()).includes(invitation.code),false);
    assert.equal((await joinLearner(f,parent,invitation)).status,409);
    assert.equal((await joinLearner(f,teacher,invitation)).status,409);
    assert.equal((await enroll(f,'/preview',{...invitation})).status,401);
    assert.equal((await enroll(f,'/preview',invitation,student)).status,200);
    assert.equal((await joinLearner(f,student,{...invitation,code:invitation.code.toLowerCase().match(/.{4}/g).join('-')},'Student name')).status,200);
    assert.equal((await joinLearner(f,student,invitation,'Student name')).status,200);
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM class_students').get().n,1);
    const account=await(await f.request('/api/account',undefined,student)).json();assert.equal(account.dashboardPath,'/student');
    assert.equal((await f.request('/student',undefined,student)).status,200);
    assert.equal((await f.request('/parent',undefined,student)).headers.get('Location'),'/account?manage=1');
    assert.equal((await f.request('/parent',undefined,parent)).status,200);
  }finally{f.db.close();}
});

test('student and family invitations cannot be reused by a different account or grant access to other children',async()=>{
  const f=await fixture();try{
    const teacher=await signInAs(f,'teacher@example.invalid');
    const student=await signInAs(f,'student@example.invalid','student');
    const otherStudent=await signInAs(f,'otherstudent@example.invalid','student');
    const parent=await signInAs(f,'parent@example.invalid','parent');
    const otherParent=await signInAs(f,'otherparent@example.invalid','parent');
    const {classroom}=await (await newClass(f,teacher)).json();
    const a=await addLearner(f,teacher,classroom.id,'Learner A'),b=await addLearner(f,teacher,classroom.id,'Learner B');
    const studentInvite=await inviteLearner(f,teacher,classroom.id,'student',a);
    const familyInvite=await inviteLearner(f,teacher,classroom.id,'family',a);
    assert.equal((await joinLearner(f,student,studentInvite)).status,200);
    assert.equal((await joinLearner(f,otherStudent,studentInvite)).status,400);
    assert.equal((await joinLearner(f,parent,familyInvite)).status,200);
    assert.equal((await joinLearner(f,otherParent,familyInvite)).status,400);
    assert.equal((await joinLearner(f,student,await inviteLearner(f,teacher,classroom.id,'student',b))).status,409);
    assert.equal((await (await enroll(f,'/mine',undefined,parent)).json()).children[0].id,a);
    assert.deepEqual((await (await enroll(f,'/mine',undefined,otherParent)).json()).children,[]);
    const newFamily=await inviteLearner(f,teacher,classroom.id,'family',a);
    assert.notEqual(newFamily.code,familyInvite.code);
    assert.equal((await joinLearner(f,otherParent,newFamily)).status,200);
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM learner_parents WHERE learner_id=?').get(a).n,2);
  }finally{f.db.close();}
});

test('resetting, closing and expiring invites blocks new joins while existing access remains',async()=>{
  const f=await fixture();try{
    const teacher=await signInAs(f,'teacher@example.invalid'),student=await signInAs(f,'student@example.invalid','student');
    const {classroom}=await(await newClass(f,teacher)).json();
    const first=await inviteLearner(f,teacher,classroom.id,'class');
    const next=await inviteLearner(f,teacher,classroom.id,'class',null,'reset');
    assert.notEqual(first.code,next.code);assert.equal((await joinLearner(f,student,first)).status,400);
    assert.equal((await joinLearner(f,student,next)).status,200);
    await inviteLearner(f,teacher,classroom.id,'class',null,'disable');
    assert.equal((await joinLearner(f,student,next)).status,400);
    assert.equal((await(await enroll(f,'/mine',undefined,student)).json()).classes.length,1);
    const expired=await inviteLearner(f,teacher,classroom.id,'class');f.db.prepare('UPDATE learning_invites SET expires_at=1').run();
    assert.equal((await joinLearner(f,student,expired)).status,400);
  }finally{f.db.close();}
});

test('roster and invitations reject unauthorized edits, CSRF, duplicate retries and code guessing',async()=>{
  const f=await fixture();try{
    const teacher=await signInAs(f,'teacher@example.invalid'),stranger=await signInAs(f,'stranger@example.invalid'),student=await signInAs(f,'student@example.invalid','student');
    const {classroom}=await(await newClass(f,teacher)).json();const route='/classes/'+classroom.id;
    const body={name:'Example',requestId:crypto.randomUUID()};
    assert.equal((await enroll(f,route+'/students',body,{...teacher,Origin:'https://evil.invalid'})).status,403);
    assert.equal((await enroll(f,route+'/students',body,stranger)).status,404);
    assert.equal((await enroll(f,route+'/students',body,student)).status,404);
    const one=await(await enroll(f,route+'/students',body,teacher)).json(),two=await(await enroll(f,route+'/students',body,teacher)).json();
    assert.equal(one.learnerId,two.learnerId);
    assert.equal((await enroll(f,route+'/invite',{kind:'family',learnerId:one.learnerId},stranger)).status,404);
    assert.equal((await enroll(f,route+'/students',{learnerId:one.learnerId},stranger)).status,404);
    for(let i=0;i<10;i++)assert.equal((await enroll(f,'/join',{kind:'class',code:'AAAAAAAA',name:'Example'},student)).status,400);
    assert.equal((await enroll(f,'/join',{kind:'class',code:'AAAAAAAA',name:'Example'},student)).status,429);
  }finally{f.db.close();}
});

test('verification emails preserve only valid invitation context and return members to the correct workspace',async()=>{
  const f=await fixture();try{
    const join='family.ABCDEFGHJKLM';
    assert.equal((await f.post('signup',{email:EMAIL,password:PASSWORD,accountType:'parent',join})).status,200);
    const url=new URL(f.mail.at(-1).text.match(/https:\/\/\S+/)[0]);
    const fragment=new URLSearchParams(url.hash.slice(1));assert.equal(fragment.get('join'),join);
    assert.equal((await f.post('activate',{token:fragment.get('activate')})).status,200);
    const login=await f.post('signin',{email:EMAIL,password:PASSWORD});
    assert.equal((await(await f.request('/api/account',undefined,{Cookie:f.cookie(login)})).json()).dashboardPath,'/parent');
    await f.post('signup',{email:'new@example.invalid',password:PASSWORD,accountType:'student',join:'https://evil.invalid'});
    assert.ok(!f.mail.at(-1).text.includes('evil.invalid'));
  }finally{f.db.close();}
});


test('course overviews persist per class, enforce teacher membership, and preserve concurrent drafts', async () => {
  const { defaults, generateLessons } = await import('../dist/course-model.mjs');
  const f = await fixture();
  try {
    const owner = await signInAs(f, 'owner@example.invalid');
    const guest = await signInAs(f, 'guest@example.invalid');
    const student = await signInAs(f, 'student@example.invalid', 'student');
    const { classroom } = await (await newClass(f, owner)).json();
    const route = '/api/classes/' + classroom.id + '/overview';
    const course = defaults('Rivendell literature'); course.lessons = generateLessons(course);
    course.themes = 'Responsibility'; course.essentialQuestions = 'What makes a fair decision?';
    Object.assign(course.lessons[0], { skills: 'Evidence selection', activities: 'Seminar', evidence: 'Exit ticket', sourcePages: '1–2' });
    course.lessons[0].reading = 'Chapter 1: ' + 'Discuss this passage. '.repeat(300);
    // Trim to the per-field bound but make the whole plan larger than the old 8 KiB body limit.
    course.lessons[0].reading = course.lessons[0].reading.slice(0, 1200);
    for (const lesson of course.lessons) lesson.homework = 'Develop your interpretation. '.repeat(25).trim();
    const body = { revision: 0, course };
    assert.ok(JSON.stringify(body).length > 8192);
    assert.equal((await f.request(route, undefined, guest)).status, 404);
    assert.equal((await f.request(route, body, guest)).status, 404);
    assert.equal((await f.request(route, body, student)).status, 403);
    assert.equal((await f.request(route, body, { ...owner, Origin: 'https://evil.invalid' })).status, 403);
    assert.equal((await f.request(route, body, owner)).status, 200);
    assert.equal((await f.request(route, body, owner)).status, 200, 'a lost-response retry does not create a conflict');
    const saved = await (await f.request(route, undefined, owner)).json();
    assert.deepEqual(saved.course, course); assert.equal(saved.revision, 1);
    const invite = await (await f.request('/api/classes/' + classroom.id + '/invite', {}, owner)).json();
    await f.request('/api/classes/join', { code: invite.code }, guest);
    assert.equal((await f.request(route, undefined, guest)).status, 200);
    const updated = { ...course, description: 'A revised course overview.' };
    assert.equal((await f.request(route, { revision: 1, course: updated }, guest)).status, 200);
    assert.equal((await f.request(route, { revision: 1, course: { ...course, description: 'Stale edit' } }, owner)).status, 409);
    assert.equal((await (await f.request(route, undefined, owner)).json()).course.description, updated.description);
    const listed = (await (await f.request('/api/classes', undefined, owner)).json()).classes[0];
    assert.equal(listed.overviewRevision, 2); assert.equal(listed.courseWeeks, 15); assert.equal(listed.courseMinutes, 120);
    f.db.prepare('DELETE FROM class_teachers').run();
    assert.equal((await f.request(route, undefined, guest)).status, 404);
    assert.equal((await f.request(route, { revision: 2, course: { ...course, weeks: 16 } }, owner)).status, 400);
  } finally { f.db.close(); }
});

test('class owners can delete into Trash and restore plans/rosters while access and invitations pause',async()=>{
  const {defaults,generateLessons}=await import('../dist/course-model.mjs');
  const f=await fixture();try{
    const owner=await signInAs(f,'owner@example.invalid'),guest=await signInAs(f,'guest@example.invalid'),outsider=await signInAs(f,'other@example.invalid');
    const student=await signInAs(f,'student@example.invalid','student'),parent=await signInAs(f,'parent@example.invalid','parent');
    const {classroom}=await(await newClass(f,owner,'Trash test')).json(),id=classroom.id,route='/api/classes/'+id;
    const course=defaults('Preserved course');course.lessons=generateLessons(course);await f.request(route+'/overview',{revision:0,course},owner);
    const learner=await addLearner(f,owner,id),family=await inviteLearner(f,owner,id,'family',learner),personal=await inviteLearner(f,owner,id,'student',learner);
    await joinLearner(f,parent,family);await joinLearner(f,student,personal);
    const code=await(await f.request(route+'/invite',{},owner)).json();await f.request('/api/classes/join',{code:code.code},guest);
    const classInvite=await inviteLearner(f,owner,id,'class');
    assert.equal((await f.request(route+'/delete',{},guest)).status,404);assert.equal((await f.request(route+'/delete',{},outsider)).status,404);
    assert.equal((await f.request(route+'/delete',{},student)).status,403);
    assert.equal((await f.request(route+'/delete',{}, {...owner,Origin:'https://evil.invalid'})).status,403);
    const first=await(await f.request(route+'/delete',{},owner)).json();assert.ok(first.classroom.deletedAt);
    assert.deepEqual(await(await f.request(route+'/delete',{},owner)).json(),first,'repeat deletion keeps its original time');
    for(const headers of [owner,guest])assert.deepEqual((await(await f.request('/api/classes',undefined,headers)).json()).classes,[]);
    assert.equal((await(await f.request('/api/classes/trash',undefined,owner)).json()).classes.length,1);
    assert.equal((await(await f.request('/api/classes/trash',undefined,guest)).json()).classes.length,0);
    assert.equal((await f.request(route+'/overview',undefined,owner)).status,404);
    assert.equal((await enroll(f,'/classes/'+id+'/roster',undefined,guest)).status,404);
    assert.equal((await f.request('/api/classes/join',{code:code.code},outsider)).status,400);
    assert.equal((await enroll(f,'/preview',classInvite,student)).status,400);
    assert.equal((await joinLearner(f,student,personal)).status,400);
    assert.equal((await joinLearner(f,parent,family)).status,400);
    assert.deepEqual((await(await enroll(f,'/mine',undefined,student)).json()).classes,[]);
    const familyView=await(await enroll(f,'/mine',undefined,parent)).json();assert.equal(familyView.children.length,1);assert.deepEqual(familyView.children[0].classes,[]);
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM class_students').get().n,1);
    assert.equal((await f.request(route+'/restore',{},guest)).status,404);
    assert.equal((await f.request(route+'/restore',{},owner)).status,200);
    assert.equal((await f.request(route+'/restore',{},owner)).status,200);
    assert.deepEqual((await(await f.request(route+'/overview',undefined,owner)).json()).course,course);
    assert.equal((await(await enroll(f,'/mine',undefined,student)).json()).classes.length,1);
    assert.equal((await(await enroll(f,'/classes/'+id+'/roster',undefined,owner)).json()).students[0].parents.length,1);
    assert.equal((await(await f.request('/api/classes',undefined,guest)).json()).classes.length,1);
    assert.equal((await enroll(f,'/preview',classInvite,student)).status,200,'unexpired invitations work again after restore');
  }finally{f.db.close();}
});

test('calendar includes only accessible active classes, converts course times and validates query ranges',async()=>{
  const {defaults,generateLessons}=await import('../dist/course-model.mjs');
  const f=await fixture();try{
    const owner=await signInAs(f,'owner@example.invalid'),guest=await signInAs(f,'guest@example.invalid'),student=await signInAs(f,'student@example.invalid','student');
    const {classroom}=await(await newClass(f,owner,'Calendar test')).json();
    const course={...defaults('Scheduled course'),weeks:1,startTime:'00:30',startDate:'2026-11-01'};course.lessons=generateLessons(course);
    await f.request('/api/classes/'+classroom.id+'/overview',{revision:0,course},owner);
    const route='/api/classes/calendar?from=2026-10-01&to=2026-11-01&timeZone=Asia/Bangkok';
    assert.equal((await f.request(route)).status,401);assert.equal((await f.request(route,undefined,student)).status,403);
    assert.deepEqual((await(await f.request(route,undefined,guest)).json()).events,[]);
    const events=(await(await f.request(route,undefined,owner)).json()).events;
    assert.equal(events.length,1);assert.equal(events[0].date,'2026-10-31');assert.equal(events[0].startsAt,'2026-10-31T16:30:00.000Z');
    assert.equal(events[0].endsAt,'2026-10-31T18:30:00.000Z');assert.equal(events[0].feedback,undefined);assert.equal(events[0].sourceNotes,undefined);
    assert.equal((await f.request('/api/classes/calendar?from=2026-01-01&to=2027-01-01',undefined,owner)).status,400);
    assert.equal((await f.request('/api/classes/calendar?from=2026-02-30&to=2026-03-31',undefined,owner)).status,400);
    assert.equal((await f.request(route.replace('Asia/Bangkok','Nowhere'),undefined,owner)).status,400);
    const invite=await(await f.request('/api/classes/'+classroom.id+'/invite',{},owner)).json();await f.request('/api/classes/join',{code:invite.code},guest);
    assert.equal((await(await f.request(route,undefined,guest)).json()).events.length,1);
    await f.request('/api/classes/'+classroom.id+'/delete',{},owner);
    assert.deepEqual((await(await f.request(route,undefined,guest)).json()).events,[]);
    await f.request('/api/classes/'+classroom.id+'/restore',{},owner);
    assert.equal((await(await f.request(route,undefined,guest)).json()).events.length,1);
  }finally{f.db.close();}
});

test('transcript summary sends the entire file to OpenAI only for a verified teacher and never persists it',async()=>{
  const f=await fixture(),originalFetch=global.fetch;let calls=0;
  try{
    const teacher=await signInAs(f,'transcript-teacher@example.invalid'),student=await signInAs(f,'transcript-student@example.invalid','student');
    f.env.OPENAI_API_KEY='fake-test-key';f.env.OPENAI_PLANNING_ENABLED='true';
    const source='19:00:00 --> 19:01:00\nTeacher: A fictional lesson about language.\n'.repeat(2000);
    const body={filename:'Fictional Transcript.txt',fileData:'data:text/plain;base64,'+Buffer.from(source).toString('base64')};
    global.fetch=async(url,init)=>{
      calls++;assert.equal(url,'https://api.openai.com/v1/responses');const payload=JSON.parse(init.body);assert.equal(payload.store,false);
      const file=payload.input[0].content.find(c=>c.type==='input_file');assert.equal(Buffer.from(file.file_data.split(',')[1],'base64').toString(),source);
      assert.ok(!JSON.stringify(payload).includes('transcript-teacher'));
      return Response.json({id:'resp_test',model:'gpt-6-sol',status:'completed',output:[{type:'message',content:[{type:'output_text',text:'# Class summary\nA fictional lesson.'}]}],usage:{input_tokens:40,output_tokens:12,total_tokens:52}},{headers:{'x-request-id':'req_test'}});
    };
    const route='/api/teacher/transcript-summary';
    assert.equal((await f.request(route,body)).status,401);assert.equal((await f.request(route,body,student)).status,403);
    assert.equal((await f.request(route,body,{...teacher,Origin:'https://evil.invalid'})).status,403);
    assert.equal((await f.request(route,{...body,filename:'../../private.txt'},teacher)).status,400);
    assert.equal((await f.request(route,{...body,fileData:'bad'},teacher)).status,400);assert.equal(calls,0);
    const response=await f.request(route,body,teacher);assert.equal(response.status,200,await response.clone().text());const result=await response.json();
    assert.equal(result.summary,'# Class summary\nA fictional lesson.');assert.equal(result.inputBytes,Buffer.byteLength(source));assert.equal(result.requestId,'req_test');assert.equal(result.usage.totalTokens,52);
    assert.equal(f.db.prepare('SELECT count(*) AS n FROM course_overviews').get().n,0);
    assert.equal((await f.request(route,body,teacher)).status,429);assert.equal(calls,1);
    f.db.prepare('DELETE FROM ai_planning_limits').run();global.fetch=async()=>Response.json({error:{code:'model_not_found',message:'Sensitive provider diagnostic'}},{status:404,headers:{'x-request-id':'req_failure'}});
    const failed=await f.request(route,body,teacher);assert.equal(failed.status,502);const error=await failed.json();assert.equal(error.providerCode,'model_not_found');assert.ok(!JSON.stringify(error).includes('Sensitive'));
  }finally{global.fetch=originalFetch;f.db.close();}
});
