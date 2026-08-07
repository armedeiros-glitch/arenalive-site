(() => {
  'use strict';

  const DESKTOP_QUERY = '(min-width: 821px)';
  const READY_CLASS = 'aos-desktop-shell-v2-ready';
  const HOME_CLASS = 'aos-shell-home-active';
  const PLANET_CLASS = 'aos-shell-planet-active';

  const PLANET_DESTINATIONS = [
    { key: 'planet', label: 'Visão geral', hash: '#planet' },
    { key: 'marketing', label: 'Marketing', hash: '#marketing' },
    { key: 'campanhas', label: 'Campanhas', hash: '#calendario' },
    { key: 'inauguracoes', label: 'Inaugurações', hash: '#inauguracoes' },
    { key: 'chamados', label: 'Chamados', hash: '#chamados' },
    { key: 'expansao', label: 'Expansão', hash: '#expansao' },
    { key: 'central', label: 'Central', hash: '#conteudos' },
  ];

  const normalizedHash = () => String(location.hash || '#inicio').replace(/^#/, '').toLowerCase();

  const planetDestinationFromHash = () => {
    const hash = normalizedHash();
    if (hash === 'planet') return 'planet';
    if (hash === 'marketing' || hash.includes('demanda') || hash.includes('radar')) return 'marketing';
    if (hash.includes('calend') || hash.includes('campanha')) return 'campanhas';
    if (hash.includes('inaug')) return 'inauguracoes';
    if (hash.includes('cham')) return 'chamados';
    if (hash.includes('expans')) return 'expansao';
    if (hash.includes('conte')) return 'central';
    return '';
  };

  const isHome = () => {
    const hash = normalizedHash();
    return !hash || hash === 'inicio' || hash === 'hoje';
  };

  const sidebar = () => document.querySelector('.pmh-sidebar');
  const sidebarNav = () => document.querySelector('.pmh-sidebar nav');
  const topbar = () => document.querySelector('.pmh-topbar');
  const main = () => document.querySelector('.pmh-main');
  const pageTitle = () => document.querySelector('[data-title]');
  const desktopActive = () => window.matchMedia(DESKTOP_QUERY).matches;

  const ensureSidebar = () => {
    const nav = sidebarNav();
    if (!nav) return null;

    let root = nav.querySelector(':scope > [data-aos-desktop-shell]');
    if (!root) {
      root = document.createElement('div');
      root.className = 'aos-shell-v2-root';
      root.dataset.aosDesktopShell = 'true';
      root.innerHTML = `
        <button type="button" class="aos-shell-v2-home" data-shell-hash="#inicio">
          <i aria-hidden="true">⌂</i><span>Início</span>
        </button>
        <section class="aos-shell-v2-environment" data-shell-environment="trabalho">
          <button type="button" class="aos-shell-v2-environment-toggle" data-shell-work-toggle aria-expanded="true">
            <i aria-hidden="true">▣</i><span>Trabalho</span><b aria-hidden="true">⌄</b>
          </button>
          <div class="aos-shell-v2-workspaces" data-shell-workspaces>
            <button type="button" class="aos-shell-v2-workspace" data-shell-hash="#planet" data-shell-workspace="planet">
              <i aria-hidden="true">●</i>
              <span><strong>Planet Chocolate</strong><small>Marketing e rede</small></span>
            </button>
          </div>
        </section>`;
      nav.prepend(root);
    }
    return root;
  };

  const ensurePlanetContext = () => {
    const targetMain = main();
    const header = topbar();
    if (!targetMain || !header) return null;

    let context = targetMain.querySelector(':scope > [data-aos-planet-context]');
    if (!context) {
      context = document.createElement('nav');
      context.className = 'aos-planet-context-nav';
      context.dataset.aosPlanetContext = 'true';
      context.setAttribute('aria-label', 'Navegação Planet Chocolate');
      context.innerHTML = `
        <div class="aos-planet-context-brand">
          <small>AMBIENTE</small>
          <strong>Planet Chocolate</strong>
        </div>
        <div class="aos-planet-context-tabs">
          ${PLANET_DESTINATIONS.map((item) => `<button type="button" data-shell-hash="${item.hash}" data-shell-context="${item.key}">${item.label}</button>`).join('')}
        </div>`;
      header.insertAdjacentElement('afterend', context);
    }
    return context;
  };

  const syncWorkToggle = (root, open) => {
    const toggle = root?.querySelector('[data-shell-work-toggle]');
    const workspaces = root?.querySelector('[data-shell-workspaces]');
    if (!toggle || !workspaces) return;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.classList.toggle('open', open);
    workspaces.hidden = !open;
  };

  const syncTopbar = (planetActive) => {
    const header = topbar();
    const kicker = header?.querySelector(':scope > div:first-child > small');
    if (!kicker) return;
    kicker.textContent = planetActive ? 'TRABALHO / PLANET CHOCOLATE' : 'ANDRÉ OS / INÍCIO';

    if (planetActive && normalizedHash() === 'planet' && pageTitle()) {
      pageTitle().textContent = 'Planet Chocolate';
    }
  };

  const syncIdentity = (planetActive) => {
    const target = sidebar();
    if (!target) return;
    const brandSubtitle = target.querySelector('.pmh-brand small');
    const footerText = target.querySelector('footer > small');
    if (brandSubtitle) brandSubtitle.textContent = 'OPERATING SYSTEM';
    if (footerText) footerText.textContent = planetActive ? 'Ambiente Planet Chocolate' : 'André OS · ambiente principal';
  };

  const sync = () => {
    const root = ensureSidebar();
    const context = ensurePlanetContext();
    if (!root || !context) return;

    if (!desktopActive()) {
      document.documentElement.classList.remove(READY_CLASS, HOME_CLASS, PLANET_CLASS);
      context.hidden = true;
      return;
    }

    const currentPlanet = planetDestinationFromHash();
    const planetActive = Boolean(currentPlanet);
    const homeActive = isHome();

    document.documentElement.classList.add(READY_CLASS);
    document.documentElement.classList.toggle(HOME_CLASS, homeActive);
    document.documentElement.classList.toggle(PLANET_CLASS, planetActive);

    root.querySelector('[data-shell-hash="#inicio"]')?.classList.toggle('active', homeActive);
    root.querySelector('[data-shell-work-toggle]')?.classList.toggle('has-active-workspace', planetActive);
    root.querySelector('[data-shell-workspace="planet"]')?.classList.toggle('active', planetActive);
    syncWorkToggle(root, planetActive || root.querySelector('[data-shell-work-toggle]')?.getAttribute('aria-expanded') !== 'false');

    context.hidden = !planetActive;
    context.querySelectorAll('[data-shell-context]').forEach((button) => {
      button.classList.toggle('active', button.dataset.shellContext === currentPlanet);
    });

    syncTopbar(planetActive);
    syncIdentity(planetActive);
  };

  const navigate = (hash) => {
    if (!hash) return;
    if (location.hash === hash) {
      sync();
      return;
    }
    location.hash = hash;
  };

  document.addEventListener('click', (event) => {
    const destination = event.target.closest?.('[data-shell-hash]');
    if (destination && desktopActive()) {
      event.preventDefault();
      navigate(destination.dataset.shellHash || '#inicio');
      return;
    }

    const toggle = event.target.closest?.('[data-shell-work-toggle]');
    if (!toggle || !desktopActive()) return;
    event.preventDefault();
    const root = ensureSidebar();
    syncWorkToggle(root, toggle.getAttribute('aria-expanded') !== 'true');
  });

  const schedule = () => requestAnimationFrame(sync);

  window.addEventListener('hashchange', schedule);
  window.addEventListener('pmh:view-rendered', schedule);
  window.addEventListener('andre-os:home-page-rendered', schedule);
  window.addEventListener('planet:expansion-section-rendered', schedule);
  window.addEventListener('pmh:access-ready', schedule);

  const media = window.matchMedia(DESKTOP_QUERY);
  if (typeof media.addEventListener === 'function') media.addEventListener('change', schedule);
  else if (typeof media.addListener === 'function') media.addListener(schedule);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
  } else {
    schedule();
  }
})();
