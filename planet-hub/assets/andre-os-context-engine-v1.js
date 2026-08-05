(() => {
  'use strict';

  const VERSION = '1.0.0';
  const SCHEMA_VERSION = 1;
  const PROVIDER_NAME_PATTERN = /^[a-z][a-zA-Z0-9]*$/;
  const root = window.AndreOS;

  if (!root?.events || !root?.state) {
    console.error('[AndreOS Context] Runtime indisponível.');
    return;
  }

  if (root.context?.version) return;

  const { events, state } = root;
  const names = Object.freeze({
    updated: 'context.updated',
    focusChanged: 'context.focusChanged',
    sourceStatusChanged: 'context.sourceStatusChanged',
    priorityChanged: 'context.priorityChanged',
    providerFailed: 'context.providerFailed',
  });

  const providers = new Map();
  const subscriptions = [];
  let current = null;
  let revision = 0;
  let scheduled = false;
  let scheduledReasons = new Set();
  let explicitFocus = null;
  let lastSemanticSignature = '';
  let lastFocusSignature = '';
  let lastSourcesSignature = '';
  let lastPrioritySignature = '';

  const clone = (value) => {
    if (value === undefined) return undefined;
    if (typeof structuredClone === 'function') {
      try { return structuredClone(value); } catch (_) { /* non-cloneable */ }
    }
    if (value && typeof value === 'object') {
      try { return JSON.parse(JSON.stringify(value)); } catch (_) { /* non-serializable */ }
    }
    return value;
  };

  const cleanText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();
  const cleanDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').slice(0, 10))
    ? String(value).slice(0, 10)
    : '';

  const readPath = (value, path = '') => String(path || '').split('.').filter(Boolean)
    .reduce((currentValue, part) => currentValue?.[part], value);

  const stableSignature = (value) => {
    const normalize = (entry) => {
      if (Array.isArray(entry)) return entry.map(normalize);
      if (!entry || typeof entry !== 'object') return entry;
      return Object.keys(entry).sort().reduce((result, key) => {
        if (!['capturedAt', 'revision', 'reasons'].includes(key)) result[key] = normalize(entry[key]);
        return result;
      }, {});
    };
    try { return JSON.stringify(normalize(value)); } catch { return String(Date.now()); }
  };

  const todayIso = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());

  const dayDiff = (value) => {
    const due = cleanDate(value);
    if (!due) return null;
    const left = Date.parse(`${todayIso()}T12:00:00`);
    const right = Date.parse(`${due}T12:00:00`);
    return Number.isNaN(right) ? null : Math.round((right - left) / 86400000);
  };

  const normalizeItem = (item) => item ? {
    id: cleanText(item.id || item.itemId || item.source_id || item.sourceId),
    sourceId: cleanText(item.sourceId || item.source_id),
    type: cleanText(item.action || item.type || item.origin || 'item'),
    title: cleanText(item.title || 'Item selecionado'),
    origin: cleanText(item.origin),
    status: cleanText(item.status),
    responsible: cleanText(item.responsible),
    dueDate: cleanDate(item.dueDate || item.due_date),
    priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : 2,
    operationalState: cleanText(item.operationalState || item.operational_state || 'actionable'),
    dependsOn: cleanText(item.dependsOn || item.depends_on),
    blockerReason: cleanText(item.blockerReason || item.blocker_reason),
    nextAction: cleanText(item.nextAction || item.next_action),
    followUpDate: cleanDate(item.followUpDate || item.follow_up_date),
    lastReading: clone(item.ticketReading || item.last_reading || null),
  } : null;

  const pageForView = (view) => ({
    inicio: { pageId: 'planet_marketing.dashboard', label: 'Painel de Marketing' },
    chamados: { pageId: 'planet_marketing.chamados', label: 'Chamados' },
    inauguracoes: { pageId: 'planet_marketing.inauguracoes', label: 'Implantações e inaugurações' },
    calendario: { pageId: 'planet_marketing.calendario', label: 'Calendário e campanhas' },
    conteudos: { pageId: 'planet_marketing.conteudos', label: 'Conteúdos' },
    financeiro: { pageId: 'financeiro', label: 'Financeiro' },
  }[view] || { pageId: `andre_os.${view || 'inicio'}`, label: cleanText(view || 'Início') });

  const latestDetail = (name) => events.latest(name)?.detail || null;
  const providerResult = (value, evidence = []) => ({ value, evidence: Array.isArray(evidence) ? evidence : [evidence] });

  const registerProvider = (name, provider, options = {}) => {
    const providerName = String(name || '');
    if (!PROVIDER_NAME_PATTERN.test(providerName)) {
      throw new TypeError('O provider de contexto deve usar lowerCamelCase sem pontos.');
    }
    if (typeof provider !== 'function') throw new TypeError('O provider de contexto deve ser uma função.');
    if (providers.has(providerName) && !options.replace) {
      throw new Error(`O provider “${providerName}” já está registrado.`);
    }

    providers.set(providerName, {
      provider,
      priority: Number(options.priority || 0),
      optional: options.optional !== false,
    });
    schedule(`provider:${providerName}`);
    return () => {
      const removed = providers.delete(providerName);
      if (removed) schedule(`provider-removed:${providerName}`);
      return removed;
    };
  };

  const collectFacts = () => {
    const facts = Object.create(null);
    const providerStates = Object.create(null);
    const evidence = [];

    [...providers.entries()]
      .sort((left, right) => right[1].priority - left[1].priority)
      .forEach(([name, entry]) => {
        try {
          const raw = entry.provider({ current: clone(current), events, state, now: new Date().toISOString() });
          const result = raw && typeof raw === 'object' && 'value' in raw ? raw : providerResult(raw);
          facts[name] = clone(result.value);
          providerStates[name] = { status: 'ready' };
          (result.evidence || []).filter(Boolean).forEach((item) => evidence.push({ provider: name, ...clone(item) }));
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause);
          providerStates[name] = { status: 'error', message };
          events.emit(names.providerFailed, { provider: name, message }, { source: 'context-engine' });
          if (!entry.optional) evidence.push({ provider: name, type: 'error', message });
        }
      });

    return { facts, providerStates, evidence };
  };

  const sourceStatus = (loadedAt, errors, label) => {
    if (!loadedAt) return 'unknown';
    return errors.includes(label) ? 'unavailable' : 'online';
  };

  const buildSources = (radar) => {
    const errors = Array.isArray(radar?.errors) ? radar.errors.map(String) : [];
    const loadedAt = cleanText(radar?.loadedAt);
    const sharedLabels = ['Inaugurações', 'Demandas internas', 'Conteúdos', 'Campanhas', 'Contextos operacionais'];
    const sharedFailures = sharedLabels.filter((label) => errors.includes(label));
    return {
      radar: { status: !loadedAt ? 'unknown' : errors.length ? 'degraded' : 'online', loadedAt, errors },
      sults: { status: sourceStatus(loadedAt, errors, 'SULTS') },
      sharedData: {
        status: !loadedAt ? 'unknown' : sharedFailures.length ? 'degraded' : 'online',
        failures: sharedFailures,
      },
    };
  };

  const chooseFocus = (facts) => {
    const items = Array.isArray(facts.radar?.items) ? facts.radar.items.map(normalizeItem).filter(Boolean) : [];
    const requested = normalizeItem(facts.focus?.item || facts.focus);
    if (requested) {
      const currentItem = items.find((item) => item.id && item.id === requested.id)
        || items.find((item) => item.sourceId && item.sourceId === requested.sourceId);
      return {
        item: currentItem || requested,
        origin: 'explicit',
        summary: 'Este item foi selecionado explicitamente pelo usuário.',
        reasons: ['A seleção explícita tem precedência sobre o foco automático do Radar.'],
      };
    }

    const actionable = items.find((item) => item.operationalState === 'actionable');
    const item = actionable || items[0] || null;
    if (!item) return {
      item: null,
      origin: 'none',
      summary: 'Nenhum item ativo foi disponibilizado pelo Radar.',
      reasons: ['O Context Engine não inventa um foco quando as fontes não entregam itens.'],
    };

    return {
      item,
      origin: 'radar-order',
      summary: actionable
        ? 'O foco veio do primeiro item executável na ordenação oficial do Radar.'
        : 'Não havia item executável; foi mantido o primeiro item da ordenação oficial do Radar.',
      reasons: [
        'O Context Engine preserva a ordenação do Radar em vez de criar uma segunda regra de prioridade.',
        actionable ? 'Itens executáveis têm precedência sobre itens aguardando dependências.' : 'Todos os itens disponíveis possuem dependência ou bloqueio.',
      ],
    };
  };

  const genericNextAction = (item) => ({
    chamados: 'Abrir o chamado e definir o próximo passo.',
    inauguracoes: 'Abrir a implantação e avançar a próxima etapa pendente.',
    conteudos: 'Abrir o conteúdo e avançar seu fluxo.',
    calendario: 'Abrir a campanha e validar o próximo marco.',
    demand: 'Abrir a demanda e executar o próximo movimento.',
  }[item?.type] || 'Abrir o item e definir o próximo movimento concreto.');

  const priorityFor = (item) => {
    if (!item) return { level: 'none', reason: 'Sem foco ativo.' };
    if (item.operationalState !== 'actionable') {
      return { level: 'waiting', reason: item.blockerReason || 'O item depende de informação, aprovação ou retorno externo.' };
    }
    const diff = dayDiff(item.dueDate);
    if (diff != null && diff < 0) return { level: 'critical', reason: `O prazo está atrasado há ${Math.abs(diff)} dia(s).` };
    if (diff === 0) return { level: 'high', reason: 'O prazo vence hoje.' };
    if (item.priority <= 1) return { level: 'high', reason: 'O Radar marcou o item com prioridade elevada.' };
    if (diff != null && diff <= 7) return { level: 'medium', reason: `O prazo vence em ${diff} dia(s).` };
    return { level: 'normal', reason: 'Não há sinal de urgência imediata nos fatos disponíveis.' };
  };

  const normalizeContext = (collected, reason) => {
    const { facts, providerStates, evidence } = collected;
    const authentication = facts.authentication || { configured: false, authenticated: false, status: 'unknown' };
    const navigationFact = facts.navigation || {};
    const view = cleanText(navigationFact.view || String(location.hash || '#inicio').replace(/^#/, '') || 'inicio');
    const page = pageForView(view);
    const radarFact = facts.radar || { items: [], errors: [], loadedAt: '' };
    const focusChoice = chooseFocus(facts);
    const priority = priorityFor(focusChoice.item);
    const nextAction = focusChoice.item?.nextAction || genericNextAction(focusChoice.item);
    const sources = facts.sources || buildSources(radarFact);
    const contextPath = ['André OS', 'Planet Chocolate', page.label];
    if (focusChoice.item?.title) contextPath.push(focusChoice.item.title);

    return {
      schemaVersion: SCHEMA_VERSION,
      engineVersion: VERSION,
      revision: revision + 1,
      capturedAt: new Date().toISOString(),
      operation: facts.operation || { id: 'planet-chocolate', name: 'Planet Chocolate', moduleId: 'marketing', moduleLabel: 'Marketing' },
      authentication,
      navigation: {
        view,
        viewId: cleanText(navigationFact.viewId),
        pageId: page.pageId,
        moduleId: page.pageId === 'financeiro' ? 'financeiro' : 'marketing',
        label: page.label,
        route: cleanText(navigationFact.route || `${location.pathname}${location.hash || ''}`),
        contextPath,
      },
      focus: focusChoice.item ? {
        item: focusChoice.item,
        origin: focusChoice.origin,
        attentionLevel: priority.level,
        attentionReason: priority.reason,
        nextAction,
      } : null,
      radar: {
        activeItems: Array.isArray(radarFact.items) ? radarFact.items.length : 0,
        loadedAt: cleanText(radarFact.loadedAt),
        sourceErrors: Array.isArray(radarFact.errors) ? radarFact.errors.map(String) : [],
      },
      sources,
      providers: providerStates,
      explanations: {
        focus: {
          summary: focusChoice.summary,
          reasons: [...focusChoice.reasons, priority.reason].filter(Boolean),
          sources: focusChoice.origin === 'explicit' ? ['focus', 'radar'] : ['radar'],
        },
        priority: { summary: priority.reason, reasons: [priority.reason], sources: ['radar'] },
        sources: {
          summary: sources.radar?.status === 'online'
            ? 'Todas as fontes consultadas pelo Radar responderam.'
            : 'Uma ou mais fontes estão indisponíveis, degradadas ou ainda não carregaram.',
          reasons: evidence.filter((entry) => entry.type === 'source').map((entry) => entry.message),
          sources: ['radar'],
        },
      },
      update: { reason: cleanText(reason || 'manual'), evidence },
    };
  };

  const publish = (next) => {
    const semanticSignature = stableSignature(next);
    if (semanticSignature === lastSemanticSignature && current) return current;

    const previous = current;
    revision += 1;
    next.revision = revision;
    current = clone(next);
    lastSemanticSignature = semanticSignature;

    if (!state.has('context')) {
      state.registerSlice('context', { current: null, version: VERSION }, { source: 'context-engine' });
    }
    state.set('context.current', current, { source: 'context-engine' });
    state.set('context.version', VERSION, { source: 'context-engine', silent: true });

    events.emit(names.updated, clone(current), { source: 'context-engine', retain: true });
    events.emit(events.names.assistant.contextUpdated, clone(current), { source: 'context-engine', retain: true });

    const focusSignature = stableSignature(current.focus);
    if (focusSignature !== lastFocusSignature) {
      lastFocusSignature = focusSignature;
      events.emit(names.focusChanged, { previous: clone(previous?.focus || null), value: clone(current.focus) }, { source: 'context-engine', retain: true });
    }

    const sourcesSignature = stableSignature(current.sources);
    if (sourcesSignature !== lastSourcesSignature) {
      lastSourcesSignature = sourcesSignature;
      events.emit(names.sourceStatusChanged, { previous: clone(previous?.sources || null), value: clone(current.sources) }, { source: 'context-engine', retain: true });
    }

    const prioritySignature = stableSignature({
      attentionLevel: current.focus?.attentionLevel || 'none',
      nextAction: current.focus?.nextAction || '',
    });
    if (prioritySignature !== lastPrioritySignature) {
      lastPrioritySignature = prioritySignature;
      events.emit(names.priorityChanged, {
        previous: previous?.focus ? { attentionLevel: previous.focus.attentionLevel, nextAction: previous.focus.nextAction } : null,
        value: current.focus ? { attentionLevel: current.focus.attentionLevel, nextAction: current.focus.nextAction } : null,
      }, { source: 'context-engine', retain: true });
    }

    return clone(current);
  };

  function update(reason = 'manual') {
    scheduled = false;
    scheduledReasons = new Set();
    return publish(normalizeContext(collectFacts(), reason));
  }

  function schedule(reason = 'event') {
    scheduledReasons.add(String(reason));
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => update([...scheduledReasons].join(', ')));
  }

  const get = (path = '') => clone(path ? readPath(current, path) : current);
  const subscribe = (handler, options = {}) => {
    if (typeof handler !== 'function') throw new TypeError('context.subscribe exige uma função.');
    return events.on(names.updated, handler, { replayLatest: options.immediate !== false });
  };
  const explain = (topic = '') => clone(topic ? current?.explanations?.[topic] || null : current?.explanations || null);

  registerProvider('operation', () => providerResult({
    id: 'planet-chocolate', name: 'Planet Chocolate', moduleId: 'marketing', moduleLabel: 'Marketing',
  }, [{ type: 'fact', message: 'Planet Chocolate é a operação ativa deste shell.' }]), { priority: 100 });

  registerProvider('authentication', () => {
    const value = latestDetail(events.names.system.authenticated) || window.PMH_ACCESS || {};
    return providerResult({
      configured: Boolean(value.configured),
      authenticated: Boolean(value.authenticated),
      status: value.authenticated ? 'authenticated' : value.configured ? 'required' : 'unconfigured',
    }, [{ type: 'fact', message: value.authenticated ? 'Sessão autenticada.' : 'Sessão não autenticada ou não configurada.' }]);
  }, { priority: 90 });

  registerProvider('navigation', () => {
    const value = latestDetail(events.names.navigation.viewChanged) || {};
    const view = cleanText(value.view || String(location.hash || '#inicio').replace(/^#/, '') || 'inicio');
    return providerResult({ view, viewId: cleanText(value.viewId), route: `${location.pathname}${location.hash || ''}` }, [
      { type: 'fact', message: `A view ativa é ${view}.` },
    ]);
  }, { priority: 80 });

  registerProvider('radar', () => {
    const snapshot = latestDetail(events.names.radar.updated) || window.PMHRadarData?.getSnapshot?.() || null;
    return providerResult({
      items: Array.isArray(snapshot?.items) ? snapshot.items : [],
      errors: Array.isArray(snapshot?.errors) ? snapshot.errors : [],
      loadedAt: cleanText(snapshot?.loadedAt),
    }, [{ type: 'source', message: snapshot?.loadedAt ? 'O Radar entregou um snapshot.' : 'O Radar ainda não entregou um snapshot.' }]);
  }, { priority: 70 });

  registerProvider('sources', ({ current: previous }) => {
    const radar = latestDetail(events.names.radar.updated) || window.PMHRadarData?.getSnapshot?.() || previous?.radar || {};
    return providerResult(buildSources(radar));
  }, { priority: 60 });

  registerProvider('focus', () => providerResult(explicitFocus ? { item: explicitFocus.item } : null, explicitFocus ? [{
    type: 'fact', message: `O usuário selecionou ${explicitFocus.item.title || explicitFocus.item.id || 'um item'}.`,
  }] : []), { priority: 110 });

  const setFocusFromEvent = (detail) => {
    const item = normalizeItem(detail?.item || detail?.focus || detail);
    if (!item) return;
    explicitFocus = { item, selectedAt: new Date().toISOString() };
    schedule('focus.changed');
  };

  subscriptions.push(
    events.on(events.names.system.authenticated, () => schedule('system.authenticated'), { replayLatest: true }),
    events.on(events.names.navigation.viewChanged, () => schedule('navigation.viewChanged'), { replayLatest: true }),
    events.on(events.names.radar.updated, () => schedule('radar.updated'), { replayLatest: true }),
    events.on(events.names.focus.changed, setFocusFromEvent, { replayLatest: true }),
    events.on(events.names.radar.focusChanged, setFocusFromEvent, { replayLatest: true }),
    events.on(events.names.focus.cleared, () => { explicitFocus = null; schedule('focus.cleared'); }),
    events.on(events.names.focus.completed, () => { explicitFocus = null; schedule('focus.completed'); }),
    events.on(events.names.system.offline, () => schedule('system.offline')),
    events.on(events.names.system.sync, () => schedule('system.sync')),
  );

  const context = Object.freeze({
    version: VERSION,
    schemaVersion: SCHEMA_VERSION,
    events: names,
    get,
    update,
    subscribe,
    registerProvider,
    explain,
    providers: () => [...providers.keys()],
    destroy() {
      subscriptions.splice(0).forEach((unsubscribe) => unsubscribe?.());
      providers.clear();
    },
  });

  root.context = context;
  update('context-engine.ready');
})();
