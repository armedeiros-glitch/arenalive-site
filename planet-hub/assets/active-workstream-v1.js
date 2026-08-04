(() => {
  'use strict';

  const FILTERS = {
    all: 'Tudo ativo',
    actionable: 'Posso agir',
    blocked: 'Com dependência',
    late: 'Atrasadas',
    today: 'Hoje',
    week: 'Esta semana',
    noDate: 'Sem prazo',
  };

  const OPERATIONAL = {
    actionable: { label: 'Posso agir', tone: 'actionable' },
    blocked: { label: 'Bloqueado', tone: 'blocked' },
    waiting_info: { label: 'Aguardando informação', tone: 'waiting' },
    waiting_approval: { label: 'Aguardando aprovação', tone: 'waiting' },
    scheduled: { label: 'Retomar depois', tone: 'scheduled' },
  };

  const state = {
    items: [],
    filter: 'all',
    loaded: false,
    loading: false,
    errors: [],
  };

  const radar = () => window.PMHRadarData;
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const isHome = () => normalize(document.querySelector('[data-title]')?.textContent).includes('painel de marketing');
  const demandsRoot = () => document.querySelector('[data-internal-demands]');

  const suppressOldBlocks = () => {
    const root = demandsRoot();
    if (!root) return;
    root.querySelector('.pmh-demand-section-head')?.setAttribute('hidden', '');
    root.querySelector('.pmh-demand-kpis')?.setAttribute('hidden', '');
    root.querySelector('.pmh-demand-list')?.setAttribute('hidden', '');
    root.querySelector('.pmh-demand-completed')?.setAttribute('hidden', '');
  };

  const hasDependency = (item) => (item.operationalState || 'actionable') !== 'actionable';

  const matchesFilter = (item, filter) => {
    const bucket = radar()?.dueMeta(item.dueDate).bucket;
    if (filter === 'all') return true;
    if (filter === 'actionable') return !hasDependency(item);
    if (filter === 'blocked') return hasDependency(item);
    if (filter === 'week') return ['today', 'week'].includes(bucket);
    return bucket === filter;
  };

  const filterCounts = () => Object.keys(FILTERS).reduce((result, key) => {
    result[key] = state.items.filter((item) => matchesFilter(item, key)).length;
    return result;
  }, {});

  const operationalMeta = (item) => OPERATIONAL[item.operationalState] || OPERATIONAL.actionable;

  const contextSummary = (item) => {
    if (!hasDependency(item)) return '';
    return [item.dependsOn, item.blockerReason].filter(Boolean).join(' · ');
  };

  const card = (item) => {
    const due = radar().dueMeta(item.dueDate);
    const operational = operationalMeta(item);
    const attrs = item.action === 'demand'
      ? `data-demand-edit="${esc(item.sourceId)}"`
      : `data-view="${esc(item.action)}"`;
    const detail = contextSummary(item);

    return `<article class="pmh-active-entry ${hasDependency(item) ? 'has-dependency' : ''}">
      <button type="button" class="pmh-active-row" ${attrs}>
        <span class="pmh-active-origin tone-${esc(item.originTone)}">${esc(item.origin)}</span>
        <span class="pmh-active-main"><strong>${esc(item.title)}</strong><small>${esc(detail || item.context)}</small></span>
        <span class="pmh-active-person"><small>RESPONSÁVEL</small><strong>${esc(item.responsible)}</strong></span>
        <span class="pmh-active-status operational-${esc(operational.tone)}">${esc(hasDependency(item) ? operational.label : item.status)}</span>
        <time class="${esc(due.tone)}">${esc(due.label)}</time>
      </button>
      <button type="button" class="pmh-active-context" data-radar-context="${esc(item.id)}" aria-label="Definir contexto de ${esc(item.title)}">${hasDependency(item) ? 'Editar contexto' : '+ Contexto'}</button>
    </article>`;
  };

  const render = () => {
    if (!isHome()) return;
    suppressOldBlocks();
    const root = demandsRoot();
    if (!root) return;

    let target = root.querySelector('[data-active-workstream]');
    if (!target) {
      target = document.createElement('section');
      target.dataset.activeWorkstream = '1';
      const preview = root.querySelector('.pmh-demand-preview');
      const capture = root.querySelector('.pmh-demand-capture');
      (preview || capture)?.insertAdjacentElement('afterend', target);
      if (!target.isConnected) root.appendChild(target);
    }

    const visible = radar()?.sortItems(state.items.filter((item) => matchesFilter(item, state.filter))) || [];
    const totals = filterCounts();

    target.innerHTML = `<header class="pmh-active-head">
      <div><small>RADAR OPERACIONAL</small><h2>Tudo que está ativo</h2><p>A fila mostra o prazo. O contexto explica se o item realmente pode andar.</p></div>
      <b>${visible.length} ${visible.length === 1 ? 'demanda' : 'demandas'}</b>
    </header>
    <nav class="pmh-active-filters" aria-label="Filtrar demandas ativas">
      ${Object.entries(FILTERS).map(([key, label]) => `<button type="button" data-active-filter="${esc(key)}" class="${state.filter === key ? 'active' : ''}">${esc(label)} <b>${totals[key] || 0}</b></button>`).join('')}
    </nav>
    <div class="pmh-active-list">
      ${state.loading ? '<div class="pmh-active-empty">Carregando o radar…</div>' : visible.length ? visible.map(card).join('') : '<div class="pmh-active-empty">Nenhuma demanda ativa neste filtro.</div>'}
    </div>
    ${state.errors.length ? `<footer class="pmh-active-warning">Algumas fontes não carregaram: ${esc(state.errors.join(', '))}.</footer>` : ''}`;
  };

  const applySnapshot = (snapshot) => {
    if (!snapshot) return;
    state.items = Array.isArray(snapshot.items) ? snapshot.items : [];
    state.errors = Array.isArray(snapshot.errors) ? snapshot.errors : [];
    state.loaded = true;
    state.loading = false;
    render();
  };

  const load = async ({ force = false } = {}) => {
    if (state.loading || !isHome()) return;
    const service = radar();
    if (!service) {
      state.errors = ['Serviço de dados do Radar'];
      state.loaded = true;
      return render();
    }

    state.loading = true;
    render();
    try {
      applySnapshot(await service.collect({ force }));
    } catch {
      state.errors = ['Não foi possível carregar o Radar'];
      state.loaded = true;
      state.loading = false;
      render();
    }
  };

  const refresh = () => {
    if (!isHome()) return;
    radar()?.invalidate();
    state.loaded = false;
    load({ force: true });
  };

  document.addEventListener('click', (event) => {
    const filter = event.target.closest('[data-active-filter]');
    if (filter) {
      state.filter = filter.dataset.activeFilter || 'all';
      render();
      return;
    }

    if (event.target.closest('[data-refresh]') && isHome()) setTimeout(refresh, 100);
    if (event.target.closest('[data-demand-complete], [data-demand-reopen], [data-demand-delete]')) setTimeout(refresh, 500);
  });

  document.addEventListener('submit', (event) => {
    if (event.target.matches('[data-demand-preview]')) setTimeout(refresh, 650);
  });

  window.addEventListener('pmh:radar-data', (event) => {
    if (isHome()) applySnapshot(event.detail);
  });

  const sync = () => {
    if (!isHome()) return;
    suppressOldBlocks();
    const root = demandsRoot();
    if (!root) return;
    if (!root.querySelector('[data-active-workstream]')) render();
    if (!state.loaded && !state.loading) load();
  };

  let syncTimer = 0;
  const observer = new MutationObserver(() => {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(sync, 30);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener('hashchange', () => {
    if (isHome()) refresh();
  });
  document.addEventListener('pmh:active-refresh', refresh);
  sync();
})();
