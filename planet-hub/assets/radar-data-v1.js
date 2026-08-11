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
  const SOURCE_BY_KEY = new Map(SOURCES.map((source) => [source.key, source]));
  const DEFAULT_MAX_AGE_MS = 15 * 1000;

  const sourceCache = new Map();
  const sourcePending = new Map();
  let lastFullSnapshot = null;

  const todayIso = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

  const cleanDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').slice(0, 10))
    ? String(value).slice(0, 10)
    : '';

  const normalizeText = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

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
      requester: item.requester || '',
      situationId: Number(item.situation?.id || item.situationId || 0),
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

  const isAndre = (value) => /\bandre\b/.test(normalizeText(value));
  const responsibleMissing = (item) => !item.responsible || /não definido|sem responsável/i.test(item.responsible);

  const contextSuggestionFor = (item) => {
    if (item.origin === 'SULTS' && item.situationId === 5) {
      return {
        state: 'waiting_info',
        reason: 'O SULTS indica que este chamado está aguardando retorno do solicitante.',
        dependsOn: item.requester || 'Solicitante',
        nextAction: 'Receber o retorno, revisar o chamado e definir a próxima entrega.',
        source: 'SULTS',
        confidence: 'high',
      };
    }

    if (item.origin === 'SULTS' && item.situationId === 6 && !responsibleMissing(item) && !isAndre(item.responsible)) {
      return {
        state: 'blocked',
        reason: `O SULTS indica que o chamado aguarda ação de ${item.responsible}.`,
        dependsOn: item.responsible,
        nextAction: 'Acompanhar o retorno do responsável e atualizar o próximo passo.',
        source: 'SULTS',
        confidence: 'high',
      };
    }

    if (/aprova/i.test(item.status) && !responsibleMissing(item) && !isAndre(item.responsible)) {
      return {
        state: 'waiting_approval',
        reason: `O item está em aprovação com ${item.responsible}.`,
        dependsOn: item.responsible,
        nextAction: 'Acompanhar a aprovação e avançar assim que houver retorno.',
        source: item.origin,
        confidence: 'high',
      };
    }

    if (/aguardando/i.test(item.status) && !responsibleMissing(item) && !isAndre(item.responsible)) {
      return {
        state: 'waiting_info',
        reason: `O item está marcado como aguardando e possui ${item.responsible} como responsável.`,
        dependsOn: item.responsible,
        nextAction: 'Confirmar o que falta e registrar uma nova previsão.',
        source: item.origin,
        confidence: 'medium',
      };
    }

    if (responsibleMissing(item)) {
      return {
        state: 'blocked',
        reason: 'Ainda não existe um responsável definido para este item.',
        dependsOn: 'Definição de responsável',
        nextAction: 'Definir quem assume e registrar o próximo movimento.',
        source: 'Radar',
        confidence: 'medium',
      };
    }

    return null;
  };

  const mergeContexts = (items, contexts) => {
    const byId = new Map((Array.isArray(contexts) ? contexts : [])
      .filter((context) => context?.itemId)
      .map((context) => [String(context.itemId), context]));

    return items.map((item) => {
      const context = byId.get(item.id) || {};
      const hasSavedContext = Boolean(context.itemId);
      return {
        ...item,
        operationalState: context.state || 'actionable',
        blockerReason: String(context.reason || ''),
        dependsOn: String(context.dependsOn || ''),
        nextAction: String(context.nextAction || ''),
        followUpDate: cleanDate(context.followUpDate),
        contextUpdatedAt: String(context.updatedAt || ''),
        contextSuggestion: hasSavedContext ? null : contextSuggestionFor(item),
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

  const NORMALIZERS = Object.freeze({
    tickets: fromTickets,
    inaugurations: fromInaugurations,
    demands: fromInternalDemands,
    contents: fromContents,
    campaigns: fromCampaigns,
    contexts: (items) => Array.isArray(items) ? items : [],
  });

  const normalizeRequestedSources = (sources) => {
    if (sources == null) return SOURCES.map((source) => source.key);
    const requested = Array.isArray(sources) ? sources : [sources];
    const keys = [...new Set(requested.map((key) => String(key || '').trim()).filter(Boolean))];
    const invalid = keys.filter((key) => !SOURCE_BY_KEY.has(key));
    if (invalid.length) throw new Error(`Fonte(s) do RadarData inválida(s): ${invalid.join(', ')}`);
    return keys;
  };

  const sourceResult = (source, raw, error = null) => {
    const loadedAt = new Date().toISOString();
    return {
      key: source.key,
      label: source.label,
      raw: Array.isArray(raw) ? raw : [],
      items: NORMALIZERS[source.key](Array.isArray(raw) ? raw : []),
      loadedAt,
      cachedAt: Date.now(),
      reliability: error ? 'error' : 'fresh',
      error: error ? String(error instanceof Error ? error.message : error) : '',
    };
  };

  const loadSource = async (key, { force = false, maxAgeMs = DEFAULT_MAX_AGE_MS } = {}) => {
    const source = SOURCE_BY_KEY.get(key);
    if (!source) throw new Error(`Fonte do RadarData inválida: ${key}`);

    const inFlight = sourcePending.get(key);
    if (inFlight) return inFlight;

    const cached = sourceCache.get(key);
    const fresh = cached && Date.now() - cached.cachedAt < maxAgeMs;
    if (!force && fresh) return cached;

    const pending = fetchJson(source.url)
      .then((raw) => sourceResult(source, raw))
      .catch((error) => sourceResult(source, [], error))
      .then((result) => {
        sourceCache.set(key, result);
        return result;
      })
      .finally(() => { sourcePending.delete(key); });

    sourcePending.set(key, pending);
    return pending;
  };

  const buildSnapshot = async (requestedKeys, options) => {
    const results = await Promise.all(requestedKeys.map((key) => loadSource(key, options)));
    const byKey = Object.fromEntries(results.map((result) => [result.key, result]));
    const contexts = requestedKeys.includes('contexts') ? (byKey.contexts?.raw || []) : [];
    const rawItems = requestedKeys
      .filter((key) => key !== 'contexts')
      .flatMap((key) => byKey[key]?.items || []);
    const items = sortItems(mergeContexts(rawItems, contexts));
    const errors = results.filter((result) => result.error).map((result) => result.label);
    const sources = Object.fromEntries(results.map((result) => [result.key, {
      loadedAt: result.loadedAt,
      reliability: result.reliability,
      error: result.error,
    }]));

    return { items, errors, loadedAt: new Date().toISOString(), sources };
  };

  const collect = async ({ force = false, maxAgeMs = DEFAULT_MAX_AGE_MS, sources = null } = {}) => {
    const requestedKeys = normalizeRequestedSources(sources);
    const isFullCollection = requestedKeys.length === SOURCES.length
      && SOURCES.every((source) => requestedKeys.includes(source.key));
    const snapshot = await buildSnapshot(requestedKeys, { force, maxAgeMs });

    if (isFullCollection) {
      lastFullSnapshot = snapshot;
      window.dispatchEvent(new CustomEvent('pmh:radar-data', { detail: snapshot }));
    } else {
      window.dispatchEvent(new CustomEvent('pmh:radar-data-partial', {
        detail: { ...snapshot, requestedSources: requestedKeys },
      }));
    }
    return snapshot;
  };

  const invalidate = (sources = null) => {
    const keys = normalizeRequestedSources(sources);
    keys.forEach((key) => sourceCache.delete(key));
    if (sources == null || keys.length === SOURCES.length) lastFullSnapshot = null;
  };

  const getSnapshot = () => lastFullSnapshot;

  const getSourceState = (key) => {
    const cached = sourceCache.get(String(key || ''));
    if (!cached) return null;
    return {
      loadedAt: cached.loadedAt,
      reliability: cached.reliability,
      error: cached.error,
    };
  };

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
    getSourceState,
    toAnalysisItems,
  });
})();