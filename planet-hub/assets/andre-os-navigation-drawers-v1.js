(() => {
  'use strict';

  const SECTION_KEY = 'planet-expansion-section';
  const OPEN_DRAWER_KEY = 'andre-os-open-navigation-drawer';
  const READY_CLASS = 'aos-navigation-drawers-ready';

  const ITEMS = {
    inicio: { label: 'Hoje', icon: '⌂', order: 0, group: '' },
    demandas: { label: 'Demandas', icon: '✎', order: 11, group: 'operacao' },
    radar: { label: 'Radar', icon: '◎', order: 12, group: 'operacao' },
    chamados: { label: 'Chamados', icon: '▥', order: 13, group: 'operacao' },
    inauguracoes: { label: 'Inaugurações', icon: '⚑', order: 14, group: 'operacao' },
    calendario: { label: 'Calendário', icon: '▦', order: 21, group: 'marketing' },
    conteudos: { label: 'Conteúdos', icon: '▤', order: 22, group: 'marketing' },
  };

  const DRAWERS = [
    { id: 'operacao', label: 'Operação da rede', icon: '◫', order: 10 },
    { id: 'marketing', label: 'Marketing', icon: '✦', order: 20 },
    { id: 'expansao', label: 'Expansão', icon: '↗', order: 30 },
  ];

  const nav = () => document.querySelector('.pmh-sidebar nav');
  const title = () => document.querySelector('[data-title]');
  const currentHash = () => String(location.hash || '#inicio').replace(/^#/, '').toLowerCase();
  const expansionSection = () => sessionStorage.getItem(SECTION_KEY) === 'caca-lead' ? 'caca-lead' : 'leads';

  const activeDrawer = () => {
    const hash = currentHash();
    if (hash.includes('expans')) return 'expansao';
    if (hash.includes('demanda') || hash.includes('radar') || hash.includes('cham') || hash.includes('inaug')) return 'operacao';
    if (hash.includes('calend') || hash.includes('campanha') || hash.includes('conte')) return 'marketing';
    return '';
  };

  const directViewButton = (target, view) => target.querySelector(`:scope > [data-view="${view}"]`);

  const badgeMarkup = (button) => {
    const badge = button?.querySelector('b');
    return badge ? badge.outerHTML : '';
  };

  const decorateItem = (button, config) => {
    if (!button) return null;
    const badge = badgeMarkup(button);
    button.type = 'button';
    button.classList.add('aos-nav-drawer-item');
    button.dataset.navigationDrawerItem = config.group || 'home';
    button.style.order = String(config.order);
    button.innerHTML = `<i aria-hidden="true">${config.icon}</i><span class="aos-nav-item-label">${config.label}</span>${badge}`;
    return button;
  };

  const ensureViewItem = (target, view, config) => {
    let button = directViewButton(target, view);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.view = view;
      target.appendChild(button);
    }
    return decorateItem(button, config);
  };

  const ensureToggle = (target, drawer) => {
    let button = target.querySelector(`:scope > [data-navigation-drawer-toggle="${drawer.id}"]`);
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.dataset.navigationDrawerToggle = drawer.id;
      target.appendChild(button);
    }
    button.className = 'aos-nav-drawer-toggle';
    button.style.order = String(drawer.order);
    button.innerHTML = `<i aria-hidden="true">${drawer.icon}</i><span>${drawer.label}</span><b aria-hidden="true">⌄</b>`;
    return button;
  };

  const ensureExpansionItems = (target) => {
    let leads = target.querySelector(':scope > [data-expansion-section-destination="leads"]')
      || target.querySelector(':scope > [data-expansion-nav]:not([data-expansion-section-destination="caca-lead"])');

    if (!leads) {
      leads = document.createElement('button');
      leads.type = 'button';
      leads.dataset.expansionNav = 'primary';
      leads.innerHTML = '<b data-expansion-badge hidden>0</b>';
      target.appendChild(leads);
    }

    leads.dataset.expansionSectionDestination = 'leads';
    decorateItem(leads, { label: 'Leads recebidos', icon: '◎', order: 31, group: 'expansao' });

    let hunter = target.querySelector(':scope > [data-expansion-section-destination="caca-lead"]');
    if (!hunter) {
      hunter = document.createElement('button');
      hunter.type = 'button';
      hunter.dataset.expansionNav = 'secondary';
      hunter.dataset.expansionSectionDestination = 'caca-lead';
      target.appendChild(hunter);
    }
    decorateItem(hunter, { label: 'Caça Leads', icon: '⌖', order: 32, group: 'expansao' });
    return { leads, hunter };
  };

  const setDrawerOpen = (drawerId, open) => {
    const target = nav();
    if (!target) return;
    const toggle = target.querySelector(`:scope > [data-navigation-drawer-toggle="${drawerId}"]`);
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.classList.toggle('open', open);
    }
    target.querySelectorAll(`:scope > [data-navigation-drawer-item="${drawerId}"]`).forEach((item) => {
      item.hidden = !open;
    });
  };

  const openOnly = (drawerId, { persist = true } = {}) => {
    DRAWERS.forEach((drawer) => setDrawerOpen(drawer.id, drawer.id === drawerId));
    if (!persist) return;
    if (drawerId) sessionStorage.setItem(OPEN_DRAWER_KEY, drawerId);
    else sessionStorage.removeItem(OPEN_DRAWER_KEY);
  };

  const syncExpansionActiveState = () => {
    const target = nav();
    if (!target) return;
    const section = expansionSection();
    const expansionOpen = currentHash().includes('expans');
    target.querySelectorAll(':scope > [data-expansion-section-destination]').forEach((button) => {
      button.classList.toggle('active', expansionOpen && button.dataset.expansionSectionDestination === section);
    });
  };

  const syncDrawerState = ({ forceActive = false } = {}) => {
    const target = nav();
    if (!target) return;
    const active = activeDrawer();
    DRAWERS.forEach((drawer) => {
      const toggle = target.querySelector(`:scope > [data-navigation-drawer-toggle="${drawer.id}"]`);
      toggle?.classList.toggle('has-active-destination', drawer.id === active);
    });

    if (forceActive) {
      openOnly(active, { persist: false });
    } else if (!DRAWERS.some((drawer) => target.querySelector(`:scope > [data-navigation-drawer-toggle="${drawer.id}"]`)?.classList.contains('open'))) {
      const remembered = sessionStorage.getItem(OPEN_DRAWER_KEY);
      openOnly(active || (DRAWERS.some((drawer) => drawer.id === remembered) ? remembered : ''), { persist: false });
    }

    syncExpansionActiveState();
  };

  const syncTitle = () => {
    const heading = title();
    if (!heading) return;
    const hash = currentHash();
    if (!hash || hash === 'inicio' || hash === 'hoje') heading.textContent = 'Hoje';
    if (hash.includes('demanda')) heading.textContent = 'Demandas';
    if (hash.includes('radar')) heading.textContent = 'Radar';
    if (hash.includes('expans')) heading.textContent = expansionSection() === 'caca-lead' ? 'Caça Leads' : 'Leads recebidos';
  };

  const mount = ({ forceActive = false } = {}) => {
    const target = nav();
    if (!target) return false;

    target.classList.add('aos-nav-drawers');
    document.documentElement.classList.add(READY_CLASS);

    Object.entries(ITEMS).forEach(([view, config]) => ensureViewItem(target, view, config));
    DRAWERS.forEach((drawer) => ensureToggle(target, drawer));
    ensureExpansionItems(target);
    syncDrawerState({ forceActive });
    syncTitle();
    return true;
  };

  let mountFrame = 0;
  const scheduleMount = ({ forceActive = false } = {}) => {
    if (mountFrame) cancelAnimationFrame(mountFrame);
    mountFrame = requestAnimationFrame(() => {
      mountFrame = 0;
      mount({ forceActive });
    });
  };

  document.addEventListener('click', (event) => {
    const toggle = event.target.closest?.('[data-navigation-drawer-toggle]');
    if (!toggle) return;
    event.preventDefault();
    const drawerId = toggle.dataset.navigationDrawerToggle || '';
    const open = toggle.getAttribute('aria-expanded') === 'true';
    openOnly(open ? '' : drawerId);
  });

  window.addEventListener('click', (event) => {
    const destination = event.target.closest?.('[data-expansion-section-destination]');
    if (!destination) return;
    sessionStorage.setItem(
      SECTION_KEY,
      destination.dataset.expansionSectionDestination === 'caca-lead' ? 'caca-lead' : 'leads',
    );
  }, true);

  window.addEventListener('pmh:view-rendered', () => scheduleMount({ forceActive: true }));
  window.addEventListener('andre-os:home-page-rendered', () => scheduleMount({ forceActive: true }));
  window.addEventListener('planet:expansion-section-rendered', () => scheduleMount({ forceActive: true }));
  window.addEventListener('pmh:access-ready', () => scheduleMount({ forceActive: true }));
  window.addEventListener('hashchange', () => scheduleMount({ forceActive: true }));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => scheduleMount({ forceActive: true }), { once: true });
  } else {
    scheduleMount({ forceActive: true });
  }
})();
