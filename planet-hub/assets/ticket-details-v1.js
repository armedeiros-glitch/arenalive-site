(() => {
  'use strict';

  const DETAIL_API = '/api/sults/chamados';
  const SULTS_BASE = 'https://planetchocolate.sults.com.br/chamados/interacoes';
  const SITUATIONS = {
    1: 'Novo chamado',
    2: 'Concluído',
    3: 'Resolvido',
    4: 'Em andamento',
    5: 'Aguardando solicitante',
    6: 'Aguardando responsável',
  };

  let drawer = null;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const textFromHtml = (html) => {
    const parsed = new DOMParser().parseFromString(String(html || ''), 'text/html');
    return parsed.body.textContent?.replace(/\s+/g, ' ').trim() || '';
  };

  const asDate = (value) => {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const fmtDate = (value) => {
    const date = asDate(value);
    return date ? new Intl.DateTimeFormat('pt-BR').format(date) : 'Sem data';
  };

  const fmtDateTime = (value) => {
    const date = asDate(value);
    return date ? new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short', timeStyle: 'short',
    }).format(date) : 'Sem data';
  };

  const ticketIdFromCard = (card) => String(card.querySelector('small')?.textContent || '').replace(/\D/g, '');

  const decorateCards = () => {
    document.querySelectorAll('.pmh-ticket').forEach((card) => {
      const id = ticketIdFromCard(card);
      if (!id || card.dataset.ticketDetailsReady === '1') return;
      card.dataset.ticketDetailsReady = '1';
      card.dataset.ticketId = id;
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', `Abrir detalhes do chamado ${id}`);

      const hint = document.createElement('div');
      hint.className = 'pmh-ticket-open-hint';
      hint.innerHTML = '<span>Ver detalhes</span><b>→</b>';
      card.appendChild(hint);
    });
  };

  const closeDrawer = () => {
    drawer?.remove();
    drawer = null;
    document.documentElement.classList.remove('pmh-ticket-drawer-open');
  };

  const timelineText = (item) => {
    if (item.interaction) return textFromHtml(item.interaction.messageHtml) || 'Interação sem texto.';
    if (item.deadline) return `Prazo alterado de ${fmtDate(item.deadline.previous)} para ${fmtDate(item.deadline.next)}.`;
    if (item.previousResponsible || item.nextResponsible) return `Responsável alterado de ${item.previousResponsible?.name || 'não definido'} para ${item.nextResponsible?.name || 'não definido'}.`;
    if (item.previousSubject || item.nextSubject) return `Assunto alterado de ${item.previousSubject?.name || 'não definido'} para ${item.nextSubject?.name || 'não definido'}.`;
    if (item.type === 7 || item.type === 11) return `${item.support?.person?.name || 'Pessoa'} adicionada como apoio.`;
    if (item.type === 8) return `${item.support?.person?.name || 'Pessoa'} removida do apoio.`;
    if (item.type === 9) return `Chamado concluído${item.rating ? ` com avaliação ${item.rating}/5` : ''}${item.ratingNote ? `: ${item.ratingNote}` : '.'}`;
    return 'Movimentação registrada no chamado.';
  };

  const renderTimeline = (timeline) => {
    if (!timeline.length) return '<div class="pmh-ticket-empty">Nenhuma interação disponível.</div>';
    return [...timeline].reverse().map((item) => {
      const attachments = item.interaction?.attachments || [];
      return `<article class="pmh-ticket-event ${item.interaction?.internal ? 'internal' : ''}">
        <header><strong>${esc(item.person?.name || 'SULTS')}</strong><time>${esc(fmtDateTime(item.createdAt))}</time></header>
        <p>${esc(timelineText(item))}</p>
        ${item.interaction?.internal ? '<small>Interação interna</small>' : ''}
        ${attachments.length ? `<div class="pmh-ticket-attachments">${attachments.map((attachment) => attachment.url
          ? `<a href="${esc(attachment.url)}" target="_blank" rel="noopener noreferrer">${esc(attachment.name)}</a>`
          : `<span>${esc(attachment.name)}</span>`).join('')}</div>` : ''}
      </article>`;
    }).join('');
  };

  const renderDetail = (payload) => {
    const ticket = payload.ticket || {};
    const due = ticket.stipulatedResolutionAt || ticket.plannedResolutionAt;
    const labels = ticket.labels || [];
    const support = ticket.support || [];
    const sultsUrl = ticket.sultsUrl || `${SULTS_BASE}/${ticket.id}`;

    return `<section class="pmh-ticket-drawer-panel">
      <header class="pmh-ticket-drawer-header">
        <div><small>CHAMADO #${esc(ticket.id)}</small><h2>${esc(ticket.title)}</h2></div>
        <button type="button" data-ticket-close aria-label="Fechar">×</button>
      </header>
      <div class="pmh-ticket-drawer-actions">
        <span class="pmh-ticket-status status-${esc(ticket.situation)}">${esc(SITUATIONS[ticket.situation] || 'Situação não informada')}</span>
        <a href="${esc(sultsUrl)}" target="_blank" rel="noopener noreferrer">Abrir no SULTS ↗</a>
        <button type="button" data-ticket-copy="${esc(ticket.id)}">Copiar número</button>
      </div>
      ${payload.warning ? `<div class="pmh-ticket-warning">${esc(payload.warning)}</div>` : ''}
      <section class="pmh-ticket-summary">
        <article><small>UNIDADE</small><strong>${esc(ticket.unit?.name || 'Não informada')}</strong></article>
        <article><small>RESPONSÁVEL</small><strong>${esc(ticket.responsible?.name || 'Não definido')}</strong></article>
        <article><small>SOLICITANTE</small><strong>${esc(ticket.requester?.name || 'Não informado')}</strong></article>
        <article><small>PRAZO</small><strong>${esc(fmtDate(due))}</strong></article>
        <article><small>DEPARTAMENTO</small><strong>${esc(ticket.department?.name || ticket.sendingDepartment?.name || 'Não informado')}</strong></article>
        <article><small>ASSUNTO</small><strong>${esc(ticket.subject?.name || 'Não informado')}</strong></article>
        <article><small>ABERTO EM</small><strong>${esc(fmtDateTime(ticket.openedAt))}</strong></article>
        <article><small>ÚLTIMA ALTERAÇÃO</small><strong>${esc(fmtDateTime(ticket.lastChangeAt))}</strong></article>
      </section>
      <section class="pmh-ticket-meta-row">
        <span>${Number(ticket.publicInteractionCount || 0)} públicas</span>
        <span>${Number(ticket.internalInteractionCount || 0)} internas</span>
        ${support.length ? `<span>${support.length} em apoio</span>` : ''}
      </section>
      ${labels.length ? `<section class="pmh-ticket-labels">${labels.map((label) => `<span style="--ticket-label:${esc(label.color || '#8f776c')}">${esc(label.name)}</span>`).join('')}</section>` : ''}
      <section class="pmh-ticket-timeline"><header><div><small>HISTÓRICO</small><h3>Timeline do chamado</h3></div><span>${payload.timeline?.length || 0} movimentações</span></header>${renderTimeline(payload.timeline || [])}</section>
    </section>`;
  };

  const openDrawer = async (id) => {
    closeDrawer();
    drawer = document.createElement('div');
    drawer.className = 'pmh-ticket-drawer';
    drawer.innerHTML = `<section class="pmh-ticket-drawer-panel loading"><button type="button" data-ticket-close aria-label="Fechar">×</button><div class="pmh-ticket-loading">Carregando chamado #${esc(id)}…</div></section>`;
    document.body.appendChild(drawer);
    document.documentElement.classList.add('pmh-ticket-drawer-open');

    try {
      const response = await fetch(`${DETAIL_API}/${encodeURIComponent(id)}`, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
      if (drawer) drawer.innerHTML = renderDetail(payload);
    } catch (error) {
      if (drawer) drawer.innerHTML = `<section class="pmh-ticket-drawer-panel"><header class="pmh-ticket-drawer-header"><div><small>CHAMADO #${esc(id)}</small><h2>Não foi possível carregar</h2></div><button type="button" data-ticket-close>×</button></header><div class="pmh-ticket-error"><p>${esc(error instanceof Error ? error.message : String(error))}</p><a href="${SULTS_BASE}/${esc(id)}" target="_blank" rel="noopener noreferrer">Abrir no SULTS ↗</a></div></section>`;
    }
  };

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-ticket-close]') || (drawer && event.target === drawer)) {
      closeDrawer();
      return;
    }

    const copy = event.target.closest('[data-ticket-copy]');
    if (copy) {
      navigator.clipboard?.writeText(copy.dataset.ticketCopy || '');
      const original = copy.textContent;
      copy.textContent = 'Copiado';
      setTimeout(() => { copy.textContent = original; }, 1200);
      return;
    }

    const card = event.target.closest('.pmh-ticket[data-ticket-id]');
    if (card) openDrawer(card.dataset.ticketId);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && drawer) closeDrawer();
    const card = event.target.closest?.('.pmh-ticket[data-ticket-id]');
    if (card && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      openDrawer(card.dataset.ticketId);
    }
  });

  const observer = new MutationObserver(decorateCards);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  decorateCards();
})();
