(() => {
  'use strict';
  const root = document.querySelector('[data-account-root]');
  if (!root) return;
  const dialog = root.closest('dialog');
  const standalone = document.body.hasAttribute('data-account-page');
  const fragments = new URLSearchParams(standalone ? location.hash.slice(1) : '');
  let token = fragments.get('activate') || fragments.get('reset') || '';
  const joinValue = fragments.get('join') || '';
  const pendingJoin = /^(class\.[A-HJ-NP-Z2-9]{8}|(?:student|family)\.[A-HJ-NP-Z2-9]{12})$/.test(joinValue) ? joinValue : '';
  const joinHash = pendingJoin ? '#join=' + pendingJoin : '';
  const invitedRole = pendingJoin.startsWith('family.') ? 'parent' : pendingJoin ? 'student' : '';
  const entryView = new URLSearchParams(location.search).get('mode') === 'signup' ? 'signup' : 'signin';
  let view = fragments.has('activate') ? 'activate' : fragments.has('reset') ? 'reset' : entryView;
  let email = '', accountType = invitedRole, rememberMe = false, account = null, busy = false, requestId = 0, availability = 'checking';
  if (standalone && location.hash) history.replaceState(null, '', location.pathname + location.search + joinHash);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const titles = { signin: 'Sign in', signup: 'Create account', verify: 'Check your email.', forgot: 'Reset your password.', forgotSent: 'Check your email.', reset: 'Choose a new password.', activate: 'Activate your account.', account: 'Your account', unavailable: 'Account access' };
  const link = (target, label) => `<button type="button" class="account-link" data-view="${target}">${label}</button>`;
  const emailInput = () => `<label for="account-email">Email</label><input id="account-email" name="email" type="email" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="254" required value="${escape(email)}" placeholder="you@example.com">`;
  const accountTypeInput = () => `<label for="account-type">Account type</label><select id="account-type" name="accountType" required><option value="">Select account type</option>${(invitedRole ? [invitedRole] : ['parent', 'student', 'teacher']).map(role => `<option value="${role}" ${accountType === role ? 'selected' : ''}>${role[0].toUpperCase() + role.slice(1)}</option>`).join('')}</select>`;
  const passwordInput = isNew => `<label for="account-password">${isNew ? 'Set a password' : 'Password'}</label><div class="account-password"><input id="account-password" name="password" type="password" autocomplete="${isNew ? 'new-password' : 'current-password'}" ${isNew ? 'minlength="12" aria-describedby="password-hint"' : ''} maxlength="128" required><button type="button" data-show-password aria-label="Show password" aria-pressed="false">Show</button></div>${isNew ? '<p id="password-hint" class="account-hint">Use at least 12 characters. You can use a memorable passphrase.</p>' : ''}`;
  const form = (action, fields, label) => `<form class="account-form" data-action="${action}"><fieldset ${availability !== 'ready' ? 'disabled' : ''}>${fields}<button class="button full account-submit" type="submit">${label}</button></fieldset></form>`;
  const dashboardPath = () => account?.classroomStatus === 'active' && ['teacher','student','parent'].includes(account?.role) && account?.dashboardPath === '/' + account.role ? account.dashboardPath : '';
  function showAccount() {
    render('account');
    if (pendingJoin) location.replace('/join#' + pendingJoin.replace('.', '='));
    else if (dashboardPath() && new URLSearchParams(location.search).get('manage') !== '1') location.replace(dashboardPath());
  }

  function render(next = view, message = '', error = false) {
    view = next; busy = false;
    let content = '';
    if (view === 'signin') content = `<p>Access your Ink Wire account.</p>${form('signin', emailInput() + passwordInput(false) + `<label class="account-remember"><input name="rememberMe" type="checkbox" aria-describedby="remember-hint" ${rememberMe ? 'checked' : ''}><span>Remember me</span></label><p id="remember-hint" class="account-hint">Uses a sign-in cookie to remember this device for up to 7 days. Leave unchecked on a shared device.</p>`, 'Sign in')}<p>${link('forgot', 'Forgot password?')}</p>`;
    if (view === 'signup') content = `<p>Register with your email and password. We’ll send a link to activate your account.</p>${form('signup', accountTypeInput() + emailInput() + passwordInput(true), 'Create account')}<p class="account-hint">Verify your email, then open your invitation to connect to your class or child. Teachers can create their own classes.</p>`;
    if (view === 'verify') content = `<p>If this address needs activation, an email will arrive with your activation link. The link expires after one hour.</p><p class="account-hint">Check your spam folder too. If you already activated your account, you can sign in.</p>${form('resend', emailInput(), 'Resend activation email')}<p>${link('signin', 'Back to sign in')}</p>`;
    if (view === 'forgot') content = `<p>Enter your account email to request a password reset link.</p>${form('forgot', emailInput(), 'Send reset link')}<p>${link('signin', 'Back to sign in')}</p>`;
    if (view === 'forgotSent') content = `<p>If an account matches that email, you’ll receive a reset link. The link expires after 30 minutes.</p><p class="account-hint">Check your spam folder and allow a few minutes for delivery.</p><p>${link('forgot', 'Request another link')} · ${link('signin', 'Back to sign in')}</p>`;
    if (view === 'activate') content = `<p>Select the button below to confirm your email address and activate your Ink Wire account.</p>${form('activate', '', 'Activate account')}<p>${link('verify', 'Request a new activation link')} · ${link('signin', 'Sign in')}</p>`;
    if (view === 'reset') content = `<p>Set a new password for your Ink Wire account.</p>${form('reset', passwordInput(true), 'Save new password')}<p>${link('forgot', 'Request a new reset link')} · ${link('signin', 'Sign in')}</p>`;
    if (view === 'account') content = `<p class="account-email">${escape(account?.email || email)}</p><p class="account-badge">Email verified</p><h3>Classroom access</h3>${dashboardPath() ? `<p>Your ${escape(account.role)} account is active.</p><a class="account-submit account-dashboard" href="${dashboardPath()}">Open ${escape(account.role)} dashboard →</a>` : `<p>${account?.requestedRole === 'teacher' ? 'Your account is active. Please reload to open your teacher dashboard.' : account?.requestedRole === 'parent' ? 'Your account is active. Matthew will link it to your child’s classroom.' : 'Your account is active. Matthew will arrange access to your classroom.'}</p>`}${form('signout', '', 'Sign out')}${standalone ? '' : '<a class="account-link" href="./">Back to Ink Wire</a>'}`;
    if (view === 'unavailable') content = `<p>${location.hostname.endsWith('.chatgpt.site') ? 'Use the Ink Wire website to register or sign in.' : 'Account access is temporarily unavailable. Please try again shortly.'}</p><div class="account-retry">${link('retry', 'Try again')}<a class="account-link" href="https://inkwire-education.com/account.html">Open Ink Wire</a></div>`;
    const tabs = ['signin', 'signup'].includes(view) ? `<div class="account-tabs" role="group" aria-label="Account options"><button type="button" data-view="signin" aria-pressed="${view === 'signin'}">Sign in</button><button type="button" data-view="signup" aria-pressed="${view === 'signup'}">Create account</button></div>` : '';
    const notice = availability === 'ready' ? '' : `<div class="account-availability" role="status">${availability === 'checking' ? 'Connecting securely…' : `Account access is temporarily unavailable. Please try again shortly.<div class="account-retry">${link('retry', 'Try again')}${location.hostname.endsWith('.chatgpt.site') ? '<a class="account-link" href="https://inkwire-education.com/account">Open Ink Wire website</a>' : ''}</div>`}</div>`;
    root.innerHTML = `${tabs}<h2 id="account-title" tabindex="-1">${titles[view]}</h2><p class="account-message${error ? ' is-error' : ''}" tabindex="-1" role="${error ? 'alert' : 'status'}" ${message ? '' : 'hidden'}>${escape(message)}</p>${notice}${content}`;
    root.setAttribute('aria-busy', 'false');
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
    availability = 'checking';
    if (view === 'account' || view === 'unavailable') view = entryView;
    render(view);
    try {
      const status = await api('/api/status');
      if (id !== requestId) return;
      if (!status.accountsReady) { availability = 'unavailable'; return render(view); }
      if (token) { availability = 'ready'; return render(view); }
      let currentAccount;
      try { currentAccount = await api('/api/account'); }
      catch (error) { if (error.status !== 401) throw error; currentAccount = null; }
      if (id !== requestId) return;
      account = currentAccount; availability = 'ready';
      if (account) showAccount(); else render(view);
    } catch { if (id === requestId) { availability = 'unavailable'; render(view); } }
  }

  function rememberFields() {
    const emailField = root.querySelector('[name="email"]');
    const roleField = root.querySelector('[name="accountType"]');
    const rememberField = root.querySelector('[name="rememberMe"]');
    if (emailField) email = emailField.value.trim();
    if (roleField) accountType = roleField.value;
    if (rememberField) rememberMe = rememberField.checked;
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
      rememberFields();
      if (button.dataset.view === 'retry') initialise();
      else {
        render(button.dataset.view);
        if (standalone && ['signin', 'signup'].includes(view)) history.replaceState(null, '', location.pathname + (view === 'signup' ? '?mode=signup' : '') + joinHash);
        root.querySelector('h2').focus();
      }
    }
  });
  root.addEventListener('submit', async event => {
    const form = event.target.closest('form[data-action]');
    if (!form) return;
    event.preventDefault(); if (busy || availability !== 'ready' || !form.reportValidity()) return;
    const id = ++requestId, submittedView = view;
    const action = form.dataset.action, data = new FormData(form);
    email = data.get('email')?.trim() || email;
    accountType = data.get('accountType') || accountType;
    const body = action === 'reset' ? { token, newPassword: data.get('password') } : action === 'activate' ? { token } : action === 'signout' ? {} : { email, ...(data.has('password') ? { password: data.get('password') } : {}) };
    if (action === 'signup') body.accountType = accountType;
    if (pendingJoin && ['signup','resend','forgot'].includes(action)) body.join = pendingJoin;
    if (action === 'signin') { rememberMe = data.has('rememberMe'); body.rememberMe = rememberMe; }
    busy = true; root.setAttribute('aria-busy', 'true');
    root.querySelectorAll('button').forEach(button => { button.disabled = true; });
    form.querySelector('fieldset').disabled = true;
    const message = root.querySelector('.account-message'); message.hidden = false; message.classList.remove('is-error'); message.textContent = 'Please wait…'; message.setAttribute('role', 'status');
    try {
      await api('/api/accounts/' + action, body);
      if (id !== requestId) return;
      if (action === 'signup' || action === 'resend') render('verify', action === 'resend' ? 'Request received. Please allow a few minutes for delivery.' : 'Your registration request was received.');
      if (action === 'forgot') render('forgotSent');
      if (action === 'activate') { token = ''; render('signin', 'Your account is activated. You can now sign in.'); }
      if (action === 'reset') { token = ''; render('signin', 'Your password has been updated. Sign in with your new password.'); }
      if (action === 'signout') { account = null; rememberMe = false; render('signin', 'You’re signed out.'); }
      if (action === 'signin') {
        const signedInAccount = await api('/api/account');
        if (id !== requestId) return;
        account = signedInAccount; showAccount();
      }
      root.querySelector('h2').focus();
    } catch (error) {
      if (id !== requestId) return;
      const networkMessage = ['signup', 'resend', 'forgot'].includes(action)
        ? 'We couldn’t confirm delivery. Check your email before requesting another link.'
        : action === 'reset' ? 'We couldn’t confirm the update. Try signing in with your new password before requesting another reset.'
        : 'We couldn’t complete the connection. Please try again.';
      const text = error.name === 'TimeoutError' || error.name === 'TypeError' ? networkMessage : error.message;
      render(error.code === 'EMAIL_NOT_VERIFIED' ? 'verify' : submittedView, text, true);
      root.querySelector('.account-message').focus();
    }
  });

  document.querySelectorAll('[data-signin]').forEach(button => button.addEventListener('click', event => {
    if (!dialog) return;
    event.preventDefault();
    view = entryView;
    const previews = dialog?.querySelector('.dashboard-previews');
    if (previews) previews.open = button.hasAttribute('data-dashboard-preview');
    if (dialog && !dialog.open) dialog.showModal();
    initialise();
  }));
  if (dialog) {
    dialog.querySelector('.dialog-close')?.addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { requestId++; busy = false; root.querySelectorAll('input[type="password"], #account-password').forEach(input => { input.value = ''; }); });
    dialog.addEventListener('click', event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  }
  if (standalone) initialise();
  else if (new URLSearchParams(location.search).get('signin') === '1') { dialog.showModal(); initialise(); }
})();
