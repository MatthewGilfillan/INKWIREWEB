/* Runs only in the separate classroom WKWebView, before the page's scripts. */
(() => {
  const params = new URLSearchParams(location.search);
  const base = '/api/class-boards/classes/' + params.get('classId');
  const route = base + '/' + params.get('boardId');
  let authorized = false, lastApproved = false, notice = '', sent = '', queued = false;
  const style = document.createElement('style');
  style.textContent = `
    html:not([data-inkwire-projection="ready"]) body{visibility:hidden!important}
    html{color-scheme:light!important}
    .class-board-host button,.class-board-host form,.class-board-host dialog,
    .class-board-host input,.class-board-host select,.class-board-host textarea,
    .board-post-menu,.class-board-author-style,.class-board-removed-list,
    .class-board-comment.is-removed,.class-board-thread,.class-board-post footer,
    .class-board-post-tools,.class-board-heading-actions,.class-board-status,
    .class-board-meta,[data-board-state],.board-back-link,.reading-header-filters,
    .story-view-tools,.story-teacher-tools,.story-reflection,.story-control-panel,
    .story-standard-chips,.venn-scroll-hint,#embedded-status{display:none!important}
    .class-board-host a{pointer-events:none!important;color:inherit}
    .class-board-host [draggable]{cursor:default!important}
    dialog::backdrop{display:none!important}
    .class-board-heading{padding-block:12px!important}
    .class-board-heading h2{margin:0!important}
  `;
  function state(allowed, message = '') {
    authorized = allowed; notice = message;
    document.documentElement?.setAttribute('data-inkwire-projection', allowed ? 'ready' : 'waiting');
    refresh();
  }
  function refresh() {
    if (queued) return; queued = true;
    requestAnimationFrame(() => {
      queued = false;
      if (!style.isConnected) (document.head || document.documentElement)?.append(style);
      const title = document.querySelector('[data-board-title]')?.textContent?.trim();
      const ready = !!(authorized && title && document.querySelector('[data-board-posts]'));
      const message = JSON.stringify({ ready, title: ready ? title : '', message: notice });
      if (message !== sent) {
        sent = message;
        window.webkit?.messageHandlers?.classroomDisplay?.postMessage(JSON.parse(message));
      }
    });
  }
  new MutationObserver(refresh).observe(document, { childList: true, subtree: true });
  state(false);
  // Do not restore, overwrite or delete teacher drafts from the shared profile.
  for (const name of ['getItem', 'setItem', 'removeItem']) {
    const original = Storage.prototype[name];
    Storage.prototype[name] = function (key, ...rest) {
      if (String(key).startsWith('inkwire-board-draft:')) return name === 'getItem' ? null : undefined;
      return original.call(this, key, ...rest);
    };
  }
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, options = {}) => {
    const request = input instanceof Request ? input : null;
    const url = new URL(request?.url || input, location.href);
    const method = String(options.method || request?.method || 'GET').toUpperCase();
    if (!['GET', 'HEAD'].includes(method)) throw new Error('The classroom display is read only.');
    const endpoint = url.origin === location.origin ? url.pathname : '';
    const snapshot = endpoint.startsWith(route + '/snapshots/');
    if (endpoint.startsWith('/api/') && endpoint !== base && endpoint !== route && !snapshot) throw new Error('This information stays in the teacher workspace.');
    if (snapshot && !authorized) throw new Error('Open the shared board before displaying its final result.');
    try {
      const response = await originalFetch(input, options);
      if (endpoint !== base && endpoint !== route && !snapshot) return response;
      if (response.status === 304) { if (endpoint === route) state(lastApproved); return response; }
      if (!response.ok) { lastApproved = false; state(false, 'Open the teacher workspace to reconnect this board.'); return response; }
      const value = await response.json();
      const safe = endpoint === base ? { userId: value.userId } : snapshot ? InkWireProjectionPolicy.snapshot(value) : InkWireProjectionPolicy.board(value);
      if (!safe) {
        lastApproved = false; state(false, 'This board is not open to the class.');
        return new Response(JSON.stringify({ message: 'This board is not open to the class.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
      if (endpoint === route) { lastApproved = true; state(true); }
      return new Response(JSON.stringify(safe), { status: response.status, headers: response.headers });
    } catch (error) { state(false, 'Reconnecting to the class board…'); throw error; }
  };
  // Scrolling stays available; edits, dialogs, links, keyboard card actions,
  // drag-and-drop, and write requests are disabled on this display.
  for (const name of ['click', 'dblclick', 'submit', 'dragstart', 'dragover', 'drop', 'beforeinput']) {
    window.addEventListener(name, event => { event.preventDefault(); event.stopImmediatePropagation(); }, true);
  }
  window.addEventListener('keydown', event => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', 'Escape'].includes(event.key)) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
})();
