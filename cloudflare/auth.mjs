import { betterAuth } from 'better-auth';

export const normalizeEmail = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
export async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

// The caller supplies a delivery function; tests use an in-memory mailbox.
export function authOptions(env, deliver, context = {}) {
  const accountLink = (mode, token) => `${env.APP_ORIGIN}/account.html#${mode}=${encodeURIComponent(token)}${context.join ? '&join=' + encodeURIComponent(context.join) : ''}`;
  return {
    appName: 'Ink Wire Education',
    baseURL: env.APP_ORIGIN,
    basePath: '/api/auth',
    secret: env.BETTER_AUTH_SECRET,
    database: env.AUTH_DB || env.DB,
    trustedOrigins: [env.APP_ORIGIN],
    logger: { disabled: true },
    // Account type selects a workspace. Class membership is checked separately.
    user: { additionalFields: { requestedRole: { type: ['parent', 'student', 'teacher'], required: true, input: true } } },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      resetPasswordTokenExpiresIn: 1800,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }) => {
        await deliver(user.email, 'Reset your Ink Wire password', accountLink('reset', token), 'Reset password', '30 minutes');
      },
    },
    emailVerification: {
      expiresIn: 3600,
      sendOnSignUp: true,
      sendOnSignIn: false,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, token }) => {
        await env.DB.prepare('DELETE FROM activation_links WHERE expires_at < ?').bind(Date.now()).run();
        await env.DB.prepare('INSERT OR IGNORE INTO activation_links (token_hash, email, expires_at) VALUES (?, ?, ?)')
          .bind(await digest(token), normalizeEmail(user.email), Date.now() + 3600000).run();
        await deliver(user.email, 'Activate your Ink Wire account', accountLink('activate', token), 'Activate account', '1 hour');
      },
    },
    verification: { storeIdentifier: 'hashed' },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
    rateLimit: {
      enabled: true, storage: 'database', window: 60, max: 30,
      customRules: {
        '/sign-up/email': { window: 60, max: 3 },
        '/sign-in/email': { window: 60, max: 5 },
        '/request-password-reset': { window: 60, max: 3 },
        '/send-verification-email': { window: 60, max: 3 },
        '/reset-password': { window: 60, max: 5 },
        '/verify-email': { window: 60, max: 5 },
      },
    },
    advanced: {
      useSecureCookies: true,
      ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] },
      defaultCookieAttributes: { httpOnly: true, secure: true, sameSite: 'lax' },
    },
    databaseHooks: {
      user: { create: { before: async user => ({ data: { ...user, email: normalizeEmail(user.email) } }) } },
    },
  };
}

export function createAuth(env, delivery = {}) {
  const options = authOptions(env, async (to, subject, url, action, expiry) => {
    const day = new Date().toISOString().slice(0, 10);
    const budget = await env.DB.prepare(`INSERT INTO email_delivery_budget (day, count) VALUES (?, 1)
      ON CONFLICT(day) DO UPDATE SET count = count + 1 WHERE count < 250 RETURNING count`).bind(day).first();
    if (!budget) throw new Error('Account email daily limit reached');
    await env.EMAIL.send({
      from: { email: env.ACCOUNT_EMAIL, name: 'Ink Wire Education' },
      to,
      subject,
      text: `${action}\n\n${url}\n\nThis link expires in ${expiry}. If you did not request this, you can ignore this email.\n\nInk Wire Education`,
    });
  }, delivery);
  // Better Auth deliberately catches notification failures. Surface a safe failure
  // to our form instead of telling the visitor to expect mail that was not accepted.
  for (const [config, key] of [[options.emailVerification, 'sendVerificationEmail'], [options.emailAndPassword, 'sendResetPassword']]) {
    const send = config[key];
    config[key] = async (...args) => {
      try { await send(...args); } catch { delivery.failed = true; }
    };
  }
  return betterAuth(options);
}
