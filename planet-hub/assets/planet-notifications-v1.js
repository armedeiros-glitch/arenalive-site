(() => {
  'use strict';

  const API = '/api/hub/planet/notifications';
  const LEADS_API = '/api/hub/planet/leads';
  const RECENT_WINDOW_MS = 86400000;
  const state = { items: [], unread: 0, unreadRecent: 0, loading: false, error: '', open: false, filter: 'all' };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const relativeTime = (value) => {
    const timestamp = Date.parse(value || 0);
    if (!timestamp) return 'Agora';
    const diff = Math.max(0, Date.now() - timestamp);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours}h`;
    const days = Math.floor(hours / 24);
    return `há ${days}d`;
  };

  const recentUnreadFrom = (items) => (Array.isArray(items) ? items : []).filter((item) => {
    if (item.readAt || item.resolvedAt) return false;
    const timestamp = Date.parse(item.updatedAt || item.createdAt || 0);
    return Number.isFinite(timestamp) && Math.max(0, Date.now() - timestamp) < RECENT_WINDOW_MS;
  }).length;

  const applyUnreadCounts = (payload = {}) => {
    state.unread = Number(payload.unread) || 0;
    const providedRecent = Number(payload.unreadRecent);
    state.unreadRecent = Number.isFinite(providedRecent)
      ? Math.max(0, providedRecent)
      : recentUnreadFrom(state.items);
  };

  const injectStyles = () => {
    if (document.querySelector('[data-planet-notification-styles]')) return;
    const style = document.createElement('style');
    style.dataset.planetNotificationStyles = '1';
    style.textContent = `
      .aos-notification-trigger{position:relative;width:42px;height:42px;border:1px solid #e3d4cd;border-radius:13px;background:#fff;color:#392d28;font-size:19px;cursor:pointer;display:grid;place-items:center}
      .aos-notification-trigger:hover,.aos-notification-trigger.active{border-color:#7558e8;background:#f5f1ff;color:#5d45c7}
      .aos-notification-badge{position:absolute;right:-5px;top:-6px;min-width:20px;height:20px;padding:0 5px;border:2px solid #fff;border-radius:999px;background:#d94b4b;color:#fff;font-size:10px;font-weight:900;display:grid;place-items:center}
      .aos-notification-badge[hidden]{display:none}
      .aos-notification-panel{position:fixed;z-index:1200;right:20px;top:76px;width:min(420px,calc(100vw - 28px));max-height:calc(100vh - 96px);display:none;grid-template-rows:auto auto minmax(0,1fr);overflow:hidden;border:1px solid #e4d6cf;border-radius:20px;background:#fff;box-shadow:0 22px 70px rgba(39,28,24,.2)}
      .aos-notification-panel.open{display:grid}
      .aos-notification-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 18px 12px}.aos-notification-head h2{margin:0;font-size:19px}.aos-notification-head div{display:flex;gap:8px}
      .aos-notification-head button,.aos-notification-filters button,.aos-notification-actions button{border:0;border-radius:10px;background:#f2ece9;color:#554640;font-weight:800;cursor:pointer;padding:8px 10px}
      .aos-notification-head button:hover,.aos-notification-actions button:hover{background:#e9e0dc}.aos-notification-head [data-notification-close]{font-size:18px;padding:6px 10px}
      .aos-notification-filters{display:flex;gap:7px;padding:0 18px 14px;border-bottom:1px solid #eee4df;overflow:auto}.aos-notification-filters button{white-space:nowrap;font-size:12px}.aos-notification-filters button.active{background:#6e54df;color:#fff}
      .aos-notification-list{overflow:auto;padding:14px 14px 20px;display:grid;gap:14px}.aos-notification-group{display:grid;gap:8px}.aos-notification-group>small{padding:0 4px;color:#8a756c;font-weight:900;font-size:11px;letter-spacing:.08em}
      .aos-notification-card{position:relative;display:grid;gap:8px;padding:14px;border:1px solid #e7dad4;border-radius:15px;background:#fff}.aos-notification-card.unread{border-color:#b9a9f2;background:#faf8ff}.aos-notification-card.high:before{content:'';position:absolute;left:-1px;top:13px;bottom:13px;width:4px;border-radius:0 4px 4px 0;background:#d9534f}.aos-notification-card.medium:before{content:'';position:absolute;left:-1px;top:13px;bottom:13px;width:4px;border-radius:0 4px 4px 0;background:#e6a23c}
      .aos-notification-title{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.aos-notification-title strong{font-size:14px}.aos-notification-title time{color:#8c776f;font-size:11px;white-space:nowrap}.aos-notification-card p{margin:0;color:#65544d;font-size:13px;line-height:1.4}.aos-notification-meta{display:flex;flex-wrap:wrap;gap:6px}.aos-notification-meta span{padding:5px 8px;border-radius:999px;background:#f1ece9;color:#66534b;font-size:10px;font-weight:800}.aos-notification-meta b{padding:5px 8px;border-radius:999px;background:#eee9ff;color:#5d45c7;font-size:10px}
      .aos-notification-actions{display:flex;gap:8px}.aos-notification-actions [data-notification-open]{background:#6e54df;color:#fff}.aos-notification-actions [data-notification-open]:hover{background:#5c44c7}
      .aos-notification-empty{padding:34px 18px;text-align:center;color:#76635b}.aos-notification-error{padding:12px;border:1px solid #efb7b7;border-radius:12px;background:#fff2f2;color:#8d2c2c}
      @media(max-width:760px){.aos-notification-panel{right:8px;top:64px;width:calc(100vw - 16px);max-height:calc(100vh - 74px);border-radius:18px}.aos-notification-head{padding:15px 15px 10px}.aos-notification-filters{padding:0 15px 12px}.aos-notification-list{padding:12px}}
    `;
    document.head.appendChild(style);
  };

  const filteredItems = () => state.items
    .filter((item) => !item.resolvedAt)
    .filter((item) => state.filter === 'all' || (state.filter === 'new' ? item.type === 'lead.new' : item.type === 'lead.updated'))
    .sort((a, b) => Date.parse(b.updatedAt || b.createdAt || 0) - Date.parse(a.updatedAt || a.createdAt || 0));

  const card = (item) => `<article class="aos-notification-card ${esc(item.priority)} ${item.readAt ? '' : 'unread'}" data-notification-id="${esc(item.id)}">
    <div class="aos-notification-title"><strong>${esc(item.title)}</strong><time>${esc(relativeTime(item.updatedAt || item.createdAt))}</time></div>
    <p>${esc(item.summary)}</p>
    <div class="aos-notification-meta">
      <span>${item.type === 'lead.new' ? 'NOVO LEAD' : 'MOVIMENTAÇÃO'}</span>
      ${Number(item.count) > 1 ? `<b>${esc(item.count)} atualizações agrupadas</b>` : ''}
      ${(item.changes || []).slice(0, 3).map((value) => `<span>${esc(value)}</span>`).join('')}
    </div>
    <div class="aos-notification-actions">
      ${item.leadId ? `<button type="button" data-notification-open="${esc(item.leadId)}" data-notification-read="${esc(item.id)}">Abrir lead</button>` : ''}
      ${item.readAt ? '' : `<button type="button" data-notification-mark-read="${esc(item.id)}">Marcar como lida</button>`}
    </div>
  </article>`;

  const group = (label, items) => items.length ? `<section class="aos-notification-group"><small>${label}</small>${items.map(card).join('')}</section>` : '';

  const render = () => {
    const panel = document.querySelector('[data-notification-panel]');
    const trigger = document.querySelector('[data-notification-trigger]');
    const badge = document.querySelector('[data-notification-badge]');
    if (!panel || !trigger || !badge) return;

    trigger.classList.toggle('active', state.open);
    badge.hidden = state.unreadRecent <= 0;
    badge.textContent = state.unreadRecent > 99 ? '99+' : String(state.unreadRecent || '');
    badge.title = state.unread > state.unreadRecent
      ? `${state.unreadRecent} novas nas últimas 24h · ${state.unread} pendentes no histórico`
      : `${state.unreadRecent} notificações não lidas nas últimas 24h`;
    panel.classList.toggle('open', state.open);

    const items = filteredItems();
    const recent = items.filter((item) => Date.now() - Date.parse(item.updatedAt || item.createdAt || 0) < RECENT_WINDOW_MS);
    const previous = items.filter((item) => !recent.includes(item));

    panel.innerHTML = `<header class="aos-notification-head">
      <div><h2>Notificações</h2></div>
      <div>${state.unread ? `<button type="button" data-notification-read-all>Ler todas (${state.unread})</button>` : ''}<button type="button" data-notification-close>×</button></div>
    </header>
    <nav class="aos-notification-filters">
      <button type="button" data-notification-filter="all" class="${state.filter === 'all' ? 'active' : ''}">Tudo</button>
      <button type="button" data-notification-filter="new" class="${state.filter === 'new' ? 'active' : ''}">Novos leads</button>
      <button type="button" data-notification-filter="updates" class="${state.filter === 'updates' ? 'active' : ''}">Movimentações</button>
    </nav>
    <div class="aos-notification-list">
      ${state.error ? `<div class="aos-notification-error">${esc(state.error)}</div>` : ''}
      ${state.loading ? '<div class="aos-notification-empty">Carregando notificações…</div>' : items.length ? `${group('AGORA', recent)}${group('ANTERIORES', previous)}` : '<div class="aos-notification-empty">Nenhuma notificação pendente.</div>'}
    </div>`;
  };

  const ensureShell = () => {
    injectStyles();
    const actions = document.querySelector('.pmh-top-actions');
    if (!actions) return false;

    if (!document.querySelector('[data-notification-trigger]')) {
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'aos-notification-trigger';
      trigger.dataset.notificationTrigger = '1';
      trigger.title = 'Notificações';
      trigger.setAttribute('aria-label', 'Abrir notificações');
      trigger.innerHTML = `🔔<span class="aos-notification-badge" data-notification-badge hidden></span>`;
      const refresh = actions.querySelector('[data-refresh]');
      actions.insertBefore(trigger, refresh || null);
    }

    if (!document.querySelector('[data-notification-panel]')) {
      const panel = document.createElement('aside');
      panel.className = 'aos-notification-panel';
      panel.dataset.notificationPanel = '1';
      document.body.appendChild(panel);
    }
    render();
    return true;
  };

  const load = async ({ silent = false } = {}) => {
    if (!silent) state.loading = true;
    state.error = '';
    render();
    try {
      const response = await fetch(API, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
      state.items = Array.isArray(payload.data) ? payload.data : [];
      applyUnreadCounts(payload);
      window.AndreOS?.events?.emit?.('notifications.updated', {
        tenantId: 'planet', area: 'expansion', unread: state.unread, unreadRecent: state.unreadRecent, items: state.items,
      }, { retain: true, dedupeKey: `${payload.revision || 'none'}:${state.unread}:${state.unreadRecent}` });
    } catch (error) {
      state.error = error instanceof Error ? error.message : String(error);
    } finally {
      state.loading = false;
      render();
    }
  };

  const updateNotifications = async (action, id = '') => {
    const response = await fetch(API, {
      method: 'PUT',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, id }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
    state.items = Array.isArray(payload.data) ? payload.data : state.items;
    applyUnreadCounts(payload);
    render();
  };

  const markLeadViewed = async (leadId) => {
    await fetch(LEADS_API, {
      method: 'PUT',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: leadId, changes: { viewedAt: new Date().toISOString() } }),
    }).catch(() => null);
  };

  const openLead = async (leadId, notificationId) => {
    try {
      if (notificationId) await updateNotifications('read', notificationId);
    } catch (_) {}
    await markLeadViewed(leadId);
    sessionStorage.setItem('planet-expansion-open-lead', leadId);
    state.open = false;
    render();
    if (location.hash === '#expansao') {
      window.dispatchEvent(new CustomEvent('planet:open-lead', { detail: { leadId } }));
    } else {
      location.hash = '#expansao';
    }
  };

  document.addEventListener('click', async (event) => {
    const trigger = event.target.closest?.('[data-notification-trigger]');
    if (trigger) {
      event.preventDefault();
      state.open = !state.open;
      render();
      if (state.open) load({ silent: true });
      return;
    }

    if (event.target.closest?.('[data-notification-close]')) {
      state.open = false;
      render();
      return;
    }

    const filter = event.target.closest?.('[data-notification-filter]');
    if (filter) {
      state.filter = filter.dataset.notificationFilter || 'all';
      render();
      return;
    }

    if (event.target.closest?.('[data-notification-read-all]')) {
      try { await updateNotifications('read_all'); } catch (error) { state.error = error.message; render(); }
      return;
    }

    const mark = event.target.closest?.('[data-notification-mark-read]');
    if (mark) {
      try { await updateNotifications('read', mark.dataset.notificationMarkRead); } catch (error) { state.error = error.message; render(); }
      return;
    }

    const open = event.target.closest?.('[data-notification-open]');
    if (open) {
      await openLead(open.dataset.notificationOpen, open.dataset.notificationRead || '');
      return;
    }

    if (state.open && !event.target.closest?.('[data-notification-panel]')) {
      state.open = false;
      render();
    }
  });

  window.addEventListener('pmh:view-rendered', ensureShell);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') load({ silent: true });
  });

  const observer = new MutationObserver(() => {
    if (ensureShell()) observer.disconnect();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  ensureShell();
  load();
  setInterval(() => load({ silent: true }), 45000);
})();
