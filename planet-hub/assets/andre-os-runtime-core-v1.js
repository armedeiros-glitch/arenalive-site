(() => {
  'use strict';

  const VERSION = '1.0.0';
  const HISTORY_LIMIT = 200;
  const DEDUPE_LIMIT = 300;
  const BRIDGE_MARK = Symbol('AndreOSLegacyBridge');
  const root = window.AndreOS && typeof window.AndreOS === 'object' ? window.AndreOS : {};

  if (root.runtime?.version) {
    window.AndreOS = root;
    return;
  }

  const deepFreeze = (value) => {
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  };

  const names = deepFreeze({
    system: {
      ready: 'system.ready',
      authenticated: 'system.authenticated',
      offline: 'system.offline',
      sync: 'system.sync',
      viewportChanged: 'system.viewportChanged',
    },
    navigation: {
      viewChanged: 'navigation.viewChanged',
      modalOpened: 'navigation.modalOpened',
      modalClosed: 'navigation.modalClosed',
    },
    radar: {
      updated: 'radar.updated',
      focusChanged: 'radar.focusChanged',
      refreshRequested: 'radar.refreshRequested',
    },
    focus: {
      changed: 'focus.changed',
      cleared: 'focus.cleared',
      blocked: 'focus.blocked',
      completed: 'focus.completed',
    },
    assistant: {
      contextUpdated: 'assistant.contextUpdated',
      thinkingStarted: 'assistant.thinkingStarted',
      responseFinished: 'assistant.responseFinished',
    },
    marketing: {
      ticketOpened: 'marketing.ticketOpened',
      inaugurationCreated: 'marketing.inaugurationCreated',
      internalDemandsUpdated: 'marketing.internalDemandsUpdated',
    },
    calendar: {
      updated: 'calendar.updated',
    },
    state: {
      sliceRegistered: 'state.sliceRegistered',
      changed: 'state.changed',
    },
  });

  const legacyBridges = deepFreeze({
    [names.system.authenticated]: [
      { name: 'pmh:access-ready', target: 'window' },
    ],
    [names.navigation.viewChanged]: [
      { name: 'pmh:view-rendered', target: 'window' },
    ],
    [names.radar.updated]: [
      { name: 'pmh:radar-data', target: 'window' },
    ],
    [names.radar.refreshRequested]: [
      { name: 'pmh:active-refresh', target: 'document' },
    ],
    [names.marketing.internalDemandsUpdated]: [
      { name: 'pmh:demands-updated', target: 'document' },
    ],
    [names.system.viewportChanged]: [
      { name: 'aos:mobile-change', target: 'window' },
    ],
  });

  const canonicalByLegacy = new Map();
  Object.entries(legacyBridges).forEach(([canonical, bridges]) => {
    bridges.forEach((bridge) => canonicalByLegacy.set(bridge.name, { canonical, ...bridge }));
  });

  const eventTarget = new EventTarget();
  const subscriptions = new Map();
  const retained = new Map();
  const history = [];
  const seenDedupe = new Map();
  let sequence = 0;
  let viewSequence = 0;
  let inspectorEnabled = false;
  let inspectorFilter = null;

  const isCanonicalName = (name) => /^[a-z][a-z0-9]*(?:\.[a-z][a-zA-Z0-9]*)+$/.test(String(name || ''));

  const assertEventName = (name) => {
    if (!isCanonicalName(name)) {
      throw new TypeError(`Evento inválido: “${String(name || '')}”. Use o padrão dominio.acao.`);
    }
  };

  const bridgeTarget = (targetName) => targetName === 'document' ? document : window;

  const rememberDedupe = (key) => {
    if (!key) return true;
    if (seenDedupe.has(key)) return false;
    seenDedupe.set(key, Date.now());
    while (seenDedupe.size > DEDUPE_LIMIT) {
      seenDedupe.delete(seenDedupe.keys().next().value);
    }
    return true;
  };

  const recordEvent = (name, detail, meta = {}) => {
    const record = Object.freeze({
      id: `event-${++sequence}`,
      name,
      detail,
      timestamp: new Date().toISOString(),
      source: meta.source || 'runtime',
      legacyName: meta.legacyName || '',
      dedupeKey: meta.dedupeKey || '',
      replayed: Boolean(meta.replayed),
    });
    history.push(record);
    if (history.length > HISTORY_LIMIT) history.splice(0, history.length - HISTORY_LIMIT);
    return record;
  };

  const matchesInspectorFilter = (name) => {
    if (!inspectorFilter) return true;
    if (typeof inspectorFilter === 'function') return Boolean(inspectorFilter(name));
    if (inspectorFilter instanceof RegExp) return inspectorFilter.test(name);
    return name.startsWith(String(inspectorFilter));
  };

  const printInspector = (record) => {
    if (!inspectorEnabled || !matchesInspectorFilter(record.name)) return;
    const time = new Date(record.timestamp).toLocaleTimeString('pt-BR', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    console.debug(`[AndreOS ${time}] ${record.name}`, record.detail);
  };

  const dispatchLegacy = (canonicalName, detail, meta = {}) => {
    const bridges = legacyBridges[canonicalName] || [];
    bridges.forEach((bridge) => {
      const legacyEvent = new CustomEvent(bridge.name, { detail });
      Object.defineProperty(legacyEvent, BRIDGE_MARK, { value: true });
      Object.defineProperty(legacyEvent, 'andreOSMeta', {
        value: Object.freeze({
          canonicalName,
          source: meta.source || 'runtime',
          replayed: Boolean(meta.replayed),
        }),
      });
      bridgeTarget(bridge.target).dispatchEvent(legacyEvent);
    });
  };

  const removeWrapped = (name, handler, wrapped) => {
    eventTarget.removeEventListener(name, wrapped);
    const byHandler = subscriptions.get(name);
    const wrappers = byHandler?.get(handler);
    wrappers?.delete(wrapped);
    if (wrappers && wrappers.size === 0) byHandler.delete(handler);
    if (byHandler && byHandler.size === 0) subscriptions.delete(name);
  };

  const on = (name, handler, options = {}) => {
    assertEventName(name);
    if (typeof handler !== 'function') throw new TypeError('O listener do Event Bus deve ser uma função.');

    let active = true;
    const wrapped = (event) => {
      if (!active) return;
      if (options.once) {
        active = false;
        removeWrapped(name, handler, wrapped);
      }
      handler(event.detail, event);
    };

    const byHandler = subscriptions.get(name) || new Map();
    const wrappers = byHandler.get(handler) || new Set();
    wrappers.add(wrapped);
    byHandler.set(handler, wrappers);
    subscriptions.set(name, byHandler);
    eventTarget.addEventListener(name, wrapped);

    const unsubscribe = () => {
      if (!active) return;
      active = false;
      removeWrapped(name, handler, wrapped);
    };

    if (options.signal) {
      if (options.signal.aborted) unsubscribe();
      else options.signal.addEventListener('abort', unsubscribe, { once: true });
    }

    if (options.replayLatest && retained.has(name) && active) {
      const record = retained.get(name);
      queueMicrotask(() => {
        if (!active) return;
        const replayEvent = new CustomEvent(name, { detail: record.detail });
        Object.defineProperty(replayEvent, 'andreOSMeta', {
          value: Object.freeze({ record, replayed: true }),
        });
        wrapped(replayEvent);
      });
    }

    return unsubscribe;
  };

  const off = (name, handler) => {
    assertEventName(name);
    const byHandler = subscriptions.get(name);
    if (!byHandler) return false;

    const handlers = handler ? [handler] : [...byHandler.keys()];
    let removed = false;
    handlers.forEach((currentHandler) => {
      const wrappers = byHandler.get(currentHandler);
      if (!wrappers) return;
      [...wrappers].forEach((wrapped) => {
        removeWrapped(name, currentHandler, wrapped);
        removed = true;
      });
    });
    return removed;
  };

  const emit = (name, detail, options = {}) => {
    assertEventName(name);
    const dedupeKey = options.dedupeKey ? `${name}:${options.dedupeKey}` : '';
    if (dedupeKey && !rememberDedupe(dedupeKey)) return null;

    const record = recordEvent(name, detail, {
      source: options.source,
      legacyName: options.legacyName,
      dedupeKey: options.dedupeKey,
      replayed: options.replayed,
    });

    if (options.retain) retained.set(name, record);

    const event = new CustomEvent(name, { detail });
    Object.defineProperty(event, 'andreOSMeta', { value: Object.freeze({ record }) });
    eventTarget.dispatchEvent(event);
    printInspector(record);

    if (options.bridgeLegacy !== false && options.source !== 'legacy') {
      dispatchLegacy(name, detail, { source: options.source, replayed: options.replayed });
    }

    return record;
  };

  const once = (name, handler, options = {}) => on(name, handler, { ...options, once: true });

  const latest = (name) => {
    assertEventName(name);
    return retained.get(name) || null;
  };

  const replay = (name, options = {}) => {
    assertEventName(name);
    const record = retained.get(name);
    if (!record) return null;

    const replayKey = options.dedupeKey ? `replay:${name}:${options.dedupeKey}` : '';
    if (replayKey && !rememberDedupe(replayKey)) return null;

    const detail = options.detail === undefined ? record.detail : options.detail;
    if (options.internal !== false) {
      const event = new CustomEvent(name, { detail });
      Object.defineProperty(event, 'andreOSMeta', {
        value: Object.freeze({ record, replayed: true }),
      });
      eventTarget.dispatchEvent(event);
    }
    if (options.legacy !== false) {
      dispatchLegacy(name, detail, { source: 'runtime-replay', replayed: true });
    }
    return record;
  };

  const historySnapshot = (options = {}) => {
    const limit = Math.max(1, Math.min(HISTORY_LIMIT, Number(options.limit) || HISTORY_LIMIT));
    const filter = options.filter;
    const filtered = filter
      ? history.filter((record) => typeof filter === 'function'
        ? filter(record)
        : record.name.startsWith(String(filter)))
      : history;
    return filtered.slice(-limit);
  };

  const inspect = (options = {}) => {
    if (options === false) inspectorEnabled = false;
    else {
      inspectorEnabled = true;
      if (typeof options === 'string' || options instanceof RegExp || typeof options === 'function') {
        inspectorFilter = options;
      } else if (options && typeof options === 'object' && 'filter' in options) {
        inspectorFilter = options.filter || null;
      }
      if (options && typeof options === 'object' && options.clear) history.length = 0;
    }

    return Object.freeze({
      start(filter = null) {
        inspectorEnabled = true;
        inspectorFilter = filter;
        return this;
      },
      stop() {
        inspectorEnabled = false;
        return this;
      },
      clear() {
        history.length = 0;
        return this;
      },
      history: historySnapshot,
      latest,
      get enabled() { return inspectorEnabled; },
    });
  };

  const events = Object.freeze({
    names,
    on,
    off,
    emit,
    once,
    replay,
    latest,
    history: historySnapshot,
    inspect,
  });

  const stateRoot = Object.create(null);
  const sliceNames = new Set();

  const pathParts = (path) => Array.isArray(path)
    ? path.map(String).filter(Boolean)
    : String(path || '').split('.').map((part) => part.trim()).filter(Boolean);

  const cloneValue = (value) => {
    if (value === undefined) return undefined;
    if (typeof structuredClone === 'function') {
      try { return structuredClone(value); } catch (_) { /* non-cloneable value */ }
    }
    if (value && typeof value === 'object') {
      try { return JSON.parse(JSON.stringify(value)); } catch (_) { /* non-serializable value */ }
    }
    return value;
  };

  const readPath = (path) => {
    const parts = pathParts(path);
    let current = stateRoot;
    for (const part of parts) {
      if (!current || typeof current !== 'object' || !(part in current)) return undefined;
      current = current[part];
    }
    return current;
  };

  const writePath = (path, value) => {
    const parts = pathParts(path);
    if (!parts.length) throw new TypeError('O State Manager exige um caminho de estado.');
    let current = stateRoot;
    parts.slice(0, -1).forEach((part) => {
      if (!current[part] || typeof current[part] !== 'object') current[part] = Object.create(null);
      current = current[part];
    });
    current[parts.at(-1)] = value;
  };

  const registerSlice = (name, initialState = {}, options = {}) => {
    if (!/^[a-z][a-zA-Z0-9]*$/.test(String(name || ''))) {
      throw new TypeError('O nome da fatia de estado deve usar lowerCamelCase sem pontos.');
    }
    if (sliceNames.has(name) && !options.replace) {
      throw new Error(`A fatia de estado “${name}” já está registrada.`);
    }
    const previous = stateRoot[name];
    stateRoot[name] = cloneValue(initialState);
    sliceNames.add(name);
    events.emit(names.state.sliceRegistered, {
      name,
      previous: cloneValue(previous),
      value: cloneValue(stateRoot[name]),
    }, { source: options.source || 'state', dedupeKey: options.dedupeKey });
    return cloneValue(stateRoot[name]);
  };

  const get = (path = '') => cloneValue(pathParts(path).length ? readPath(path) : stateRoot);

  const set = (path, value, options = {}) => {
    const previous = cloneValue(readPath(path));
    writePath(path, cloneValue(value));
    const next = cloneValue(readPath(path));
    if (!options.silent) {
      events.emit(names.state.changed, {
        path: pathParts(path).join('.'),
        previous,
        value: next,
      }, { source: options.source || 'state' });
    }
    return next;
  };

  const update = (path, updater, options = {}) => {
    if (typeof updater !== 'function') throw new TypeError('state.update exige uma função atualizadora.');
    return set(path, updater(get(path)), options);
  };

  const has = (path) => readPath(path) !== undefined;

  const subscribe = (path, handler, options = {}) => {
    const normalized = pathParts(path).join('.');
    if (typeof handler !== 'function') throw new TypeError('state.subscribe exige uma função.');
    const unsubscribe = events.on(names.state.changed, (change, event) => {
      if (!normalized || change.path === normalized || change.path.startsWith(`${normalized}.`)) {
        handler(change, event);
      }
    });
    if (options.immediate) {
      queueMicrotask(() => handler({ path: normalized, previous: undefined, value: get(normalized), initial: true }, null));
    }
    return unsubscribe;
  };

  const state = Object.freeze({
    registerSlice,
    get,
    set,
    update,
    has,
    subscribe,
    snapshot: get,
    slices: () => [...sliceNames],
  });

  const startedAt = new Date().toISOString();
  const isDevelopment = /(^localhost$|^127\.0\.0\.1$|\.pages\.dev$)/.test(location.hostname)
    || new URLSearchParams(location.search).get('andreosDebug') === '1';

  const runtime = Object.freeze({
    version: VERSION,
    startedAt,
    isDevelopment,
    events,
    state,
  });

  root.runtime = runtime;
  root.events = events;
  root.state = state;
  root.version = VERSION;
  window.AndreOS = root;

  canonicalByLegacy.forEach((bridge, legacyName) => {
    const target = bridgeTarget(bridge.target);
    target.addEventListener(legacyName, (event) => {
      if (event[BRIDGE_MARK]) return;
      let detail = event.detail;
      if (bridge.canonical === names.navigation.viewChanged) {
        const view = String(detail?.view || 'view');
        const viewId = String(detail?.viewId || `${view}:${++viewSequence}`);
        if (detail && typeof detail === 'object' && Object.isExtensible(detail)) detail.viewId = viewId;
        else detail = { ...(detail || {}), view, viewId };
      }
      const retain = [names.system.authenticated, names.navigation.viewChanged, names.radar.updated]
        .includes(bridge.canonical);
      const dedupeKey = bridge.canonical === names.navigation.viewChanged && detail?.viewId
        ? detail.viewId
        : bridge.canonical === names.radar.updated && detail?.loadedAt
          ? detail.loadedAt
          : '';
      emit(bridge.canonical, detail, {
        source: 'legacy',
        legacyName,
        bridgeLegacy: false,
        retain,
        dedupeKey,
      });
    });
  });

  if (isDevelopment && new URLSearchParams(location.search).get('andreosDebug') === '1') {
    inspect();
  }

  events.emit(names.system.ready, {
    version: VERSION,
    startedAt,
    environment: isDevelopment ? 'development' : 'production',
  }, { retain: true, dedupeKey: VERSION });
})();
