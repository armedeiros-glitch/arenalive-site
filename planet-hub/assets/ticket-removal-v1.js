(() => {
  const STORAGE_KEY = 'planet-hub-hidden-tickets-v1';
  const nativeFetch = window.fetch.bind(window);

  const readHidden = () => {
    try {
      const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      return new Set(Array.isArray(value) ? value.map(String) : []);
    } catch (_) {
      return new Set();
    }
  };

  const writeHidden = (ids) => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  };

  window.fetch = async (...args) => {
    const response = await nativeFetch(...args);
    const input = args[0];
    const url = typeof input === 'string' ? input : input?.url || '';

    if (!url.includes('/api/sults/chamados') || !response.ok) return response;

    try {
      const payload = await response.clone().json();
      const hidden = readHidden();
      if (!Array.isArray(payload.data) || !hidden.size) return response;

      const filtered = payload.data.filter((ticket) => !hidden.has(String(ticket.sultsTicketId ?? ticket.id)));
      const nextPayload = {
        ...payload,
        data: filtered,
        pagination: payload.pagination
          ? { ...payload.pagination, size: filtered.length }
          : payload.pagination,
      };

      return new Response(JSON.stringify(nextPayload), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (_) {
      return response;
    }
  };

  const addRemoveButtons = () => {
    document.querySelectorAll('#pmh-command-center .pmh-ticket-card').forEach((card) => {
      if (card.dataset.pmhRemoveReady === '1') return;
      const idText = card.querySelector('header > span')?.textContent || '';
      const ticketId = idText.replace(/\D/g, '');
      if (!ticketId) return;

      card.dataset.pmhRemoveReady = '1';
      card.dataset.ticketId = ticketId;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pmh-ticket-remove';
      button.dataset.ticketRemove = ticketId;
      button.title = 'Excluir do Hub';
      button.setAttribute('aria-label', `Excluir chamado ${ticketId} do Hub`);
      button.textContent = '×';
      card.querySelector('header')?.appendChild(button);
    });
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-ticket-remove]');
    if (!button) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const ticketId = button.dataset.ticketRemove;
    const confirmed = window.confirm(
      `Excluir o chamado #${ticketId} deste painel?\n\nEle continuará existindo no SULTS.`,
    );
    if (!confirmed) return;

    const hidden = readHidden();
    hidden.add(String(ticketId));
    writeHidden(hidden);

    const refresh = document.querySelector('#pmh-command-center .pmh-cc-refresh');
    if (refresh) refresh.click();
    else window.location.reload();
  }, true);

  const observer = new MutationObserver(addRemoveButtons);
  observer.observe(document.body, { childList: true, subtree: true });
  addRemoveButtons();
})();
