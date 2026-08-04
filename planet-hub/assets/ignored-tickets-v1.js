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

  const ticketDataFromDrawer = (panel) => {
    const headerText = panel.querySelector('.pmh-ticket-drawer-header small')?.textContent || '';
    const id = headerText.replace(/\D/g, '');
    const title = panel.querySelector('.pmh-ticket-drawer-header h2')?.textContent?.trim() || 'Chamado sem título';
    const unit = panel.querySelector('.pmh-ticket-summary article:first-child strong')?.textContent?.trim() || '';
    return { id, title, unit };
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
      button.dataset.ignoreTicket = ticket.id;
      button.dataset.ticketTitle = ticket.title;
      button.dataset.ticketUnit = ticket.unit;
      button.textContent = 'Excluir do Hub';
      button.title = 'Oculta este chamado no Hub sem apagar nada no SULTS';
      actions.appendChild(button);
    });
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
    button.textContent = 'Excluindo…';

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

      document.querySelector(`.pmh-ticket[data-ticket-id="${CSS.escape(id)}"]`)?.remove();
      document.querySelector('[data-ticket-close]')?.click();
      toast(`Chamado #${id} excluído do Hub.`, 'success');
      window.setTimeout(() => window.location.reload(), 650);
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
    ignoreTicket(button);
  }, true);

  const style = document.createElement('style');
  style.textContent = `
    .pmh-ignore-ticket-button{margin-left:auto!important;border-color:#d8a69a!important;color:#a73522!important;background:#fff7f4!important}
    .pmh-ignore-ticket-button:hover{border-color:#b83925!important;color:#fff!important;background:#b83925!important}
    .pmh-ignore-ticket-button:disabled{cursor:wait!important;opacity:.65}
    .pmh-ignore-toast{position:fixed;right:24px;bottom:24px;z-index:1000002;max-width:min(440px,calc(100vw - 32px));padding:14px 17px;border-radius:12px;color:#fff;background:#2f211c;box-shadow:0 18px 48px rgba(35,20,14,.28);font-size:14px;font-weight:800;opacity:0;transform:translateY(12px);transition:opacity .2s ease,transform .2s ease}
    .pmh-ignore-toast.success{background:#21643e}.pmh-ignore-toast.error{background:#9d2f20}.pmh-ignore-toast.visible{opacity:1;transform:translateY(0)}
    @media(max-width:640px){.pmh-ignore-ticket-button{margin-left:0!important;width:100%}}
  `;
  document.head.appendChild(style);

  const observer = new MutationObserver(decorateDrawer);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  decorateDrawer();
})();
