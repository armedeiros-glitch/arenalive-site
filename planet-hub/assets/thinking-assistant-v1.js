(() => {
  'use strict';

  const VERSION = '1.0.0';
  const DRAFT_PREFIX = 'andre-os:thinking-draft:v1:';
  const LAST_CONTEXT_KEY = 'andre-os:thinking-last-context:v1';
  const ROOT_SELECTOR = '[data-thinking-assistant-root]';
  const TRIGGER_SELECTOR = '[data-thinking-assistant-trigger]';
  const UPDATE_DELAY_MS = 80;
  const CLICK_CONTEXT_TTL_MS = 30 * 60 * 1000;

  const pages = new Map();
  const providers = new Map();
  let transport = null;
  let currentContext = null;
  let lastClickedItem = null;
  let updateTimer = 0;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[character]));

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const compact = (value, max = 240) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
  };

  const clone = (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch { return value; }
  };

  const visible = (element) => Boolean(element && (element.offsetWidth || element.offsetHeight || element.getClientRects().length));
  const appReady = () => Boolean(document.querySelector('#pmh-app, .pmh-sidebar, [data-andre-os-app]'))
    && !document.querySelector('.pmh-access-screen');
  const titleText = () => document.querySelector('[data-title]')?.textContent?.trim() || document.title || 'André OS';
  const currentHash = () => String(location.hash || '#inicio').replace(/^#/, '').split('?')[0] || 'inicio';

  const registerPage = (definition = {}) => {
    const pageId = String(definition.pageId || definition.page_id || '').trim();
    if (!pageId) throw new Error('ThinkingAssistant.registerPage exige pageId.');
    pages.set(pageId, {
      pageId,
      moduleId: String(definition.moduleId || definition.module_id || pageId.split('.')[0] || pageId),
      label: String(definition.label || pageId),
      moduleLabel: String(definition.moduleLabel || definition.module_label || 'André OS'),
      contextPath: Array.isArray(definition.contextPath) ? definition.contextPath.map(String) : [],
      priority: Number(definition.priority || 0),
      match: typeof definition.match === 'function' ? definition.match : () => false,
      context: typeof definition.context === 'function' ? definition.context : null,
    });
    scheduleUpdate();
    return () => pages.delete(pageId);
  };

  const registerContextProvider = (name, provider, priority = 0) => {
    if (!name || typeof provider !== 'function') throw new Error('Provider de contexto inválido.');
    providers.set(String(name), { provider, priority: Number(priority || 0) });
    scheduleUpdate();
    return () => providers.delete(String(name));
  };

  const registerDefaultPages = () => {
    const titleHas = (pattern) => pattern.test(normalize(titleText()));
    const hashIs = (...values) => values.includes(currentHash());

    registerPage({
      pageId: 'financeiro', moduleId: 'financeiro', label: 'Financeiro', moduleLabel: 'André OS',
      contextPath: ['Financeiro'], priority: 100,
      match: () => hashIs('financeiro') || titleHas(/financeir/),
    });
    registerPage({
      pageId: 'planet_marketing.chamados', moduleId: 'planet_marketing', label: 'Chamados', moduleLabel: 'Planet Marketing Hub',
      contextPath: ['Planet Marketing Hub', 'Chamados'], priority: 80,
      match: () => hashIs('chamados') || titleHas(/chamados do marketing/),
    });
    registerPage({
      pageId: 'planet_marketing.inauguracoes', moduleId: 'planet_marketing', label: 'Inaugurações', moduleLabel: 'Planet Marketing Hub',
      contextPath: ['Planet Marketing Hub', 'Implantações e inaugurações'], priority: 80,
      match: () => hashIs('inauguracoes') || titleHas(/inaugura/),
    });
    registerPage({
      pageId: 'planet_marketing.calendario', moduleId: 'planet_marketing', label: 'Calendário', moduleLabel: 'Planet Marketing Hub',
      contextPath: ['Planet Marketing Hub', 'Calendário e campanhas'], priority: 80,
      match: () => hashIs('calendario') || titleHas(/calendario|campanha/),
    });
    registerPage({
      pageId: 'planet_marketing.conteudos', moduleId: 'planet_marketing', label: 'Conteúdos', moduleLabel: 'Planet Marketing Hub',
      contextPath: ['Planet Marketing Hub', 'Conteúdos'], priority: 80,
      match: () => hashIs('conteudos') || titleHas(/conteudo/),
    });
    registerPage({
      pageId: 'planet_marketing.dashboard', moduleId: 'planet_marketing', label: 'Painel de Marketing', moduleLabel: 'Planet Marketing Hub',
      contextPath: ['Planet Marketing Hub', 'Dashboard'], priority: 60,
      match: () => hashIs('inicio') || titleHas(/painel de marketing/),
    });
    registerPage({
      pageId: 'planet_marketing', moduleId: 'planet_marketing', label: 'Planet Marketing Hub', moduleLabel: 'Planet Marketing Hub',
      contextPath: ['Planet Marketing Hub'], priority: 10,
      match: () => Boolean(document.querySelector('#pmh-app, .pmh-sidebar')),
    });
    registerPage({
      pageId: 'dashboard', moduleId: 'andre_os', label: 'Dashboard', moduleLabel: 'André OS',
      contextPath: ['André OS', 'Dashboard'], priority: 0,
      match: () => true,
    });
  };

  const radarItems = () => window.PMHRadarData?.getSnapshot?.()?.items || [];
  const radarItemById = (id) => radarItems().find((item) => String(item.id) === String(id)) || null;
  const radarItemBySource = (action, sourceId) => radarItems().find((item) => (
    item.action === action && String(item.sourceId) === String(sourceId)
  )) || null;

  const itemFromElement = (element) => {
    if (!element?.closest) return null;
    const directId = element.dataset?.attentionOpen
      || element.dataset?.radarContext
      || element.closest('[data-attention-open]')?.dataset?.attentionOpen
      || element.closest('[data-radar-context]')?.dataset?.radarContext;
    if (directId) return radarItemById(directId);

    const sourceMappings = [
      ['demandEdit', 'demand'],
      ['contentEdit', 'conteudos'],
      ['editCampaign', 'calendario'],
      ['ticketId', 'chamados'],
    ];
    for (const [key, action] of sourceMappings) {
      const attribute = key.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
      const owner = element.closest(`[data-${attribute}]`);
      const sourceId = owner?.dataset?.[key];
      if (sourceId) return radarItemBySource(action, sourceId);
    }
    return null;
  };

  const itemContext = (item) => item ? {
    id: item.id || '',
    source_id: item.sourceId || '',
    type: item.action || item.origin || 'item',
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
    last_reading: item.ticketReading ? {
      author: item.ticketReading.author || '',
      created_at: item.ticketReading.createdAt || '',
      excerpt: compact(item.ticketReading.text || '', 320),
    } : null,
  } : null;

  const genericPanelContext = () => {
    const candidates = [
      '[data-radar-context-modal].visible',
      '.pmh-ticket-drawer-panel:not(.loading)',
      '[data-attention-handoff]',
      '.pmh-modal',
      '[role="dialog"]',
    ];
    const panel = candidates
      .flatMap((selector) => [...document.querySelectorAll(selector)])
      .filter((element) => !element.matches(ROOT_SELECTOR) && !element.closest(ROOT_SELECTOR))
      .find(visible);
    if (!panel) return null;

    const formId = panel.querySelector('[data-radar-context-form]')?.dataset?.itemId;
    if (formId) return itemContext(radarItemById(formId));

    const ticketNumber = panel.querySelector('.pmh-ticket-drawer-header small')?.textContent?.match(/\d+/)?.[0];
    if (ticketNumber) {
      const ticket = radarItemById(`ticket-${ticketNumber}`) || radarItemBySource('chamados', ticketNumber);
      if (ticket) return itemContext(ticket);
    }

    const heading = panel.querySelector('h1, h2, h3, h4, [data-modal-title], strong');
    const title = compact(heading?.textContent || '', 180);
    return title ? { id: '', source_id: '', type: 'visible_panel', title } : null;
  };

  const selectedItemContext = () => {
    const modalItem = genericPanelContext();
    if (modalItem) return modalItem;
    if (lastClickedItem && Date.now() - lastClickedItem.clickedAt <= CLICK_CONTEXT_TTL_MS) {
      const current = radarItemById(lastClickedItem.id);
      return itemContext(current || lastClickedItem.item);
    }
    return null;
  };

  const resolvePage = () => [...pages.values()]
    .filter((page) => {
      try { return page.match(); } catch { return false; }
    })
    .sort((left, right) => right.priority - left.priority)[0]
    || { pageId: 'dashboard', moduleId: 'andre_os', label: 'Dashboard', moduleLabel: 'André OS', contextPath: ['André OS'] };

  const defaultContextProvider = () => {
    const page = resolvePage();
    const item = selectedItemContext();
    const snapshot = window.PMHRadarData?.getSnapshot?.();
    const pageExtra = page.context ? page.context() : {};
    const path = [...(page.contextPath || [page.moduleLabel, page.label])];
    if (item?.title && !path.includes(item.title)) path.push(item.title);

    return {
      page_id: page.pageId,
      module_id: page.moduleId,
      page_label: page.label,
      module_label: page.moduleLabel,
      context_path: path,
      route: `${location.pathname}${location.hash || ''}`,
      screen_title: titleText(),
      selected_item: item,
      radar: snapshot ? {
        active_items: Array.isArray(snapshot.items) ? snapshot.items.length : 0,
        source_errors: Array.isArray(snapshot.errors) ? snapshot.errors : [],
        loaded_at: snapshot.loadedAt || '',
      } : null,
      ...pageExtra,
    };
  };

  const buildContext = () => {
    const base = defaultContextProvider();
    const additions = [...providers.entries()]
      .sort((left, right) => right[1].priority - left[1].priority)
      .reduce((result, [name, entry]) => {
        try {
          const value = entry.provider(clone(base));
          if (value != null) result[name] = value;
        } catch {
          // Um provider opcional não pode quebrar o assistente global.
        }
        return result;
      }, {});

    return {
      schema_version: 1,
      assistant: 'ThinkingAssistant',
      assistant_version: VERSION,
      captured_at: new Date().toISOString(),
      ...base,
      providers: additions,
    };
  };

  const contextKey = (context = currentContext || buildContext()) => [
    context.page_id,
    context.selected_item?.id || context.selected_item?.source_id || 'page',
  ].join(':');

  const contextSignature = (context) => JSON.stringify({
    page_id: context.page_id,
    context_path: context.context_path,
    selected_item: context.selected_item,
    radar_loaded_at: context.radar?.loaded_at || '',
  });

  const readDraft = (context) => {
    try { return sessionStorage.getItem(`${DRAFT_PREFIX}${contextKey(context)}`) || ''; } catch { return ''; }
  };

  const writeDraft = (value, context) => {
    try { sessionStorage.setItem(`${DRAFT_PREFIX}${contextKey(context)}`, String(value || '')); } catch { /* opcional */ }
  };

  const contextBreadcrumb = (context) => (context.context_path || []).map((part) => `<span>${esc(part)}</span>`).join('<i>›</i>');

  const contextRows = (context) => {
    const item = context.selected_item;
    return [
      ['Página', context.page_label],
      item?.title ? ['Item aberto', item.title] : null,
      item?.responsible ? ['Responsável', item.responsible] : null,
      item?.depends_on ? ['Dependência', item.depends_on] : null,
      item?.next_action ? ['Próximo movimento', item.next_action] : null,
    ].filter(Boolean).map(([label, value]) => `<div><small>${esc(label)}</small><strong>${esc(value)}</strong></div>`).join('');
  };

  const renderContext = (context = buildContext()) => {
    currentContext = context;
    const root = document.querySelector(ROOT_SELECTOR);
    const trigger = document.querySelector(TRIGGER_SELECTOR);
    if (!root || !trigger) return;

    const signature = contextSignature(currentContext);
    if (root.dataset.contextSignature === signature) return;
    root.dataset.contextSignature = signature;

    trigger.title = `Pensar no contexto: ${(currentContext.context_path || []).join(' › ')}`;
    trigger.querySelector('[data-thinking-trigger-context]').textContent = currentContext.selected_item?.title || currentContext.page_label;
    root.querySelector('[data-thinking-context-path]').innerHTML = contextBreadcrumb(currentContext);
    root.querySelector('[data-thinking-context-rows]').innerHTML = contextRows(currentContext);
    root.querySelector('[data-thinking-page-id]').textContent = currentContext.page_id;

    const textarea = root.querySelector('[data-thinking-input]');
    const activeDraftKey = textarea.dataset.draftKey || '';
    const nextDraftKey = contextKey(currentContext);
    if (activeDraftKey !== nextDraftKey) {
      textarea.dataset.draftKey = nextDraftKey;
      textarea.value = readDraft(currentContext);
    }

    try { sessionStorage.setItem(LAST_CONTEXT_KEY, JSON.stringify(currentContext)); } catch { /* opcional */ }
  };

  const open = (overrides = {}) => {
    if (!ensureMounted()) return;
    const context = { ...buildContext(), ...clone(overrides) };
    renderContext(context);
    const root = document.querySelector(ROOT_SELECTOR);
    root?.classList.add('open');
    root?.setAttribute('aria-hidden', 'false');
    document.body.classList.add('aos-thinking-open');
    root?.querySelector('[data-thinking-input]')?.focus();
    window.dispatchEvent(new CustomEvent('andre-os:thinking-open', { detail: { context: clone(currentContext) } }));
  };

  const close = () => {
    const root = document.querySelector(ROOT_SELECTOR);
    root?.classList.remove('open');
    root?.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('aos-thinking-open');
    window.dispatchEvent(new CustomEvent('andre-os:thinking-close'));
  };

  const buildPayload = (prompt, overrides = {}) => ({
    request_id: globalThis.crypto?.randomUUID?.() || `thinking-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    prompt: String(prompt || '').trim(),
    context: { ...buildContext(), ...clone(overrides.context || {}) },
    created_at: new Date().toISOString(),
    interface: 'thinking_assistant',
  });

  const setStatus = (message, tone = '') => {
    const status = document.querySelector('[data-thinking-status]');
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
    status.hidden = !message;
  };

  const submit = async (prompt, overrides = {}) => {
    const payload = buildPayload(prompt, overrides);
    if (!payload.prompt) return null;

    setStatus('Preparando o contexto desta tela…', 'loading');
    const event = new CustomEvent('andre-os:thinking-request', {
      detail: { payload: clone(payload) },
      cancelable: true,
    });
    window.dispatchEvent(event);

    if (typeof transport !== 'function') {
      setStatus('Contexto preparado. A conexão com a IA entra na próxima etapa.', 'ready');
      return payload;
    }

    try {
      const response = await transport(clone(payload));
      setStatus('Pensamento concluído.', 'success');
      window.dispatchEvent(new CustomEvent('andre-os:thinking-response', { detail: { payload, response } }));
      return response;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Não foi possível consultar a IA.', 'error');
      throw error;
    }
  };

  const setTransport = (handler) => {
    if (handler != null && typeof handler !== 'function') throw new Error('O transport deve ser uma função.');
    transport = handler || null;
  };

  const triggerMarkup = () => `<button type="button" class="aos-thinking-trigger" data-thinking-assistant-trigger>
    <span class="aos-thinking-orb" aria-hidden="true">🧠</span>
    <span><strong>Pensar comigo</strong><small data-thinking-trigger-context>Contexto atual</small></span>
  </button>`;

  const drawerMarkup = () => `<div class="aos-thinking-layer" data-thinking-assistant-root aria-hidden="true">
    <button type="button" class="aos-thinking-backdrop" data-thinking-close aria-label="Fechar Pensar comigo"></button>
    <aside class="aos-thinking-drawer" role="dialog" aria-modal="true" aria-labelledby="aos-thinking-title">
      <header class="aos-thinking-header">
        <div class="aos-thinking-brand"><span>🧠</span><div><small>ANDRÉ OS</small><h2 id="aos-thinking-title">Pensar comigo</h2></div></div>
        <button type="button" class="aos-thinking-close" data-thinking-close aria-label="Fechar">×</button>
      </header>
      <main class="aos-thinking-main">
        <section class="aos-thinking-context">
          <header><small>CONTEXTO ATUAL</small><span data-thinking-page-id></span></header>
          <nav data-thinking-context-path aria-label="Caminho do contexto"></nav>
          <div class="aos-thinking-context-rows" data-thinking-context-rows></div>
        </section>
        <section class="aos-thinking-intro">
          <span>✦</span>
          <div><strong>Este não é um chat solto.</strong><p>Seu pedido será combinado com a página, o item aberto e os dados relacionados antes de chegar à IA.</p></div>
        </section>
        <form class="aos-thinking-form" data-thinking-form>
          <label for="aos-thinking-input">O que você quer entender, decidir ou destravar?</label>
          <textarea id="aos-thinking-input" data-thinking-input rows="7" maxlength="4000" placeholder="Escreva normalmente. Ex.: o que está travando esta implantação e qual deveria ser meu próximo movimento?"></textarea>
          <div class="aos-thinking-status" data-thinking-status hidden></div>
          <footer><span>A integração com IA ainda não está ativada neste componente.</span><button type="submit">Preparar pensamento <i>→</i></button></footer>
        </form>
      </main>
    </aside>
  </div>`;

  const placeTrigger = () => {
    let trigger = document.querySelector(TRIGGER_SELECTOR);
    if (!trigger) {
      document.body.insertAdjacentHTML('beforeend', triggerMarkup());
      trigger = document.querySelector(TRIGGER_SELECTOR);
    }
    const topActions = document.querySelector('.pmh-top-actions');
    if (topActions && trigger.parentElement !== topActions) {
      topActions.insertBefore(trigger, topActions.firstChild);
      trigger.classList.remove('floating');
    } else if (!topActions) {
      trigger.classList.add('floating');
      if (trigger.parentElement !== document.body) document.body.appendChild(trigger);
    }
  };

  const ensureMounted = () => {
    if (!document.body || !appReady()) {
      document.querySelector(ROOT_SELECTOR)?.remove();
      document.querySelector(TRIGGER_SELECTOR)?.remove();
      return false;
    }
    if (!document.querySelector(ROOT_SELECTOR)) document.body.insertAdjacentHTML('beforeend', drawerMarkup());
    placeTrigger();
    return true;
  };

  const scheduleUpdate = () => {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(() => {
      if (ensureMounted()) renderContext();
    }, UPDATE_DELAY_MS);
  };

  document.addEventListener('click', (event) => {
    if (event.target.closest?.(TRIGGER_SELECTOR)) {
      event.preventDefault();
      open();
      return;
    }
    if (event.target.closest?.('[data-thinking-close]')) {
      close();
      return;
    }

    const item = itemFromElement(event.target);
    if (item) {
      lastClickedItem = { id: item.id, item: clone(item), clickedAt: Date.now() };
      scheduleUpdate();
    }
  }, true);

  document.addEventListener('input', (event) => {
    if (!event.target.matches?.('[data-thinking-input]')) return;
    writeDraft(event.target.value, currentContext || buildContext());
    setStatus('', '');
  });

  document.addEventListener('submit', (event) => {
    const form = event.target.closest?.('[data-thinking-form]');
    if (!form) return;
    event.preventDefault();
    submit(form.querySelector('[data-thinking-input]')?.value || '');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && document.querySelector(ROOT_SELECTOR)?.classList.contains('open')) close();
  });

  window.addEventListener('hashchange', () => {
    lastClickedItem = null;
    scheduleUpdate();
  });
  window.addEventListener('pmh:access-ready', scheduleUpdate);
  window.addEventListener('pmh:radar-data', scheduleUpdate);
  window.addEventListener('andre-os:context-changed', scheduleUpdate);

  const observer = new MutationObserver(() => scheduleUpdate());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  registerDefaultPages();
  registerContextProvider('capabilities', () => ({
    planned: ['tarefas relacionadas', 'calendário', 'documentos', 'indicadores', 'alterações recentes'],
    connected: false,
  }), -100);

  window.ThinkingAssistant = Object.freeze({
    version: VERSION,
    registerPage,
    registerContextProvider,
    getContext: () => clone(currentContext || buildContext()),
    buildPayload,
    open,
    close,
    submit,
    setTransport,
    refresh: scheduleUpdate,
  });

  scheduleUpdate();
})();
