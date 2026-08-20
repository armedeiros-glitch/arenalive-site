(() => {
  'use strict';

  const API = '/api/hub/chamados-ignorados';

  const toast = (message, tone = 'success') => {
    document.querySelector('.pmh-ignore-toast')?.remove();
    const element = document.createElement('div');
    element.className = `pmh-ignore-toast ${tone} visible`;
    element.textContent = message;
    document.body.appendChild(element);
    window.setTimeout(() => {
      element.classList.remove('visible');
      window.setTimeout(() => element.remove(), 220);
    }, 2400);
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

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-ignore-ticket]');
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const id = String(button.dataset.ignoreTicket || '').replace(/\D/g, '');
    if (!id) return;

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
        body: JSON.stringify({
          id,
          title: button.dataset.ticketTitle || 'Chamado sem título',
          unit: button.dataset.ticketUnit || '',
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);

      removeFromInterface(id);
      toast(`Chamado #${id} excluído do Hub.`);
    } catch (error) {
      button.disabled = false;
      button.textContent = originalText;
      toast(error instanceof Error ? error.message : 'Não foi possível excluir o chamado.', 'error');
    }
  }, true);
})();
