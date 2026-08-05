(() => {
  'use strict';

  const MOBILE_MAX = 820;
  const ROOT_CLASS = 'aos-mobile';
  const BODY_CLASS = 'aos-mobile-ready';
  let frame = 0;
  let observer;
  let lastActive = null;

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

  const announceMode = (active) => {
    if (lastActive === active) return;
    lastActive = active;
    window.dispatchEvent(new CustomEvent('aos:mobile-change', { detail: { active } }));
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

    if (active && nav.parentElement !== dock) dock.appendChild(nav);
    if (!active && nav.parentElement !== sidebar) {
      const footer = sidebar.querySelector(':scope > footer');
      sidebar.insertBefore(nav, footer || null);
    }

    announceMode(active);
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
