import { createAuth, digest, normalizeEmail } from './auth.mjs';
import { isTeacher, handleClasses } from './classes.mjs';
import { handleEnrollment } from './enrollment.mjs';

const actions = new Map([
  ['signup', '/sign-up/email'], ['signin', '/sign-in/email'], ['signout', '/sign-out'],
  ['resend', '/send-verification-email'], ['forgot', '/request-password-reset'], ['reset', '/reset-password'],
]);
const secureHeaders = {
  'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow',
};
const json = (value, status = 200) => Response.json(value, { status, headers: secureHeaders });
const fail = (message, status, code = 'REQUEST_FAILED') => json({ message, code }, status);
const unavailable = () => fail('Account access is temporarily unavailable. Please try again later.', 503, 'UNAVAILABLE');

const privateRedirect = destination => new Response(null, { status: 302, headers: { ...secureHeaders, Location: destination } });

async function ready(env) {
  if (env.ACCOUNTS_ENABLED !== 'true' || !env.DB || !env.EMAIL || !env.APP_ORIGIN?.startsWith('https://') ||
      !env.ACCOUNT_EMAIL || !env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) return false;
  try { return (await env.DB.prepare('SELECT version FROM app_schema WHERE id = 1').first())?.version === 1; }
  catch { return false; }
}

async function readJSON(request, maxBytes = 8192) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) throw new Error('JSON_REQUIRED');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('INVALID_BODY');
  const parts = []; let size = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    size += chunk.value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new Error('BODY_TOO_LARGE'); }
    parts.push(chunk.value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
  const data = JSON.parse(new TextDecoder().decode(bytes));
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('INVALID_BODY');
  return data;
}

async function limitEmailActions(env, email) {
  const now = Date.now(), period = Math.floor(now / 900000);
  await env.DB.prepare('DELETE FROM email_action_limits WHERE expires_at < ?').bind(now).run();
  const key = await digest(`${email}:${period}`);
  return Boolean(await env.DB.prepare(`INSERT INTO email_action_limits (key, count, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count = count + 1 WHERE count < 5 RETURNING count`)
    .bind(key, (period + 1) * 900000).first());
}

