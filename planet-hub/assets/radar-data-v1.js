(() => {
  'use strict';

  const SOURCES = [
    { key: 'tickets', label: 'SULTS', url: '/api/sults/chamados?start=0&limit=100' },
    { key: 'inaugurations', label: 'Inaugurações', url: '/api/hub/inauguracoes' },
    { key: 'demands', label: 'Demandas internas', url: '/api/hub/demandas-internas' },
    { key: 'contents', label: 'Conteúdos', url: '/api/hub/conteudos' },
    { key: 'campaigns', label: 'Campanhas', url: '/api/hub/campanhas' },
    { key: 'contexts', label: 'Contextos operacionais', url: '/api/hub/radar-contextos' },
  ];
  const DEFAULT_MAX_AGE_MS = 15 * 1000;

  let cachedSnapshot = null;
  let cachedAt = 0;
  let pending = null;

  const todayIso = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

  const cleanDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').slice(0, 10))
    ? String(value).slice(0, 10)
    : '';

  const asDate = (value) => {
    const raw = cleanDate(value);
    if (!raw) return null;
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

  const fetchJson = async (url) => {
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
      dueDate: cleanDate(ticketDue(item)),
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
        dueDate: cleanDate(item.openingDate),
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
      dueDate: cleanDate(item.dueDate),
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
      dueDate: cleanDate(item.dueDate),
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
      dueDate: cleanDate(item.milestoneDate || campaignStart(item.id)),
      priority: item.status === 'ativa' ? 0 : item.status === 'aprovacao' ? 1 : 2,
      updatedAt: item.updatedAt || '',
      action: 'calendario',
    }));

  const mergeContexts = (items, contexts) => {
    const byId = new Map((Array.isArray(contexts) ? contexts : [])
      .filter((context) => context?.itemId)
      .map((context) => [String(context.itemId), context]));

    return items.map((item) => {
      const context = byId.get(item.id) || {};
      return {
        ...item,
        operationalState: context.state || 'actionable',
        blockerReason: String(context.reason || ''),
        dependsOn: String(context.dependsOn || ''),
        nextAction: String(context.nextAction || ''),
        followUpDate: cleanDate(context.followUpDate),
        contextUpdatedAt: String(context.updatedAt || ''),
      };
    });
  };

  const sortItems = (items) => [...items].sort((a, b) => {
    const dueA = dueMeta(a.dueDate).weight;
    const dueB = dueMeta(b.dueDate).weight;
    if (dueA !== dueB) return dueA - dueB;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0);
  });

  const buildSnapshot = async () => {
    const results = await Promise.allSettled(SOURCES.map((source) => fetchJson(source.url)));
    const values = Object.fromEntries(SOURCES.map((source, index) => [
      source.key,
      results[index].status === 'fulfilled' ? results[index].value : [],
    ]));
    const errors = SOURCES
      .filter((_, index) => results[index].status === 'rejected')
      .map((source) => source.label);

    const rawItems = [
      ...fromTickets(values.tickets),
      ...fromInaugurations(values.inaugurations),
      ...fromInternalDemands(values.demands),
      ...fromContents(values.contents),
      ...fromCampaigns(values.campaigns),
    ];
    const items = sortItems(mergeContexts(rawItems, values.contexts));

    return { items, errors, loadedAt: new Date().toISOString() };
  };

  const collect = async ({ force = false, maxAgeMs = DEFAULT_MAX_AGE_MS } = {}) => {
    const fresh = cachedSnapshot && Date.now() - cachedAt < maxAgeMs;
    if (!force && fresh) return cachedSnapshot;
    if (!force && pending) return pending;

    pending = buildSnapshot()
      .then((snapshot) => {
        cachedSnapshot = snapshot;
        cachedAt = Date.now();
        window.dispatchEvent(new CustomEvent('pmh:radar-data', { detail: snapshot }));
        return snapshot;
      })
      .finally(() => { pending = null; });

    return pending;
  };

  const invalidate = () => {
    cachedSnapshot = null;
    cachedAt = 0;
  };

  const getSnapshot = () => cachedSnapshot;

  const toAnalysisItems = (items) => (Array.isArray(items) ? items : []).map((item) => ({
    id: item.id,
    origin: item.origin,
    title: item.title,
    context: item.context,
    responsible: item.responsible,
    status: item.status,
    dueDate: cleanDate(item.dueDate),
    priority: item.priority,
    updatedAt: item.updatedAt,
    operationalState: item.operationalState || 'actionable',
    blockerReason: item.blockerReason || '',
    dependsOn: item.dependsOn || '',
    nextAction: item.nextAction || '',
    followUpDate: cleanDate(item.followUpDate),
  }));

  window.PMHRadarData = Object.freeze({
    SOURCES,
    todayIso,
    cleanDate,
    dayDiff,
    dueMeta,
    sortItems,
    collect,
    invalidate,
    getSnapshot,
    toAnalysisItems,
  });
})();
