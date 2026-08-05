(() => {
  'use strict';

  const MOBILE_MAX = 820;
  const ROOT_CLASS = 'aos-mobile';
  const READY_CLASS = 'aos-mobile-ready';
  const OPEN_CLASS = 'aos-mobile-nav-open';
  const SIDEBAR_ID = 'aos-mobile-sidebar';
  const EDGE_OPEN_ZONE = 34;
  const SWIPE_THRESHOLD = 54;

  let frame = 0;
  let observer = null;
  let lastMobileState = null;
  let returnFocus = null;
  let gesture = null;

  const mobileViewport = () => {
    const viewport = Number(window.innerWidth) || 9999;
    const screenWidth = Number(window.screen?.width) || viewport;
    return Math.min(viewport, screenWidth) <= MOBILE_MAX;
  };

  const parts = () => {
    const shell = document.querySelector('#pmh-app');
    if (!shell) return null;

    return {
      shell,
      sidebar: shell.querySelector('.pmh-sidebar'),
      topbar: shell.querySelector('.pmh-topbar'),
    };
  };

  const currentLabel = (button) => {
    if (button.dataset.view === 'expansao' || button.hasAttribute('data-expansion-nav')) return 'Expansão';
    if (button.dataset.view === 'inauguracoes') return 'Inaugurações';

    const existing = button.querySelector(':scope > .aos-mobile-nav-label');
    const directText = [...button.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent || '')
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    return directText
      || existing?.dataset.fullLabel
      || existing?.textContent?.trim()
      || button.getAttribute('aria-label')
      || button.getAttribute('title')
      || button.dataset.view
      || 'Área';
  };

  const normalizeNavigation = (nav) => {
    nav.querySelectorAll(':scope > button').forEach((button) => {
      const labelText = currentLabel(button);
      const textNodes = [...button.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE);
      textNodes.forEach((node) => node.remove());

      let label = button.querySelector(':scope > .aos-mobile-nav-label');
      if (!label) {
        label = document.createElement('span');
        label.className = 'aos-mobile-nav-label';
        button.insertBefore(label, button.querySelector(':scope > b'));
      }

      if (label.textContent !== labelText) label.textContent = labelText;
      if (label.dataset.fullLabel !== labelText) label.dataset.fullLabel = labelText;
      if (button.hidden) button.hidden = false;
      button.classList.remove('aos-mobile-nav-excluded', 'aos-mobile-nav-overflow-source');
      button.removeAttribute('aria-hidden');
      button.removeAttribute('tabindex');

      if (!button.getAttribute('aria-label')) button.setAttribute('aria-label', labelText);
    });
  };

  const ensureMenuButton = (topbar) => {
    let button = topbar.querySelector(':scope > [data-mobile-nav-toggle]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'aos-mobile-menu-button';
      button.dataset.mobileNavToggle = '1';
      button.setAttribute('aria-label', 'Abrir navegação');
      button.setAttribute('aria-controls', SIDEBAR_ID);
      button.setAttribute('aria-expanded', 'false');
      button.innerHTML = '<span aria-hidden="true"></span>';
      topbar.prepend(button);
    }

    const copy = [...topbar.children].find((child) => child.matches?.('div:not(.pmh-top-actions)'));
    copy?.classList.add('aos-mobile-topbar-copy');
    return button;
  };

  const ensureCloseButton = (sidebar) => {
    const brand = sidebar.querySelector(':scope > .pmh-brand');
    if (!brand) return null;

    let button = brand.querySelector('[data-mobile-nav-close]');
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.className = 'aos-mobile-sidebar-close';
      button.dataset.mobileNavClose = '1';
      button.setAttribute('aria-label', 'Fechar navegação');
      button.textContent = '×';
      brand.appendChild(button);
    }
    return button;
  };

  const ensureBackdrop = (shell) => {
    let backdrop = shell.querySelector(':scope > [data-mobile-nav-backdrop]');
    if (!backdrop) {
      backdrop = document.createElement('button');
      backdrop.type = 'button';
      backdrop.className = 'aos-mobile-sidebar-backdrop';
      backdrop.dataset.mobileNavBackdrop = '1';
      backdrop.setAttribute('aria-label', 'Fechar navegação');
      shell.appendChild(backdrop);
    }
    return backdrop;
  };

  const isOpen = () => document.documentElement.classList.contains(OPEN_CLASS);

  const setOpen = (open, { restoreFocus = true } = {}) => {
    const current = parts();
    if (!current?.sidebar) return;

    const active = mobileViewport();
    const nextOpen = Boolean(open && active);
    const toggle = current.topbar?.querySelector('[data-mobile-nav-toggle]');

    if (!active) {
      document.documentElement.classList.remove(OPEN_CLASS);
      document.body?.classList.remove(OPEN_CLASS);
      current.sidebar.removeAttribute('aria-hidden');
      toggle?.setAttribute('aria-expanded', 'false');
      toggle?.setAttribute('aria-label', 'Abrir navegação');
      returnFocus = null;
      return;
    }

    if (nextOpen && !isOpen()) returnFocus = document.activeElement;

    document.documentElement.classList.toggle(OPEN_CLASS, nextOpen);
    document.body?.classList.toggle(OPEN_CLASS, nextOpen);
    current.sidebar.setAttribute('aria-hidden', nextOpen ? 'false' : 'true');
    toggle?.setAttribute('aria-expanded', nextOpen ? 'true' : 'false');
    toggle?.setAttribute('aria-label', nextOpen ? 'Fechar navegação' : 'Abrir navegação');

    if (nextOpen) {
      const target = current.sidebar.querySelector('nav button.active:not([hidden])')
        || current.sidebar.querySelector('nav button:not([hidden])')
        || current.sidebar.querySelector('[data-mobile-nav-close]');
      requestAnimationFrame(() => target?.focus?.({ preventScroll: true }));
      return;
    }

    if (restoreFocus && returnFocus instanceof HTMLElement) {
      requestAnimationFrame(() => returnFocus?.focus?.({ preventScroll: true }));
    }
    returnFocus = null;
  };

  const prepareSidebar = (sidebar, active) => {
    const nav = sidebar.querySelector(':scope > nav');
    if (!nav) return;

    normalizeNavigation(nav);
    ensureCloseButton(sidebar);

    if (active) {
      sidebar.id = SIDEBAR_ID;
      sidebar.setAttribute('role', 'dialog');
      sidebar.setAttribute('aria-modal', 'true');
      sidebar.setAttribute('aria-label', 'Navegação do André OS');
      sidebar.setAttribute('aria-hidden', isOpen() ? 'false' : 'true');
    } else {
      sidebar.removeAttribute('role');
      sidebar.removeAttribute('aria-modal');
      sidebar.removeAttribute('aria-label');
      sidebar.removeAttribute('aria-hidden');
    }
  };

  const removeLegacyDock = (shell, sidebar) => {
    const dock = shell.querySelector(':scope > .aos-mobile-dock');
    const nav = dock?.querySelector(':scope > nav');
    if (nav && nav.parentElement !== sidebar) {
      const footer = sidebar.querySelector(':scope > footer');
      sidebar.insertBefore(nav, footer || null);
    }
    dock?.remove();
  };

  const sync = () => {
    frame = 0;
    const current = parts();
    if (!current?.sidebar || !current.topbar) return false;

    const active = mobileViewport();
    document.documentElement.classList.toggle(ROOT_CLASS, active);
    document.body.classList.toggle(READY_CLASS, active);

    removeLegacyDock(current.shell, current.sidebar);
    ensureMenuButton(current.topbar);
    ensureBackdrop(current.shell);
    prepareSidebar(current.sidebar, active);

    if (!active) setOpen(false, { restoreFocus: false });

    if (lastMobileState !== active) {
      lastMobileState = active;
      window.dispatchEvent(new CustomEvent('aos:mobile-change', { detail: { active } }));
    }

    return true;
  };

  const schedule = () => {
    if (frame) return;
    frame = requestAnimationFrame(sync);
  };

  const focusableInsideSidebar = () => {
    const sidebar = parts()?.sidebar;
    if (!sidebar) return [];
    return [...sidebar.querySelectorAll(
      'button:not([hidden]):not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )].filter((element) => element.getClientRects().length);
  };

  const handleTabTrap = (event) => {
    if (event.key !== 'Tab' || !isOpen()) return;
    const items = focusableInsideSidebar();
    if (!items.length) return;

    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const beginGesture = (event) => {
    if (!mobileViewport() || event.touches?.length !== 1) return;
    const touch = event.touches[0];
    const current = parts();
    if (!current?.sidebar) return;

    const open = isOpen();
    const sidebarRect = current.sidebar.getBoundingClientRect();
    const canOpen = !open && touch.clientX <= EDGE_OPEN_ZONE;
    const canClose = open && touch.clientX <= Math.max(sidebarRect.right, 0);
    if (!canOpen && !canClose) return;

    gesture = {
      mode: canOpen ? 'open' : 'close',
      x: touch.clientX,
      y: touch.clientY,
    };
  };

  const moveGesture = (event) => {
    if (!gesture || event.touches?.length !== 1) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - gesture.x;
    const deltaY = touch.clientY - gesture.y;
    const horizontal = Math.abs(deltaX) > Math.abs(deltaY) * 1.2;
    if (!horizontal) return;

    if (gesture.mode === 'open' && deltaX >= SWIPE_THRESHOLD) {
      event.preventDefault();
      setOpen(true);
      gesture = null;
    } else if (gesture.mode === 'close' && deltaX <= -SWIPE_THRESHOLD) {
      event.preventDefault();
      setOpen(false);
      gesture = null;
    }
  };

  const endGesture = () => {
    gesture = null;
  };

  const installEvents = () => {
    document.addEventListener('click', (event) => {
      const toggle = event.target.closest?.('[data-mobile-nav-toggle]');
      if (toggle) {
        event.preventDefault();
        setOpen(!isOpen());
        return;
      }

      if (event.target.closest?.('[data-mobile-nav-close], [data-mobile-nav-backdrop]')) {
        event.preventDefault();
        setOpen(false);
        return;
      }

      const navButton = event.target.closest?.('.pmh-sidebar nav button');
      if (navButton && mobileViewport()) {
        requestAnimationFrame(() => setOpen(false, { restoreFocus: false }));
      }
    }, true);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen()) {
        event.preventDefault();
        setOpen(false);
        return;
      }
      handleTabTrap(event);
    });

    document.addEventListener('touchstart', beginGesture, { passive: true });
    document.addEventListener('touchmove', moveGesture, { passive: false });
    document.addEventListener('touchend', endGesture, { passive: true });
    document.addEventListener('touchcancel', endGesture, { passive: true });

    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('orientationchange', schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('hashchange', () => {
      setOpen(false, { restoreFocus: false });
      schedule();
    });
    window.addEventListener('pmh:view-rendered', schedule);
    window.addEventListener('pmh:navigation-updated', schedule);
    window.addEventListener('pmh:access-ready', schedule);
  };

  const boot = () => {
    sync();
    installEvents();

    observer = new MutationObserver(() => {
      if (document.querySelector('#pmh-app')) schedule();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
