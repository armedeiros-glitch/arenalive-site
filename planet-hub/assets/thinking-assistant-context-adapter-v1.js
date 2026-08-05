(() => {
  'use strict';

  const root = window.AndreOS;
  const originalAssistant = window.ThinkingAssistant;
  if (!root?.context || !root?.events || !originalAssistant) return;

  const clone = (value) => {
    if (value === undefined) return undefined;
    if (typeof structuredClone === 'function') {
      try { return structuredClone(value); } catch (_) { /* non-cloneable */ }
    }
    try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
  };

  const assistantItem = (item) => item ? {
    id: item.id || '',
    source_id: item.sourceId || '',
    type: item.type || 'item',
    title: item.title || 'Item selecionado',
    origin: item.origin || '',
    status: item.status || '',
    responsible: item.responsible || '',
    due_date: item.dueDate || '',
    operational_state: item.operationalState || 'actionable',
    depends_on: item.dependsOn || '',
    blocker_reason: item.blockerReason || '',
    next_action: item.nextAction || '',
    follow_up_date: item.followUpDate || '',
    last_reading: clone(item.lastReading || null),
  } : null;

  const runtimeItem = (item) => item ? {
    id: item.id || item.source_id || '',
    sourceId: item.source_id || '',
    type: item.type || 'item',
    title: item.title || 'Item selecionado',
    origin: item.origin || '',
    status: item.status || '',
    responsible: item.responsible || '',
    dueDate: item.due_date || '',
    operationalState: item.operational_state || 'actionable',
    dependsOn: item.depends_on || '',
    blockerReason: item.blocker_reason || '',
    nextAction: item.next_action || '',
    followUpDate: item.follow_up_date || '',
    lastReading: clone(item.last_reading || null),
  } : null;

  const toAssistantContext = (context) => {
    if (!context) return null;
    const item = assistantItem(context.focus?.item || null);
    return {
      schema_version: 2,
      assistant: 'ThinkingAssistant',
      assistant_version: originalAssistant.version,
      captured_at: context.capturedAt,
      page_id: context.navigation?.pageId || 'andre_os.inicio',
      module_id: context.navigation?.moduleId || context.operation?.moduleId || 'andre_os',
      page_label: context.navigation?.label || 'Início',
      module_label: 'André OS',
      context_path: clone(context.navigation?.contextPath || ['André OS']),
      route: context.navigation?.route || `${location.pathname}${location.hash || ''}`,
      screen_title: context.navigation?.label || document.title || 'André OS',
      selected_item: item,
      radar: {
        active_items: Number(context.radar?.activeItems || 0),
        source_errors: clone(context.radar?.sourceErrors || []),
        loaded_at: context.radar?.loadedAt || '',
      },
      operation: clone(context.operation || null),
      sources: clone(context.sources || null),
      decision_context: {
        attention_level: context.focus?.attentionLevel || 'none',
        attention_reason: context.focus?.attentionReason || '',
        next_action: context.focus?.nextAction || '',
        explanation: clone(context.explanations?.focus || null),
      },
      runtime_context: clone(context),
      providers: {
        context_engine: {
          version: root.context.version,
          schema_version: root.context.schemaVersion,
        },
      },
    };
  };

  const publishSelectedItem = (legacyContext) => {
    const item = runtimeItem(legacyContext?.selected_item);
    if (!item) return false;
    root.events.emit(root.events.names.focus.changed, {
      item,
      source: 'thinking-assistant',
    }, {
      source: 'thinking-assistant',
      retain: true,
      dedupeKey: `${item.id || item.sourceId}:${legacyContext?.captured_at || Date.now()}`,
    });
    return true;
  };

  const mapPayload = (payload, reason) => {
    publishSelectedItem(payload?.context);
    const context = root.context.update(reason);
    const mappedContext = toAssistantContext(context);
    return {
      ...clone(payload || {}),
      context: mappedContext || clone(payload?.context || {}),
    };
  };

  const originalSetTransport = originalAssistant.setTransport.bind(originalAssistant);
  const wrappedAssistant = Object.freeze({
    ...originalAssistant,
    getContext() {
      const context = root.context.get() || root.context.update('thinking-assistant.getContext');
      return toAssistantContext(context) || originalAssistant.getContext();
    },
    buildPayload(prompt, overrides = {}) {
      return mapPayload(
        originalAssistant.buildPayload(prompt, overrides),
        'thinking-assistant.buildPayload',
      );
    },
    setTransport(handler) {
      if (handler == null) return originalSetTransport(handler);
      if (typeof handler !== 'function') return originalSetTransport(handler);

      return originalSetTransport(async (payload) => {
        const mappedPayload = mapPayload(payload, 'thinking-assistant.transport');
        const contextRevision = mappedPayload.context?.runtime_context?.revision || 0;
        root.events.emit(root.events.names.assistant.thinkingStarted, {
          requestId: mappedPayload.request_id || '',
          contextRevision,
        }, { source: 'thinking-assistant' });

        try {
          const response = await handler(mappedPayload);
          root.events.emit(root.events.names.assistant.responseFinished, {
            requestId: mappedPayload.request_id || '',
            contextRevision,
            status: 'success',
          }, { source: 'thinking-assistant' });
          return response;
        } catch (cause) {
          root.events.emit(root.events.names.assistant.responseFinished, {
            requestId: mappedPayload.request_id || '',
            contextRevision,
            status: 'error',
            message: cause instanceof Error ? cause.message : String(cause),
          }, { source: 'thinking-assistant' });
          throw cause;
        }
      });
    },
  });

  originalAssistant.registerContextProvider('andreOSContext', () => root.context.get(), 1000);
  window.ThinkingAssistant = wrappedAssistant;
  root.context.subscribe(() => wrappedAssistant.refresh(), { immediate: true });

  window.addEventListener('andre-os:thinking-open', (event) => {
    publishSelectedItem(event.detail?.context);
  });

  window.addEventListener('andre-os:thinking-request', (event) => {
    publishSelectedItem(event.detail?.payload?.context);
  }, true);

  window.addEventListener('hashchange', () => {
    root.events.emit(root.events.names.focus.cleared, {
      reason: 'navigation.changed',
    }, { source: 'thinking-assistant' });
  });
})();
