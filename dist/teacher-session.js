(() => {
  if (!document.body.hasAttribute('data-teacher-workspace')) return;
  const $ = selector => document.querySelector(selector);
  const list = $('#class-list'), status = $('#dashboard-status'), retry = $('#retry-classes');
  const escape = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let loading = false, createRequestId = '', classrooms = [], returnFocus;
  async function api(path, body) {
    const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: body === undefined ? { Accept: 'application/json' } : { 'Content-Type': 'application/json', Accept: 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000) });
    if (response.status === 401 || response.status === 403) { list.replaceChildren(); location.replace('/account'); throw new Error('Please sign in again.'); }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || 'Could not complete this request. Please try again.');
    return result;
  }
  function renderClasses() {
    list.innerHTML = classrooms.length ? classrooms.map(c => `<details class="class-card" data-class-id="${escape(c.id)}"><summary><span><h2>${escape(c.name)}</h2><small>${escape(c.subject || 'Class details')}</small></span></summary><div class="class-details"><span class="class-badge">${c.membership === 'owner' ? 'Class owner' : 'Joined teacher'}</span><p>Created ${escape(new Date(c.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }))}</p>${c.membership === 'owner' ? '<p>Invite another teacher to this class. Codes last seven days. Creating a new code replaces the previous one.</p><button type="button" class="teacher-button secondary" data-invite="'+escape(c.id)+'">Create teacher invite</button>' : '<p>You joined this class with a teacher invite.</p>'}</div></details>`).join('') : '<div class="empty-classes"><h2>No classes yet</h2><p>Create your first class, or join one with an invite code.</p></div>';
  }
  async function loadClasses() {
    if (loading) return;
    loading = true; retry.hidden = true; status.textContent = 'Loading your classes…';
    try { classrooms = (await api('/api/classes')).classes; renderClasses(); status.textContent = ''; }
    catch (error) { status.textContent = error.message; retry.hidden = false; }
    finally { loading = false; }
  }
  function openDialog(id, button) { returnFocus = button; const dialog = document.getElementById(id); dialog.showModal(); }
  document.querySelectorAll('[data-open]').forEach(button => button.addEventListener('click', () => openDialog(button.dataset.open, button)));
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { if (returnFocus?.isConnected) returnFocus.focus(); });
  });
  for (const [id, route] of [['create-form','/api/classes'],['join-form','/api/classes/join']]) {
    const form = document.getElementById(id);
    form.addEventListener('submit', async event => {
      event.preventDefault(); const submit = form.querySelector('[type="submit"]'), error = form.querySelector('.form-error');
      if (submit.disabled) return;
      submit.disabled = true; error.hidden = true;
      const data = new FormData(form), body = Object.fromEntries(data);
      if (id === 'create-form') { createRequestId ||= crypto.randomUUID(); body.requestId = createRequestId; }
      try {
        const result = await api(route, body);
        form.closest('dialog').close(); form.reset(); if (id === 'create-form') createRequestId = '';
        await loadClasses();
        const card = list.querySelector('[data-class-id="'+result.classroom.id+'"]');
        if (card) { card.open = true; card.querySelector('summary').focus(); }
        status.textContent = id === 'create-form' ? 'Class created.' : 'You have joined the class.';
      } catch (problem) { error.textContent = problem.message; error.hidden = false; }
      finally { submit.disabled = false; }
    });
  }
  list.addEventListener('click', async event => {
    const button = event.target.closest('[data-invite]');
    if (!button || button.disabled) return;
    button.disabled = true;
    try {
      const invitation = await api('/api/classes/'+button.dataset.invite+'/invite', {});
      $('#created-code').value = invitation.code.match(/.{4}/g).join('-');
      $('#invite-class-name').textContent = classrooms.find(c => c.id === button.dataset.invite)?.name || '';
      $('#invite-expiry').textContent = 'Expires '+new Date(invitation.expiresAt).toLocaleString()+'.';
      $('#copy-status').textContent = '';
      openDialog('teacher-invite', button);
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });
  $('#copy-code').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('#created-code').value); $('#copy-status').textContent = 'Copied.'; }
    catch { $('#created-code').focus(); $('#created-code').select(); $('#copy-status').textContent = 'Select and copy the code above.'; }
  });
  $('[data-session-signout]').addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true;
    try { await api('/api/accounts/signout', {}); list.replaceChildren(); location.replace('/account'); }
    catch (error) { status.textContent = error.message; button.disabled = false; }
  });
  retry.addEventListener('click', loadClasses);
  window.addEventListener('pageshow', loadClasses);
  window.addEventListener('pagehide', () => list.replaceChildren());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !document.querySelector('dialog[open]')) loadClasses(); });
  loadClasses();
})();
