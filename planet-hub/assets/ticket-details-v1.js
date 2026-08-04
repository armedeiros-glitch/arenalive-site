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

  let activeFilter = 'all';
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

  const todayBr = () => new Intl.DateTimeFormat('pt-BR').format(new Date());
  const ticketIdFromCard = (card) => String(card.querySelector('small')?.textContent || '').replace(/\D/g, '');
  const laneName = (card) => card.closest('.pmh-lane')?.querySelector('header h3')?.textContent?.trim() || '';

  const cardMatches = (card, filter) => {
    if (filter === 'all') return true;
    if (filter === 'late') return card.classList.contains('late');
    if (filter === 'today') {
      const deadline = [...card.querySelectorAll('dd')].at(-1)?.textContent?.trim();
      return deadline === todayBr();
    }
    if (filter === 'waiting') return laneName(card).toLowerCase().includes('aguardando');
    if (filter === 'progress') return laneName(card).toLowerCase().includes('andamento');
    return true;
  };

  const applyFilter = () => {
    document.querySelectorAll('.pmh-ticket').forEach((card) => {
      card.hidden = !cardMatches(card, activeFilter);
    });
    document.querySelectorAll('.pmh-lane').forEach((lane) => {
      const cards = [...lane.querySelectorAll('.pmh-ticket')];
      lane.hidden = Boolean(cards.length) && cards.every((card) => card.hidden);
    });
    document.querySelectorAll('[data-ticket-filter]').forEach((button) => {
      button.classList.toggle('active', button.dataset.ticketFilter === activeFilter);
    });
  };

  const injectFilters = () => {
    const kanban = document.querySelector('.pmh-kanban');
    const head = kanban?.previousElementSibling;
    if (!kanban || !head?.classList.contains('pmh-section-head') || document.querySelector('[data-ticket-filters]')) return;

    const bar = document.createElement('div');
    bar.className = 'pmh-ticket-filters';
    bar.dataset.ticketFilters = '1';
    bar.innerHTML = `
      <span>Mostrar:</span>
      <button type="button" data-ticket-filter="all">Todos</button>
      <button type="button" data-ticket-filter="late">Atrasados</button>
      <button type="button" data-ticket-filter="today">Vencem hoje</button>
      <button type="button" data-ticket-filter="waiting">Aguardando</button>
      <button type="button" data-ticket-filter="progress">Em andamento</button>`;
    head.insertAdjacentElement('afterend', bar);
    applyFilter();
  };

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

  const decorate = () => {
    injectFilters();
    decorateCards();
    applyFilter();
  };

  const style = document.createElement('style');
  style.textContent = `
    .pmh-ticket{cursor:pointer;transition:transform .16s ease,box-shadow .16s ease,border-color .16s ease}
    .pmh-ticket:hover,.pmh-ticket:focus-visible{transform:translateY(-2px);border-color:#ef651d!important;box-shadow:0 12px 26px rgba(61,35,25,.12);outline:0}
    .pmh-ticket-open-hint{display:flex;align-items:center;justify-content:space-between;margin-top:12px;padding-top:10px;border-top:1px solid #eadbd4;color:#d85616;font-size:14px;font-weight:800}
    .pmh-ticket-filters{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:-2px 0 18px;padding:12px 14px;border:1px solid #ead9d1;border-radius:14px;background:#fff}
    .pmh-ticket-filters span{margin-right:4px;color:#6f5a50;font-size:14px;font-weight:750}
    .pmh-ticket-filters button{min-height:38px;padding:0 13px;border:1px solid #e3d2ca;border-radius:9px;background:#fff;color:#4a352d;font-size:14px;font-weight:780;cursor:pointer}
    .pmh-ticket-filters button.active{border-color:#ef651d;color:#fff;background:#ef651d}
    .pmh-ticket-drawer-open{overflow:hidden}
    .pmh-ticket-drawer{position:fixed;inset:0;z-index:999999;display:flex;justify-content:flex-end;background:rgba(36,23,18,.56);backdrop-filter:blur(3px)}
    .pmh-ticket-drawer-panel{width:min(760px,94vw);height:100%;overflow:auto;padding:28px;background:#f8f3f0;box-shadow:-24px 0 70px rgba(35,20,14,.25)}
    .pmh-ticket-drawer-panel.loading{display:grid;place-items:center;position:relative}.pmh-ticket-drawer-panel.loading>button{position:absolute;top:18px;right:18px}
    .pmh-ticket-loading{font-size:18px;font-weight:800}.pmh-ticket-drawer-header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;padding-bottom:20px;border-bottom:1px solid #ddcbc2}
    .pmh-ticket-drawer-header small{color:#ef651d;font-size:13px;font-weight:900;letter-spacing:.08em}.pmh-ticket-drawer-header h2{margin:7px 0 0;font-size:29px;line-height:1.12}
    [data-ticket-close]{display:grid;place-items:center;flex:0 0 44px;width:44px;height:44px;border:1px solid #dbc8be;border-radius:12px;background:#fff;color:#3d2a22;font-size:27px;cursor:pointer}
    .pmh-ticket-drawer-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:18px 0}.pmh-ticket-drawer-actions a,.pmh-ticket-drawer-actions button{min-height:40px;padding:0 13px;border:1px solid #dfcfc7;border-radius:9px;background:#fff;color:#3d2a22;font-size:14px;font-weight:800;text-decoration:none;cursor:pointer}.pmh-ticket-drawer-actions a{display:flex;align-items:center;color:#fff;border-color:#ef651d;background:#ef651d}
    .pmh-ticket-status{display:inline-flex;align-items:center;min-height:40px;padding:0 13px;border-radius:999px;background:#eadfd9;color:#513b31;font-size:14px;font-weight:850}.pmh-ticket-status.status-4{background:#dff3e8;color:#16683d}.pmh-ticket-status.status-5,.pmh-ticket-status.status-6{background:#fff0c9;color:#805600}.pmh-ticket-status.status-2,.pmh-ticket-status.status-3{background:#e4eaf7;color:#344c87}
    .pmh-ticket-warning,.pmh-ticket-error{margin:14px 0;padding:15px;border:1px solid #efd49b;border-radius:12px;background:#fff8df;color:#6c4b00;font-size:14px}.pmh-ticket-error a{display:inline-block;margin-top:10px;color:#d85616;font-weight:800}
    .pmh-ticket-summary{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pmh-ticket-summary article{min-height:82px;padding:14px;border:1px solid #e3d3cb;border-radius:12px;background:#fff}.pmh-ticket-summary small,.pmh-ticket-summary strong{display:block}.pmh-ticket-summary small{margin-bottom:7px;color:#8a7166;font-size:12px;font-weight:850;letter-spacing:.06em}.pmh-ticket-summary strong{font-size:15px;line-height:1.35}
    .pmh-ticket-meta-row{display:flex;gap:8px;flex-wrap:wrap;margin:13px 0}.pmh-ticket-meta-row span{padding:7px 10px;border-radius:999px;background:#eadfd9;color:#5c453b;font-size:13px;font-weight:750}
    .pmh-ticket-labels{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0 18px}.pmh-ticket-labels span{padding:7px 10px;border-left:4px solid var(--ticket-label);border-radius:7px;background:#fff;font-size:13px;font-weight:750}
    .pmh-ticket-timeline{margin-top:22px}.pmh-ticket-timeline>header{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:12px}.pmh-ticket-timeline>header small{color:#ef651d;font-size:12px;font-weight:900;letter-spacing:.08em}.pmh-ticket-timeline>header h3{margin:4px 0 0;font-size:22px}.pmh-ticket-timeline>header>span{color:#806b61;font-size:13px}
    .pmh-ticket-event{position:relative;margin-bottom:10px;padding:15px 16px;border:1px solid #e1d1c9;border-radius:12px;background:#fff}.pmh-ticket-event.internal{border-color:#d8ccef;background:#f8f3ff}.pmh-ticket-event header{display:flex;justify-content:space-between;gap:12px}.pmh-ticket-event header strong{font-size:14px}.pmh-ticket-event time{color:#87736a;font-size:12px}.pmh-ticket-event p{margin:9px 0 0;font-size:14px;line-height:1.55;white-space:pre-wrap}.pmh-ticket-event>small{display:inline-block;margin-top:9px;color:#705696;font-size:12px;font-weight:800}.pmh-ticket-attachments{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}.pmh-ticket-attachments a,.pmh-ticket-attachments span{padding:7px 9px;border-radius:7px;background:#f2e9e5;color:#553b31;font-size:12px;font-weight:750;text-decoration:none}
    .pmh-ticket-empty{padding:22px;border:1px dashed #d7c4ba;border-radius:12px;background:#fff;text-align:center;color:#7d675d;font-size:14px}
    @media(max-width:650px){.pmh-ticket-drawer-panel{width:100%;padding:20px}.pmh-ticket-summary{grid-template-columns:1fr}.pmh-ticket-drawer-header h2{font-size:24px}.pmh-ticket-filters{align-items:stretch}.pmh-ticket-filters span{width:100%}}
  `;
  document.head.appendChild(style);

  document.addEventListener('click', (event) => {
    const filter = event.target.closest('[data-ticket-filter]');
    if (filter) {
      activeFilter = filter.dataset.ticketFilter || 'all';
      applyFilter();
      return;
    }

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

  const observer = new MutationObserver(decorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  decorate();
})();