async function authResult(response, action) {
  const data = await response.json().catch(() => ({}));
  if (response.ok || (action === 'signup' && ['USER_ALREADY_EXISTS', 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'].includes(data.code))) {
    const result = json({ status: true });
    // Keep cookies server-managed. Never return session tokens to browser JavaScript.
    for (const cookie of response.headers.getSetCookie()) result.headers.append('Set-Cookie', cookie);
    return result;
  }
  if (response.status === 429) return fail('Too many attempts. Please wait a minute and try again.', 429, 'RATE_LIMITED');
  if (data.code === 'EMAIL_NOT_VERIFIED') return fail('Please activate your account using the link in your email.', 403, 'EMAIL_NOT_VERIFIED');
  if (response.status >= 500) return unavailable();
  if (action === 'signin') return fail('The email or password is incorrect.', 401, 'INVALID_CREDENTIALS');
  if (action === 'reset') return fail('This reset link is invalid, expired, or already used. Request a new link.', 400, 'INVALID_TOKEN');
  return fail('Please check your details and try again.', 400, 'INVALID_INPUT');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) {
      const workspaceMatch = url.pathname.match(/^\/(teacher|student|parent)(?:\.html)?\/?$/);
      if (workspaceMatch) {
        const role = workspaceMatch[1], destination = '/' + role;
        if (url.origin !== env.APP_ORIGIN) return privateRedirect(`${env.APP_ORIGIN}${destination}`);
        if (!await ready(env)) return unavailable();
        try {
          const session = await createAuth(env).api.getSession({ headers: request.headers });
          if (!session?.user?.emailVerified) return privateRedirect('/account');
          if (session.user.requestedRole !== role) return privateRedirect('/account?manage=1');
          if (url.pathname !== destination) return privateRedirect(destination + url.search);
          const assetURL = new URL(destination, env.APP_ORIGIN);
          const response = await env.ASSETS.fetch(new Request(assetURL, { method: 'GET' }));
          if (!response.ok) return unavailable();
          const html = await response.text();
          return new Response(html, { headers: { ...secureHeaders, 'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" } });
        } catch {
          console.error('Ink Wire workspace access check failed.');
          return unavailable();
        }
      }
      if (['/account', '/account.html', '/join', '/join.html'].includes(url.pathname)) {
        if (env.APP_ORIGIN && url.origin !== env.APP_ORIGIN) return Response.redirect(`${env.APP_ORIGIN}${url.pathname}${url.search}`, 302);
        // Static Assets serves account.html at /account and redirects the extension.
        // Keep that canonical direction so email links cannot enter a redirect loop.
        if (url.pathname.endsWith('.html')) return Response.redirect(`${url.origin}${url.pathname.slice(0,-5)}${url.search}`, 302);
        const response = await env.ASSETS.fetch(request);
        const result = new Response(response.body, response);
        for (const [key, value] of Object.entries(secureHeaders)) result.headers.set(key, value);
        result.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
        return result;
      }
      return env.ASSETS.fetch(request);
    }
    if (url.pathname === '/api/status' && request.method === 'GET') {
      return json({ accountsReady: url.origin === env.APP_ORIGIN && await ready(env) });
    }
    if (url.origin !== env.APP_ORIGIN) return fail('Invalid origin.', 403, 'INVALID_ORIGIN');
    if (!await ready(env)) return unavailable();
    try {
      const delivery = {};
      const auth = createAuth(env, delivery);
      if (url.pathname === '/api/account' && request.method === 'GET') {
        const session = await auth.api.getSession({ headers: request.headers });
        if (!session?.user?.emailVerified) return fail('Please sign in.', 401, 'UNAUTHENTICATED');
        const role = session.user.requestedRole;
        const approved = ['teacher','student','parent'].includes(role);
        return json({ email: session.user.email, verified: true, requestedRole: session.user.requestedRole,
          classroomStatus: approved ? 'active' : 'pending',
          ...(approved ? { role, dashboardPath: '/' + role } : {}) });
      }
      if (url.pathname.startsWith('/api/enrollment/')) {
        const session = await auth.api.getSession({headers:request.headers});
        return await handleEnrollment(request,env,session?.user,{json,fail,readJSON});
      }
      if (url.pathname === '/api/classes' || url.pathname.startsWith('/api/classes/')) {
        const session = await auth.api.getSession({ headers: request.headers });
        return await handleClasses(request, env, session?.user, { json, fail, readJSON });
      }
      const action = url.pathname.replace('/api/accounts/', '');
      if (!url.pathname.startsWith('/api/accounts/') || (!actions.has(action) && action !== 'activate')) return fail('Not found.', 404);
      if (request.method !== 'POST') return fail('Use POST.', 405);
      if (request.headers.get('Origin') !== env.APP_ORIGIN || request.headers.get('Sec-Fetch-Site') === 'cross-site') return fail('Invalid origin.', 403, 'INVALID_ORIGIN');
      let input;
      try { input = await readJSON(request); } catch { return fail('Invalid request.', 400, 'INVALID_INPUT'); }
      const headers = new Headers(request.headers);
      headers.delete('Content-Length'); headers.delete('Transfer-Encoding');
      if (action === 'activate') {
        if (typeof input.token !== 'string' || input.token.length > 4096) return fail('Invalid activation link.', 400, 'INVALID_TOKEN');
        const link = await env.DB.prepare('DELETE FROM activation_links WHERE token_hash = ? AND expires_at > ? RETURNING email')
          .bind(await digest(input.token), Date.now()).first();
        if (!link) return fail('This activation link is invalid, expired, or already used. Try signing in or request a new link.', 400, 'INVALID_TOKEN');
        const verifyURL = new URL('/api/auth/verify-email', env.APP_ORIGIN);
        verifyURL.searchParams.set('token', input.token);
        headers.delete('Content-Type');
        const response = await auth.handler(new Request(verifyURL, { headers }));
        if (!response.ok) return fail('Please request a new activation link.', 400, 'INVALID_TOKEN');
        await env.DB.prepare('DELETE FROM activation_links WHERE email = ?').bind(link.email).run();
        return json({ status: true });
      }
      delivery.join = typeof input.join === 'string' && /^(class\.[A-HJ-NP-Z2-9]{8}|(?:student|family)\.[A-HJ-NP-Z2-9]{12})$/.test(input.join) ? input.join : '';
      let body = {};
      if (['signup', 'signin', 'resend', 'forgot'].includes(action)) {
        const email = normalizeEmail(input.email);
        if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return fail('Enter a valid email address.', 400, 'INVALID_EMAIL');
        body.email = email;
        if (['signup', 'resend', 'forgot'].includes(action) && !await limitEmailActions(env, email)) {
          return fail('Several emails have already been requested. Please wait 15 minutes before requesting another.', 429, 'EMAIL_RATE_LIMITED');
        }
      }
      if (['signup', 'signin', 'reset'].includes(action)) {
        const password = action === 'reset' ? input.newPassword : input.password;
        if (typeof password !== 'string' || password.length > 128 || password.length < (action === 'signin' ? 1 : 12)) {
          return fail('Use a password between 12 and 128 characters.', 400, 'INVALID_PASSWORD');
        }
        body[action === 'reset' ? 'newPassword' : 'password'] = password;
      }
      if (action === 'signup') {
        if (!['parent', 'student', 'teacher'].includes(input.accountType)) return fail('Choose Parent, Student, or Teacher.', 400, 'INVALID_ACCOUNT_TYPE');
        body.name = 'Ink Wire member';
        body.requestedRole = input.accountType;
      }
      if (action === 'signin') body.rememberMe = input.rememberMe === true;
      if (action === 'reset') {
        if (typeof input.token !== 'string' || input.token.length > 512) return fail('Invalid reset link.', 400, 'INVALID_TOKEN');
        body.token = input.token;
      }
      const response = await auth.handler(new Request(`${env.APP_ORIGIN}/api/auth${actions.get(action)}`, {
        method: 'POST', headers, body: JSON.stringify(body),
      }));
      if (delivery.failed) return unavailable();
      return authResult(response, action);
    } catch {
      console.error('Ink Wire account request failed.');
      return unavailable();
    }
  },
};
