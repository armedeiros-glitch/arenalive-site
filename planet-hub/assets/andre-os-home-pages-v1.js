(() => {
  'use strict';

  const FIXED_CLASS = 'aos-fixed-workspace-page';
  const HOME_PAGE_ATTR = 'homePage';

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const PAGES = {
    hoje: {
      title: 'Hoje',
      view: 'inicio',
      eventView: 'inicio',
      hideSearch: true,
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
    planet: {
      title: 'Planet Chocolate',
      view: 'inicio',
      eventView: 'planet',
      hideSearch: false,
      markup: () => `<section class="aos-home-page aos-planet-overview-page" data-planet-overview aria-label="Visão geral da Planet Chocolate">
        <header class="aos-planet-overview-intro">
          <div><small>VISÃO GERAL</small><h2>Operação da Planet</h2><p>O que merece atenção e as portas principais da operação.</p></div>
          <span class="aos-planet-overview-status" data-planet-health>Atualizando operação…</span>
        </header>
        <div class="aos-planet-overview-grid">
          <section class="aos-planet-attention-panel">
            <header><div><small>AGORA</small><h3>Precisa de atenção</h3></div><button type="button" data-home-destination="radar">Ver Radar</button></header>
            <div class="aos-planet-attention-list" data-planet-attention><div class="aos-planet-loading">Lendo a operação…</div></div>
          </section>
          <section class="aos-planet-drawers" aria-label="Áreas da Planet">
            <button type="button" data-home-destination="marketing" class="aos-planet-drawer-card"><i>✦</i><span><small>MARKETING</small><strong>Marketing</strong><em data-planet-marketing>Demandas e produção</em></span></button>
            <button type="button" data-home-destination="calendario" class="aos-planet-drawer-card"><i>▦</i><span><small>CAMPANHAS</small><strong>Campanhas</strong><em data-planet-campaign>Calendário e execução</em></span></button>
            <button type="button" data-home-destination="inauguracoes" class="aos-planet-drawer-card"><i>⚑</i><span><small>IMPLANTAÇÃO</small><strong>Inaugurações</strong><em data-planet-inauguration>Projetos em andamento</em></span></button>
            <button type="button" data-home-destination="chamados" class="aos-planet-drawer-card"><i>▥</i><span><small>REDE</small><strong>Chamados</strong><em data-planet-tickets>Suporte das unidades</em></span></button>
            <button type="button" data-home-destination="expansao" class="aos-planet-drawer-card"><i>↗</i><span><small>EXPANSÃO</small><strong>Expansão</strong><em>Leads e Caça Lead</em></span></button>
            <button type="button" data-home-destination="conteudos" class="aos-planet-drawer-card"><i>▤</i><span><small>BASE</small><strong>Central Planet</strong><em>Materiais e conhecimento</em></span></button>
          </section>
        </div>
      </section>`,
    },
    marketing: {
      title: 'Marketing',
      view: 'demandas',
      eventView: 'marketing',
      hideSearch: false,
      markup: () => `<section class="aos-home-page aos-marketing-hub-page" data-marketing-hub aria-label="Marketing Planet Chocolate">
        <header class="aos-marketing-hub-intro">
          <div class="aos-marketing-hub-copy"><small>MARKETING PLANET</small><h2>Fluxo criativo</h2><p>O que está em produção agora e onde entrar para executar.</p></div>
          <div class="aos-marketing-kpis" aria-label="Resumo do Marketing">
            <span><small>DEMANDAS</small><strong data-marketing-demand-count>…</strong><em>ativas</em></span>
            <span><small>PRODUÇÃO</small><strong data-marketing-production-count>…</strong><em>materiais</em></span>
            <span><small>APROVAÇÃO</small><strong data-marketing-approval-count>…</strong><em>aguardando</em></span>
            <span><small>EM FLUXO</small><strong data-marketing-flow-count>…</strong><em>itens</em></span>
          </div>
        </header>
        <div class="aos-marketing-hub-grid">
          <section class="aos-marketing-queue-panel">
            <header><div><small>AGORA</small><h3>Em andamento</h3></div><button type="button" data-home-destination="demandas">Ver demandas</button></header>
            <div class="aos-marketing-queue" data-marketing-queue><div class="aos-planet-loading">Lendo o fluxo criativo…</div></div>
          </section>
          <nav class="aos-marketing-doors" aria-label="Acessos do Marketing">
            <button type="button" data-home-destination="demandas" class="aos-marketing-door primary"><i>✎</i><span><small>EXECUÇÃO</small><strong>Demandas</strong><em>Pedidos, responsáveis e prazos</em></span></button>
            <button type="button" data-home-destination="radar" class="aos-marketing-door"><i>◎</i><span><small>GESTÃO</small><strong>Radar</strong><em>Prioridades e dependências</em></span></button>
            <button type="button" data-home-destination="conteudos" class="aos-marketing-door"><i>▤</i><span><small>MATERIAIS</small><strong>Central Planet</strong><em>Conteúdos e arquivos da operação</em></span></button>
          </nav>
        </div>
      </section>`,
    },
    demandas: {
      title: 'Demandas',
      view: 'demandas',
      eventView: 'inicio',
      hideSearch: true,
      markup: () => `<section class="aos-home-page aos-home-page-workspace" aria-label="Demandas internas">
        <header class="aos-home-page-header">
          <div><small>MARKETING · EXECUÇÃO</small><h2>Demandas</h2><p>Registre, organize e revise pedidos internos sem misturá-los com o foco do dia.</p></div>
        </header>
        <section class="pmh-internal-demands" data-internal-demands>
          <div class="pmh-demand-loading">Carregando demandas internas…</div>
        </section>
      </section>`,
    },
    radar: {
      title: 'Radar',
      view: 'radar',
      eventView: 'inicio',
      hideSearch: true,
      markup: () => `<section class="aos-home-page aos-home-page-workspace" aria-label="Radar operacional">
        <header class="aos-home-page-header">
          <div><small>MARKETING · GESTÃO</small><h2>Radar</h2><p>Toda a fila ativa, com prazos, dependências e contexto de execução.</p></div>
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
  const currentHash = () => String(location.hash || '#inicio').replace(/^#/, '').toLowerCase();

  const pageFromHash = () => {
    const value = currentHash();
    if (value === 'planet') return 'planet';
    if (value === 'marketing') return 'marketing';
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
    const definition = PAGES[page];
    const eventView = definition?.eventView || definition?.view || 'inicio';
    window.dispatchEvent(new CustomEvent('andre-os:home-page-rendered', {
      detail: { page, view: eventView, content: target },
    }));
    window.dispatchEvent(new CustomEvent('pmh:view-rendered', {
      detail: {
        view: eventView,
        page,
        content: target,
        segmented: true,
        viewId: `home-page:${page}`,
      },
    }));
  };

  const destinationHash = (page) => ({
    hoje: '#inicio',
    marketing: '#marketing',
    demandas: '#demandas',
    radar: '#radar',
    calendario: '#calendario',
    inauguracoes: '#inauguracoes',
    chamados: '#chamados',
    expansao: '#expansao',
    conteudos: '#conteudos',
  }[page] || `#${page}`);

  const itemDestination = (action) => ({
    demand: '#demandas',
    conteudos: '#conteudos',
    calendario: '#calendario',
    inauguracoes: '#inauguracoes',
    chamados: '#chamados',
  }[action] || '#radar');

  const dueLabel = (item) => window.PMHRadarData?.dueMeta?.(item?.dueDate)?.label || item?.status || 'Em acompanhamento';

  const renderPlanetSnapshot = (snapshot) => {
    const root = document.querySelector('[data-planet-overview]');
    if (!root) return;
    const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
    const marketing = items.filter((item) => ['demand', 'conteudos'].includes(item.action));
    const campaigns = items.filter((item) => item.action === 'calendario');
    const inaugurations = items.filter((item) => item.action === 'inauguracoes');
    const tickets = items.filter((item) => item.action === 'chamados');
    const urgent = items.filter((item) => {
      const bucket = window.PMHRadarData?.dueMeta?.(item.dueDate)?.bucket;
      return ['late', 'today'].includes(bucket) || Number(item.priority ?? 3) <= 1;
    }).slice(0, 3);
    const attention = urgent.length ? urgent : items.slice(0, 3);

    const health = root.querySelector('[data-planet-health]');
    if (health) {
      const late = items.filter((item) => window.PMHRadarData?.dueMeta?.(item.dueDate)?.bucket === 'late').length;
      health.textContent = late ? `${late} ponto${late === 1 ? '' : 's'} atrasado${late === 1 ? '' : 's'}` : 'Operação sem atraso crítico';
      health.classList.toggle('danger', late > 0);
    }

    const attentionRoot = root.querySelector('[data-planet-attention]');
    if (attentionRoot) {
      attentionRoot.innerHTML = attention.length
        ? attention.map((item) => `<button type="button" class="aos-planet-attention-item" data-planet-item-action="${esc(item.action)}">
            <span><small>${esc(item.origin || 'Operação')}</small><strong>${esc(item.title || 'Item sem título')}</strong></span>
            <em>${esc(dueLabel(item))}</em>
          </button>`).join('')
        : '<div class="aos-planet-empty"><strong>Nada crítico agora</strong><span>A operação não trouxe pendências prioritárias.</span></div>';
    }

    const marketingLabel = root.querySelector('[data-planet-marketing]');
    if (marketingLabel) marketingLabel.textContent = `${marketing.length} item${marketing.length === 1 ? '' : 's'} em fluxo`;
    const campaignLabel = root.querySelector('[data-planet-campaign]');
    if (campaignLabel) campaignLabel.textContent = campaigns[0] ? `${campaigns[0].title} · ${dueLabel(campaigns[0])}` : 'Nenhuma campanha crítica';
    const inaugurationLabel = root.querySelector('[data-planet-inauguration]');
    if (inaugurationLabel) inaugurationLabel.textContent = inaugurations[0] ? `${inaugurations[0].title} · ${dueLabel(inaugurations[0])}` : 'Nenhuma implantação crítica';
    const ticketsLabel = root.querySelector('[data-planet-tickets]');
    if (ticketsLabel) ticketsLabel.textContent = `${tickets.length} chamado${tickets.length === 1 ? '' : 's'} aberto${tickets.length === 1 ? '' : 's'}`;
  };

  const renderMarketingSnapshot = (snapshot) => {
    const root = document.querySelector('[data-marketing-hub]');
    if (!root) return;
    const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
    const demands = items.filter((item) => item.action === 'demand');
    const contents = items.filter((item) => item.action === 'conteudos');
    const marketingFlow = items.filter((item) => ['demand', 'conteudos'].includes(item.action));
    const production = contents.filter((item) => /produ/i.test(String(item.status || '')));
    const approvals = contents.filter((item) => /aprova/i.test(String(item.status || '')));

    const demandCount = root.querySelector('[data-marketing-demand-count]');
    const productionCount = root.querySelector('[data-marketing-production-count]');
    const approvalCount = root.querySelector('[data-marketing-approval-count]');
    const flowCount = root.querySelector('[data-marketing-flow-count]');
    if (demandCount) demandCount.textContent = String(demands.length);
    if (productionCount) productionCount.textContent = String(production.length);
    if (approvalCount) approvalCount.textContent = String(approvals.length);
    if (flowCount) flowCount.textContent = String(marketingFlow.length);

    const queue = root.querySelector('[data-marketing-queue]');
    if (queue) {
      const visible = marketingFlow.slice(0, 5);
      queue.innerHTML = visible.length
        ? visible.map((item) => `<button type="button" class="aos-marketing-queue-item" data-planet-item-action="${esc(item.action)}">
            <span><small>${esc(item.origin || 'Marketing')}</small><strong>${esc(item.title || 'Item sem título')}</strong><em>${esc(item.status || 'Em andamento')}</em></span>
            <time>${esc(dueLabel(item))}</time>
          </button>`).join('')
        : '<div class="aos-planet-empty"><strong>Fluxo limpo</strong><span>Nenhuma demanda ou material ativo agora.</span></div>';
    }
  };

  const hydrateCurrentPage = async () => {
    const page = pageFromHash();
    if (!['planet', 'marketing'].includes(page) || !window.PMHRadarData?.collect) return;
    try {
      const snapshot = await window.PMHRadarData.collect({ maxAgeMs: 15000 });
      if (pageFromHash() !== page) return;
      if (page === 'planet') renderPlanetSnapshot(snapshot);
      if (page === 'marketing') renderMarketingSnapshot(snapshot);
    } catch {
      const health = document.querySelector('[data-planet-health]');
      if (health) health.textContent = 'Leitura parcial da operação';
    }
  };

  const applyPage = () => {
    frame = 0;

    const page = pageFromHash();
    const target = content();
    if (!page || !target) {
      document.documentElement.classList.remove(FIXED_CLASS);
      if (searchWrap()) searchWrap().hidden = false;
      return;
    }

    const definition = PAGES[page];
    document.documentElement.classList.add(FIXED_CLASS);
    if (title()) title().textContent = definition.title;
    if (searchWrap()) searchWrap().hidden = Boolean(definition.hideSearch);
    syncNavigation(page);

    const alreadyMounted = target.dataset[HOME_PAGE_ATTR] === page
      && target.querySelector('.aos-home-page');
    if (alreadyMounted) {
      hydrateCurrentPage();
      return;
    }

    target.dataset[HOME_PAGE_ATTR] = page;
    target.innerHTML = definition.markup();
    requestAnimationFrame(() => {
      announceMount(page, target);
      hydrateCurrentPage();
    });
  };

  const schedule = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(applyPage);
  };

  document.addEventListener('click', (event) => {
    const item = event.target.closest?.('[data-planet-item-action]');
    if (item) {
      location.hash = itemDestination(item.dataset.planetItemAction || '');
      return;
    }
    const destination = event.target.closest?.('[data-home-destination]');
    if (!destination) return;
    location.hash = destinationHash(destination.dataset.homeDestination || 'hoje');
  });

  window.addEventListener('pmh:radar-data', (event) => {
    const page = pageFromHash();
    if (page === 'planet') renderPlanetSnapshot(event.detail);
    if (page === 'marketing') renderMarketingSnapshot(event.detail);
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