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

  const PLANET_ROUTES = [
    { key: 'planet', label: 'Visão Geral', icon: '▦' },
    { key: 'marketing', label: 'Marketing', icon: '✦' },
    { key: 'calendario', label: 'Campanhas', icon: '◫' },
    { key: 'inauguracoes', label: 'Inaugurações', icon: '⚑' },
    { key: 'chamados', label: 'Chamados', icon: '▤' },
    { key: 'aquisicao', label: 'Aquisição', icon: '↙' },
    { key: 'expansao', label: 'Expansão', icon: '↗' },
    { key: '5-estrelas', label: 'Planet 5 Estrelas', icon: '★' },
    { key: 'conteudos', label: 'Central Planet', icon: '▥' },
  ];

  let gesture = null;
  let lastFocused = null;
  let previousBodyOverflow = '';
  let previousRootOverscroll = '';
  let resizeFrame = 0;
  let mobileNavigationPanel = 'root';

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
  const currentHash = () => String(location.hash || '#inicio').replace(/^#/, '').toLowerCase();

  const mobileRoute = () => {
    const hash = currentHash();
    if (!hash || hash === 'inicio' || hash === 'hoje') return 'inicio';
    if (hash === 'laboratorio') return 'laboratorio';
    if (hash === 'pessoal') return 'pessoal';
    if (hash === 'planet') return 'planet';
    if (hash.includes('demanda') || hash.includes('radar') || hash === 'marketing') return 'marketing';
    if (hash.includes('calend') || hash.includes('campanha')) return 'calendario';
    if (hash.includes('inaug')) return 'inauguracoes';
    if (hash.includes('cham')) return 'chamados';
    if (hash.includes('aquis') || hash.includes('lp-franquias')) return 'aquisicao';
    if (hash.includes('expans')) return 'expansao';
    if (hash.includes('5-estrelas') || hash.includes('cinco-estrelas') || hash.includes('5estrelas')) return '5-estrelas';
    if (hash.includes('conte')) return 'conteudos';
    return 'inicio';
  };

  const isPlanetContext = () => PLANET_ROUTES.some((route) => route.key === mobileRoute());
  const activeClass = (route) => mobileRoute() === route ? ' active' : '';

  const rootNavigationMarkup = () => `
    <div class="aos-mobile-nav-panel" data-mobile-nav-panel="root">
      <button type="button" class="aos-mobile-nav-row${activeClass('inicio')}" data-mobile-route="inicio">
        <i aria-hidden="true">⌂</i><span><strong>Início</strong><small>Seu foco e os ambientes do André OS</small></span>
      </button>
      <div class="aos-mobile-nav-section-label">AMBIENTES</div>
      <button type="button" class="aos-mobile-nav-row environment" data-mobile-panel="planet">
        <i aria-hidden="true">▣</i><span><small>TRABALHO</small><strong>Planet Chocolate</strong></span><b aria-hidden="true">›</b>
      </button>
      <button type="button" class="aos-mobile-nav-row environment${activeClass('laboratorio')}" data-mobile-route="laboratorio">
        <i aria-hidden="true">⌁</i><span><small>LABORATÓRIO</small><strong>Projetos e ideias</strong></span><b aria-hidden="true">›</b>
      </button>
      <button type="button" class="aos-mobile-nav-row environment${activeClass('pessoal')}" data-mobile-route="pessoal">
        <i aria-hidden="true">◉</i><span><small>VIDA PESSOAL</small><strong>Foco e tarefas</strong></span><b aria-hidden="true">›</b>
      </button>
    </div>`;

  const planetNavigationMarkup = () => `
    <div class="aos-mobile-nav-panel" data-mobile-nav-panel="planet">
      <header class="aos-mobile-nav-context">
        <button type="button" data-mobile-panel="root" aria-label="Voltar para ambientes">‹</button>
        <span><small>TRABALHO</small><strong>Planet Chocolate</strong></span>
      </header>
      <div class="aos-mobile-nav-section-label">GAVETAS</div>
      <div class="aos-mobile-nav-route-list">
        ${PLANET_ROUTES.map((route) => `
          <button type="button" class="aos-mobile-nav-row${activeClass(route.key)}" data-mobile-route="${route.key}">
            <i aria-hidden="true">${route.icon}</i><span><strong>${route.label}</strong></span><b aria-hidden="true">›</b>
          </button>`).join('')}
      </div>
    </div>`;

  const renderMobileNavigation = () => {
    const host = sidebar()?.querySelector('[data-mobile-navigation]');
    if (!host) return;
    host.dataset.mobileNavigationPanel = mobileNavigationPanel;
    host.innerHTML = mobileNavigationPanel === 'planet' ? planetNavigationMarkup() : rootNavigationMarkup();
  };

  const ensureNavigationContainer = () => {
    const app = shell();
    const drawer = sidebar();
    if (!app || !drawer) return null;

    const dock = app.querySelector(':scope > .aos-mobile-dock');
    let navigation = drawer.querySelector('nav') || dock?.querySelector('nav') || null;

    if (!navigation) {
      navigation = document.createElement('nav');
      navigation.className = 'aos-mobile-nav-root';
      const footer = drawer.querySelector(':scope > footer');
      drawer.insertBefore(navigation, footer || null);
    } else if (navigation.parentElement !== drawer) {
      const footer = drawer.querySelector(':scope > footer');
      drawer.insertBefore(navigation, footer || null);
    }

    dock?.remove();
    return navigation;
  };

  const ensureMobileNavigation = () => {
    if (!isMobile()) return null;
    const navigation = ensureNavigationContainer();
    if (!navigation) return null;

    let host = navigation.querySelector(':scope > [data-mobile-navigation]');
    if (!host) {
      host = document.createElement('section');
      host.className = 'aos-mobile-navigation';
      host.dataset.mobileNavigation = 'v3';
      navigation.prepend(host);
    }

    renderMobileNavigation();
    return host;
  };

  const syncNavigationPanelFromRoute = () => {
    mobileNavigationPanel = isPlanetContext() ? 'planet' : 'root';
    renderMobileNavigation();
  };

  const setMobileNavigationPanel = (panel) => {
    mobileNavigationPanel = panel === 'planet' ? 'planet' : 'root';
    renderMobileNavigation();
    requestAnimationFrame(() => {
      sidebar()?.querySelector('[data-mobile-navigation] button')?.focus?.({ preventScroll: true });
    });
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

  const syncBrand = () => {
    const brand = sidebar()?.querySelector(':scope > .pmh-brand');
    const subtitle = brand?.querySelector('small');
    if (subtitle) subtitle.textContent = 'OPERATING SYSTEM';
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

  const ensureShell = () => {
    if (!shell()) return false;
    ensureNavigationContainer();
    ensureBackdrop();
    ensureToggle();
    ensureCloseButton();
    syncBrand();
    ensureMobileNavigation();
    syncAccessibility();
    return true;
  };

  const openSidebar = ({ focus = true } = {}) => {
    if (!isMobile() || isOpen() || !sidebar()) return;

    ensureShell();
    syncNavigationPanelFromRoute();
    ensureMobileNavigation();

    lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.documentElement.classList.add(OPEN_CLASS);
    document.body.classList.add(OPEN_CLASS);
    lockPageScroll();
    syncAccessibility();

    if (focus) {
      requestAnimationFrame(() => {
        const target = sidebar()?.querySelector('[data-mobile-menu-close], [data-mobile-navigation] button:not([hidden])');
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

  const syncViewport = () => {
    resizeFrame = 0;
    const active = mobileViewport();
    document.documentElement.classList.toggle(ROOT_CLASS, active);
    document.body.classList.toggle(BODY_CLASS, active);

    ensureShell();
    if (!active) closeSidebar({ restoreFocus: false });
    else {
      syncNavigationPanelFromRoute();
      ensureMobileNavigation();
      syncAccessibility();
    }
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

  const navigateMobileRoute = (route) => {
    if (!route) return;
    const target = `#${route}`;
    closeSidebar({ restoreFocus: false });
    if (location.hash === target) return;
    location.hash = target;
  };

  const onClick = (event) => {
    const panelTrigger = event.target.closest?.('[data-mobile-panel]');
    if (panelTrigger && isMobile()) {
      event.preventDefault();
      setMobileNavigationPanel(panelTrigger.dataset.mobilePanel);
      return;
    }

    const routeTrigger = event.target.closest?.('[data-mobile-route]');
    if (routeTrigger && isMobile()) {
      event.preventDefault();
      navigateMobileRoute(routeTrigger.dataset.mobileRoute);
      return;
    }

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

  const onRouteChange = () => {
    syncNavigationPanelFromRoute();
    ensureMobileNavigation();
    closeSidebar({ restoreFocus: false });
  };

  const refreshShell = () => {
    ensureShell();
    syncNavigationPanelFromRoute();
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
    window.addEventListener('hashchange', onRouteChange);
    window.addEventListener('resize', scheduleViewportSync, { passive: true });
    window.addEventListener('orientationchange', scheduleViewportSync, { passive: true });
    window.visualViewport?.addEventListener('resize', scheduleViewportSync, { passive: true });
    window.addEventListener('pmh:access-ready', refreshShell);
    window.addEventListener('pmh:view-rendered', refreshShell);
    window.addEventListener('andre-os:home-page-rendered', refreshShell);
    window.addEventListener('andre-os:mode-page-rendered', refreshShell);
    window.addEventListener('planet:expansion-section-rendered', refreshShell);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
