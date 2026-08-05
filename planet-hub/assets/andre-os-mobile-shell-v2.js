(() => {
  'use strict';

  const MOBILE_MAX = 820;
  const ROOT_CLASS = 'aos-mobile';
  const BODY_CLASS = 'aos-mobile-ready';
  const MOBILE_VIEWS = new Set(['inicio', 'chamados', 'inauguracoes', 'calendario', 'conteudos']);
  const THINKING_TRIGGER_SELECTOR = '[data-thinking-assistant-trigger]';
  const THINKING_PROXY_SELECTOR = '[data-thinking-mobile-proxy]';
  let frame = 0;
  let observer;

  const mobileViewport = () => {
    const viewport = Number(window.innerWidth) || 9999;
    const screenWidth = Number(window.screen?.width) || viewport;
    return Math.min(viewport, screenWidth) <= MOBILE_MAX;
  };

  const normalizeNavLabels = (nav) => {
    nav.querySelectorAll('button[data-view]').forEach((button) => {
      if (button.querySelector('.aos-mobile-nav-label')) return;

      const textNodes = [...button.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE);
      const fullLabel = textNodes.map((node) => node.textContent || '').join(' ').replace(/\s+/g, ' ').trim();
      textNodes.forEach((node) => node.remove());

      const label = document.createElement('span');
      label.className = 'aos-mobile-nav-label';
      label.textContent = button.dataset.view === 'inauguracoes' ? 'Inaug.' : fullLabel;
      label.dataset.fullLabel = fullLabel;
      button.insertBefore(label, button.querySelector('b'));
      button.setAttribute('aria-label', fullLabel || button.dataset.view || 'Navegação');
    });
  };

  const syncMobileEntries = (nav, active) => {
    nav.querySelectorAll('button').forEach((button) => {
      const view = String(button.dataset.view || '');
      const financeEntry = button.hasAttribute('data-finance-open');
      const unsupportedView = Boolean(view) && !MOBILE_VIEWS.has(view);
      const excluded = financeEntry || unsupportedView;

      button.classList.toggle('aos-mobile-nav-excluded', active && excluded);
      if (active && excluded) {
        button.setAttribute('aria-hidden', 'true');
        button.tabIndex = -1;
      } else if (!excluded) {
        button.removeAttribute('aria-hidden');
        button.removeAttribute('tabindex');
      }
    });
  };

  const ensureDock = (shell) => {
    let dock = shell.querySelector(':scope > .aos-mobile-dock');
    if (!dock) {
      dock = document.createElement('div');
      dock.className = 'aos-mobile-dock';
      dock.setAttribute('aria-label', 'Navegação principal');
      shell.appendChild(dock);
    }
    return dock;
  };

  const createThinkingProxy = () => {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'aos-thinking-trigger aos-thinking-mobile-proxy';
    trigger.dataset.thinkingMobileProxy = '1';
    trigger.setAttribute('aria-label', 'Pensar comigo');
    trigger.innerHTML = '<span class="aos-thinking-orb" aria-hidden="true">🧠</span>';
    trigger.addEventListener('click', () => window.ThinkingAssistant?.open?.());
    return trigger;
  };

  const syncThinkingTrigger = (shell, active) => {
    const proxy = document.querySelector(THINKING_PROXY_SELECTOR);
    if (!active) {
      proxy?.remove();
      return;
    }

    const topActions = shell.querySelector('.pmh-top-actions');
    if (!topActions) return;

    const official = document.querySelector(THINKING_TRIGGER_SELECTOR);
    const trigger = official || proxy || createThinkingProxy();

    if (official && proxy && proxy !== official) proxy.remove();
    if (trigger.parentElement !== topActions) topActions.insertBefore(trigger, topActions.firstChild);

    trigger.classList.remove('floating');
    trigger.removeAttribute('aria-hidden');
    trigger.removeAttribute('tabindex');
    trigger.hidden = false;
  };

  const sync = () => {
    frame = 0;

    const shell = document.querySelector('#pmh-app');
    if (!shell) return false;

    const sidebar = shell.querySelector('.pmh-sidebar');
    const dock = ensureDock(shell);
    const nav = sidebar?.querySelector(':scope > nav') || dock.querySelector(':scope > nav');
    if (!sidebar || !nav) return false;

    normalizeNavLabels(nav);

    const active = mobileViewport();
    document.documentElement.classList.toggle(ROOT_CLASS, active);
    document.body.classList.toggle(BODY_CLASS, active);
    syncMobileEntries(nav, active);

    if (active && nav.parentElement !== dock) {
      dock.appendChild(nav);
    }

    if (!active && nav.parentElement !== sidebar) {
      const footer = sidebar.querySelector(':scope > footer');
      sidebar.insertBefore(nav, footer || null);
    }

    syncThinkingTrigger(shell, active);
    return true;
  };

  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(sync);
  };

  const boot = () => {
    sync();

    observer = new MutationObserver(() => {
      if (document.querySelector('#pmh-app')) schedule();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', schedule, { passive: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();