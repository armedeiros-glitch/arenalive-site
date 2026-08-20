(() => {
  const API = {
    chamados: '/api/sults/chamados?start=0&limit=100',
    implantacoes: '/api/sults/implantacoes?start=0&limit=100',
  };

  const state = {
    chamados: [],
    implantacoes: [],
    loading: true,
    error: null,
    view: 'inicio',
    search: '',
  };

  const strip = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  const esc = (value) =>
    String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }[char]));

  const formatDate = (value) => {
    if (!value) return 'Sem data';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Sem data';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    }).format(date);
  };

  const isFinished = (ticket) => Boolean(ticket.concludedAt || ticket.resolvedAt);
  const deadline = (ticket) => ticket.stipulatedResolutionAt || ticket.plannedResolutionAt;
  const isOverdue = (ticket) => {
    const due = deadline(ticket);
    return !isFinished(ticket) && due && new Date(due).getTime() < Date.now();
  };

  const ticketText = (ticket) => strip([
    ticket.title,
    ticket.subject,
    ticket.department,
    ticket.sendingDepartment,
    ...(ticket.labels || []).map((label) => label.name),
  ].filter(Boolean).join(' '));

  const ticketLane = (ticket) => {
    if (isFinished(ticket)) return 'concluidos';
    if (isOverdue(ticket)) return 'atrasados';
    const text = ticketText(ticket);
    if (/aguard|espera|retorno/.test(text)) return 'aguardando';
    if (/aprov|validac|aprova/.test(text)) return 'aprovacao';
    if (/inaug|implant/.test(text)) return 'inauguracoes';
    if (/rebrand|logomarca|fachada|identidade/.test(text)) return 'rebranding';
    if (/video|grava|edicao|reels|filmagem/.test(text)) return 'videos';
    if (/franquead|unidade|loja/.test(text)) return 'franqueados';
    if (/interno|franqueadora|administrativo/.test(text)) return 'interno';
    return 'andamento';
  };

  const lanes = [
    ['atrasados', 'Prioridade', 'Chamados com prazo vencido'],
    ['interno', 'Interno', 'Demandas internas'],
    ['videos', 'Vídeos', 'Gravação e edição'],
    ['franqueados', 'Franqueados', 'Pedidos das unidades'],
    ['inauguracoes', 'Inaugurações', 'Materiais inaugurais'],
    ['rebranding', 'Rebranding', 'Identidade e atualização'],
    ['aguardando', 'Aguardando', 'Dependência externa'],
    ['aprovacao', 'Em aprovação', 'Aguardando validação'],
    ['andamento', 'Em andamento', 'Demais chamados ativos'],
    ['concluidos', 'Concluídos', 'Finalizados'],
  ];

  const shell = document.createElement('div');
  shell.id = 'pmh-command-center';
  shell.innerHTML = `
    <aside class="pmh-cc-sidebar">
      <div class="pmh-cc-brand">
        <span class="pmh-cc-brandmark">P</span>
        <div><strong>Planet</strong><small>Marketing Hub</small></div>
      </div>
      <nav aria-label="Navegação principal">
        <button data-pmh-view="inicio"><span>⌂</span>Início</button>
        <button data-pmh-view="chamados"><span>◫</span>Chamados <b data-pmh-badge="chamados">0</b></button>
        <button data-pmh-open="inauguracoes"><span>⚑</span>Inaugurações</button>
        <button data-pmh-open="campanhas"><span>◉</span>Campanhas</button>
        <button data-pmh-open="calendario"><span>▦</span>Calendário</button>
        <button data-pmh-open="conteudos"><span>▤</span>Conteúdos</button>
      </nav>
      <footer>
        <button class="pmh-cc-back" type="button" data-pmh-open="hub">Abrir Hub completo</button>
        <small>Dados sincronizados com o SULTS</small>
      </footer>
    </aside>
    <main class="pmh-cc-main">
      <header class="pmh-cc-topbar">
        <div>
          <small>PLANET CHOCOLATE</small>
          <h1 data-pmh-title>Painel de Marketing</h1>
        </div>
        <div class="pmh-cc-top-actions">
          <label class="pmh-cc-search">
            <span>⌕</span>
            <input type="search" placeholder="Buscar chamado, unidade ou responsável" aria-label="Buscar">
          </label>
          <button type="button" class="pmh-cc-refresh" title="Atualizar dados">↻</button>
        </div>
      </header>
      <section class="pmh-cc-content" data-pmh-content></section>
    </main>`;
  document.body.appendChild(shell);

  const root = document.getElementById('root');
  const content = shell.querySelector('[data-pmh-content]');
  const title = shell.querySelector('[data-pmh-title]');
  const searchInput = shell.querySelector('.pmh-cc-search input');

  const activate = (view) => {
    state.view = view;
    document.body.classList.add('pmh-command-mode');
    shell.hidden = false;
    if (root) root.setAttribute('aria-hidden', 'true');
    shell.querySelectorAll('[data-pmh-view]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.pmhView === view);
    });
    searchInput.closest('label').hidden = view !== 'chamados';
    render();
  };

  const leaveCommandMode = () => {
    document.body.classList.remove('pmh-command-mode');
    shell.hidden = true;
    if (root) root.removeAttribute('aria-hidden');
  };

  const findNativeTarget = (key) => {
    const patterns = {
      inauguracoes: [/inaugura/, /implanta/],
      campanhas: [/campanha/],
      calendario: [/calend/],
      conteudos: [/conte[uú]do/, /biblioteca/, /materiais/],
    }[key] || [];
    const candidates = [...document.querySelectorAll('#root button, #root a')];
    return candidates.find((node) => {
      const text = strip(node.textContent);
      return patterns.some((pattern) => pattern.test(text));
    });
  };

  const openNative = (key) => {
    leaveCommandMode();
    if (key === 'hub') return;
    requestAnimationFrame(() => {
      const target = findNativeTarget(key);
      if (target) target.click();
      else {
        activate('inicio');
        state.error = `Não encontrei a área “${key}” no menu atual.`;
        render();
      }
    });
  };

  const stats = () => {
    const activeTickets = state.chamados.filter((item) => !isFinished(item));
    const overdue = activeTickets.filter(isOverdue);
    const activeImplantations = state.implantacoes.filter((item) => item.active && !item.completed);
    const upcoming = activeImplantations.filter((item) => {
      const date = item.endDate || item.startDate;
      if (!date) return false;
      const days = (new Date(date).getTime() - Date.now()) / 86400000;
      return days >= 0 && days <= 45;
    });
    return { activeTickets, overdue, activeImplantations, upcoming };
  };

  const metricCard = (label, value, note, tone, view) => `
    <button class="pmh-cc-metric ${tone || ''}" type="button" ${view ? `data-pmh-view="${view}"` : ''}>
      <small>${esc(label)}</small>
      <strong>${value}</strong>
      <span>${esc(note)}</span>
    </button>`;

  const ticketCard = (ticket) => {
    const due = deadline(ticket);
    const labels = (ticket.labels || []).slice(0, 2);
    return `
      <article class="pmh-ticket-card ${isOverdue(ticket) ? 'is-overdue' : ''}">
        <header>
          <span>#${esc(ticket.sultsTicketId)}</span>
          ${labels.map((label) => `<i style="--tag:${esc(label.color || '#8f7a70')}">${esc(label.name)}</i>`).join('')}
        </header>
        <h4>${esc(ticket.title || 'Chamado sem título')}</h4>
        <p>${esc(ticket.unit || 'Unidade não informada')}</p>
        <dl>
          <div><dt>Responsável</dt><dd>${esc(ticket.responsible || 'Não definido')}</dd></div>
          <div><dt>Prazo</dt><dd>${esc(formatDate(due))}</dd></div>
        </dl>
        <footer>
          <span>${esc(ticket.subject || ticket.department || 'Sem classificação')}</span>
          <b>${ticket.publicInteractionCount || 0} interações</b>
        </footer>
      </article>`;
  };

  const renderHome = () => {
    const { activeTickets, overdue, activeImplantations, upcoming } = stats();
    const recentTickets = [...activeTickets]
      .sort((a, b) => new Date(b.lastChangeAt || b.openedAt || 0) - new Date(a.lastChangeAt || a.openedAt || 0))
      .slice(0, 5);
    const attention = [...overdue, ...activeTickets.filter((item) => !item.responsible)]
      .filter((item, index, array) => array.findIndex((candidate) => candidate.sultsTicketId === item.sultsTicketId) === index)
      .slice(0, 5);

    title.textContent = 'Painel de Marketing';
    content.innerHTML = `
      ${state.error ? `<div class="pmh-cc-alert">${esc(state.error)}</div>` : ''}
      <section class="pmh-cc-welcome">
        <div><small>VISÃO GERAL</small><h2>O que precisa de atenção agora</h2><p>Um painel para decidir rápido, sem abrir cinco abas e conversar com três fantasmas digitais.</p></div>
        <button type="button" data-pmh-view="chamados">Ver todos os chamados</button>
      </section>
      <section class="pmh-cc-metrics">
        ${metricCard('Chamados abertos', activeTickets.length, 'Sincronizados com o SULTS', 'tone-blue', 'chamados')}
        ${metricCard('Chamados atrasados', overdue.length, overdue.length ? 'Precisam de ação hoje' : 'Nenhum prazo vencido', 'tone-red', 'chamados')}
        ${metricCard('Implantações ativas', activeImplantations.length, 'Projetos em andamento', 'tone-green')}
        ${metricCard('Próximas inaugurações', upcoming.length, 'Nos próximos 45 dias', 'tone-orange')}
      </section>
      <section class="pmh-cc-apps">
        <header><div><small>ACESSO RÁPIDO</small><h3>Áreas do Marketing Hub</h3></div></header>
        <div class="pmh-cc-app-grid">
          <button data-pmh-view="chamados"><span>◫</span><strong>Chamados</strong><small>Demandas e prazos</small></button>
          <button data-pmh-open="inauguracoes"><span>⚑</span><strong>Inaugurações</strong><small>Implantações e ações</small></button>
          <button data-pmh-open="campanhas"><span>◉</span><strong>Campanhas</strong><small>Calendário comercial</small></button>
          <button data-pmh-open="calendario"><span>▦</span><strong>Calendário</strong><small>Datas e entregas</small></button>
          <button data-pmh-open="conteudos"><span>▤</span><strong>Conteúdos</strong><small>Materiais da rede</small></button>
        </div>
      </section>
      <section class="pmh-cc-home-grid">
        <div class="pmh-cc-panel">
          <header><div><small>RECENTES</small><h3>Chamados em movimento</h3></div><button data-pmh-view="chamados">Abrir Kanban</button></header>
          <div class="pmh-cc-list">
            ${recentTickets.length ? recentTickets.map((ticket) => `
              <button type="button" data-pmh-view="chamados">
                <span class="pmh-cc-dot"></span>
                <div><strong>${esc(ticket.title)}</strong><small>${esc(ticket.unit || ticket.department || 'Sem unidade')}</small></div>
                <time>${esc(formatDate(ticket.lastChangeAt || ticket.openedAt))}</time>
              </button>`).join('') : '<p class="pmh-cc-empty">Nenhum chamado ativo encontrado.</p>'}
          </div>
        </div>
        <div class="pmh-cc-panel">
          <header><div><small>ATENÇÃO</small><h3>O que pode travar a operação</h3></div></header>
          <div class="pmh-cc-list is-attention">
            ${attention.length ? attention.map((ticket) => `
              <button type="button" data-pmh-view="chamados">
                <span class="pmh-cc-dot"></span>
                <div><strong>${esc(ticket.title)}</strong><small>${isOverdue(ticket) ? 'Prazo vencido' : 'Sem responsável definido'}</small></div>
                <time>${esc(formatDate(deadline(ticket)))}</time>
              </button>`).join('') : '<p class="pmh-cc-empty">Nada crítico agora. O painel está respirando.</p>'}
          </div>
        </div>
      </section>`;
  };

  const renderTickets = () => {
    const query = strip(state.search);
    const filtered = state.chamados.filter((ticket) => {
      if (!query) return true;
      return strip([
        ticket.title,
        ticket.unit,
        ticket.requester,
        ticket.responsible,
        ticket.subject,
        ticket.department,
      ].join(' ')).includes(query);
    });

    const byLane = new Map(lanes.map(([key]) => [key, []]));
    filtered.forEach((ticket) => byLane.get(ticketLane(ticket)).push(ticket));
    byLane.forEach((items) => items.sort((a, b) => {
      if (isOverdue(a) !== isOverdue(b)) return isOverdue(a) ? -1 : 1;
      return new Date(b.lastChangeAt || b.openedAt || 0) - new Date(a.lastChangeAt || a.openedAt || 0);
    }));

    title.textContent = 'Chamados do Marketing';
    content.innerHTML = `
      ${state.error ? `<div class="pmh-cc-alert">${esc(state.error)}</div>` : ''}
      <section class="pmh-cc-board-head">
        <div><small>SULTS • ATUALIZAÇÃO EM TEMPO REAL</small><h2>Kanban de chamados</h2><p>Organizado automaticamente por assunto, prazo e situação do chamado.</p></div>
        <div><b>${filtered.filter((item) => !isFinished(item)).length}</b><span>abertos</span></div>
      </section>
      <section class="pmh-kanban">
        ${lanes.map(([key, label, note]) => {
          const items = byLane.get(key);
          if (!items.length && ['interno', 'videos', 'franqueados', 'inauguracoes', 'rebranding'].includes(key)) return '';
          return `
            <div class="pmh-kanban-lane" data-lane="${key}">
              <header><div><strong>${esc(label)}</strong><small>${esc(note)}</small></div><b>${items.length}</b></header>
              <div class="pmh-kanban-cards">
                ${items.length ? items.map(ticketCard).join('') : '<p class="pmh-cc-empty">Nenhum chamado aqui.</p>'}
              </div>
            </div>`;
        }).join('')}
      </section>`;
  };

  const renderLoading = () => {
    title.textContent = state.view === 'chamados' ? 'Chamados do Marketing' : 'Painel de Marketing';
    content.innerHTML = `
      <section class="pmh-cc-loading">
        <span></span><h2>Sincronizando com o SULTS</h2><p>Buscando chamados e implantações...</p>
      </section>`;
  };

  const render = () => {
    if (state.loading) return renderLoading();
    if (state.view === 'chamados') renderTickets();
    else renderHome();
    shell.querySelector('[data-pmh-badge="chamados"]').textContent =
      state.chamados.filter((item) => !isFinished(item)).length;
  };

  const load = async () => {
    state.loading = true;
    state.error = null;
    render();
    try {
      const [ticketResponse, implantationResponse] = await Promise.all([
        fetch(API.chamados, { headers: { Accept: 'application/json' } }),
        fetch(API.implantacoes, { headers: { Accept: 'application/json' } }),
      ]);
      const [ticketPayload, implantationPayload] = await Promise.all([
        ticketResponse.json(),
        implantationResponse.json(),
      ]);
      if (!ticketResponse.ok) throw new Error(ticketPayload.error || 'Falha ao consultar chamados');
      if (!implantationResponse.ok) throw new Error(implantationPayload.error || 'Falha ao consultar implantações');
      state.chamados = Array.isArray(ticketPayload.data) ? ticketPayload.data : [];
      state.implantacoes = Array.isArray(implantationPayload.data) ? implantationPayload.data : [];
    } catch (error) {
      console.error('Planet Hub: falha no painel inicial', error);
      state.error = error instanceof Error ? error.message : String(error);
    } finally {
      state.loading = false;
      render();
    }
  };

  shell.addEventListener('click', (event) => {
    const viewButton = event.target.closest('[data-pmh-view]');
    if (viewButton) {
      activate(viewButton.dataset.pmhView);
      return;
    }
    const nativeButton = event.target.closest('[data-pmh-open]');
    if (nativeButton) openNative(nativeButton.dataset.pmhOpen);
  });

  searchInput.addEventListener('input', () => {
    state.search = searchInput.value;
    if (state.view === 'chamados') renderTickets();
  });

  shell.querySelector('.pmh-cc-refresh').addEventListener('click', load);

  const nativeObserver = new MutationObserver(() => {
    if (!document.body.classList.contains('pmh-command-mode')) return;
    if (!document.body.contains(shell)) document.body.appendChild(shell);
  });
  if (root) nativeObserver.observe(root, { childList: true, subtree: true });

  activate('inicio');
  load();
})();