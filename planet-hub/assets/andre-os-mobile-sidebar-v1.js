(() => {
  'use strict';

  const MOBILE_MAX = 820;
  const OPEN_CLASS = 'aos-mobile-nav-open';
  const EDGE_ZONE = 34;
  const SWIPE_DISTANCE = 54;
  let gesture = null;
  let frame = 0;

  const isMobile = () => Math.min(
    Number(window.innerWidth) || 9999,
    Number(window.screen?.width) || Number(window.innerWidth) || 9999,
  ) <= MOBILE_MAX;

  const getParts = () => {
    const shell = document.querySelector('#pmh-app');
    if (!shell) return null;
    return {
      shell,
      sidebar: shell.querySelector('.pmh-sidebar'),
      topbar: shell.querySelector('.pmh-topbar'),
    };
  };

  const restoreNavigation = (shell, sidebar) => {
    const dock = shell.querySelector(':scope > .aos-mobile-dock');
    const nav = dock?.querySelector(':scope > nav');
    if (nav && nav.parentElement !== sidebar) {
      const footer = sidebar.querySelector(':scope > footer');
      sidebar.insertBefore(nav, footer || null);
    }
    dock?.remove();
  };

  const normalizeLabels = (sidebar) => {
    sidebar.querySelectorAll(':scope > nav > button').forEach((button) => {
      const directText = [...button.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent || '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      const labelText = button.dataset.view === 'expansao' || button.hasAttribute('data-expansion-nav')
        ? 'Expansão'
        : button.dataset.view === 'inauguracoes'
          ? 'Inaugurações'
          : directText || button.querySelector('.aos-mobile-nav-label')?.textContent?.trim() || button.getAttribute('aria-label') || 'Área';

      [...button.childNodes]
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .forEach((node) => node.remove());

      let label = button.querySelector(':scope > .aos-mobile-nav-label');
      if (!label) {
        label = document.createElement('span');
        label.className = 'aos-mobile-nav-label';
        button.insertBefore(label, button.querySelector(':scope > b'));
      }
      label.textContent = labelText;
      label.dataset.fullLabel = labelText;
      button.hidden = false;
      button.classList.remove('aos-mobile-nav-excluded', 'aos-mobile-nav-overflow-source');
      button.removeAttribute('aria-hidden');
      button.removeAttribute('tabindex');
      button.setAttribute('aria-label', labelText);
    });
  };

  const ensureControls = ({ shell, sidebar, topbar }) => {
    let toggle = topbar.querySelector(':scope > [data-mobile-sidebar-toggle]');
    if (!toggle) {
      toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'aos-mobile-menu-button';
      toggle.dataset.mobileSidebarToggle = '1';
      toggle.setAttribute('aria-label', 'Abrir navegação');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.innerHTML = '<span aria-hidden="true"></span>';
      topbar.prepend(toggle);
    }

    const copy = [...topbar.children].find((item) => item.matches?.('div:not(.pmh-top-actions)'));
    copy?.classList.add('aos-mobile-topbar-copy');

    const brand = sidebar.querySelector(':scope > .pmh-brand');
    if (brand && !brand.querySelector('[data-mobile-sidebar-close]')) {
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'aos-mobile-sidebar-close';
      close.dataset.mobileSidebarClose = '1';
      close.setAttribute('aria-label', 'Fechar navegação');
      close.textContent = '×';
      brand.appendChild(close);
    }

    if (!shell.querySelector(':scope > [data-mobile-sidebar-backdrop]')) {
      const backdrop = document.createElement('button');
      backdrop.type = 'button';
      backdrop.className = 'aos-mobile-sidebar-backdrop';
      backdrop.dataset.mobileSidebarBackdrop = '1';
      backdrop.setAttribute('aria-label', 'Fechar navegação');
      shell.appendChild(backdrop);
    }
  };

  const open = (value) => {
    const parts = getParts();
    if (!parts?.sidebar) return;
    const next = Boolean(value && isMobile());
    document.documentElement.classList.toggle(OPEN_CLASS, next);
    document.body.classList.toggle(OPEN_CLASS, next);
    parts.sidebar.setAttribute('aria-hidden', next ? 'false' : 'true');
    const toggle = parts.topbar?.querySelector('[data-mobile-sidebar-toggle]');
    toggle?.setAttribute('aria-expanded', next ? 'true' : 'false');
    toggle?.setAttribute('aria-label', next ? 'Fechar navegação' : 'Abrir navegação');
  };

  const sync = () => {
    frame = 0;
    const parts = getParts();
    if (!parts?.sidebar || !parts.topbar) return;
    restoreNavigation(parts.shell, parts.sidebar);
    normalizeLabels(parts.sidebar);
    ensureControls(parts);
    if (isMobile()) {
      parts.sidebar.setAttribute('role', 'dialog');
      parts.sidebar.setAttribute('aria-modal', 'true');
      parts.sidebar.setAttribute('aria-label', 'Navegação do André OS');
      if (!document.documentElement.classList.contains(OPEN_CLASS)) parts.sidebar.setAttribute('aria-hidden', 'true');
    } else {
      open(false);
      parts.sidebar.removeAttribute('role');
      parts.sidebar.removeAttribute('aria-modal');
      parts.sidebar.removeAttribute('aria-label');
      parts.sidebar.removeAttribute('aria-hidden');
    }
  };

  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(sync);
  };

  document.addEventListener('click', (event) => {
    if (event.target.closest?.('[data-mobile-sidebar-toggle]')) {
      event.preventDefault();
      open(!document.documentElement.classList.contains(OPEN_CLASS));
      return;
    }
    if (event.target.closest?.('[data-mobile-sidebar-close], [data-mobile-sidebar-backdrop]')) {
      event.preventDefault();
      open(false);
      return;
    }
    if (isMobile() && event.target.closest?.('.pmh-sidebar nav button')) {
      requestAnimationFrame(() => open(false));
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') open(false);
  });

  document.addEventListener('touchstart', (event) => {
    if (!isMobile() || event.touches?.length !== 1) return;
    const touch = event.touches[0];
    const opened = document.documentElement.classList.contains(OPEN_CLASS);
    const sidebar = getParts()?.sidebar;
    if (!sidebar) return;
    const canOpen = !opened && touch.clientX <= EDGE_ZONE;
    const canClose = opened && touch.clientX <= sidebar.getBoundingClientRect().right;
    if (!canOpen && !canClose) return;
    gesture = { mode: canOpen ? 'open' : 'close', x: touch.clientX, y: touch.clientY };
  }, { passive: true });

  document.addEventListener('touchmove', (event) => {
    if (!gesture || event.touches?.length !== 1) return;
    const touch = event.touches[0];
    const dx = touch.clientX - gesture.x;
    const dy = touch.clientY - gesture.y;
    if (Math.abs(dx) <= Math.abs(dy) * 1.2) return;
    if (gesture.mode === 'open' && dx >= SWIPE_DISTANCE) {
      event.preventDefault();
      open(true);
      gesture = null;
    } else if (gesture.mode === 'close' && dx <= -SWIPE_DISTANCE) {
      event.preventDefault();
      open(false);
      gesture = null;
    }
  }, { passive: false });

  ['touchend', 'touchcancel'].forEach((name) => document.addEventListener(name, () => { gesture = null; }, { passive: true }));
  ['resize', 'orientationchange', 'hashchange', 'pmh:view-rendered', 'pmh:navigation-updated', 'pmh:access-ready']
    .forEach((name) => window.addEventListener(name, schedule, { passive: true }));

  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync, { once: true });
  else sync();
})();
