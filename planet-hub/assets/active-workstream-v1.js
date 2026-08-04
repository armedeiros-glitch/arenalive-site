(() => {
  'use strict';

  const API = {
    tickets: '/api/sults/chamados?start=0&limit=100',
    inaugurations: '/api/hub/inauguracoes',
    demands: '/api/hub/demandas-internas',
    contents: '/api/hub/conteudos',
    campaigns: '/api/hub/campanhas',
  };

  const FILTERS = {
    all: 'Tudo ativo',
    late: 'Atrasadas',
    today: 'Hoje',
    week: 'Esta semana',
    noDate: 'Sem prazo',
  };

  const state = {
    items: [],
    filter: 'all',
    loaded: false,
    loading: false,
    errors: [],
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const todayIso = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

  const asDate = (value) => {
    const raw = String(value || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
    const date = new Date(`${raw}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const dayDiff = (value) => {
    const due = asDate(value);
    const today = asDate(todayIso());
    return due && today ? Math.round((due - today) / 86400000) : null;
  };

  const fmtDate = (value) => {
    const date = asDate(value);
    return date ? new Intl.DateTimeFormat('pt-BR').format(date) : 'Sem prazo';
  };

  const dueMeta = (value) => {
    const diff = dayDiff(value);
    if (diff == null) return { label: 'Sem prazo', tone: 'none', weight: 90000, bucket: 'noDate' };
    if (diff < 0) return { label: `Atrasada há ${Math.abs(diff)}d`, tone: 'late', weight: diff, bucket: 'late' };
    if (diff === 0) return { label: 'Hoje', tone: 'today', weight: 0, bucket: 'today' };
    if (diff <= 7) return { label: diff === 1 ? 'Amanhã' : `Em ${diff} dias`, tone: 'soon', weight: diff, bucket: 'week' };
    return { label: fmtDate(value), tone: 'later', weight: diff, bucket: 'later' };
  };

  const json = async (url) => {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
    return Array.isArray(payload.data) ? payload.data : [];
  };

  const ticketDue = (item) => item.stipulatedResolutionAt || item.plannedResolutionAt || '';
  const ticketFinished = (item) => Boolean(
    item.concludedAt || item.resolvedAt || [2, 3].includes(Number(item.situation?.id || item.situationId)),
  );

  const fromTickets = (items) => items
    .filter((item) => !ticketFinished(item))
    .map((item) => ({
      id: `ticket-${item.sultsTicketId || item.id}`,
      sourceId: String(item.sultsTicketId || item.id || ''),
      origin: 'SULTS',
      originTone: 'sults',
      title: item.title || 'Demanda sem título',
      context: item.unit || item.department || 'Chamado do Marketing',
      responsible: item.responsible || 'Não definido',
      status: item.situation?.name || 'Aberta',
      dueDate: ticketDue(item),
      priority: ticketDue(item) && (dayDiff(ticketDue(item)) ?? 1) < 0 ? 0 : 2,
      updatedAt: item.lastChangeAt || item.openedAt || '',
      action: 'chamados',
    }));

  const fromInaugurations = (items) => items
    .filter((item) => {
      const checklist = Array.isArray(item.checklist) ? item.checklist : [];
      return !checklist.length || checklist.some((step) => !step.done);
    })
    .map((item) => {
      const checklist = Array.isArray(item.checklist) ? item.checklist : [];
      const done = checklist.filter((step) => step.done).length;
      return {
        id: `inauguration-${item.id}`,
        sourceId: String(item.id || ''),
        origin: 'Inauguração',
        originTone: 'inauguration',
        title: item.unit || 'Inauguração sem unidade',
        context: item.location || 'Implantação acompanhada',
        responsible: item.responsible || 'Não definido',
        status: checklist.length ? `${done}/${checklist.length} etapas` : 'Em acompanhamento',
        dueDate: item.openingDate || '',
        priority: item.openingDate && (dayDiff(item.openingDate) ?? 99) <= 7 ? 1 : 3,
        updatedAt: item.updatedAt || '',
        action: 'inauguracoes',
      };
    });

  const demandOrigin = (origin) => ({
    direction: 'Direção',
    meeting: 'Reunião',
    whatsapp: 'WhatsApp',
    internal: 'Operação interna',
    other: 'Outra origem',
  }[origin] || 'Demanda interna');

  const fromInternalDemands = (items) => items
    .filter((item) => !['completed', 'cancelled'].includes(item.status))
    .map((item) => ({
      id: `demand-${item.id}`,
      sourceId: String(item.id || ''),
      origin: demandOrigin(item.origin),
      originTone: item.origin || 'internal',
      title: item.title || 'Demanda sem título',
      context: item.category || 'Demanda interna',
      responsible: item.responsible || 'Não definido',
      status: ({ new: 'Nova', in_progress: 'Em andamento', waiting: 'Aguardando' }[item.status] || 'Ativa'),
      dueDate: item.dueDate || '',
      priority: ({ urgent: 0, high: 1, normal: 2, low: 3 }[item.priority] ?? 2),
      updatedAt: item.updatedAt || '',
      action: 'demand',
    }));

  const fromContents = (items) => items
    .filter((item) => ['planejamento', 'producao', 'aprovacao'].includes(item.status))
    .map((item) => ({
      id: `content-${item.id}`,
      sourceId: String(item.id || ''),
      origin: /social|reels|instagram|facebook/i.test([item.category, item.format, ...(item.tags || [])].join(' '))
        ? 'Social media'
        : 'Conteúdo',
      originTone: 'content',
      title: item.title || 'Conteúdo sem título',
      context: [item.category, item.campaign, item.unit].filter(Boolean).join(' · ') || 'Biblioteca de conteúdos',
      responsible: item.responsible || 'Não definido',
      status: ({ planejamento: 'Planejamento', producao: 'Em produção', aprovacao: 'Em aprovação' }[item.status] || 'Ativo'),
      dueDate: item.dueDate || '',
      priority: item.status === 'aprovacao' ? 1 : item.status === 'producao' ? 2 : 3,
      updatedAt: item.updatedAt || '',
      action: 'conteudos',
    }));

  const campaignName = (id) => {
    const slug = String(id || '').split('__')[1] || 'campanha';
    return slug.split('-').filter(Boolean).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const campaignStart = (id) => String(id || '').split('__')[0] || '';

  const fromCampaigns = (items) => items
    .filter((item) => ['planejamento', 'producao', 'aprovacao', 'ativa'].includes(item.status))
    .map((item) => ({
      id: `campaign-${item.id}`,
      sourceId: String(item.id || ''),
      origin: 'Campanha',
      originTone: 'campaign',
      title: campaignName(item.id),
      context: item.nextMilestone || 'Campanha do calendário',
      responsible: item.responsible || 'Não definido',
      status: ({ planejamento: 'Planejamento', producao: 'Em produção', aprovacao: 'Em aprovação', ativa: 'Ativa' }[item.status] || 'Ativa'),
      dueDate: item.milestoneDate || campaignStart(item.id),
      priority: item.status === 'ativa' ? 0 : item.status === 'aprovacao' ? 1 : 2,
      updatedAt: item.updatedAt || '',
      action: 'calendario',
    }));

  const sortItems = (items) => [...items].sort((a, b) => {
    const dueA = dueMeta(a.dueDate).weight;
    const dueB = dueMeta(b.dueDate).weight;
    if (dueA !== dueB) return dueA - dueB;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0);
  });

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

  const matchesFilter = (item, filter) => {
    const bucket = dueMeta(item.dueDate).bucket;
    if (filter === 'all') return true;
    if (filter === 'week') return ['today', 'week'].includes(bucket);
    return bucket === filter;
  };

  const filterCounts = () => Object.keys(FILTERS).reduce((result, key) => {
    result[key] = state.items.filter((item) => matchesFilter(item, key)).length;
    return result;
  }, {});

  const card = (item) => {
    const due = dueMeta(item.dueDate);
    const attrs = item.action === 'demand'
      ? `data-demand-edit="${esc(item.sourceId)}"`
      : `data-view="${esc(item.action)}"`;
    return `<button type="button" class="pmh-active-row" ${attrs}>
      <span class="pmh-active-origin tone-${esc(item.originTone)}">${esc(item.origin)}</span>
      <span class="pmh-active-main"><strong>${esc(item.title)}</strong><small>${esc(item.context)}</small></span>
      <span class="pmh-active-person"><small>RESPONSÁVEL</small><strong>${esc(item.responsible)}</strong></span>
      <span class="pmh-active-status">${esc(item.status)}</span>
      <time class="${esc(due.tone)}">${esc(due.label)}</time>
    </button>`;
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

    const visible = sortItems(state.items.filter((item) => matchesFilter(item, state.filter)));
    const totals = filterCounts();

    target.innerHTML = `<header class="pmh-active-head">
      <div><small>RADAR OPERACIONAL</small><h2>Tudo que está ativo</h2><p>Uma fila única. A origem aparece só para dar contexto.</p></div>
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

  const load = async () => {
    if (state.loading || !isHome()) return;
    state.loading = true;
    render();
    const results = await Promise.allSettled([
      json(API.tickets),
      json(API.inaugurations),
      json(API.demands),
      json(API.contents),
      json(API.campaigns),
    ]);
    const labels = ['SULTS', 'Inaugurações', 'Demandas internas', 'Conteúdos', 'Campanhas'];
    state.errors = results.map((result, index) => result.status === 'rejected' ? labels[index] : '').filter(Boolean);
    state.items = sortItems([
      ...fromTickets(results[0].status === 'fulfilled' ? results[0].value : []),
      ...fromInaugurations(results[1].status === 'fulfilled' ? results[1].value : []),
      ...fromInternalDemands(results[2].status === 'fulfilled' ? results[2].value : []),
      ...fromContents(results[3].status === 'fulfilled' ? results[3].value : []),
      ...fromCampaigns(results[4].status === 'fulfilled' ? results[4].value : []),
    ]);
    state.loaded = true;
    state.loading = false;
    render();
  };

  const refresh = () => {
    if (!isHome()) return;
    state.loaded = false;
    load();
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
