(() => {
  'use strict';

  const API = '/api/hub/chamados-ignorados';

  const toast = (message, tone = 'default') => {
    document.querySelector('.pmh-ignore-toast')?.remove();
    const element = document.createElement('div');
    element.className = `pmh-ignore-toast ${tone}`;
    element.textContent = message;
    document.body.appendChild(element);
    requestAnimationFrame(() => element.classList.add('visible'));
    window.setTimeout(() => {
      element.classList.remove('visible');
      window.setTimeout(() => element.remove(), 220);
    }, 2600);
  };

  const decreaseNumber = (selector) => {
    const element = document.querySelector(selector);
    if (!element) return;
    const current = Number.parseInt(element.textContent || '0', 10);
    if (Number.isFinite(current)) element.textContent = String(Math.max(0, current - 1));
  };

  const refreshVisibleLabels = () => {
    const visible = document.querySelectorAll('.pmh-command-ticket').length;
    const filterLabel = document.querySelector('.pmh-command-filter-title span');
    if (filterLabel) filterLabel.textContent = `${visible} exibidos`;

    const description = document.querySelector('.pmh-section-head p');
    const match = description?.textContent?.match(/^(\d+) de (\d+) chamados visíveis\.(.*)$/);
    if (description && match) {
      const total = Math.max(visible, Number.parseInt(match[2], 10) - 1);
      description.textContent = `${visible} de ${total} chamados visíveis.${match[3]}`;
    }
  };

  const updateGroup = (card) => {
    const group = card?.closest('.pmh-command-group');
    if (!group) return;

    const counter = group.querySelector(':scope > header b');
    if (counter) {
      const current = Number.parseInt(counter.textContent || '0', 10);
      counter.textContent = String(Math.max(0, current - 1));
    }

    const list = group.querySelector('.pmh-command-list');
    window.setTimeout(() => {
      if (list && !list.querySelector('.pmh-command-ticket') && !list.querySelector('.pmh-command-empty')) {
        list.innerHTML = '<div class="pmh-command-empty">Nenhum chamado neste grupo.</div>';
      }
    }, 0);
  };

  const updateMetrics = (card) => {
    const deadline = card?.querySelector('.pmh-command-ticket-badges .deadline');
    if (deadline?.classList.contains('late')) decreaseNumber('[data-command-urgency="late"] strong');
    if (deadline?.classList.contains('today')) decreaseNumber('[data-command-urgency="today"] strong');
    if (deadline?.classList.contains('week')) decreaseNumber('[data-command-urgency="week"] strong');
    if (deadline?.classList.contains('no-date')) decreaseNumber('[data-command-urgency="no-date"] strong');

    const status = card?.querySelector('.pmh-command-ticket-badges .status');
    if (status?.classList.contains('status-5') || status?.classList.contains('status-6')) {
      decreaseNumber('[data-command-urgency="waiting"] strong');
    }

    decreaseNumber('[data-badge="tickets"]');
  };

  const removeFromInterface = (id) => {
    const card = document.querySelector(`.pmh-ticket[data-ticket-id="${CSS.escape(id)}"]`);
    updateGroup(card);
    updateMetrics(card);
    card?.remove();

    document.querySelector('.pmh-ticket-drawer')?.remove();
    document.documentElement.classList.remove('pmh-ticket-drawer-open');
    refreshVisibleLabels();
  };

  const ticketDataFromDrawer = (panel) => {
    const headerText = panel.querySelector('.pmh-ticket-drawer-header small')?.textContent || '';
    const id = headerText.replace(/\D/g, '');
    const title = panel.querySelector('.pmh-ticket-drawer-header h2')?.textContent?.trim() || 'Chamado sem título';
    const unit = panel.querySelector('.pmh-ticket-summary article:first-child strong')?.textContent?.trim() || '';
    return { id, title, unit };
  };

  const ticketDataFromCard = (card) => ({
    id: String(card.dataset.ticketId || '').replace(/\D/g, ''),
    title: card.querySelector('h4')?.textContent?.trim() || 'Chamado sem título',
    unit: card.querySelector('p')?.textContent?.trim() || '',
  });

  const setTicketData = (button, ticket) => {
    button.dataset.ignoreTicket = ticket.id;
    button.dataset.ticketTitle = ticket.title;
    button.dataset.ticketUnit = ticket.unit;
  };

  const decorateCards = () => {
    document.querySelectorAll('.pmh-ticket[data-ticket-id]').forEach((card) => {
      if (card.querySelector('[data-ignore-ticket]')) return;
      const ticket = ticketDataFromCard(card);
      if (!ticket.id) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pmh-ignore-card-button';
      button.textContent = '×';
      button.title = `Excluir o chamado #${ticket.id} do Hub`;
      button.setAttribute('aria-label', `Excluir chamado ${ticket.id} do Hub`);
      setTicketData(button, ticket);
      card.appendChild(button);
    });
  };

  const decorateDrawer = () => {
    document.querySelectorAll('.pmh-ticket-drawer-panel').forEach((panel) => {
      const actions = panel.querySelector('.pmh-ticket-drawer-actions');
      if (!actions || actions.querySelector('[data-ignore-ticket]')) return;

      const ticket = ticketDataFromDrawer(panel);
      if (!ticket.id) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pmh-ignore-ticket-button';
      button.textContent = 'Excluir do Hub';
      button.title = 'Oculta este chamado no Hub sem apagar nada no SULTS';
      setTicketData(button, ticket);
      actions.appendChild(button);
    });
  };

  const decorate = () => {
    decorateCards();
    decorateDrawer();
  };

  const ignoreTicket = async (button) => {
    const id = button.dataset.ignoreTicket;
    const title = button.dataset.ticketTitle || 'Chamado sem título';
    const unit = button.dataset.ticketUnit || '';

    const confirmed = window.confirm(
      `Excluir o chamado #${id} do Hub?\n\nEle continuará existindo no SULTS, mas não será importado novamente.`,
    );
    if (!confirmed) return;

    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = button.classList.contains('pmh-ignore-card-button') ? '…' : 'Excluindo…';

    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id, title, unit }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);

      removeFromInterface(id);
      toast(`Chamado #${id} excluído do Hub.`, 'success');
    } catch (error) {
      button.disabled = false;
      button.textContent = originalText;
      toast(error instanceof Error ? error.message : 'Não foi possível excluir o chamado.', 'error');
    }
  };

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-ignore-ticket]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    ignoreTicket(button);
  }, true);

  const style = document.createElement('style');
  style.textContent = `
    .pmh-ticket{position:relative}
    .pmh-ignore-card-button{position:absolute;top:10px;right:10px;z-index:3;display:grid;place-items:center;width:30px;height:30px;padding:0;border:1px solid #e2c7bd;border-radius:8px;color:#98503f;background:#fff8f5;font-size:20px;font-weight:700;line-height:1;cursor:pointer;opacity:.72;transition:opacity .16s ease,border-color .16s ease,color .16s ease,background .16s ease}
    .pmh-ticket:hover .pmh-ignore-card-button,.pmh-ignore-card-button:focus-visible{opacity:1}
    .pmh-ignore-card-button:hover{border-color:#b83925;color:#fff;background:#b83925}
    .pmh-ignore-ticket-button{margin-left:auto!important;border-color:#d8a69a!important;color:#a73522!important;background:#fff7f4!important}
    .pmh-ignore-ticket-button:hover{border-color:#b83925!important;color:#fff!important;background:#b83925!important}
    .pmh-ignore-ticket-button:disabled,.pmh-ignore-card-button:disabled{cursor:wait!important;opacity:.55}
    .pmh-ignore-toast{position:fixed;right:24px;bottom:24px;z-index:1000002;max-width:min(440px,calc(100vw - 32px));padding:14px 17px;border-radius:12px;color:#fff;background:#2f211c;box-shadow:0 18px 48px rgba(35,20,14,.28);font-size:14px;font-weight:800;opacity:0;transform:translateY(12px);transition:opacity .2s ease,transform .2s ease}
    .pmh-ignore-toast.success{background:#21643e}.pmh-ignore-toast.error{background:#9d2f20}.pmh-ignore-toast.visible{opacity:1;transform:translateY(0)}
    @media(max-width:640px){.pmh-ignore-ticket-button{margin-left:0!important;width:100%}}
  `;
  document.head.appendChild(style);

  const observer = new MutationObserver(decorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  decorate();
})();
