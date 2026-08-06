(() => {
  'use strict';

  const API = {
    tickets: '/api/sults/chamados?start=0&limit=100',
    projects: '/api/sults/implantacoes?start=0&limit=100',
    inaugurations: '/api/hub/inauguracoes',
  };
  const MAX_RESULTS = 18;
  const cache = { tickets: [], projects: [], inaugurations: [], loaded: false, loading: null };
  let activeIndex = -1;

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const text = (...values) => values.flat(Infinity).filter(Boolean).join(' ');
  const input = () => document.querySelector('[data-search-wrap] input[type="search"]');
  const wrap = () => document.querySelector('[data-search-wrap]');

  const json = async (url) => {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json().catch(() => ({}));
  };

  const load = async () => {
    if (cache.loaded) return cache;
    if (cache.loading) return cache.loading;
    cache.loading = Promise.allSettled([json(API.tickets), json(API.projects), json(API.inaugurations)])
      .then(([tickets, projects, inaugurations]) => {
        cache.tickets = tickets.status === 'fulfilled' ? (tickets.value.data || []) : [];
        cache.projects = projects.status === 'fulfilled' ? (projects.value.data || []) : [];
        cache.inaugurations = inaugurations.status === 'fulfilled' ? (inaugurations.value.data || []) : [];
        cache.loaded = true;
        return cache;
      })
      .finally(() => { cache.loading = null; });
    return cache.loading;
  };

  const ticketResult = (item) => ({
    type: 'Chamado', icon: '▥', id: String(item.sultsTicketId || item.id || ''),
    title: item.title || item.subject || 'Chamado sem título',
    subtitle: text(item.unit || 'Unidade não informada', item.responsible || item.requester || 'Sem responsável'),
    search: normalize(text(item.sultsTicketId, item.id, item.title, item.subject, item.unit, item.requester, item.responsible, item.department, item.sendingDepartment, (item.labels || []).map((label) => label.name))),
    view: 'chamados', query: String(item.sultsTicketId || item.id || item.title || ''), target: String(item.sultsTicketId || item.id || ''),
  });

  const projectResult = (item) => ({
    type: 'Implantação', icon: '⚑', id: String(item.sultsProjectId || item.id || ''),
    title: item.unit || item.projectName || item.name || 'Implantação sem nome',
    subtitle: text(item.responsible || 'Sem responsável', item.endDate || item.startDate || ''),
    search: normalize(text(item.sultsProjectId, item.id, item.unit, item.projectName, item.name, item.responsible, item.category, item.status)),
    view: 'inauguracoes', query: String(item.unit || item.projectName || item.name || ''), target: String(item.sultsProjectId || item.id || ''),
  });

  const inaugurationResult = (item) => ({
    type: 'Inauguração', icon: '🚀', id: String(item.id || ''),
    title: item.unit || 'Unidade sem nome',
    subtitle: text(item.responsible || 'Sem responsável', item.location || '', item.openingDate || ''),
    search: normalize(text(item.id, item.unit, item.responsible, item.location, item.openingDate, (item.checklist || []).map((entry) => entry.action), (item.inauguralActions || []).map((entry) => [entry.name, entry.owner, entry.notes]))),
    view: 'inauguracoes', query: String(item.unit || ''), target: String(item.id || ''),
  });

  const navigationResults = [
    ['Início', 'Painel geral e prioridades', '⌂', 'inicio'],
    ['Chamados', 'Demandas, responsáveis e prazos', '▥', 'chamados'],
    ['Inaugurações', 'Implantações, unidades e checklists', '⚑', 'inauguracoes'],
    ['Calendário', 'Campanhas e datas de 2026', '▦', 'calendario'],
    ['Conteúdos', 'Biblioteca do Marketing', '▤', 'conteudos'],
    ['Expansão', 'Leads e oportunidades de franquia', '↗', 'expansao'],
  ].map(([title, subtitle, icon, view]) => ({ type: 'Área', title, subtitle, icon, view, query: '', target: '', search: normalize(`${title} ${subtitle}`) }));

  const score = (result, query) => {
    const haystack = result.search;
    if (haystack === query) return 0;
    if (normalize(result.title).startsWith(query)) return 10;
    if (haystack.startsWith(query)) return 20;
    const index = haystack.indexOf(query);
    return index >= 0 ? 100 + index : Number.POSITIVE_INFINITY;
  };

  const resultsFor = (rawQuery) => {
    const query = normalize(rawQuery);
    if (!query) return [];
    return [
      ...cache.tickets.map(ticketResult),
      ...cache.projects.map(projectResult),
      ...cache.inaugurations.map(inaugurationResult),
      ...navigationResults,
    ]
      .map((result) => ({ ...result, rank: score(result, query) }))
      .filter((result) => Number.isFinite(result.rank))
      .sort((a, b) => a.rank - b.rank || a.type.localeCompare(b.type) || a.title.localeCompare(b.title))
      .slice(0, MAX_RESULTS);
  };

  const ensurePanel = () => {
    const container = wrap();
    if (!container) return null;
    let panel = container.querySelector('[data-global-search-results]');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'pmh-global-search-results';
      panel.dataset.globalSearchResults = '1';
      panel.hidden = true;
      panel.setAttribute('role', 'listbox');
      container.appendChild(panel);
    }
    return panel;
  };

  const render = (query) => {
    const panel = ensurePanel();
    if (!panel) return;
    const results = resultsFor(query);
    activeIndex = results.length ? 0 : -1;
    if (!normalize(query)) {
      panel.hidden = true;
      panel.replaceChildren();
      return;
    }
    if (!cache.loaded) {
      panel.hidden = false;
      panel.innerHTML = '<div class="pmh-global-search-state">Buscando em todo o André OS…</div>';
      return;
    }
    panel.hidden = false;
    if (!results.length) {
      panel.innerHTML = '<div class="pmh-global-search-state"><strong>Nada encontrado</strong><span>Tente nome da unidade, número do chamado ou responsável.</span></div>';
      return;
    }
    panel.innerHTML = results.map((result, index) => `
      <button type="button" role="option" class="pmh-global-search-item${index === activeIndex ? ' active' : ''}"
        data-search-index="${index}" data-search-view="${result.view}" data-search-query="${encodeURIComponent(result.query)}" data-search-target="${encodeURIComponent(result.target)}">
        <i>${result.icon}</i><span><small>${result.type}</small><strong>${result.title}</strong><em>${result.subtitle}</em></span><b>↵</b>
      </button>`).join('');
  };

  const close = () => {
    const panel = ensurePanel();
    if (panel) panel.hidden = true;
    activeIndex = -1;
  };

  const focusTarget = (target) => {
    if (!target) return;
    window.setTimeout(() => {
      const selectors = [
        `[data-ticket-id="${CSS.escape(target)}"]`,
        `[data-item-id="${CSS.escape(target)}"]`,
        `[data-inauguration-id="${CSS.escape(target)}"]`,
      ];
      const element = document.querySelector(selectors.join(','));
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('pmh-global-search-highlight');
        window.setTimeout(() => element.classList.remove('pmh-global-search-highlight'), 1800);
      }
    }, 350);
  };

  const openResult = (button) => {
    if (!button) return;
    const view = button.dataset.searchView || 'inicio';
    const query = decodeURIComponent(button.dataset.searchQuery || '');
    const target = decodeURIComponent(button.dataset.searchTarget || '');
    const field = input();
    if (field) field.value = query;
    location.hash = `#${view}`;
    field?.dispatchEvent(new Event('input', { bubbles: true }));
    close();
    focusTarget(target);
  };

  const move = (direction) => {
    const panel = ensurePanel();
    const items = [...(panel?.querySelectorAll('[data-search-index]') || [])];
    if (!items.length) return;
    activeIndex = (activeIndex + direction + items.length) % items.length;
    items.forEach((item, index) => item.classList.toggle('active', index === activeIndex));
    items[activeIndex]?.scrollIntoView({ block: 'nearest' });
  };

  const bind = async () => {
    const field = input();
    if (!field || field.dataset.globalSearchBound) return;
    field.dataset.globalSearchBound = '1';
    field.placeholder = 'Buscar em todo o André OS';
    field.setAttribute('autocomplete', 'off');
    field.setAttribute('aria-label', 'Buscar em todo o André OS');
    ensurePanel();

    field.addEventListener('focus', async () => {
      render(field.value);
      await load();
      render(field.value);
    });
    field.addEventListener('input', async () => {
      render(field.value);
      await load();
      render(field.value);
    });
    field.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
      if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
      if (event.key === 'Enter') {
        const panel = ensurePanel();
        const selected = panel?.querySelector(`[data-search-index="${Math.max(0, activeIndex)}"]`);
        if (selected) { event.preventDefault(); openResult(selected); }
      }
      if (event.key === 'Escape') close();
    });

    wrap()?.addEventListener('click', (event) => {
      const result = event.target.closest('[data-search-index]');
      if (result) openResult(result);
    });
    document.addEventListener('pointerdown', (event) => {
      if (!wrap()?.contains(event.target)) close();
    }, { passive: true });
  };

  window.addEventListener('pmh:view-rendered', bind);
  window.addEventListener('pmh:access-ready', bind);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => window.setTimeout(bind, 250), { once: true });
  else window.setTimeout(bind, 250);
})();
