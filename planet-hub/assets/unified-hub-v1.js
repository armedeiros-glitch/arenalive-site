(() => {
  'use strict';

  const API = {
    tickets: '/api/sults/chamados?start=0&limit=100',
    projects: '/api/sults/implantacoes?start=0&limit=100',
    inaugurations: '/api/hub/inauguracoes',
  };
  const LOCAL_KEY = 'planet-hub-inaugurations-v2';
  const DEFAULT_BUDGET = 4100;

  const checklistTemplate = [
    ['Número de telefone para redes sociais', 'Franqueado', 30],
    ['Criação/ajuste do Instagram', 'Franqueado', 30],
    ['Criação/ajuste do Facebook', 'Franqueado', 30],
    ['Google Meu Negócio', 'Franqueado', 30],
    ['Vídeo de inauguração', 'Franqueadora', 20],
    ['Enviar @ dos influenciadores', 'Franqueado', 20],
    ['Contratar influenciadores', 'Franqueado', 15],
    ['Contratar Social Media para inauguração', 'Franqueado', 15],
    ['Contratar ornamentação / arco de bolas', 'Franqueado', 15],
    ['Aprovar artes inaugurais', 'Franqueadora', 12],
    ['Fazer 1000 panfletos', 'Franqueado', 10],
    ['Entregar panfletos para lojistas', 'Franqueado', 7],
    ['Configurar tráfego pago', 'Franqueadora', 7],
    ['Separar brindes/cupons', 'Franqueado', 5],
    ['Conferência final da operação', 'Franqueadora', 3],
  ];

  const actionTemplate = [
    ['decoracao', 'Decoração com balões', 'Arco, totem, ponto instagramável ou ambientação da unidade.', 'Franqueado', 'D-1 a D0', 350, 'package', 1],
    ['corte-fita', 'Corte de fita', 'Fita personalizada, tesoura e registro simbólico da abertura.', 'Franqueado', 'D0', 0, 'included', 1],
    ['degustacao', 'Degustação sensorial', 'Mini porções de fondue, frutas ou produto definido pela operação.', 'Franqueado', 'D0', 0, 'unit', 50],
    ['trafego-pago', 'Tráfego pago local', 'Campanhas geolocalizadas antes, durante e depois da inauguração.', 'Franqueadora', 'D-15 a D+15', 1300, 'package', 1],
    ['influenciadores', 'Influenciadores locais', 'Criadores regionais para gerar expectativa, visita e prova social.', 'Franqueadora + unidade', 'D-10 a D0', 2000, 'package', 2],
    ['panfletagem', 'Panfletagem e relacionamento', 'Divulgação para lojistas, entorno, parceiros e pontos de alto fluxo.', 'Franqueado', 'D-7 a D0', 450, 'package', 1],
  ];

  const campaigns = [
    ['2026-01-01', '2026-01-31', 'Verão Planet', 'apoio', 'Campanha sazonal'],
    ['2026-02-14', '2026-02-14', 'Valentine’s Day', 'apoio', 'Portugal e EUA'],
    ['2026-02-24', '2026-02-24', 'Aniversário Planet', 'principal', 'Data da marca'],
    ['2026-03-01', '2026-03-31', 'Março Azul-Marinho', 'institucional', 'Conscientização sobre o câncer colorretal'],
    ['2026-03-15', '2026-03-15', 'Dia do Consumidor', 'data', 'Conteúdo e relacionamento'],
    ['2026-03-20', '2026-03-20', 'Dia da Felicidade', 'data', 'Conteúdo digital'],
    ['2026-03-28', '2026-03-28', 'Hora do Planeta', 'data', 'Ação às 20h30'],
    ['2026-04-01', '2026-04-30', 'Abril Azul', 'institucional', 'Conscientização sobre o autismo'],
    ['2026-03-16', '2026-04-05', 'Páscoa Planet', 'principal', 'Campanha nacional'],
    ['2026-04-14', '2026-04-14', 'Café · data promocional', 'data', 'Calendário de conteúdo'],
    ['2026-05-01', '2026-05-31', 'Maio Amarelo', 'institucional', 'Segurança no trânsito'],
    ['2026-05-10', '2026-05-10', 'Dia das Mães', 'apoio', '2º domingo de maio'],
    ['2026-06-01', '2026-06-30', 'Arraiá Planet', 'principal', 'Período definido pelo Marketing'],
    ['2026-06-01', '2026-06-30', 'Junho Vermelho', 'institucional', 'Doação de sangue'],
    ['2026-06-12', '2026-06-12', 'Dia dos Namorados', 'apoio', 'Brasil'],
    ['2026-07-01', '2026-07-31', 'Férias Escolares', 'apoio', 'Conforme calendário local'],
    ['2026-07-07', '2026-07-07', 'Dia Mundial do Chocolate', 'apoio', 'Oportunidade de produto'],
    ['2026-07-20', '2026-07-20', 'Dia do Amigo', 'data', 'Conteúdo e relacionamento'],
    ['2026-08-01', '2026-08-31', 'Agosto Lilás', 'institucional', 'Combate à violência contra a mulher'],
    ['2026-08-01', '2026-08-09', 'Mês dos Pais Planet', 'principal', 'Ativação durante agosto'],
    ['2026-08-11', '2026-08-11', 'Dia do Estudante', 'data', 'Conteúdo digital'],
    ['2026-09-01', '2026-09-30', 'Setembro Amarelo', 'institucional', 'Valorização da vida'],
    ['2026-09-15', '2026-09-15', 'Dia do Cliente', 'data', 'Relacionamento'],
    ['2026-09-21', '2026-09-21', 'Dia da Árvore', 'data', 'Conteúdo institucional'],
    ['2026-09-22', '2026-09-22', 'Primavera Planet', 'principal', 'Início da primavera'],
    ['2026-09-23', '2026-09-23', 'Dia do Sorvete', 'apoio', 'Data nacional'],
    ['2026-10-01', '2026-10-31', 'Outubro Rosa', 'institucional', 'Prevenção ao câncer de mama'],
    ['2026-10-01', '2026-10-01', 'Dia Internacional do Café', 'data', 'Conteúdo e PDV'],
    ['2026-10-01', '2026-10-12', 'Semana das Crianças', 'principal', 'Período de campanha'],
    ['2026-10-31', '2026-10-31', 'Halloween Planet', 'principal', 'Data comemorativa'],
    ['2026-11-01', '2026-11-30', 'Novembro Azul', 'institucional', 'Saúde do homem'],
    ['2026-11-27', '2026-11-27', 'Black Planet', 'principal', 'Black Friday 2026'],
    ['2026-12-01', '2026-12-31', 'Dezembro Vermelho', 'institucional', 'Prevenção ao HIV e outras ISTs'],
    ['2026-12-01', '2026-12-25', 'Natal Planet', 'principal', 'Campanha nacional'],
    ['2026-12-01', '2026-12-23', 'Amigo Secreto Planet', 'apoio', 'Confraternizações'],
    ['2026-12-31', '2026-12-31', 'Réveillon', 'data', 'Conteúdo de encerramento'],
  ].map(([start, end, name, type, note]) => ({ start, end, name, type, note }));

  const state = {
    view: 'inicio',
    loading: true,
    error: '',
    tickets: [],
    projects: [],
    inaugurations: [],
    revision: null,
    shared: false,
    search: '',
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));
  const strip = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const asDate = (value) => value ? new Date(`${String(value).slice(0, 10)}T12:00:00`) : null;
  const fmtDate = (value) => {
    const date = value instanceof Date ? value : asDate(value);
    return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('pt-BR').format(date) : 'Sem data';
  };
  const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
  const number = (value) => Math.max(0, Number(String(value ?? '').replace(',', '.')) || 0);
  const now = () => new Date();
  const daysUntil = (value) => {
    const date = asDate(value);
    if (!date) return null;
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    return Math.ceil((date - today) / 86400000);
  };

  const makeChecklist = () => checklistTemplate.map(([action, owner, daysBefore]) => ({ action, owner, daysBefore, done: false }));
  const makeActions = () => actionTemplate.map(([id, name, description, owner, timing, plannedAmount, costType, quantity]) => ({
    id, name, description, owner, timing, plannedAmount, actualAmount: 0, costType, quantity, included: true, done: false, notes: '',
  }));

  const normalizeInauguration = (item = {}) => {
    const actionsById = new Map((Array.isArray(item.inauguralActions) ? item.inauguralActions : []).map((action) => [action.id, action]));
    return {
      id: String(item.id || `inauguration-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      sourceProjectId: item.sourceProjectId == null ? null : String(item.sourceProjectId),
      unit: String(item.unit || 'Unidade sem nome'),
      openingDate: String(item.openingDate || ''),
      responsible: String(item.responsible || ''),
      location: String(item.location || ''),
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
      packageBudget: number(item.packageBudget || DEFAULT_BUDGET),
      checklist: (Array.isArray(item.checklist) && item.checklist.length ? item.checklist : makeChecklist()).map((entry) => ({
        action: String(entry.action || ''), owner: String(entry.owner || ''), daysBefore: Number(entry.daysBefore) || 0, done: Boolean(entry.done),
      })),
      inauguralActions: makeActions().map((template) => ({ ...template, ...(actionsById.get(template.id) || {}) })),
    };
  };

  const readLocal = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.map(normalizeInauguration) : [];
    } catch (_) { return []; }
  };
  const writeLocal = (items) => localStorage.setItem(LOCAL_KEY, JSON.stringify(items));

  const apiJson = async (url, options = {}) => {
    const response = await fetch(url, { headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `Falha HTTP ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  };

  const mergeInaugurations = (remote, local) => {
    const merged = new Map();
    [...remote, ...local].forEach((raw) => {
      const item = normalizeInauguration(raw);
      const current = merged.get(item.id);
      if (!current || Date.parse(item.updatedAt || 0) >= Date.parse(current.updatedAt || 0)) merged.set(item.id, item);
    });
    return [...merged.values()];
  };

  const loadAll = async () => {
    state.loading = true;
    state.error = '';
    render();
    const [ticketsResult, projectsResult, inaugurationsResult] = await Promise.allSettled([
      apiJson(API.tickets), apiJson(API.projects), apiJson(API.inaugurations),
    ]);
    state.tickets = ticketsResult.status === 'fulfilled' ? (ticketsResult.value.data || []) : [];
    state.projects = projectsResult.status === 'fulfilled' ? (projectsResult.value.data || []) : [];
    if (inaugurationsResult.status === 'fulfilled') {
      const remote = (inaugurationsResult.value.data || []).map(normalizeInauguration);
      const merged = mergeInaugurations(remote, readLocal());
      state.inaugurations = merged;
      state.revision = inaugurationsResult.value.revision || null;
      state.shared = true;
      writeLocal(merged);
      if (JSON.stringify(remote) !== JSON.stringify(merged)) await saveInaugurations(false);
    } else {
      state.inaugurations = readLocal();
      state.shared = false;
    }
    const errors = [ticketsResult, projectsResult].filter((result) => result.status === 'rejected');
    if (errors.length) state.error = 'Parte dos dados do SULTS não carregou. Use o botão atualizar para tentar novamente.';
    state.loading = false;
    render();
  };

  const saveInaugurations = async (rerender = true) => {
    state.inaugurations = state.inaugurations.map((item) => normalizeInauguration(item));
    writeLocal(state.inaugurations);
    try {
      const payload = await apiJson(API.inaugurations, {
        method: 'PUT',
        body: JSON.stringify({ data: state.inaugurations, baseRevision: state.revision }),
      });
      state.inaugurations = (payload.data || state.inaugurations).map(normalizeInauguration);
      state.revision = payload.revision || state.revision;
      state.shared = true;
      writeLocal(state.inaugurations);
    } catch (error) {
      if (error.status === 409 && error.payload?.data) {
        state.inaugurations = mergeInaugurations(error.payload.data, state.inaugurations);
        state.revision = error.payload.revision || null;
        return saveInaugurations(rerender);
      }
      state.shared = false;
      state.error = 'Alteração salva neste navegador, mas a sincronização compartilhada falhou.';
    }
    if (rerender) render();
  };

  const isFinished = (ticket) => Boolean(ticket.concludedAt || ticket.resolvedAt);
  const dueDate = (ticket) => ticket.stipulatedResolutionAt || ticket.plannedResolutionAt;
  const isOverdue = (ticket) => !isFinished(ticket) && dueDate(ticket) && new Date(dueDate(ticket)).getTime() < Date.now();
  const ticketLane = (ticket) => {
    if (isFinished(ticket)) return 'concluidos';
    if (isOverdue(ticket)) return 'atrasados';
    const text = strip([ticket.title, ticket.subject, ticket.department, ticket.sendingDepartment, ...(ticket.labels || []).map((label) => label.name)].join(' '));
    if (/aguard|espera|retorno/.test(text)) return 'aguardando';
    if (/aprov|validac/.test(text)) return 'aprovacao';
    if (/inaug|implant/.test(text)) return 'inauguracoes';
    if (/video|grava|edicao|reels|filmagem/.test(text)) return 'videos';
    if (/rebrand|logomarca|fachada|identidade/.test(text)) return 'rebranding';
    if (/franquead|unidade|loja/.test(text)) return 'franqueados';
    return 'andamento';
  };

  const viewFromHash = () => {
    const value = strip(location.hash.replace(/^#/, ''));
    if (value.includes('chamado')) return 'chamados';
    if (value.includes('inaug')) return 'inauguracoes';
    if (value.includes('calend') || value.includes('campanha')) return 'calendario';
    if (value.includes('conte')) return 'conteudos';
    return 'inicio';
  };

  const shell = document.createElement('div');
  shell.id = 'pmh-app';
  shell.innerHTML = `
    <aside class="pmh-sidebar">
      <div class="pmh-brand"><span aria-hidden="true">A</span><div><strong>André OS</strong><small>Marketing Command</small></div></div>
      <nav aria-label="Navegação principal">
        <button data-view="inicio"><i>⌂</i>Início</button>
        <button data-view="chamados"><i>▥</i>Chamados <b data-badge="tickets">0</b></button>
        <button data-view="inauguracoes"><i>⚑</i>Inaugurações <b data-badge="inaugurations">0</b></button>
        <button data-view="calendario"><i>▦</i>Calendário</button>
        <button data-view="conteudos"><i>▤</i>Conteúdos</button>
      </nav>
      <footer><small>Operação Planet Chocolate · dados do SULTS e André OS</small><span data-storage-status></span></footer>
    </aside>
    <main class="pmh-main">
      <header class="pmh-topbar"><div><small>OPERAÇÃO · PLANET CHOCOLATE</small><h1 data-title></h1></div><div class="pmh-top-actions"><label data-search-wrap><span>⌕</span><input type="search" placeholder="Buscar chamado, unidade ou responsável"></label><button data-refresh title="Atualizar">↻</button></div></header>
      <section class="pmh-content" data-content></section>
    </main>`;
  document.body.replaceChildren(shell);

  const content = shell.querySelector('[data-content]');
  const title = shell.querySelector('[data-title]');
  const searchWrap = shell.querySelector('[data-search-wrap]');
  const searchInput = searchWrap.querySelector('input');

  const metric = (label, value, note, tone, view = '') => `<button class="pmh-metric ${tone}" ${view ? `data-view="${view}"` : ''}><small>${esc(label)}</small><strong>${esc(value)}</strong><span>${esc(note)}</span></button>`;
  const empty = (text) => `<div class="pmh-empty">${esc(text)}</div>`;

  const renderHome = () => {
    const active = state.tickets.filter((item) => !isFinished(item));
    const overdue = active.filter(isOverdue);
    const activeProjects = state.projects.filter((item) => item.active && !item.completed);
    const upcoming = state.inaugurations.filter((item) => {
      const days = daysUntil(item.openingDate);
      return days != null && days >= 0 && days <= 45;
    });
    title.textContent = 'Painel de Marketing';
    return `<section class="pmh-decision-cockpit" data-decision-cockpit aria-live="polite"><div class="pmh-loading">Carregando o cockpit de decisão…</div></section>
      <section class="pmh-internal-demands" data-internal-demands><div class="pmh-demand-loading">Carregando demandas internas…</div></section>
      <section data-active-workstream><div class="pmh-active-empty">Carregando o radar…</div></section>
      <section class="pmh-metrics">
        ${metric('Chamados abertos', active.length, 'Sincronizados com o SULTS', 'blue', 'chamados')}
        ${metric('Chamados atrasados', overdue.length, overdue.length ? 'Precisam de ação hoje' : 'Nenhum prazo vencido', 'red', 'chamados')}
        ${metric('Implantações no SULTS', activeProjects.length, 'Projetos ativos', 'green', 'inauguracoes')}
        ${metric('Próximas inaugurações', upcoming.length, 'Nos próximos 45 dias', 'orange', 'inauguracoes')}
      </section>
      <section class="pmh-shortcuts">
        <button data-view="chamados"><i>▥</i><strong>Chamados</strong><span>Demandas e prazos</span></button>
        <button data-view="inauguracoes"><i>⚑</i><strong>Inaugurações</strong><span>Checklist e ações</span></button>
        <button data-view="calendario"><i>▦</i><strong>Calendário</strong><span>Campanhas de 2026</span></button>
        <button data-view="conteudos"><i>▤</i><strong>Conteúdos</strong><span>Biblioteca da rede</span></button>
      </section>`;
  };

  const renderTickets = () => {
    title.textContent = 'Chamados do Marketing';
    const query = strip(state.search);
    const filtered = state.tickets.filter((item) => !query || strip([item.title, item.unit, item.requester, item.responsible, item.subject, item.department].join(' ')).includes(query));
    const lanes = [
      ['atrasados', 'Prioridade'], ['andamento', 'Em andamento'], ['aprovacao', 'Em aprovação'], ['aguardando', 'Aguardando'], ['videos', 'Vídeos'], ['franqueados', 'Franqueados'], ['inauguracoes', 'Inaugurações'], ['rebranding', 'Rebranding'], ['concluidos', 'Concluídos'],
    ];
    const groups = new Map(lanes.map(([key]) => [key, []]));
    filtered.forEach((ticket) => groups.get(ticketLane(ticket))?.push(ticket));
    return `<section class="pmh-section-head"><div><small>SULTS</small><h2>Fluxo de chamados</h2><p>${filtered.length} chamados encontrados.</p></div></section><div class="pmh-kanban">${lanes.map(([key, label]) => {
      const items = groups.get(key) || [];
      return `<section class="pmh-lane"><header><h3>${esc(label)}</h3><b>${items.length}</b></header><div>${items.length ? items.slice(0, 30).map((ticket) => `<article class="pmh-ticket ${isOverdue(ticket) ? 'late' : ''}" data-ticket-id="${esc(ticket.sultsTicketId || ticket.id || '')}"><small>#${esc(ticket.sultsTicketId || ticket.id || '')}</small><h4>${esc(ticket.title || 'Chamado sem título')}</h4><p>${esc(ticket.unit || 'Unidade não informada')}</p><dl><div><dt>Responsável</dt><dd>${esc(ticket.responsible || 'Não definido')}</dd></div><div><dt>Prazo</dt><dd>${fmtDate(dueDate(ticket))}</dd></div></dl></article>`).join('') : empty('Nenhum chamado.')}</div></section>`;
    }).join('')}</div>`;
  };

  const actionTotals = (item) => {
    const used = item.inauguralActions.filter((action) => action.included !== false);
    const packageActions = used.filter((action) => action.costType === 'package');
    return {
      used, done: used.filter((action) => action.done).length,
      planned: packageActions.reduce((sum, action) => sum + number(action.plannedAmount), 0),
      actual: packageActions.reduce((sum, action) => sum + number(action.actualAmount), 0),
      unit: used.filter((action) => action.costType === 'unit').reduce((sum, action) => sum + number(action.actualAmount), 0),
    };
  };

  const renderAction = (item, action) => `<article class="pmh-action ${action.done ? 'done' : ''} ${action.included === false ? 'disabled' : ''}">
    <header><label><input type="checkbox" data-action-field="done" data-item="${esc(item.id)}" data-action="${esc(action.id)}" ${action.done ? 'checked' : ''} ${action.included === false ? 'disabled' : ''}><span></span></label><div><h5>${esc(action.name)}</h5><p>${esc(action.description)}</p></div><label class="use"><input type="checkbox" data-action-field="included" data-item="${esc(item.id)}" data-action="${esc(action.id)}" ${action.included !== false ? 'checked' : ''}> Usar</label></header>
    <div class="pmh-action-grid"><div><small>RESPONSÁVEL</small><strong>${esc(action.owner)}</strong></div><div><small>PERÍODO</small><strong>${esc(action.timing)}</strong></div>${action.id === 'influenciadores' ? `<label><small>QUANTIDADE</small><input type="number" min="1" max="6" value="${number(action.quantity) || 2}" data-action-field="quantity" data-item="${esc(item.id)}" data-action="${esc(action.id)}"></label>` : ''}<label><small>PREVISTO</small><input type="number" min="0" step="0.01" value="${number(action.plannedAmount)}" data-action-field="plannedAmount" data-item="${esc(item.id)}" data-action="${esc(action.id)}" ${action.costType === 'included' ? 'disabled' : ''}></label><label><small>REAL</small><input type="number" min="0" step="0.01" value="${number(action.actualAmount)}" data-action-field="actualAmount" data-item="${esc(item.id)}" data-action="${esc(action.id)}" ${action.costType === 'included' ? 'disabled' : ''}></label></div>
    <label class="pmh-action-note"><small>OBSERVAÇÃO / FORNECEDOR</small><input type="text" maxlength="300" value="${esc(action.notes || '')}" data-action-field="notes" data-item="${esc(item.id)}" data-action="${esc(action.id)}"></label>
  </article>`;

  const renderTrackedCard = (item) => {
    const completed = item.checklist.filter((entry) => entry.done).length;
    const progress = Math.round((completed / Math.max(1, item.checklist.length)) * 100);
    const totals = actionTotals(item);
    const balance = item.packageBudget - totals.actual;
    const days = daysUntil(item.openingDate);
    return `<article class="pmh-inauguration-card">
      <header><div><small>INAUGURAÇÃO ACOMPANHADA</small><h3>${esc(item.unit)}</h3><p>${esc(item.responsible || 'Sem responsável')} · ${esc(item.location || 'Local não informado')}</p></div><div class="pmh-date"><strong>${fmtDate(item.openingDate)}</strong><span>${days == null ? 'Sem contagem' : days < 0 ? `${Math.abs(days)} dias atrás` : days === 0 ? 'Hoje' : `Em ${days} dias`}</span></div></header>
      <div class="pmh-progress"><i style="width:${progress}%"></i></div><div class="pmh-progress-label"><span>${completed}/${item.checklist.length} etapas</span><b>${progress}%</b></div>
      <details><summary>Checklist de implantação</summary><div class="pmh-checklist">${item.checklist.map((entry, index) => { const due = asDate(item.openingDate); if (due) due.setDate(due.getDate() - entry.daysBefore); return `<label class="${entry.done ? 'done' : ''}"><input type="checkbox" data-check-index="${index}" data-item="${esc(item.id)}" ${entry.done ? 'checked' : ''}><div><strong>${esc(entry.action)}</strong><small>${esc(entry.owner)} · D-${entry.daysBefore}</small></div><em>${entry.done ? 'Concluído' : fmtDate(due)}</em></label>`; }).join('')}</div></details>
      <details class="pmh-actions"><summary><span><strong>Ações inaugurais</strong><small>${totals.done}/${totals.used.length} concluídas</small></span><b>${money(balance)} disponível</b></summary><div class="pmh-finance"><label><small>VERBA DO PACOTE</small><input type="number" min="0" step="0.01" value="${number(item.packageBudget)}" data-budget="${esc(item.id)}"></label><article><small>PLANEJADO</small><strong>${money(totals.planned)}</strong></article><article><small>GASTO</small><strong>${money(totals.actual)}</strong></article><article class="${balance < 0 ? 'negative' : ''}"><small>SALDO</small><strong>${money(balance)}</strong></article>${totals.unit ? `<article><small>CUSTO DA UNIDADE</small><strong>${money(totals.unit)}</strong></article>` : ''}</div><div class="pmh-actions-list">${item.inauguralActions.map((action) => renderAction(item, action)).join('')}</div></details>
      <footer><button class="danger" data-remove-inauguration="${esc(item.id)}">Remover acompanhamento</button></footer>
    </article>`;
  };

  const renderInaugurations = () => {
    title.textContent = 'Inaugurações';
    const tracked = [...state.inaugurations].sort((a, b) => (asDate(a.openingDate) || Infinity) - (asDate(b.openingDate) || Infinity));
    const activeProjects = state.projects.filter((item) => item.active && !item.completed);
    const upcoming = tracked.filter((item) => { const days = daysUntil(item.openingDate); return days != null && days >= 0 && days <= 45; });
    const lateSteps = tracked.reduce((sum, item) => sum + item.checklist.filter((entry) => { if (entry.done || !item.openingDate) return false; const due = asDate(item.openingDate); due.setDate(due.getDate() - entry.daysBefore); return due < now(); }).length, 0);
    return `<section class="pmh-section-head"><div><small>IMPLANTAÇÕES E INAUGURAÇÕES</small><h2>Unidades no radar do Marketing</h2><p>Uma única área para data real, checklist e ações inaugurais.</p></div><button class="primary" data-new-inauguration>+ Nova inauguração</button></section>
      <section class="pmh-metrics">${metric('Implantações no SULTS', activeProjects.length, 'Projetos ativos', 'green')}${metric('Em acompanhamento', tracked.length, 'Checklists ativos', 'blue')}${metric('Próximas inaugurações', upcoming.length, 'Nos próximos 45 dias', 'orange')}${metric('Etapas atrasadas', lateSteps, 'Precisam de ação', 'red')}</section>
      <section class="pmh-tracked">${tracked.length ? tracked.map(renderTrackedCard).join('') : empty('Nenhuma inauguração em acompanhamento. Clique em “Nova inauguração”.')}</section>
      <section class="pmh-projects"><header><div><small>REFERÊNCIA SULTS</small><h3>Implantações ativas</h3></div><span>${activeProjects.length} projetos</span></header><div>${activeProjects.slice(0, 50).map((project) => `<article><div><strong>${esc(project.unit || project.projectName || 'Unidade sem nome')}</strong><small>${esc(project.responsible || 'Sem responsável')} · ${fmtDate(project.endDate || project.startDate)}</small></div><button data-start-project="${esc(project.sultsProjectId || project.id || '')}">Acompanhar</button></article>`).join('') || empty('Nenhuma implantação ativa.')}</div></section>`;
  };

  const renderCalendar = () => {
    title.textContent = 'Calendário de Campanhas';
    const today = new Date();
    const typeLabel = { principal: 'Principal', apoio: 'Apoio', data: 'Data comemorativa', institucional: 'Institucional' };
    const months = Array.from({ length: 12 }, (_, index) => campaigns.filter((campaign) => asDate(campaign.start).getMonth() === index));
    return `<section class="pmh-section-head"><div><small>CALENDÁRIO OFICIAL · 2026</small><h2>Campanhas, datas e posicionamento</h2><p>Campanhas passadas aparecem suavizadas. Datas podem ser ajustadas pelo Marketing Planet.</p></div></section><div class="pmh-calendar-legend"><span class="principal">Principal</span><span class="apoio">Apoio</span><span class="data">Data comemorativa</span><span class="institucional">Institucional</span></div><div class="pmh-calendar">${months.map((items, month) => `<section><header><h3>${new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(2026, month, 1))}</h3><b>${items.length}</b></header><div>${items.map((campaign) => { const past = asDate(campaign.end) < today; return `<article class="${campaign.type} ${past ? 'past' : ''}"><small>${fmtDate(campaign.start)}${campaign.end !== campaign.start ? ` → ${fmtDate(campaign.end)}` : ''}</small><h4>${esc(campaign.name)}</h4><p>${esc(campaign.note)}</p><span>${typeLabel[campaign.type]}</span></article>`; }).join('') || empty('Sem ações previstas.')}</div></section>`).join('')}</div>`;
  };

  const renderContents = () => {
    title.textContent = 'Conteúdos';
    return `<section class="pmh-section-head"><div><small>BIBLIOTECA DO MARKETING</small><h2>Materiais organizados por frente</h2><p>Estrutura inicial do acervo. Os próximos arquivos entram aqui sem reabrir o sistema antigo.</p></div></section><div class="pmh-library"><article><i>▦</i><small>PLANEJAMENTO</small><h3>Calendário oficial 2026</h3><p>Campanhas principais, apoio, datas comemorativas e institucionais.</p><button data-view="calendario">Abrir calendário</button></article><article><i>⚑</i><small>INAUGURAÇÕES</small><h3>Kit de implantação</h3><p>Checklist de 15 etapas e seis ações inaugurais com controle financeiro.</p><button data-view="inauguracoes">Abrir inaugurações</button></article><article><i>▥</i><small>OPERAÇÃO</small><h3>Chamados do SULTS</h3><p>Demandas, responsáveis, prazos e classificação do fluxo.</p><button data-view="chamados">Abrir chamados</button></article><article class="pending"><i>＋</i><small>PRÓXIMA FRENTE</small><h3>Arquivos e peças da rede</h3><p>O acervo de PDFs, apresentações e artes será conectado nesta área.</p><span>Em consolidação</span></article></div>`;
  };

  const announceView = () => window.dispatchEvent(new CustomEvent('pmh:view-rendered', {
    detail: { view: state.view, content },
  }));

  const render = () => {
    shell.querySelectorAll('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === state.view));
    shell.querySelector('[data-badge="tickets"]').textContent = state.tickets.filter((item) => !isFinished(item)).length;
    shell.querySelector('[data-badge="inaugurations"]').textContent = state.inaugurations.length;
    shell.querySelector('[data-storage-status]').innerHTML = `<i class="${state.shared ? 'shared' : 'local'}"></i>${state.shared ? 'Dados compartilhados' : 'Modo local'}`;
    searchWrap.hidden = state.view !== 'chamados';
    if (state.loading) {
      title.textContent = 'André OS';
      content.innerHTML = '<div class="pmh-loading">Carregando o painel…</div>';
      announceView();
      return;
    }
    const html = state.view === 'chamados' ? renderTickets() : state.view === 'inauguracoes' ? renderInaugurations() : state.view === 'calendario' ? renderCalendar() : state.view === 'conteudos' ? renderContents() : renderHome();
    content.innerHTML = `${state.error ? `<div class="pmh-alert">${esc(state.error)}</div>` : ''}${html}`;
    announceView();
  };

  const setView = (view) => {
    state.view = view;
    location.hash = view === 'inicio' ? 'inicio' : view;
    render();
  };

  const openModal = (projectId = '') => {
    document.querySelector('.pmh-modal')?.remove();
    const project = state.projects.find((item) => String(item.sultsProjectId || item.id || '') === String(projectId));
    const modal = document.createElement('div');
    modal.className = 'pmh-modal';
    modal.innerHTML = `<section><header><div><small>NOVA INAUGURAÇÃO</small><h2>Iniciar acompanhamento</h2><p>Escolha a implantação e informe a data real.</p></div><button data-close>×</button></header><form><label class="wide">Implantação do SULTS<select name="projectId"><option value="">Cadastro manual</option>${state.projects.filter((item) => item.active && !item.completed).map((item) => `<option value="${esc(item.sultsProjectId || item.id || '')}" ${String(item.sultsProjectId || item.id || '') === String(projectId) ? 'selected' : ''}>${esc(item.unit || item.projectName || 'Unidade sem nome')}</option>`).join('')}</select></label><label>Unidade<input name="unit" required value="${esc(project?.unit || project?.projectName || '')}"></label><label>Data real da inauguração<input name="openingDate" type="date" required></label><label>Responsável<input name="responsible" value="${esc(project?.responsible || '')}"></label><label>Shopping / local<input name="location" value="${esc(project?.category || project?.model || '')}"></label><p class="wide">Ao salvar, entram automaticamente o checklist, as seis ações inaugurais e a verba padrão de R$ 4.100.</p><footer class="wide"><button type="button" data-close>Cancelar</button><button class="primary" type="submit">Criar inauguração</button></footer></form></section>`;
    document.body.appendChild(modal);
    const select = modal.querySelector('select');
    select.addEventListener('change', () => {
      const selected = state.projects.find((item) => String(item.sultsProjectId || item.id || '') === select.value);
      modal.querySelector('[name="unit"]').value = selected?.unit || selected?.projectName || '';
      modal.querySelector('[name="responsible"]').value = selected?.responsible || '';
      modal.querySelector('[name="location"]').value = selected?.category || selected?.model || '';
    });
    modal.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => modal.remove()));
    modal.addEventListener('click', (event) => { if (event.target === modal) modal.remove(); });
    modal.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const sourceProjectId = String(form.get('projectId') || '');
      if (sourceProjectId && state.inaugurations.some((item) => String(item.sourceProjectId || '') === sourceProjectId)) return alert('Essa implantação já está em acompanhamento.');
      state.inaugurations.unshift(normalizeInauguration({ id: `inauguration-${Date.now()}`, sourceProjectId: sourceProjectId || null, unit: form.get('unit'), openingDate: form.get('openingDate'), responsible: form.get('responsible'), location: form.get('location'), packageBudget: DEFAULT_BUDGET, checklist: makeChecklist(), inauguralActions: makeActions(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
      modal.remove();
      await saveInaugurations();
    });
  };

  shell.addEventListener('click', async (event) => {
    const viewButton = event.target.closest('[data-view]');
    if (viewButton) return setView(viewButton.dataset.view);
    if (event.target.closest('[data-refresh]')) return loadAll();
    if (event.target.closest('[data-new-inauguration]')) return openModal();
    const projectButton = event.target.closest('[data-start-project]');
    if (projectButton) return openModal(projectButton.dataset.startProject);
    const removeButton = event.target.closest('[data-remove-inauguration]');
    if (removeButton && confirm('Remover esta inauguração do acompanhamento?')) {
      state.inaugurations = state.inaugurations.filter((item) => item.id !== removeButton.dataset.removeInauguration);
      await saveInaugurations();
    }
  });

  shell.addEventListener('change', async (event) => {
    const itemId = event.target.dataset.item;
    if (!itemId && !event.target.dataset.budget) return;
    const item = state.inaugurations.find((candidate) => candidate.id === (itemId || event.target.dataset.budget));
    if (!item) return;
    if (event.target.dataset.checkIndex != null) item.checklist[Number(event.target.dataset.checkIndex)].done = event.target.checked;
    if (event.target.dataset.budget) item.packageBudget = number(event.target.value);
    if (event.target.dataset.actionField) {
      const action = item.inauguralActions.find((candidate) => candidate.id === event.target.dataset.action);
      const field = event.target.dataset.actionField;
      if (action) {
        if (field === 'done' || field === 'included') action[field] = event.target.checked;
        else if (field === 'quantity') action.quantity = Math.max(1, Math.min(6, Number.parseInt(event.target.value, 10) || 1));
        else if (field === 'plannedAmount' || field === 'actualAmount') action[field] = number(event.target.value);
        else action[field] = String(event.target.value || '').slice(0, 300);
      }
    }
    item.updatedAt = new Date().toISOString();
    await saveInaugurations();
  });

  searchInput.addEventListener('input', () => { state.search = searchInput.value; if (state.view === 'chamados') render(); });
  window.addEventListener('hashchange', () => { state.view = viewFromHash(); render(); });
  window.addEventListener('keydown', (event) => { if (event.key === 'Escape') document.querySelector('.pmh-modal')?.remove(); });

  state.view = viewFromHash();
  loadAll();
})();
