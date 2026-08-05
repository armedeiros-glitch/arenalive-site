(() => {
  'use strict';

  const ROOT_SELECTOR = '[data-thinking-assistant-root]';
  const CONVERSATION_SELECTOR = '[data-thinking-conversation]';
  const UPDATE_DELAY_MS = 60;
  let updateTimer = 0;

  const enhanceEmptyState = (conversation) => {
    const empty = conversation?.querySelector('.aos-thinking-empty');
    if (!empty || empty.dataset.enhanced === '1') return;

    empty.dataset.enhanced = '1';
    empty.replaceChildren();

    const icon = document.createElement('span');
    icon.className = 'aos-thinking-chat-empty-icon';
    icon.textContent = '✦';

    const copy = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = 'Este não é um chat solto.';
    const text = document.createElement('p');
    text.textContent = 'Seu pedido será combinado com a página, o item aberto e os dados relacionados antes de chegar à IA.';
    copy.append(title, text);

    empty.append(icon, copy);
  };

  const ensureChatSurface = () => {
    const root = document.querySelector(ROOT_SELECTOR);
    const intro = root?.querySelector('.aos-thinking-intro');
    const form = root?.querySelector('[data-thinking-form]');
    const conversation = root?.querySelector(CONVERSATION_SELECTOR);
    if (!root || !intro || !form || !conversation) return null;

    intro.classList.add('aos-thinking-chat-surface');
    intro.dataset.thinkingChatSurface = '1';

    let header = intro.querySelector('[data-thinking-chat-header]');
    if (!header) {
      intro.replaceChildren();

      header = document.createElement('header');
      header.className = 'aos-thinking-chat-header';
      header.dataset.thinkingChatHeader = '1';
      header.innerHTML = '<span aria-hidden="true">✦</span><div><small>CONVERSA CONTEXTUAL</small><strong>André OS</strong></div>';
      intro.appendChild(header);
    }

    if (conversation.parentElement !== intro) intro.appendChild(conversation);
    if (intro.nextElementSibling !== form) form.parentElement?.insertBefore(intro, form);

    enhanceEmptyState(conversation);
    return { root, intro, form, conversation };
  };

  const scrollConversationIntoView = () => {
    const mounted = ensureChatSurface();
    if (!mounted) return;

    const { root, intro, conversation } = mounted;
    const main = root.querySelector('.aos-thinking-main');
    const latest = conversation.querySelector('.aos-thinking-message.assistant.latest')
      || conversation.querySelector('.aos-thinking-message.assistant:last-child')
      || conversation.lastElementChild;

    requestAnimationFrame(() => {
      conversation.scrollTop = conversation.scrollHeight;
      if (main) {
        const targetTop = Math.max(0, intro.offsetTop - 12);
        main.scrollTo({ top: targetTop, behavior: 'smooth' });
      }
      latest?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const setStatus = (message, tone = '') => {
    const status = document.querySelector('[data-thinking-status]');
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone;
    status.hidden = !message;
  };

  const scheduleMount = () => {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(() => ensureChatSurface(), UPDATE_DELAY_MS);
  };

  window.addEventListener('andre-os:thinking-open', () => {
    ensureChatSurface();
    requestAnimationFrame(() => scrollConversationIntoView());
  });

  window.addEventListener('andre-os:thinking-response', () => {
    ensureChatSurface();
    setStatus('Resposta pronta.', 'success');
    requestAnimationFrame(() => scrollConversationIntoView());
  });

  window.addEventListener('andre-os:context-changed', scheduleMount);
  window.addEventListener('pmh:radar-data', scheduleMount);
  window.addEventListener('pmh:access-ready', scheduleMount);
  window.addEventListener('hashchange', scheduleMount);

  const observer = new MutationObserver(scheduleMount);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  ensureChatSurface();
  scheduleMount();
})();