(() => {
  'use strict';

  const API_URL = '/api/hub/pensar-comigo';
  const HISTORY_PREFIX = 'andre-os:thinking-history:v1:';
  const FLOATING_TRIGGER_SELECTOR = '[data-thinking-floating-trigger]';
  const MAX_HISTORY_MESSAGES = 12;

  let installed = false;
  let observerTimer = 0;
  let activeContext = null;

  const assistant = () => window.ThinkingAssistant;
  const currentContext = () => activeContext || assistant()?.getContext?.() || {};

  const contextKey = (context = currentContext()) => [
    context.page_id || 'dashboard',
    context.selected_item?.id || context.selected_item?.source_id || 'page',
  ].join(':');

  const historyStorageKey = (context) => `${HISTORY_PREFIX}${contextKey(context)}`;

  const readHistory = (context) => {
    try {
      const value = JSON.parse(sessionStorage.getItem(historyStorageKey(context)) || '[]');
      return Array.isArray(value) ? value.slice(-MAX_HISTORY_MESSAGES) : [];
    } catch {
      return [];
    }
  };

  const writeHistory = (context, history) => {
    try {
      sessionStorage.setItem(historyStorageKey(context), JSON.stringify(history.slice(-MAX_HISTORY_MESSAGES)));
    } catch {
      // A conversa continua funcionando sem persistência de sessão.
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

  const ensureChat = () => {
    ensureFloatingTrigger();

    const root = document.querySelector('[data-thinking-assistant-root]');
    const main = root?.querySelector('.aos-thinking-main');
    const form = root?.querySelector('[data-thinking-form]');
    if (!root || !main || !form) return null;

    root.querySelector('.aos-thinking-intro')?.remove();

    let shell = root.querySelector('[data-thinking-chat-shell]');
    if (!shell) {
      shell = document.createElement('section');
      shell.className = 'aos-thinking-chat-shell';
      shell.dataset.thinkingChatShell = '1';
      main.appendChild(shell);
    }

    let conversation = root.querySelector('[data-thinking-conversation]');
    if (!conversation) {
      conversation = document.createElement('div');
      conversation.className = 'aos-thinking-conversation';
      conversation.dataset.thinkingConversation = '1';
      conversation.setAttribute('aria-live', 'polite');
      conversation.setAttribute('aria-label', 'Conversa com o André OS');
    }

    if (conversation.parentElement !== shell) shell.prepend(conversation);
    if (form.parentElement !== shell) shell.appendChild(form);

    form.classList.add('aos-thinking-chat-composer');
    form.querySelector('label')?.classList.add('aos-thinking-chat-label');

    const textarea = form.querySelector('textarea');
    if (textarea) {
      textarea.rows = 2;
      textarea.placeholder = 'Escreva sua pergunta…';
    }

    const footerText = form.querySelector('footer > span');
    if (footerText) footerText.textContent = 'A IA só responde quando você enviar.';

    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) submitButton.innerHTML = 'Enviar <i>→</i>';

    return { root, main, shell, conversation, form };
  };

  const messageElement = (entry, latest = false) => {
    const article = document.createElement('article');
    article.className = `aos-thinking-message ${entry.role === 'assistant' ? 'assistant' : 'user'}`;
    if (latest && entry.role === 'assistant') article.classList.add('latest');

    const label = document.createElement('small');
    label.textContent = entry.role === 'assistant' ? 'André OS' : 'Você';

    const text = document.createElement('div');
    text.textContent = String(entry.content || '');

    article.append(label, text);
    return article;
  };

  const renderHistory = (context = currentContext()) => {
    const mounted = ensureChat();
    if (!mounted) return;

    const { conversation } = mounted;
    const history = readHistory(context);
    conversation.replaceChildren();
    conversation.dataset.contextKey = contextKey(context);

    if (!history.length) {
      const empty = document.createElement('div');
      empty.className = 'aos-thinking-empty';
      empty.innerHTML = '<strong>Conversa pronta.</strong><span>Pergunte sobre esta página ou sobre o item aberto.</span>';
      conversation.appendChild(empty);
      return;
    }

    history.forEach((entry, index) => {
      conversation.appendChild(messageElement(entry, index === history.length - 1));
    });

    requestAnimationFrame(() => {
      conversation.scrollTop = conversation.scrollHeight;
    });
  };

  const showPending = () => {
    const mounted = ensureChat();
    if (!mounted) return;

    const pending = document.createElement('article');
    pending.className = 'aos-thinking-message assistant pending';
    pending.dataset.thinkingPending = '1';
    pending.innerHTML = '<small>André OS</small><div>Pensando…</div>';
    mounted.conversation.appendChild(pending);
    mounted.conversation.scrollTop = mounted.conversation.scrollHeight;
  };

  const setBusy = (busy) => {
    const mounted = ensureChat();
    if (!mounted) return;

    mounted.form.dataset.thinkingBusy = busy ? '1' : '0';
    mounted.form.querySelector('textarea')?.toggleAttribute('disabled', busy);
    mounted.form.querySelector('button[type="submit"]')?.toggleAttribute('disabled', busy);
  };

  const clearInput = () => {
    const input = document.querySelector('[data-thinking-input]');
    if (!input) return;
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const clearStatus = () => {
    const status = document.querySelector('[data-thinking-status]');
    if (!status) return;
    status.hidden = true;
    status.textContent = '';
  };

  const transport = async (payload) => {
    const context = payload.context || assistant()?.getContext?.() || {};
    activeContext = context;

    const previousHistory = readHistory(context);
    const userEntry = { role: 'user', content: String(payload.prompt || '').trim() };
    const visibleHistory = [...previousHistory, userEntry].slice(-MAX_HISTORY_MESSAGES);

    writeHistory(context, visibleHistory);
    renderHistory(context);
    showPending();
    clearStatus();
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
      renderHistory(context);
      clearInput();
      clearStatus();
      return result;
    } catch (error) {
      const failedHistory = [...visibleHistory, {
        role: 'assistant',
        content: error instanceof Error ? error.message : 'Não foi possível responder agora.',
      }].slice(-MAX_HISTORY_MESSAGES);
      writeHistory(context, failedHistory);
      renderHistory(context);
      clearStatus();
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
    ensureChat();
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

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.shiftKey) return;
    const input = event.target.closest?.('[data-thinking-input]');
    if (!input) return;
    event.preventDefault();
    input.closest('form')?.requestSubmit();
  });

  window.addEventListener('andre-os:thinking-open', (event) => {
    activeContext = event.detail?.context || assistant()?.getContext?.() || null;
    ensureChat();
    renderHistory(activeContext);
    clearStatus();
  });

  window.addEventListener('andre-os:thinking-response', () => {
    renderHistory(activeContext || assistant()?.getContext?.());
    clearStatus();
  });

  window.addEventListener('andre-os:thinking-close', () => {
    activeContext = null;
  });

  window.addEventListener('andre-os:context-changed', scheduleSync);
  window.addEventListener('pmh:radar-data', scheduleSync);
  window.addEventListener('hashchange', () => {
    activeContext = null;
    scheduleSync();
  });
  window.addEventListener('pmh:access-ready', scheduleSync);

  const observer = new MutationObserver(scheduleSync);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  install();
  scheduleSync();
})();