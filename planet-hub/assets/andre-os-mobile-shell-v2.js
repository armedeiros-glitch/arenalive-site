(() => {
  'use strict';

  const MOBILE_MAX = 820;
  const ROOT_CLASS = 'aos-mobile';
  const BODY_CLASS = 'aos-mobile-ready';
  const OPEN_CLASS = 'aos-mobile-sidebar-open';
  const EDGE_START_PX = 28;
  const AXIS_LOCK_PX = 10;
  const OPEN_DISTANCE_PX = 64;
  const CLOSE_DISTANCE_PX = 56;

  let gesture = null;
  let lastFocused = null;
  let previousBodyOverflow = '';
  let previousRootOverscroll = '';
  let resizeFrame = 0;

  const mobileViewport = () => {
    const viewport = Number(window.innerWidth) || 9999;
    const screenWidth = Number(window.screen?.width) || viewport;
    return Math.min(viewport, screenWidth) <= MOBILE_MAX;
  };

  const isMobile = () => document.documentElement.classList.contains(ROOT_CLASS);
  const isOpen = () => document.documentElement.classList.contains(OPEN_CLASS);
  const shell = () => document.querySelector('#pmh-app');
  const sidebar = () => shell()?.querySelector('.pmh-sidebar') || null;
  const topbar = () => shell()?.querySelector('.pmh-topbar') || null;
  const toggle = () => document.querySelector('[data-mobile-menu-toggle]');
  const backdrop = () => document.querySelector('[data-mobile-menu-backdrop]');

  const restoreNavigation = () => {
    const app = shell();
    const drawer = sidebar();
    if (!app || !drawer) return;

    const dock = app.querySelector(':scope > .aos-mobile-dock');
    const nav = drawer.querySelector(':scope > nav') || dock?.querySelector(':scope > nav');
    if (nav && nav.parentElement !== drawer) {
      const footer = drawer.querySelector(':scope > footer');
      drawer.insertBefore(nav, footer || null);
    }
    dock?.remove();
  };

  const ensureBackdrop = () => {
    let element = backdrop();
    if (element) return element;

    element = document.createElement('button');
    element.type = 'button';
    element.className = 'aos-mobile-backdrop';
    element.dataset.mobileMenuBackdrop = '1';
    element.setAttribute('aria-label', 'Fechar navegação');
    element.tabIndex = -1;
    document.body.appendChild(element);
    return element;
  };

  const ensureToggle = () => {
    const bar = topbar();
    const titleGroup = bar?.querySelector(':scope > div:first-child');
    if (!titleGroup) return null;

    let element = titleGroup.querySelector(':scope > [data-mobile-menu-toggle]');
    if (!element) {
      element = document.createElement('button');
      element.type = 'button';
      element.className = 'aos-mobile-menu-toggle';
      element.dataset.mobileMenuToggle = '1';
      element.setAttribute('aria-controls', 'andre-os-mobile-sidebar');
      element.innerHTML = '<span aria-hidden="true"></span>';
      titleGroup.insertBefore(element, titleGroup.firstChild);
    }
    return element;
  };

  const ensureCloseButton = () => {
    const drawer = sidebar();
    if (!drawer) return null;

    drawer.id = 'andre-os-mobile-sidebar';
    let element = drawer.querySelector('[data-mobile-menu-close]');
    if (element) return element;

    element = document.createElement('button');
    element.type = 'button';
    element.className = 'aos-mobile-sidebar-close';
    element.dataset.mobileMenuClose = '1';
    element.setAttribute('aria-label', 'Fechar navegação');
    element.innerHTML = '<span aria-hidden="true">×</span>';

    const brand = drawer.querySelector(':scope > .pmh-brand');
    if (brand) brand.appendChild(element);
    else drawer.insertBefore(element, drawer.firstChild);
    return element;
  };

  const syncAccessibility = () => {
    const drawer = sidebar();
    const trigger = toggle();
    const open = isMobile() && isOpen();

    if (trigger) {
      trigger.hidden = !isMobile();
      trigger.setAttribute('aria-expanded', String(open));
      trigger.setAttribute('aria-label', open ? 'Fechar navegação' : 'Abrir navegação');
    }

    if (!drawer) return;
    if (!isMobile()) {
      drawer.removeAttribute('inert');
      drawer.removeAttribute('aria-hidden');
      return;
    }

    drawer.setAttribute('aria-hidden', String(!open));
    if (open) drawer.removeAttribute('inert');
    else drawer.setAttribute('inert', '');
  };

  const lockPageScroll = () => {
    previousBodyOverflow = document.body.style.overflow;
    previousRootOverscroll = document.documentElement.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
  };

  const unlockPageScroll = () => {
    document.body.style.overflow = previousBodyOverflow;
    document.documentElement.style.overscrollBehavior = previousRootOverscroll;
  };

  const openSidebar = ({ focus = true } = {}) => {
    if (!isMobile() || isOpen() || !sidebar()) return;
    lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.documentElement.classList.add(OPEN_CLASS);
    document.body.classList.add(OPEN_CLASS);
    lockPageScroll();
    syncAccessibility();

    if (focus) {
      requestAnimationFrame(() => {
        const target = sidebar()?.querySelector('[data-mobile-menu-close], nav button:not([hidden])');
        target?.focus?.({ preventScroll: true });
      });
    }
  };

  const closeSidebar = ({ restoreFocus = true } = {}) => {
    const wasOpen = isOpen();
    document.documentElement.classList.remove(OPEN_CLASS);
    document.body.classList.remove(OPEN_CLASS);
    if (wasOpen) unlockPageScroll();
    syncAccessibility();

    if (wasOpen && restoreFocus) {
      const target = lastFocused?.isConnected ? lastFocused : toggle();
      requestAnimationFrame(() => target?.focus?.({ preventScroll: true }));
    }
    lastFocused = null;
  };

  const ensureShell = () => {
    if (!shell()) return false;
    restoreNavigation();
    ensureBackdrop();
    ensureToggle();
    ensureCloseButton();
    syncAccessibility();
    return true;
  };

  const syncViewport = () => {
    resizeFrame = 0;
    const active = mobileViewport();
    document.documentElement.classList.toggle(ROOT_CLASS, active);
    document.body.classList.toggle(BODY_CLASS, active);

    ensureShell();
    if (!active) closeSidebar({ restoreFocus: false });
    else syncAccessibility();
  };

  const scheduleViewportSync = () => {
    if (resizeFrame) return;
    resizeFrame = requestAnimationFrame(syncViewport);
  };

  const cancelGesture = () => {
    gesture = null;
  };

  const onPointerDown = (event) => {
    if (!isMobile() || event.pointerType === 'mouse' || event.isPrimary === false) return;

    const open = isOpen();
    if (!open && event.clientX > EDGE_START_PX) return;
    if (open && !event.target.closest?.('.pmh-sidebar, [data-mobile-menu-backdrop]')) return;

    gesture = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      openAtStart: open,
      horizontal: false,
    };
  };

  const onPointerMove = (event) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const dx = event.clientX - gesture.startX;
    const dy = event.clientY - gesture.startY;

    if (!gesture.horizontal) {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
      if (Math.abs(dy) >= Math.abs(dx)) {
        cancelGesture();
        return;
      }
      gesture.horizontal = true;
    }

    event.preventDefault();
  };

  const onPointerUp = (event) => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;

    const dx = event.clientX - gesture.startX;
    const shouldOpen = !gesture.openAtStart && gesture.horizontal && dx >= OPEN_DISTANCE_PX;
    const shouldClose = gesture.openAtStart && gesture.horizontal && dx <= -CLOSE_DISTANCE_PX;
    cancelGesture();

    if (shouldOpen) openSidebar({ focus: false });
    if (shouldClose) closeSidebar();
  };

  const onClick = (event) => {
    if (event.target.closest?.('[data-mobile-menu-toggle]')) {
      if (isOpen()) closeSidebar();
      else openSidebar();
      return;
    }

    if (event.target.closest?.('[data-mobile-menu-close], [data-mobile-menu-backdrop]')) {
      closeSidebar();
      return;
    }

    if (isOpen() && event.target.closest?.('.pmh-sidebar nav button[data-view], .pmh-sidebar [data-expansion-nav]')) {
      closeSidebar({ restoreFocus: false });
    }
  };

  const boot = () => {
    syncViewport();

    document.addEventListener('click', onClick);
    document.addEventListener('pointerdown', onPointerDown, { passive: true });
    document.addEventListener('pointermove', onPointerMove, { passive: false });
    document.addEventListener('pointerup', onPointerUp, { passive: true });
    document.addEventListener('pointercancel', cancelGesture, { passive: true });

    window.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen()) closeSidebar();
    });
    window.addEventListener('hashchange', () => closeSidebar({ restoreFocus: false }));
    window.addEventListener('resize', scheduleViewportSync, { passive: true });
    window.addEventListener('orientationchange', scheduleViewportSync, { passive: true });
    window.visualViewport?.addEventListener('resize', scheduleViewportSync, { passive: true });
    window.addEventListener('pmh:access-ready', ensureShell);
    window.addEventListener('pmh:view-rendered', ensureShell);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
