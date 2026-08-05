(() => {
  'use strict';

  let demandObserver = null;

  const isMobile = () => document.documentElement.classList.contains('aos-mobile');
  const homeContent = () => document.querySelector('.pmh-content:has([data-decision-cockpit])');
  const demandRoot = () => document.querySelector('[data-internal-demands]');

  const ensurePartialAlertAction = () => {
    if (!isMobile()) return;
    const alert = homeContent()?.querySelector('.pmh-alert');
    if (!alert || alert.querySelector('[data-mobile-alert-refresh]')) return;
    alert.classList.add('pmh-alert-partial');
    alert.title = alert.textContent.trim();

    const text = document.createElement('span');
    text.textContent = 'Alguns dados do SULTS não foram atualizados.';
    alert.replaceChildren(text);

    const refresh = document.createElement('button');
    refresh.type = 'button';
    refresh.dataset.refresh = '';
    refresh.dataset.mobileAlertRefresh = '';
    refresh.textContent = 'Atualizar';
    alert.appendChild(refresh);
  };

  const ensureAttentionAction = () => {
    if (!isMobile()) return;
    const header = document.querySelector('[data-decision-cockpit] .pmh-attention-queue > header');
    if (!header || header.querySelector('[data-mobile-attention-all]')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.mobileAttentionAll = '';
    button.textContent = 'Ver todos';
    header.appendChild(button);
  };

  const ensureDemandLauncher = () => {
    const root = demandRoot();
    if (!root) return;

    let launcher = document.querySelector('[data-mobile-demand-launcher]');
    if (!isMobile()) {
      launcher?.remove();
      root.classList.remove('is-mobile-open');
      document.body.classList.remove('aos-demand-sheet-open');
      return;
    }

    if (!launcher) {
      launcher = document.createElement('button');
      launcher.type = 'button';
      launcher.className = 'pmh-mobile-demand-launcher';
      launcher.dataset.mobileDemandLauncher = '';
      launcher.innerHTML = '<span aria-hidden="true">＋</span><span><strong>Nova demanda interna</strong><small>Descreva e revise antes de salvar</small></span><i aria-hidden="true">›</i>';
      root.insertAdjacentElement('beforebegin', launcher);
    }
  };

  const ensureDemandClose = () => {
    const root = demandRoot();
    if (!root?.classList.contains('is-mobile-open')) return;
    if (root.querySelector('[data-mobile-demand-close]')) return;

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'pmh-mobile-demand-close';
    close.dataset.mobileDemandClose = '';
    close.setAttribute('aria-label', 'Fechar nova demanda');
    close.textContent = '×';
    root.prepend(close);
  };

  const watchDemandRoot = () => {
    demandObserver?.disconnect();
    const root = demandRoot();
    if (!root) return;
    demandObserver = new MutationObserver(() => ensureDemandClose());
    demandObserver.observe(root, { childList: true });
  };

  const openDemandSheet = () => {
    const root = demandRoot();
    if (!root) return;
    root.classList.add('is-mobile-open');
    document.body.classList.add('aos-demand-sheet-open');
    ensureDemandClose();
    requestAnimationFrame(() => root.querySelector('[data-demand-input]')?.focus({ preventScroll: true }));
  };

  const closeDemandSheet = () => {
    demandRoot()?.classList.remove('is-mobile-open');
    document.body.classList.remove('aos-demand-sheet-open');
  };

  const syncMobileHome = () => {
    if (!homeContent()) return;
    ensurePartialAlertAction();
    ensureDemandLauncher();
    watchDemandRoot();
    requestAnimationFrame(ensureAttentionAction);
  };

  const onViewRendered = (event) => {
    if (event.detail?.view !== 'inicio') {
      closeDemandSheet();
      return;
    }

    document.dispatchEvent(new CustomEvent('pmh:home-mounted', {
      detail: { content: event.detail.content || null },
    }));
    syncMobileHome();
  };

  window.addEventListener('pmh:view-rendered', onViewRendered);
  window.addEventListener('pmh:radar-data', () => requestAnimationFrame(ensureAttentionAction));
  window.addEventListener('resize', syncMobileHome, { passive: true });

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-mobile-demand-launcher]')) return openDemandSheet();
    if (event.target.closest('[data-mobile-demand-close]')) return closeDemandSheet();
    if (event.target.closest('[data-mobile-attention-all]')) {
      document.dispatchEvent(new CustomEvent('pmh:active-expand'));
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeDemandSheet();
  });
})();
