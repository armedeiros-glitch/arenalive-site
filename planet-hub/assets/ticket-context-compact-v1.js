(() => {
  'use strict';

  let drawerAttempts = 0;
  let drawerTimer = 0;
  let lastSnapshot = null;

  const normalize = (value) => String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));
  const ticketItemId = (id) => `ticket-${String(id || '').replace(/\D/g, '')}`;
  const isTicketsView = () => normalize(document.querySelector('[data-title]')?.textContent).includes('chamados');

  const syncScope = () => {
    document.documentElement.classList.toggle('pmh-ticket-compact-active', isTicketsView());
  };

  const contextLabel = (state) => ({
    blocked: 'Bloqueado',
    waiting_info: 'Aguardando informação',
    waiting_approval: 'Aguardando aprovação',
    scheduled: 'Retomar depois',
    actionable: 'Posso agir agora',
  }[state] || 'Contexto operacional');

  const contextItem = (id) => {
    const snapshot = lastSnapshot || window.PMHRadarData?.getSnapshot?.();
    return snapshot?.items?.find((item) => item.id === ticketItemId(id)) || null;
  };

  const hasContext = (item) => Boolean(item && (
    item.contextUpdatedAt || item.blockerReason || item.dependsOn || item.nextAction || item.followUpDate || item.operationalState !== 'actionable'
  ));

  const contextCard = (item) => {
    if (!hasContext(item)) return '';
    const follow = item.followUpDate
      ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${item.followUpDate}T12:00:00`))
      : '';
    return `<section class="pmh-ticket-saved-context" data-ticket-saved-context>
      <header><small>CONTEXTO ANDRÉ OS</small><strong>${esc(contextLabel(item.operationalState))}</strong></header>
      <p>${esc(item.blockerReason || 'Contexto operacional registrado.')}</p>
      <footer>
        ${item.dependsOn ? `<span>Depende de: <b>${esc(item.dependsOn)}</b></span>` : ''}
        ${follow ? `<span>Revisar em: <b>${esc(follow)}</b></span>` : ''}
        ${item.nextAction ? `<span>Depois: <b>${esc(item.nextAction)}</b></span>` : ''}
      </footer>
    </section>`;
  };

  const decorateDrawer = () => {
    syncScope();
    const panel = document.querySelector('.pmh-ticket-drawer-panel:not(.loading)');
    if (!panel) return false;
    const id = panel.querySelector('.pmh-ticket-drawer-header small')?.textContent?.replace(/\D/g, '');
    if (!id) return false;

    const actions = panel.querySelector('.pmh-ticket-drawer-actions');
    if (actions && !actions.querySelector('[data-ticket-context]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'pmh-ticket-context-drawer-button';
      button.dataset.ticketContext = id;
      button.textContent = hasContext(contextItem(id)) ? 'Editar contexto' : '+ Adicionar contexto';
      actions.appendChild(button);
    }

    panel.querySelector('[data-ticket-saved-context]')?.remove();
    const item = contextItem(id);
    if (hasContext(item) && actions) actions.insertAdjacentHTML('afterend', contextCard(item));
    return true;
  };

  const waitForDrawer = () => {
    window.clearTimeout(drawerTimer);
    drawerAttempts = 0;
    const check = () => {
      if (decorateDrawer()) return;
      drawerAttempts += 1;
      if (drawerAttempts < 50 && document.querySelector('.pmh-ticket-drawer')) {
        drawerTimer = window.setTimeout(check, 100);
      }
    };
    drawerTimer = window.setTimeout(check, 0);
  };

  const ensureRadar = async () => {
    const radar = window.PMHRadarData;
    if (!radar?.collect) return null;
    lastSnapshot = await radar.collect({ force: true }).catch(() => radar.getSnapshot?.() || null);
    return lastSnapshot;
  };

  const openContext = async (id) => {
    if (!id) return;
    await ensureRadar();
    const context = window.PMHRadarContext;
    if (!context?.open) {
      window.alert('O contexto operacional ainda não ficou disponível. Atualize a página e tente novamente.');
      return;
    }
    context.open(ticketItemId(id));
  };

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest?.('[data-ticket-context]');
    if (trigger) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      openContext(trigger.dataset.ticketContext);
      return;
    }

    if (event.target.closest?.('.pmh-command-ticket')) waitForDrawer();
  }, true);

  window.addEventListener('pmh:radar-data', (event) => {
    lastSnapshot = event.detail || null;
    decorateDrawer();
  });
  window.addEventListener('pmh:view-rendered', () => {
    syncScope();
    if (isTicketsView()) ensureRadar().then(() => decorateDrawer());
  });
  window.addEventListener('hashchange', () => window.requestAnimationFrame(syncScope));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      syncScope();
      if (isTicketsView()) ensureRadar();
    }, { once: true });
  } else {
    syncScope();
    if (isTicketsView()) ensureRadar();
  }
})();
