(() => {
  'use strict';

  const FIXED_CLASS = 'aos-fixed-workspace-page';
  const HOME_PAGE_ATTR = 'homePage';

  const PAGES = {
    hoje: {
      title: 'Hoje',
      view: 'inicio',
      markup: () => `<section class="aos-home-page aos-home-page-today" aria-label="Prioridades de hoje">
        <section class="pmh-decision-cockpit" data-decision-cockpit aria-live="polite">
          <div class="pmh-loading">Carregando o que precisa da sua atenção…</div>
        </section>
        <nav class="aos-home-page-shortcuts" aria-label="Atalhos da operação">
          <button type="button" data-home-destination="demandas"><i aria-hidden="true">✎</i><span><strong>Nova demanda</strong><small>Registrar e organizar um pedido interno</small></span></button>
          <button type="button" data-home-destination="radar"><i aria-hidden="true">◎</i><span><strong>Abrir Radar</strong><small>Ver toda a fila operacional</small></span></button>
        </nav>
      </section>`,
    },
    demandas: {
      title: 'Demandas',
      view: 'demandas',
      markup: () => `<section class="aos-home-page aos-home-page-workspace" aria-label="Demandas internas">
        <header class="aos-home-page-header">
          <div><small>OPERAÇÃO INTERNA</small><h2>Demandas</h2><p>Registre, organize e revise pedidos internos sem misturá-los com o foco do dia.</p></div>
        </header>
        <section class="pmh-internal-demands" data-internal-demands>
          <div class="pmh-demand-loading">Carregando demandas internas…</div>
        </section>
      </section>`,
    },
    radar: {
      title: 'Radar',
      view: 'radar',
      markup: () => `<section class="aos-home-page aos-home-page-workspace" aria-label="Radar operacional">
        <header class="aos-home-page-header">
          <div><small>VISÃO OPERACIONAL</small><h2>Radar</h2><p>Toda a fila ativa, com prazos, dependências e contexto de execução.</p></div>
        </header>
        <section class="aos-radar-workspace" data-active-workstream>
          <div class="pmh-active-empty">Carregando o Radar…</div>
        </section>
      </section>`,
    },
  };

  let frame = 0;

  const content = () => document.querySelector('[data-content]');
  const title = () => document.querySelector('[data-title]');
  const nav = () => document.querySelector('.pmh-sidebar nav');
  const searchWrap = () => document.querySelector('[data-search-wrap]');

  const pageFromHash = () => {
    const value = String(location.hash || '#inicio').replace(/^#/, '').toLowerCase();
    if (value.includes('demanda')) return 'demandas';
    if (value.includes('radar')) return 'radar';
    if (!value || value === 'inicio' || value === 'hoje') return 'hoje';
    return '';
  };

  const syncNavigation = (page) => {
    const definition = PAGES[page];
    const target = nav();
    if (!definition || !target) return;
    document.querySelectorAll('.pmh-sidebar nav [data-view], .pmh-sidebar nav [data-expansion-nav]')
      .forEach((button) => button.classList.remove('active'));
    target.querySelector(`:scope > [data-view="${definition.view}"]`)?.classList.add('active');
  };

  const announceMount = (page, target) => {
    window.dispatchEvent(new CustomEvent('andre-os:home-page-rendered', {
      detail: { page, content: target },
    }));
    window.dispatchEvent(new CustomEvent('pmh:view-rendered', {
      detail: {
        view: 'inicio',
        page,
        content: target,
        segmented: true,
        viewId: `home-page:${page}`,
      },
    }));
  };

  const applyPage = () => {
    frame = 0;

    const page = pageFromHash();
    const target = content();
    if (!page || !target) {
      document.documentElement.classList.remove(FIXED_CLASS);
      return;
    }

    const definition = PAGES[page];
    document.documentElement.classList.add(FIXED_CLASS);
    if (title()) title().textContent = definition.title;
    if (searchWrap()) searchWrap().hidden = true;
    syncNavigation(page);

    const alreadyMounted = target.dataset[HOME_PAGE_ATTR] === page
      && target.querySelector('.aos-home-page');
    if (alreadyMounted) return;

    target.dataset[HOME_PAGE_ATTR] = page;
    target.innerHTML = definition.markup();
    requestAnimationFrame(() => announceMount(page, target));
  };

  const schedule = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(applyPage);
  };

  document.addEventListener('click', (event) => {
    const destination = event.target.closest?.('[data-home-destination]');
    if (!destination) return;
    const page = destination.dataset.homeDestination || 'hoje';
    location.hash = page === 'hoje' ? '#inicio' : `#${page}`;
  });

  window.addEventListener('pmh:view-rendered', (event) => {
    if (event.detail?.segmented) return;
    schedule();
  });
  window.addEventListener('pmh:access-ready', schedule);
  window.addEventListener('hashchange', schedule);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
  } else {
    schedule();
  }
})();
