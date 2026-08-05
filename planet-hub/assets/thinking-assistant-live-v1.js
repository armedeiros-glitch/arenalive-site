(() => {
  'use strict';

  const API_URL = '/api/hub/pensar-comigo';
  const HISTORY_PREFIX = 'andre-os:thinking-history:v1:';
  const FLOATING_TRIGGER_SELECTOR = '[data-thinking-floating-trigger]';
  const MAX_HISTORY_MESSAGES = 10;
  let installed = false;
  let observerTimer = 0;
  let activeConversationContext = null;

  const assistant = () => window.ThinkingAssistant;
  const currentContext = () => activeConversationContext || assistant()?.getContext?.() || {};
  const contextKey = (context = currentContext()) => [
    context.page_id || 'dashboard',
    context.selected_item?.id || context.selected_item?.source_id || 'page',
  ].join(':');

  const historyStorageKey = (context) => `${HISTORY_PREFIX}${contextKey(context)}`;

  const readHistory = (context) => {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(historyStorageKey(context)) || '[]');
      return Array.isArray(parsed) ? parsed.slice(-MAX_HISTORY_MESSAGES) : [];
    } catch {
      return [];
    }
  };

  const writeHistory = (context, history) => {
    try {
      sessionStorage.setItem(historyStorageKey(context), JSON.stringify(history.slice(-MAX_HISTORY_MESSAGES)));
    } catch {
      // O assistente continua funcionando sem persistência de sessão.
    }
  };

  const ensureFloatingTrigger = () => {
    if (!document.body || !assistant()) return null;

    let trigger = document.querySelector(FLOATING_TRIGGER_SELECTOR);
    if (!trigger) {
      trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'aos-thinking-floating-trigger';
      trigger.dataset.thinkingFloatingTrigger = '1';
      trigger.setAttribute('aria-label', 'Pensar comigo');
      trigger.innerHTML = '<span class="aos-thinking-orb" aria-hidden="true">🧠</span>';
      document.body.appendChild(trigger);
    } else if (trigger.parentElement !== document.body) {
      document.body.appendChild(trigger);
    }

    const context = assistant()?.getContext?.() || {};
    const path = Array.isArray(context.context_path) ? context.context_path.join(' › ') : '';
    trigger.title = path ? `Pensar no contexto: ${path}` : 'Pensar comigo';

    document.querySelectorAll('[data-thinking-assistant-trigger]').forEach((legacyTrigger) => {
      legacyTrigger.setAttribute('aria-hidden', 'true');
      legacyTrigger.setAttribute('tabindex', '-1');
    });

    return trigger;
  };

  const ensureConversation = () => {
    ensureFloatingTrigger();

    const root = document.querySelector('[data-thinking-assistant-root]');
    const form = root?.querySelector('[data-thinking-form]');
    if (!root || !form) return null;

    let conversation = root.querySelector('[data-thinking-conversation]');
    if (!conversation) {
      conversation = document.createElement('section');
      conversation.className = 'aos-thinking-conversation';
      conversation.dataset.thinkingConversation = '1';
      conversation.setAttribute('aria-live', 'polite');
      conversation.setAttribute('aria-label', 'Conversa com o André OS');
      form.insertAdjacentElement('beforebegin', conversation);
    }

    const footerText = form.querySelector('footer > span');
    if (footerText) footerText.textContent = 'A IA só é consultada quando você enviar. Nenhuma ação é executada automaticamente.';

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.innerHTML = 'Pensar agora <i>→</i>';

    return conversation;
  };

  const messageElement = (entry, isLatest = false) => {
    const article = document.createElement('article');
    article.className = `aos-thinking-message ${entry.role === 'assistant' ? 'assistant' : 'user'}`;
    if (isLatest && entry.role === 'assistant') article.classList.add('latest');
    const label = document.createElement('small');
    label.textContent = entry.role === 'assistant' ? 'André OS' : 'Você';
    const text = document.createElement('div');
    text.textContent = String(entry.content || '');
    article.append(label, text);
    return article;
  };

  const renderHistory = (context = currentContext()) => {
    const conversation = ensureConversation();
    if (!conversation || !context) return;

    const history = readHistory(context);
    conversation.replaceChildren();
    conversation.dataset.contextKey = contextKey(context);

    if (!history.length) {
      const empty = document.createElement('div');
      empty.className = 'aos-thinking-empty';
      empty.textContent = 'O contexto desta tela está pronto. Escreva o que você quer entender, decidir ou destravar.';
      conversation.appendChild(empty);
      return;
    }

    history.forEach((entry, index) => {
      const isLatest = index === history.length - 1;
      conversation.appendChild(messageElement(entry, isLatest));
    });
    requestAnimationFrame(() => { conversation.scrollTop = conversation.scrollHeight; });
  };

  const showPending = () => {
    const conversation = ensureConversation();
    if (!conversation) return;
    conversation.querySelector('[data-thinking-pending]')?.remove();
    const pending = document.createElement('article');
    pending.className = 'aos-thinking-message assistant pending';
    pending.dataset.thinkingPending = '1';
    pending.innerHTML = '<small>André OS</small><div>Organizando o contexto e pensando…</div>';
    conversation.appendChild(pending);
    requestAnimationFrame(() => {
      conversation.scrollTop = conversation.scrollHeight;
      pending.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const revealLatestResponse = (context = currentContext()) => {
    const conversation = ensureConversation();
    if (!conversation) return;
    renderHistory(context);
    requestAnimationFrame(() => {
      const latest = conversation.querySelector('.aos-thinking-message.assistant.latest');
      if (!latest) return;
      conversation.scrollTop = conversation.scrollHeight;
      latest.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const setStatus = (message, tone = '') => {
    const status = document.querySelector('[data-thinking-status]');
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
    status.hidden = !message;
  };

  const setBusy = (busy) => {
    const form = document.querySelector('[data-thinking-form]');
    if (!form) return;
    form.dataset.thinkingBusy = busy ? '1' : '0';
    form.querySelector('textarea')?.toggleAttribute('disabled', busy);
    form.querySelector('button[type="submit"]')?.toggleAttribute('disabled', busy);
  };

  const clearInput = () => {
    const input = document.querySelector('[data-thinking-input]');
    if (!input) return;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const transport = async (payload) => {
    const context = payload.context || assistant()?.getContext?.() || {};
    activeConversationContext = context;
    const previousHistory = readHistory(context);
    const userEntry = { role: 'user', content: String(payload.prompt || '').trim() };
    const visibleHistory = [...previousHistory, userEntry].slice(-MAX_HISTORY_MESSAGES);
    writeHistory(context, visibleHistory);
    renderHistory(context);
    showPending();
    setBusy(true);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          history: previousHistory.slice(-8),
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Falha HTTP ${response.status}`);

      const answer = String(result.answer || '').trim();
      if (!answer) throw new Error('A IA não retornou uma resposta utilizável.');

      const completedHistory = [...visibleHistory, { role: 'assistant', content: answer }]
        .slice(-MAX_HISTORY_MESSAGES);
      writeHistory(context, completedHistory);
      revealLatestResponse(context);
      clearInput();
      return result;
    } catch (error) {
      renderHistory(context);
      throw error;
    } finally {
      setBusy(false);
    }
  };

  const install = () => {
    if (!assistant()) return false;
    if (!installed) {
      assistant().setTransport(transport);
      assistant().registerContextProvider('ai_connection', () => ({
        connected: true,
        mode: 'manual_only',
        endpoint: API_URL,
      }), 100);
      installed = true;
    }
    ensureFloatingTrigger();
    ensureConversation();
    renderHistory();
    return true;
  };

  const scheduleSync = () => {
    clearTimeout(observerTimer);
    observerTimer = setTimeout(() => install(), 70);
  };

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.(FLOATING_TRIGGER_SELECTOR)) return;
    event.preventDefault();
    event.stopPropagation();
    assistant()?.open?.();
  }, true);

  window.addEventListener('andre-os:thinking-open', (event) => {
    activeConversationContext = event.detail?.context || assistant()?.getContext?.() || null;
    ensureConversation();
    renderHistory(activeConversationContext);
  });
  window.addEventListener('andre-os:thinking-response', (event) => {
    const context = event.detail?.payload?.context || activeConversationContext || assistant()?.getContext?.();
    activeConversationContext = context || activeConversationContext;
    setStatus('Resposta pronta. Ela está destacada acima.', 'success');
    revealLatestResponse(context);
  });
  window.addEventListener('andre-os:thinking-close', () => {
    activeConversationContext = null;
  });
  window.addEventListener('andre-os:context-changed', scheduleSync);
  window.addEventListener('pmh:radar-data', scheduleSync);
  window.addEventListener('hashchange', () => {
    activeConversationContext = null;
    scheduleSync();
  });
  window.addEventListener('pmh:access-ready', scheduleSync);

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  install();
  scheduleSync();
})();