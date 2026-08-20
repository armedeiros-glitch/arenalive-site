(() => {
  'use strict';

  const MAIN_API = '/api/sults/chamados?start=0&limit=100';
  const ALL_API = '/api/sults/chamados?scope=all&includeIgnored=1';
  const CONTEXT_API = '/api/hub/radar-contextos';
  const MY_NAME = 'André Roberto Medeiros';
  const ACTIVE_SITUATIONS = new Set([1, 4, 5, 6]);
  const STATUS = {
    1: 'Novo chamado',
    2: 'Concluído',
    3: 'Resolvido',
    4: 'Em andamento',
    5: 'Aguardando solicitante',
    6: 'Aguardando responsável',
  };

  const state = {
    tickets: null,
    allTickets: null,
    loading: null,
    allLoading: null,
    contexts: new Map(),
    contextsLoading: null,
    discovery: false,
    unit: '',
    responsible: '',
    subject: '',
    status: '',
    urgency: 'all',
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const isActiveTicket = (ticket) => ACTIVE_SITUATIONS.has(Number(ticket?.situation));

  const dateValue = (value) => {
    if (!value) return null;
    const raw = String(value).slice(0, 10);
    const date = new Date(`${raw}T12:00:00`);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const dueDate = (ticket) => ticket.stipulatedResolutionAt || ticket.plannedResolutionAt || null;

  const dayDifference = (value) => {
    const due = dateValue(value);
    if (!due) return null;
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return Math.round((due.getTime() - today.getTime()) / 86400000);
  };

  const fmtDate = (value) => {
    const date = dateValue(value);
    return date ? new Intl.DateTimeFormat('pt-BR').format(date) : 'Sem prazo';
  };

  const fmtDateTime = (value) => {
    if (!value) return 'Sem movimentação';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Sem movimentação';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  };

  const ticketId = (ticket) => String(ticket.sultsTicketId || ticket.id || '');
  const ticketItemId = (ticket) => `ticket-${ticketId(ticket)}`;
  const contextFor = (ticket) => state.contexts.get(ticketItemId(ticket)) || null;

  const supportNames = (ticket) => (Array.isArray(ticket.support) ? ticket.support : [])
    .map((item) => item?.pessoa?.nome || item?.person?.name || item?.nome || item?.name || '')
    .filter(Boolean);

  // Mantido apenas para leitura/decoração e compatibilidade.
  // A fila principal NÃO depende mais deste filtro no navegador.
  const isMine = (ticket) => {
    const target = normalize(MY_NAME);
    return normalize(ticket.responsible) === target
      || supportNames(ticket).some((name) => normalize(name) === target);
  };

  const contextDefers = (ticket) => {
    const context = contextFor(ticket);
    if (!context || context.state === 'actionable') return false;
    if (!context.followUpDate) return true;
    const diff = dayDifference(context.followUpDate);
    return diff != null && diff > 0;
  };

  const contextDueNow = (ticket) => {
    const context = contextFor(ticket);
    if (!context || context.state === 'actionable' || !context.followUpDate) return false;
    const diff = dayDifference(context.followUpDate);
    return diff != null && diff <= 0;
  };

  const contextLabel = (context) => ({
    blocked: 'Bloqueado',
    waiting_info: 'Aguardando informação',
    waiting_approval: 'Aguardando aprovação',
    scheduled: 'Retomar depois',
    actionable: 'Posso agir agora',
  }[context?.state] || 'Contexto registrado');

  const urgencyKey = (ticket) => {
    const diff = dayDifference(dueDate(ticket));
    if (diff == null) return 'no-date';
    if (diff < 0) return 'late';
    if (diff === 0) return 'today';
    if (diff <= 7) return 'week';
    return 'later';
  };

  const waitingTicket = (ticket) =>
    contextDefers(ticket) || Number(ticket.situation) === 5 || Number(ticket.situation) === 6;

  const groupKey = (ticket) => {
    if (contextDefers(ticket)) return 'waiting';
    const situation = Number(ticket.situation);
    const urgency = urgencyKey(ticket);
    if (urgency === 'late' || urgency === 'today' || situation === 1 || situation === 6 || !ticket.responsible) {
      return 'action';
    }
    if (situation === 5) return 'waiting';
    return 'progress';
  };

  const deadlineLabel = (ticket) => {
    const diff = dayDifference(dueDate(ticket));
    if (diff == null) return { text: 'Sem prazo', tone: 'no-date' };
    if (diff < 0) return { text: `Atrasado há ${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'dia' : 'dias'}`, tone: 'late' };
    if (diff === 0) return { text: 'Vence hoje', tone: 'today' };
    if (diff === 1) return { text: 'Vence amanhã', tone: 'week' };
    if (diff <= 7) return { text: `Vence em ${diff} dias`, tone: 'week' };
    return { text: fmtDate(dueDate(ticket)), tone: 'later' };
  };

  const searchQuery = () => normalize(document.querySelector('[data-search-wrap] input')?.value || '');

  const matchesBaseFilters = (ticket) => {
    const query = searchQuery();
    const context = contextFor(ticket);
    const haystack = normalize([
      ticket.title,
      ticket.unit,
      ticket.requester,
      ticket.responsible,
      ticket.subject,
      ticket.department,
      ticket.sultsTicketId,
      context?.reason,
      context?.dependsOn,
      context?.nextAction,
      ...supportNames(ticket),
    ].join(' '));

    if (query && !haystack.includes(query)) return false;
    if (state.unit && String(ticket.unit || '') !== state.unit) return false;
    if (state.responsible && String(ticket.responsible || '') !== state.responsible) return false;
    if (state.subject && String(ticket.subject || ticket.department || '') !== state.subject) return false;
    if (state.status && String(ticket.situation || '') !== state.status) return false;
    return true;
  };

  const matchesUrgency = (ticket) => {
    if (state.urgency === 'all') return true;
    if (state.urgency === 'waiting') return waitingTicket(ticket);
    if (contextDefers(ticket)) return false;
    return urgencyKey(ticket) === state.urgency;
  };

  const uniqueSorted = (items) => [...new Set(
    items.filter(Boolean).map((item) => String(item).trim()).filter(Boolean),
  )].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));

  const optionList = (items, selected, placeholder) => [
    `<option value="">${esc(placeholder)}</option>`,
    ...items.map((item) => `<option value="${esc(item)}" ${item === selected ? 'selected' : ''}>${esc(item)}</option>`),
  ].join('');

  const sortTickets = (group, tickets) => [...tickets].sort((a, b) => {
    if (group === 'waiting') {
      const aContext = contextFor(a);
      const bContext = contextFor(b);
      const aFollow = aContext?.followUpDate || '9999-12-31';
      const bFollow = bContext?.followUpDate || '9999-12-31';
      if (aFollow !== bFollow) return aFollow.localeCompare(bFollow);
    }

    const aDiff = dayDifference(dueDate(a));
    const bDiff = dayDifference(dueDate(b));
    const safeA = aDiff == null ? 99999 : aDiff;
    const safeB = bDiff == null ? 99999 : bDiff;
    if (safeA !== safeB) return safeA - safeB;

    return new Date(b.lastChangeAt || b.lastUpdatedAt || b.openedAt || 0).getTime()
      - new Date(a.lastChangeAt || a.lastUpdatedAt || a.openedAt || 0).getTime();
  });

  const renderTicket = (ticket) => {
    const deadline = deadlineLabel(ticket);
    const status = STATUS[Number(ticket.situation)] || 'Situação não informada';
    const subject = ticket.subject || ticket.department || 'Sem assunto';
    const id = ticketId(ticket);
    const context = contextFor(ticket);
    const deferred = contextDefers(ticket);
    const followUpNow = contextDueNow(ticket);
    const contextStatus = context ? (followUpNow ? 'Contexto para revisar' : contextLabel(context)) : '';

    return `<article class="pmh-ticket pmh-command-ticket ${deadline.tone === 'late' ? 'late' : ''} ${deferred ? 'has-operational-context' : ''}" data-ticket-id="${esc(id)}">
      <small>#${esc(id)}</small>
      <div class="pmh-command-ticket-head">
        <div><h4>${esc(ticket.title || 'Chamado sem título')}</h4><p>${esc(ticket.unit || 'Unidade não informada')}</p></div>
        <div class="pmh-command-ticket-badges">
          <span class="status status-${esc(ticket.situation || 'none')}">${esc(status)}</span>
          <span class="deadline ${deadline.tone}">${esc(deadline.text)}</span>
          ${context ? `<span class="context ${followUpNow ? 'due' : ''}">${esc(contextStatus)}</span>` : ''}
          <button type="button" class="pmh-ticket-context-button" data-ticket-context="${esc(id)}">${context ? 'Editar contexto' : '+ Contexto'}</button>
        </div>
      </div>
      ${context ? `<div class="pmh-ticket-context-line"><strong>${esc(contextLabel(context))}</strong><span>${esc(context.reason || 'Contexto operacional registrado.')}</span>${context.followUpDate ? `<em>Revisar ${esc(fmtDate(context.followUpDate))}</em>` : ''}</div>` : ''}
      <dl class="pmh-command-ticket-facts">
        <div><dt>Responsável</dt><dd>${esc(ticket.responsible || 'Não definido')}</dd></div>
        <div><dt>Assunto</dt><dd>${esc(subject)}</dd></div>
        <div><dt>Prazo</dt><dd>${esc(fmtDate(dueDate(ticket)))}</dd></div>
        <div><dt>Última movimentação</dt><dd>${esc(fmtDateTime(ticket.lastChangeAt || ticket.lastUpdatedAt || ticket.openedAt))}</dd></div>
      </dl>
    </article>`;
  };

  const renderGroup = (key, label, note, tickets) => `<section class="pmh-command-group group-${key}">
    <header><div><span></span><div><h3>${esc(label)}</h3><p>${esc(note)}</p></div></div><b>${tickets.length}</b></header>
    <div class="pmh-command-list">${tickets.length
      ? sortTickets(key, tickets).map(renderTicket).join('')
      : '<div class="pmh-command-empty">Nenhum chamado neste grupo.</div>'}</div>
  </section>`;

  const renderDiscovery = (tickets) => `<section class="pmh-command-group group-progress" data-command-discovery-list>
    <header><div><span></span><div><h3>Todos os chamados ativos do SULTS</h3><p>Consulta geral do SULTS, separada da sua fila pessoal.</p></div></div><b>${tickets.length}</b></header>
    <div class="pmh-command-list">${tickets.length
      ? sortTickets('progress', tickets).map(renderTicket).join('')
      : '<div class="pmh-command-empty">Nenhum chamado ativo encontrado com estes filtros.</div>'}</div>
  </section>`;

  const metricButton = (key, label, count, note, tone) =>
    `<button type="button" class="pmh-command-metric ${tone} ${state.urgency === key ? 'active' : ''}" data-command-urgency="${key}">
      <small>${esc(label)}</small><strong>${count}</strong><span>${esc(note)}</span>
    </button>`;

  const currentSource = () => state.discovery ? state.allTickets : state.tickets;

  const render = (mount, head) => {
    if (!mount?.isConnected) return;

    const source = currentSource();
    if (!Array.isArray(source)) {
      mount.innerHTML = `<div class="pmh-command-loading">${state.discovery ? 'Carregando chamados do SULTS…' : 'Carregando chamados da Planet…'}</div>`;
      return;
    }

    const activeTickets = source.filter(isActiveTicket);
    if (state.status && !ACTIVE_SITUATIONS.has(Number(state.status))) state.status = '';

    const base = activeTickets.filter(matchesBaseFilters);
    const actionableBase = base.filter((ticket) => !contextDefers(ticket));
    const counts = {
      late: actionableBase.filter((ticket) => urgencyKey(ticket) === 'late').length,
      today: actionableBase.filter((ticket) => urgencyKey(ticket) === 'today').length,
      week: actionableBase.filter((ticket) => urgencyKey(ticket) === 'week').length,
      waiting: base.filter(waitingTicket).length,
      'no-date': actionableBase.filter((ticket) => urgencyKey(ticket) === 'no-date').length,
    };

    const visible = base.filter(matchesUrgency);
    const groups = {
      action: visible.filter((ticket) => groupKey(ticket) === 'action'),
      progress: visible.filter((ticket) => groupKey(ticket) === 'progress'),
      waiting: visible.filter((ticket) => groupKey(ticket) === 'waiting'),
    };

    const units = uniqueSorted(activeTickets.map((ticket) => ticket.unit));
    const responsibles = uniqueSorted(activeTickets.map((ticket) => ticket.responsible));
    const subjects = uniqueSorted(activeTickets.map((ticket) => ticket.subject || ticket.department));
    const statusOptions = uniqueSorted(activeTickets.map((ticket) => String(ticket.situation || '')))
      .map((value) => ({ value, label: STATUS[Number(value)] || `Status ${value}` }));

    if (head) {
      const total = Array.isArray(state.tickets) ? state.tickets.filter(isActiveTicket).length : 0;
      head.innerHTML = `<div><small>CENTRAL DE DECISÃO</small><h2>Chamados ativos</h2><p>${total} chamado${total === 1 ? '' : 's'} ativo${total === 1 ? '' : 's'} da Planet no SULTS.</p></div>`;
    }

    mount.innerHTML = `
      ${state.discovery ? '' : `<section class="pmh-command-metrics">
        ${metricButton('late', 'Atrasados', counts.late, 'Pedem ação agora', 'red')}
        ${metricButton('today', 'Vencem hoje', counts.today, 'Ação imediata', 'orange')}
        ${metricButton('week', 'Esta semana', counts.week, 'Próximos 7 dias', 'blue')}
        ${metricButton('waiting', 'Aguardando', counts.waiting, 'SULTS ou contexto', 'purple')}
        ${metricButton('no-date', 'Sem prazo', counts['no-date'], 'Precisam de definição', 'gray')}
      </section>`}

      <section class="pmh-command-filters">
        <div class="pmh-command-filter-title"><strong>${state.discovery ? 'Explorar SULTS' : 'Filtrar chamados'}</strong><span>${visible.length} exibidos</span></div>
        <select data-command-filter="unit" aria-label="Filtrar por unidade">${optionList(units, state.unit, 'Todas as unidades')}</select>
        <select data-command-filter="responsible" aria-label="Filtrar por responsável">${optionList(responsibles, state.responsible, 'Todos os responsáveis')}</select>
        <select data-command-filter="subject" aria-label="Filtrar por assunto">${optionList(subjects, state.subject, 'Todos os assuntos')}</select>
        <select data-command-filter="status" aria-label="Filtrar por status">
          <option value="">Todos os status</option>
          ${statusOptions.map((item) => `<option value="${esc(item.value)}" ${item.value === state.status ? 'selected' : ''}>${esc(item.label)}</option>`).join('')}
        </select>
        <button type="button" class="pmh-command-mine ${state.discovery ? 'active' : ''}" data-command-discovery>${state.discovery ? '← Voltar aos chamados da Planet' : '＋ Todos do SULTS'}</button>
        <button type="button" class="pmh-command-clear" data-command-clear>Limpar filtros</button>
      </section>

      ${state.discovery ? renderDiscovery(visible) : `<section class="pmh-command-groups">
        ${renderGroup('action', 'Precisa de ação', 'Atrasados, vencendo hoje, novos ou aguardando responsável.', groups.action)}
        ${renderGroup('progress', 'Em andamento', 'Demandas em execução com prazo controlado.', groups.progress)}
        ${renderGroup('waiting', 'Aguardando / contextualizados', 'Dependem de retorno ou têm contexto registrado para revisão.', groups.waiting)}
      </section>`}`;
  };

  const fetchTicketList = async (url) => {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
    return Array.isArray(payload.data) ? payload.data : [];
  };

  const loadTickets = async (force = false) => {
    if (Array.isArray(state.tickets) && !force) return state.tickets;
    if (state.loading && !force) return state.loading;
    state.loading = fetchTicketList(MAIN_API)
      .then((tickets) => {
        state.tickets = tickets;
        return tickets;
      })
      .finally(() => { state.loading = null; });
    return state.loading;
  };

  const loadAllTickets = async (force = false) => {
    if (Array.isArray(state.allTickets) && !force) return state.allTickets;
    if (state.allLoading && !force) return state.allLoading;
    state.allLoading = fetchTicketList(ALL_API)
      .then((tickets) => {
        state.allTickets = tickets;
        return tickets;
      })
      .finally(() => { state.allLoading = null; });
    return state.allLoading;
  };

  const loadContexts = async (force = false) => {
    if (state.contexts.size && !force) return state.contexts;
    if (state.contextsLoading && !force) return state.contextsLoading;
    state.contextsLoading = fetch(CONTEXT_API, { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
        state.contexts = new Map((Array.isArray(payload.data) ? payload.data : [])
          .filter((item) => String(item.itemId || '').startsWith('ticket-'))
          .map((item) => [String(item.itemId), item]));
        return state.contexts;
      })
      .catch(() => state.contexts)
      .finally(() => { state.contextsLoading = null; });
    return state.contextsLoading;
  };

  const contextsFromRadar = (snapshot) => {
    const items = Array.isArray(snapshot?.items) ? snapshot.items : [];
    const next = new Map();

    items
      .filter((item) => item.origin === 'SULTS' && String(item.id || '').startsWith('ticket-'))
      .forEach((item) => {
        const hasContext = item.contextUpdatedAt
          || item.blockerReason
          || item.dependsOn
          || item.nextAction
          || item.followUpDate
          || item.operationalState !== 'actionable';
        if (!hasContext) return;

        next.set(String(item.id), {
          itemId: String(item.id),
          state: item.operationalState || 'actionable',
          reason: item.blockerReason || '',
          dependsOn: item.dependsOn || '',
          nextAction: item.nextAction || '',
          followUpDate: item.followUpDate || '',
          updatedAt: item.contextUpdatedAt || '',
        });
      });

    state.contexts = next;
  };

  const transform = async () => {
    const kanban = document.querySelector('.pmh-kanban');
    if (!kanban || kanban.dataset.commandTransforming === '1') return;

    const pageTitle = document.querySelector('[data-title]')?.textContent || '';
    if (!normalize(pageTitle).includes('chamados')) return;

    kanban.dataset.commandTransforming = '1';
    document.querySelector('[data-ticket-filters]')?.remove();

    const head = kanban.previousElementSibling?.classList.contains('pmh-section-head')
      ? kanban.previousElementSibling
      : document.querySelector('.pmh-section-head');

    const mount = document.createElement('section');
    mount.className = 'pmh-ticket-command';
    mount.innerHTML = '<div class="pmh-command-loading">Carregando meus chamados…</div>';
    kanban.replaceWith(mount);

    try {
      await Promise.all([loadTickets(), loadContexts()]);
      render(mount, head);
    } catch (error) {
      mount.innerHTML = `<div class="pmh-command-error"><strong>Não foi possível carregar meus chamados.</strong><span>${esc(error instanceof Error ? error.message : String(error))}</span></div>`;
    }
  };

  document.addEventListener('change', (event) => {
    const filter = event.target.closest('[data-command-filter]');
    if (!filter) return;
    state[filter.dataset.commandFilter] = filter.value;
    render(document.querySelector('.pmh-ticket-command'), document.querySelector('.pmh-section-head'));
  });

  document.addEventListener('click', async (event) => {
    const discovery = event.target.closest('[data-command-discovery]');
    if (discovery) {
      state.discovery = !state.discovery;
      state.urgency = 'all';
      state.unit = '';
      state.responsible = '';
      state.subject = '';
      state.status = '';

      const mount = document.querySelector('.pmh-ticket-command');
      const head = document.querySelector('.pmh-section-head');
      render(mount, head);

      if (state.discovery && !Array.isArray(state.allTickets)) {
        try {
          await loadAllTickets();
          render(mount, head);
        } catch (error) {
          mount.innerHTML = `<div class="pmh-command-error"><strong>Não foi possível carregar todos os chamados.</strong><span>${esc(error instanceof Error ? error.message : String(error))}</span></div>`;
        }
      }
      return;
    }

    const urgency = event.target.closest('[data-command-urgency]');
    if (urgency) {
      const value = urgency.dataset.commandUrgency;
      state.urgency = state.urgency === value ? 'all' : value;
      render(document.querySelector('.pmh-ticket-command'), document.querySelector('.pmh-section-head'));
      return;
    }

    if (event.target.closest('[data-command-clear]')) {
      state.unit = '';
      state.responsible = '';
      state.subject = '';
      state.status = '';
      state.urgency = 'all';
      render(document.querySelector('.pmh-ticket-command'), document.querySelector('.pmh-section-head'));
      return;
    }

    if (event.target.closest('[data-refresh]')) {
      state.tickets = null;
      state.allTickets = null;
      state.loading = null;
      state.allLoading = null;
      state.contexts = new Map();
      state.contextsLoading = null;
    }
  }, true);

  window.addEventListener('pmh:radar-data', (event) => {
    if (!document.querySelector('.pmh-ticket-command')) return;
    contextsFromRadar(event.detail);
    render(document.querySelector('.pmh-ticket-command'), document.querySelector('.pmh-section-head'));
  });

  window.TicketCommandFollowing = Object.freeze({
    isActiveTicket,
    isMine,
    ticketId,
    // A lista já vem filtrada do backend por scope=mine.
    activeMineTickets: (tickets) => (tickets || []).filter(isActiveTicket),
  });

  const observer = new MutationObserver(() => transform());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  transform();
})();