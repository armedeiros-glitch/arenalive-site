(() => {
  'use strict';
  const SCRIPT_SEQUENCE = [
    '/planet-hub/assets/unified-hub-v1.js?v=20260805-1',
    '/planet-hub/assets/financeiro-v1.js?v=20260805-3',
  ];

  const loadScript = (src) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.defer = true;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(script);
  });

  const currentView = () => {
    const value = String(location.hash || '#inicio').replace(/^#/, '').toLowerCase();
    if (value.includes('cham')) return 'chamados';
    if (value.includes('inaug')) return 'inauguracoes';
    if (value.includes('calend') || value.includes('campanha')) return 'calendario';
    if (value.includes('conte')) return 'conteudos';
    return 'inicio';
  };

  const runtimeEvents = () => window.AndreOS?.events || null;

  const replayRenderedView = () => {
    const content = document.querySelector('[data-content]');
    if (!content) return;

    const view = currentView();
    const events = runtimeEvents();
    if (!events) {
      window.dispatchEvent(new CustomEvent('pmh:view-rendered', {
        detail: { view, content, viewId: `${view}:bootstrap`, replayed: true },
      }));
      return;
    }

    const eventName = events.names.navigation.viewChanged;
    const latest = events.latest(eventName);
    const sameView = latest?.detail?.view === view;
    const viewId = sameView && latest?.detail?.viewId
      ? latest.detail.viewId
      : `${view}:bootstrap`;
    const detail = {
      ...(sameView ? latest.detail : {}),
      view,
      content,
      viewId,
      replayed: true,
    };

    if (latest && sameView) {
      events.replay(eventName, {
        detail,
        internal: false,
        legacy: true,
        dedupeKey: viewId,
      });
      return;
    }

    events.emit(eventName, detail, {
      retain: true,
      replayed: true,
      dedupeKey: viewId,
    });
  };

  const scheduleViewReplay = () => {
    const replay = () => requestAnimationFrame(replayRenderedView);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', replay, { once: true });
    } else {
      replay();
    }
  };

  const announceAuthenticated = (access) => {
    const events = runtimeEvents();
    if (events) {
      events.emit(events.names.system.authenticated, access, {
        retain: true,
        dedupeKey: 'current-session',
      });
      return;
    }
    window.dispatchEvent(new CustomEvent('pmh:access-ready', { detail: access }));
  };

  const startHub = async (access) => {
    window.PMH_ACCESS = access;
    document.documentElement.classList.remove('pmh-access-pending');
    for (const src of SCRIPT_SEQUENCE) await loadScript(src);
    announceAuthenticated(access);
    scheduleViewReplay();
  };

  const renderLogin = (message = '') => {
    document.documentElement.classList.remove('pmh-access-pending');
    document.body.innerHTML = `<main class="pmh-access-screen"><form class="pmh-access-card"><div class="pmh-access-brand"><span>A</span><div><strong>André OS</strong><small>MARKETING COMMAND</small></div></div><h1>Acesso ao comando</h1><p>Entre com a senha interna para acessar chamados, inaugurações, fornecedores e pagamentos da operação.</p><label>Senha de acesso<input name="password" type="password" autocomplete="current-password" required autofocus></label><button type="submit">Entrar no sistema</button><p class="pmh-access-error" ${message ? '' : 'hidden'}>${message}</p></form></main>`;
    const form = document.querySelector('.pmh-access-card');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button');
      const error = form.querySelector('.pmh-access-error');
      button.disabled = true;
      error.hidden = true;
      try {
        const response = await fetch('/api/hub/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ password: new FormData(form).get('password') }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || 'Não foi possível entrar.');
        location.reload();
      } catch (cause) {
        error.textContent = cause instanceof Error ? cause.message : String(cause);
        error.hidden = false;
        button.disabled = false;
      }
    });
  };

  const boot = async () => {
    try {
      const response = await fetch('/api/hub/session', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Não foi possível verificar o acesso.');
      if (payload.configured && !payload.authenticated) return renderLogin();
      await startHub(payload);
    } catch (cause) {
      renderLogin(cause instanceof Error ? cause.message : String(cause));
    }
  };

  boot();
})();
