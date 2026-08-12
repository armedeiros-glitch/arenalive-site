(() => {
  'use strict';
  const SCRIPT_SEQUENCE = [
    '/planet-hub/assets/unified-hub-v1.js?v=20260812-1',
    '/planet-hub/assets/financeiro-v1.js?v=20260805-5',
    '/planet-hub/assets/planet-expansion-v1.js?v=20260811-1',
    '/planet-hub/assets/andre-os-navigation-drawers-v1.js?v=20260811-1',
    '/planet-hub/assets/andre-os-home-pages-v1.js?v=20260807-3',
    '/planet-hub/assets/andre-os-radar-home-v1.js?v=20260807-2',
    '/planet-hub/assets/planet-five-stars-v1.js?v=20260807-2',
    '/planet-hub/assets/planet-five-stars-data-v1.js?v=20260807-1',
    '/planet-hub/assets/planet-five-stars-import-v1.js?v=20260807-1',
    '/planet-hub/assets/planet-five-stars-actions-v1.js?v=20260807-1',
    '/planet-hub/assets/andre-os-desktop-shell-v2.js?v=20260807-4',
    '/planet-hub/assets/planet-notifications-v1.js?v=20260805-1',
  ];
  const ACQUISITION_SCRIPT = '/planet-hub/assets/planet-acquisition-v1.js?v=20260807-1';
  let acquisitionLoaded = false;
  let acquisitionLoading = null;

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
    if (value === 'planet') return 'planet';
    if (value === 'marketing') return 'marketing';
    if (value.includes('demanda')) return 'demandas';
    if (value.includes('radar')) return 'radar';
    if (value.includes('cham')) return 'chamados';
    if (value.includes('inaug')) return 'inauguracoes';
    if (value.includes('calend') || value.includes('campanha')) return 'calendario';
    if (value.includes('conte')) return 'conteudos';
    if (value.includes('aquis') || value.includes('lp-franquias')) return 'aquisicao';
    if (value.includes('expans')) return 'expansao';
    if (value.includes('5-estrelas') || value.includes('cinco-estrelas') || value.includes('5estrelas')) return 'cinco-estrelas';
    return 'inicio';
  };

  const loadAcquisitionForCurrentView = () => {
    if (currentView() !== 'aquisicao' || acquisitionLoaded) return Promise.resolve();
    if (acquisitionLoading) return acquisitionLoading;
    acquisitionLoading = loadScript(ACQUISITION_SCRIPT)
      .then(() => { acquisitionLoaded = true; })
      .finally(() => { acquisitionLoading = null; });
    return acquisitionLoading;
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
    await loadAcquisitionForCurrentView();
    announceAuthenticated(access);
    scheduleViewReplay();
    window.addEventListener('hashchange', () => {
      loadAcquisitionForCurrentView().catch(() => {});
    });
  };

  const renderLogin = (message = '') => {
    document.documentElement.classList.remove('pmh-access-pending');
    document.body.innerHTML = `<main class="pmh-access-screen"><form class="pmh-access-card"><div class="pmh-access-brand"><span>A</span><div><strong>André OS</strong><small>OPERATING SYSTEM</small></div></div><h1>Acesso ao André OS</h1><p>Entre com a senha interna para acessar seus ambientes, informações e operações.</p><label>Senha de acesso<input name="password" type="password" autocomplete="current-password" required autofocus></label><button type="submit">Entrar no sistema</button><p class="pmh-access-error" ${message ? '' : 'hidden'}>${message}</p></form></main>`;
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