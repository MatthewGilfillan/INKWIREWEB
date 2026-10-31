(() => {
  'use strict';
  const root = document.querySelector('[data-account-root]');
  if (!root) return;
  const dialog = root.closest('dialog');
  const standalone = document.body.hasAttribute('data-account-page');
  const fragments = new URLSearchParams(standalone ? location.hash.slice(1) : '');
  let token = fragments.get('activate') || fragments.get('reset') || '';
  let view = fragments.has('activate') ? 'activate' : fragments.has('reset') ? 'reset' : 'signin';
  let email = '', accountType = '', account = null, busy = false, requestId = 0;
  if (standalone && location.hash) history.replaceState(null, '', location.pathname);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const titles = { signin: 'Welcome back.', signup: 'Create your account.', verify: 'Check your email.', forgot: 'Reset your password.', forgotSent: 'Check your email.', reset: 'Choose a new password.', activate: 'Activate your account.', account: 'Your account', unavailable: 'Account access' };
  const link = (target, label) => `<button type="button" class="account-link" data-view="${target}">${label}</button>`;
  const emailInput = () => `<label for="account-email">Email</label><input id="account-email" name="email" type="email" autocomplete="email" maxlength="254" required value="${escape(email)}" placeholder="you@example.com">`;
  const accountTypeInput = () => `<label for="account-type">Account type</label><select id="account-type" name="accountType" required><option value="">Select account type</option>${['parent', 'student', 'teacher'].map(role => `<option value="${role}" ${accountType === role ? 'selected' : ''}>${role[0].toUpperCase() + role.slice(1)}</option>`).join('')}</select>`;
  const passwordInput = isNew => `<label for="account-password">${isNew ? 'Set a password' : 'Password'}</label><div class="account-password"><input id="account-password" name="password" type="password" autocomplete="${isNew ? 'new-password' : 'current-password'}" ${isNew ? 'minlength="12" aria-describedby="password-hint"' : ''} maxlength="128" required><button type="button" data-show-password aria-label="Show password" aria-pressed="false">Show</button></div>${isNew ? '<p id="password-hint" class="account-hint">Use at least 12 characters. A few unrelated words make a memorable password.</p>' : ''}`;
  const form = (action, fields, label) => `<form class="account-form" data-action="${action}"><fieldset>${fields}<button class="button full account-submit" type="submit">${label}</button></fieldset></form>`;

  function render(next = view, message = '', error = false) {
    view = next; busy = false;
    let content = '';
    if (view === 'signin') content = `<p>Sign in with your verified email address.</p>${form('signin', emailInput() + passwordInput(false), 'Sign in')}<p>${link('forgot', 'Forgot password?')}</p><p>New to Ink Wire? ${link('signup', 'Create an account')}</p>`;
    if (view === 'signup') content = `<p>Choose your account type, enter your email, and set a password. We’ll email you an activation link.</p>${form('signup', accountTypeInput() + emailInput() + passwordInput(true), 'Create account')}<p class="account-hint">Matthew confirms classroom access and parent–student links. Teacher access requires approval.</p><p>Already registered? ${link('signin', 'Sign in')}</p>`;
    if (view === 'verify') content = `<p>If this address needs activation, an email will arrive with your activation link. The link expires after one hour.</p><p class="account-hint">Check your spam folder too. If you already activated your account, you can sign in.</p>${form('resend', emailInput(), 'Resend activation email')}<p>${link('signin', 'Back to sign in')}</p>`;
    if (view === 'forgot') content = `<p>Enter your account email to request a password reset link.</p>${form('forgot', emailInput(), 'Send reset link')}<p>${link('signin', 'Back to sign in')}</p>`;
    if (view === 'forgotSent') content = `<p>If an account matches that email, you’ll receive a reset link. The link expires after 30 minutes.</p><p class="account-hint">Check your spam folder and allow a few minutes for delivery.</p><p>${link('forgot', 'Request another link')} · ${link('signin', 'Back to sign in')}</p>`;
    if (view === 'activate') content = `<p>Select the button below to confirm your email address and activate your Ink Wire account.</p>${form('activate', '', 'Activate account')}<p>${link('verify', 'Request a new activation link')} · ${link('signin', 'Sign in')}</p>`;
    if (view === 'reset') content = `<p>Set a new password for your Ink Wire account.</p>${form('reset', passwordInput(true), 'Save new password')}<p>${link('forgot', 'Request a new reset link')} · ${link('signin', 'Sign in')}</p>`;
    if (view === 'account') content = `<p class="account-email">${escape(account?.email || email)}</p><p class="account-badge">Email verified</p><h3>Classroom access</h3><p>${account?.requestedRole === 'teacher' ? 'Your account is active. Teacher access awaits Matthew’s approval.' : account?.requestedRole === 'parent' ? 'Your account is active. Matthew will link it to your child’s classroom.' : 'Your account is active. Matthew will arrange access to your classroom.'}</p>${form('signout', '', 'Sign out')}<a class="account-link" href="./">Back to Ink Wire</a>`;
    if (view === 'unavailable') content = `<p>${location.hostname.endsWith('.chatgpt.site') ? 'Use the Ink Wire website to register or sign in.' : 'Account access is temporarily unavailable. Please try again shortly.'}</p><div class="account-retry">${link('retry', 'Try again')}<a class="account-link" href="https://inkwire-education.com/account.html">Open Ink Wire</a></div>`;
    root.innerHTML = `<h2 id="account-title" tabindex="-1">${titles[view]}</h2><p class="account-message${error ? ' is-error' : ''}" role="${error ? 'alert' : 'status'}" ${message ? '' : 'hidden'}>${escape(message)}</p>${content}`;
    if (dialog) dialog.setAttribute('aria-labelledby', 'account-title');
  }

  async function api(path, body) {
    const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: body === undefined ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.message || 'We couldn’t complete that request. Please try again.'), { code: data.code, status: response.status });
    return data;
  }

  async function initialise() {
    const id = ++requestId;
    root.innerHTML = '<h2 id="account-title">Your Ink Wire account</h2><p role="status">Connecting…</p>';
    try {
      const status = await api('/api/status');
      if (id !== requestId) return;
      if (!status.accountsReady) return render('unavailable');
      if (token) return render(view);
      try { account = await api('/api/account'); }
      catch (error) { if (error.status !== 401) throw error; account = null; }
      if (id !== requestId) return;
      render(account ? 'account' : 'signin');
    } catch { if (id === requestId) render('unavailable'); }
  }

  root.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || busy) return;
    if (button.hasAttribute('data-show-password')) {
      const input = root.querySelector('#account-password');
      const show = input.type === 'password'; input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Hide' : 'Show'; button.setAttribute('aria-label', `${show ? 'Hide' : 'Show'} password`); button.setAttribute('aria-pressed', String(show)); return;
    }
    if (button.dataset.view) {
      email = root.querySelector('[name="email"]')?.value.trim() || email;
      if (button.dataset.view === 'retry') initialise();
      else { render(button.dataset.view); root.querySelector('h2').focus(); }
    }
  });
  root.addEventListener('submit', async event => {
    const form = event.target.closest('form[data-action]');
    if (!form) return;
    event.preventDefault(); if (busy || !form.reportValidity()) return;
    const action = form.dataset.action, data = new FormData(form);
    email = data.get('email')?.trim() || email;
    accountType = data.get('accountType') || accountType;
    const body = action === 'reset' ? { token, newPassword: data.get('password') } : action === 'activate' ? { token } : action === 'signout' ? {} : { email, ...(data.has('password') ? { password: data.get('password') } : {}) };
    if (action === 'signup') body.accountType = accountType;
    busy = true; form.querySelector('fieldset').disabled = true;
    const message = root.querySelector('.account-message'); message.hidden = false; message.classList.remove('is-error'); message.textContent = 'Please wait…';
    try {
      await api('/api/accounts/' + action, body);
      if (action === 'signup' || action === 'resend') render('verify', action === 'resend' ? 'Request received. Please allow a few minutes for delivery.' : 'Your registration request was received.');
      if (action === 'forgot') render('forgotSent');
      if (action === 'activate') { token = ''; render('signin', 'Your account is activated. You can now sign in.'); }
      if (action === 'reset') { token = ''; render('signin', 'Your password has been updated. Sign in with your new password.'); }
      if (action === 'signout') { account = null; render('signin', 'You’re signed out.'); }
      if (action === 'signin') { account = await api('/api/account'); render('account'); }
      root.querySelector('h2').focus();
    } catch (error) {
      const text = error.name === 'TimeoutError' || error.name === 'TypeError' ? 'We couldn’t confirm the result. Check your email before trying again, or use Sign in if you have already activated your account.' : error.message;
      render(error.code === 'EMAIL_NOT_VERIFIED' ? 'verify' : view, text, true);
    }
  });

  document.querySelectorAll('[data-signin]').forEach(button => button.addEventListener('click', () => {
    const previews = dialog?.querySelector('.dashboard-previews');
    if (previews) previews.open = button.hasAttribute('data-dashboard-preview');
    if (dialog && !dialog.open) dialog.showModal();
    initialise();
  }));
  if (dialog) {
    dialog.querySelector('.dialog-close')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { requestId++; root.querySelectorAll('input[type="password"], #account-password').forEach(input => { input.value = ''; }); });
    dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  }
  if (standalone) initialise();
  else if (new URLSearchParams(location.search).get('signin') === '1') { dialog.showModal(); initialise(); }
})();
