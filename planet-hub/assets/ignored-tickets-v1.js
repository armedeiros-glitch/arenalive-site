(() => {
  'use strict';

  const API = '/api/hub/chamados-ignorados';
  const ignoredState = {
    open: false,
    loading: false,
    error: '',
    items: [],
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const fmtDateTime = (value) => {
    if (!value) return 'Data não informada';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Data não informada';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  };

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

  const ignoredPanel = () => document.querySelector('[data-ignored-tickets-panel]');

  const renderIgnoredPanel = () => {
    const panel = ignoredPanel();
    if (!panel) return;
    const body = panel.querySelector('[data-ignored-tickets-body]');
    if (!body) return;

    if (ignoredState.loading) {
      body.innerHTML = '<div class="pmh-ignored-state">Carregando chamados ignorados…</div>';
      return;
    }
    if (ignoredState.error) {
      body.innerHTML = `<div class="pmh-ignored-state error"><strong>Não foi possível carregar os chamados ignorados.</strong><span>${esc(ignoredState.error)}</span><button type="button" data-ignored-retry>Tentar novamente</button></div>`;
      return;
    }
    if (!ignoredState.items.length) {
      body.innerHTML = '<div class="pmh-ignored-state">Nenhum chamado ignorado.</div>';
      return;
    }

    body.innerHTML = ignoredState.items.map((item) => `<article class="pmh-ignored-item" data-ignored-ticket-item="${esc(item.id)}">
      <div class="pmh-ignored-item-main">
        <small>#${esc(item.id)}</small>
        <strong>${esc(item.title || 'Chamado sem título')}</strong>
        <span>${esc(item.unit || 'Unidade não informada')}</span>
      </div>
      <div class="pmh-ignored-item-meta"><small>IGNORADO EM</small><span>${esc(fmtDateTime(item.ignoredAt))}</span></div>
      <button type="button" data-restore-ticket="${esc(item.id)}">Restaurar no Hub</button>
    </article>`).join('');
  };

  const loadIgnoredTickets = async () => {
    ignoredState.loading = true;
    ignoredState.error = '';
    renderIgnoredPanel();
    try {
      const response = await fetch(API, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
      ignoredState.items = Array.isArray(payload.data) ? payload.data : [];
    } catch (error) {
      ignoredState.items = [];
      ignoredState.error = error instanceof Error ? error.message : String(error);
    } finally {
      ignoredState.loading = false;
      renderIgnoredPanel();
    }
  };

  const openIgnoredTickets = () => {
    document.querySelector('[data-ignored-tickets-panel]')?.remove();
    const panel = document.createElement('div');
    panel.className = 'pmh-ignored-panel';
    panel.dataset.ignoredTicketsPanel = '1';
    panel.innerHTML = `<section class="pmh-ignored-panel-card">
      <header><div><small>CHAMADOS</small><h2>Chamados ignorados</h2><p>Itens ocultados apenas no André OS. O status oficial continua no SULTS.</p></div><button type="button" data-ignored-close aria-label="Fechar">×</button></header>
      <div class="pmh-ignored-panel-body" data-ignored-tickets-body><div class="pmh-ignored-state">Carregando chamados ignorados…</div></div>
    </section>`;
    document.body.appendChild(panel);
    ignoredState.open = true;
    loadIgnoredTickets();
  };

  const closeIgnoredTickets = () => {
    document.querySelector('[data-ignored-tickets-panel]')?.remove();
    ignoredState.open = false;
  };

  const decorateIgnoredAccess = () => {
    const filters = document.querySelector('.pmh-command-filters');
    if (!filters || filters.querySelector('[data-open-ignored-tickets]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pmh-command-ignored-button';
    button.dataset.openIgnoredTickets = '1';
    button.textContent = 'Chamados ignorados';
    filters.appendChild(button);
  };

  const decorate = () => {
    decorateCards();
    decorateDrawer();
    decorateIgnoredAccess();
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
      if (ignoredState.open) loadIgnoredTickets();
      toast(`Chamado #${id} excluído do Hub.`, 'success');
    } catch (error) {
      button.disabled = false;
      button.textContent = originalText;
      toast(error instanceof Error ? error.message : 'Não foi possível excluir o chamado.', 'error');
    }
  };

  const restoreTicket = async (button) => {
    const id = String(button.dataset.restoreTicket || '').replace(/[^0-9A-Za-z_-]/g, '');
    if (!id) return;
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Restaurando…';
    try {
      const response = await fetch(API, {
        method: 'DELETE',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);

      ignoredState.items = ignoredState.items.filter((item) => String(item.id) !== id);
      renderIgnoredPanel();
      toast(`Chamado #${id} restaurado no Hub.`, 'success');
      document.querySelector('[data-refresh]')?.click();
    } catch (error) {
      button.disabled = false;
      button.textContent = originalText;
      toast(error instanceof Error ? error.message : 'Não foi possível restaurar o chamado.', 'error');
    }
  };

  document.addEventListener('click', (event) => {
    const ignoreButton = event.target.closest('[data-ignore-ticket]');
    if (ignoreButton) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      ignoreTicket(ignoreButton);
      return;
    }

    if (event.target.closest('[data-open-ignored-tickets]')) {
      event.preventDefault();
      openIgnoredTickets();
      return;
    }

    if (event.target.closest('[data-ignored-close]') || event.target.matches?.('[data-ignored-tickets-panel]')) {
      closeIgnoredTickets();
      return;
    }

    if (event.target.closest('[data-ignored-retry]')) {
      loadIgnoredTickets();
      return;
    }

    const restoreButton = event.target.closest('[data-restore-ticket]');
    if (restoreButton) {
      event.preventDefault();
      restoreTicket(restoreButton);
    }
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && ignoredState.open) closeIgnoredTickets();
  });

  const style = document.createElement('style');
  style.textContent = `
    .pmh-ticket{position:relative}
    .pmh-ignore-card-button{position:absolute;top:10px;right:10px;z-index:3;display:grid;place-items:center;width:30px;height:30px;padding:0;border:1px solid #e2c7bd;border-radius:8px;color:#98503f;background:#fff8f5;font-size:20px;font-weight:700;line-height:1;cursor:pointer;opacity:.72;transition:opacity .16s ease,border-color .16s ease,color .16s ease,background .16s ease}
    .pmh-ticket:hover .pmh-ignore-card-button,.pmh-ignore-card-button:focus-visible{opacity:1}
    .pmh-ignore-card-button:hover{border-color:#b83925;color:#fff;background:#b83925}
    .pmh-ignore-ticket-button{margin-left:auto!important;border-color:#d8a69a!important;color:#a73522!important;background:#fff7f4!important}
    .pmh-ignore-ticket-button:hover{border-color:#b83925!important;color:#fff!important;background:#b83925!important}
    .pmh-ignore-ticket-button:disabled,.pmh-ignore-card-button:disabled{cursor:wait!important;opacity:.55}
    .pmh-command-ignored-button{margin-left:auto;border:1px solid #d9cec8;border-radius:9px;padding:9px 12px;background:#fff;color:#6f5b52;font:inherit;font-size:12px;font-weight:800;cursor:pointer}
    .pmh-command-ignored-button:hover{border-color:#bdaaa1;color:#3c2d27;background:#fffaf7}
    .pmh-ignored-panel{position:fixed;inset:0;z-index:1000001;display:flex;justify-content:flex-end;background:rgba(31,21,17,.34)}
    .pmh-ignored-panel-card{width:min(620px,100%);height:100%;overflow:auto;background:#fff;box-shadow:-18px 0 52px rgba(35,20,14,.2)}
    .pmh-ignored-panel-card>header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:24px;border-bottom:1px solid #eee4df}
    .pmh-ignored-panel-card>header small{font-size:11px;font-weight:900;letter-spacing:.08em;color:#9a7d70}.pmh-ignored-panel-card>header h2{margin:4px 0 5px;font-size:24px}.pmh-ignored-panel-card>header p{margin:0;color:#806d64;font-size:13px}
    .pmh-ignored-panel-card>header button{border:0;background:transparent;font-size:26px;line-height:1;cursor:pointer;color:#78645b}
    .pmh-ignored-panel-body{display:grid;gap:10px;padding:18px 24px 28px}.pmh-ignored-state{padding:30px 18px;border:1px dashed #ddcfc8;border-radius:12px;text-align:center;color:#806d64}.pmh-ignored-state.error{display:grid;gap:8px}.pmh-ignored-state.error strong{color:#9d2f20}.pmh-ignored-state button{justify-self:center;border:1px solid #d7c7bf;border-radius:8px;padding:8px 11px;background:#fff;cursor:pointer}
    .pmh-ignored-item{display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:16px;padding:15px;border:1px solid #e9dfda;border-radius:12px;background:#fff}.pmh-ignored-item-main{display:grid;gap:3px;min-width:0}.pmh-ignored-item-main small,.pmh-ignored-item-meta small{font-size:10px;font-weight:900;letter-spacing:.06em;color:#9a7d70}.pmh-ignored-item-main strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#352721}.pmh-ignored-item-main span,.pmh-ignored-item-meta span{color:#806d64;font-size:12px}.pmh-ignored-item-meta{display:grid;gap:3px;text-align:right}.pmh-ignored-item>button{border:1px solid #a9c9b3;border-radius:8px;padding:9px 11px;background:#f5fbf7;color:#21643e;font-weight:800;cursor:pointer;white-space:nowrap}.pmh-ignored-item>button:disabled{opacity:.55;cursor:wait}
    .pmh-ignore-toast{position:fixed;right:24px;bottom:24px;z-index:1000002;max-width:min(440px,calc(100vw - 32px));padding:14px 17px;border-radius:12px;color:#fff;background:#2f211c;box-shadow:0 18px 48px rgba(35,20,14,.28);font-size:14px;font-weight:800;opacity:0;transform:translateY(12px);transition:opacity .2s ease,transform .2s ease}
    .pmh-ignore-toast.success{background:#21643e}.pmh-ignore-toast.error{background:#9d2f20}.pmh-ignore-toast.visible{opacity:1;transform:translateY(0)}
    @media(max-width:640px){.pmh-ignore-ticket-button{margin-left:0!important;width:100%}.pmh-ignored-item{grid-template-columns:1fr}.pmh-ignored-item-meta{text-align:left}.pmh-ignored-item>button{width:100%}.pmh-command-ignored-button{margin-left:0}}
  `;
  document.head.appendChild(style);

  const observer = new MutationObserver(decorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  decorate();
})();
