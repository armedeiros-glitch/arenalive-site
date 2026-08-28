(() => {
  'use strict';

  const STYLE_ID = 'andre-os-radar-home-v1-style';
  let requestId = 0;

  const ensureStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const link = document.createElement('link');
    link.id = STYLE_ID;
    link.rel = 'stylesheet';
    link.href = '/planet-hub/assets/andre-os-radar-home-v1.css?v=20260828-1';
    document.head.appendChild(link);
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const homeContent = () => document.querySelector('[data-content][data-home-page="hoje"]');
  const homeRoot = () => {
    const content = homeContent();
    if (!content) return null;
    return content.querySelector('[data-radar-andre-home], [data-decision-cockpit]');
  };

  const claimHome = () => {
    ensureStyles();
    const root = homeRoot();
    if (!root) return null;
    root.removeAttribute('data-decision-cockpit');
    root.dataset.radarAndreHome = '1';
    root.className = 'aos-radar-today';

    const shortcuts = homeContent()?.querySelector('.aos-home-page-shortcuts');
    if (shortcuts && shortcuts.dataset.radarAndreShortcuts !== '1') {
      shortcuts.dataset.radarAndreShortcuts = '1';
      shortcuts.innerHTML = `
        <button type="button" data-radar-refresh-home><i aria-hidden="true">↻</i><span><strong>Atualizar foco</strong><small>Ler Radar pessoal e atenção operacional</small></span></button>
        <button type="button" data-home-destination="planet"><i aria-hidden="true">▦</i><span><strong>Abrir Planet Chocolate</strong><small>Entrar na operação de trabalho</small></span></button>`;
    }
    return root;
  };

  const localDateKey = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const dueKey = (value) => String(value || '').slice(0, 10);
  const dueLabel = (value) => {
    const key = dueKey(value);
    if (!key) return 'Sem prazo';
    const today = localDateKey();
    if (key === today) return 'Hoje';
    const due = new Date(`${key}T12:00:00-03:00`);
    const now = new Date(`${today}T12:00:00-03:00`);
    const diff = Math.round((due - now) / 86400000);
    if (diff < 0) return `Atrasada há ${Math.abs(diff)}d`;
    if (diff === 1) return 'Amanhã';
    if (diff > 1 && diff <= 7) return `Em ${diff} dias`;
    return new Intl.DateTimeFormat('pt-BR').format(due);
  };
  const taskMeta = (task) => [
    Number(task.priority) ? `P${Number(task.priority)}` : '',
    task.duration_minutes ? `${Number(task.duration_minutes)} min` : '',
    dueLabel(task.due),
  ].filter(Boolean).join(' · ');

  const operationalRoleLabel = (item) => ({
    mine: 'MINHA AÇÃO',
    follow_up: 'COBRANÇA',
    tracking: 'ACOMPANHAR',
  }[item?.role] || 'OPERAÇÃO');

  const loadOperational = async (force = false) => {
    const service = window.AndreOSOperationalAttention;
    if (!service?.refresh) {
      return { items: [], total: 0, sourceErrors: ['Operação'], unavailable: true };
    }
    return service.refresh({ force });
  };

  const operationalMarkup = (snapshot = {}) => {
    const items = Array.isArray(snapshot.items) ? snapshot.items.slice(0, 3) : [];
    const total = Number(snapshot.total || items.length || 0);
    const errors = Array.isArray(snapshot.sourceErrors) ? snapshot.sourceErrors : [];

    if (snapshot.unavailable) {
      return `
        <section class="aos-radar-operation-section is-warning">
          <header><small>OPERAÇÃO PLANET</small><strong>Leitura indisponível</strong></header>
          <p>O Radar pessoal continua independente. Não consegui confirmar a atenção operacional agora.</p>
        </section>`;
    }

    if (!total) {
      return `
        <section class="aos-radar-operation-section is-clear">
          <header><small>OPERAÇÃO PLANET</small><strong>Sem atenção imediata</strong></header>
          <p>Nenhum item operacional entrou nos critérios de prazo, prioridade ou cobrança agora.${errors.length ? ` ${esc(errors.length)} fonte(s) falharam na leitura.` : ''}</p>
        </section>`;
    }

    return `
      <section class="aos-radar-operation-section">
        <header><small>OPERAÇÃO PLANET</small><strong>${total} ponto${total === 1 ? '' : 's'} de atenção</strong></header>
        <div class="aos-radar-operation-list">
          ${items.map((item) => `
            <article class="aos-radar-operation-item">
              <b>${esc(operationalRoleLabel(item))}</b>
              <span><strong>${esc(item.title || 'Item operacional')}</strong><small>${esc([item.origin, dueLabel(item.attentionDate || item.followUpDate || item.dueDate)].filter(Boolean).join(' · '))}</small></span>
            </article>`).join('')}
        </div>
        <button type="button" class="aos-radar-operation-open" data-home-destination="planet">Abrir operação da Planet</button>
      </section>`;
  };

  const sideMarkup = (secondary = [], operational = {}) => `
    <aside class="aos-radar-secondary" aria-label="Radar pessoal e atenção operacional">
      ${secondary.length ? `
        <section class="aos-radar-personal-next">
          <header><small>DEPOIS DO FOCO</small><strong>${secondary.length} próxima${secondary.length === 1 ? '' : 's'}</strong></header>
          ${secondary.map((task, index) => `
            <article>
              <b>${index + 2}</b>
              <span><strong>${esc(task.title || 'Tarefa sem título')}</strong><small>${esc(taskMeta(task))}</small></span>
            </article>`).join('')}
        </section>` : ''}
      ${operationalMarkup(operational)}
    </aside>`;

  const renderLoading = (root) => {
    root.innerHTML = `<div class="aos-radar-loading"><small>ANDRÉ OS</small><strong>Atualizando o que merece atenção…</strong><span>Radar pessoal e operação continuam como fontes separadas.</span></div>`;
  };

  const renderEmpty = (root, operational = {}) => {
    root.innerHTML = `
      <section class="aos-radar-focus-card is-empty">
        <small>RADAR PESSOAL</small>
        <h2>Radar pessoal sem pendências</h2>
        <p>Não encontrei tarefas ativas na fila oficial do Radar André. A situação da Planet é mostrada separadamente ao lado.</p>
        <button type="button" data-radar-refresh-home>Atualizar Radar</button>
      </section>
      ${sideMarkup([], operational)}`;
  };

  const renderUnavailable = (root, payload = {}, operational = {}) => {
    const notConfigured = payload.code === 'RADAR_NOT_CONFIGURED';
    root.innerHTML = `
      <section class="aos-radar-focus-card is-warning">
        <small>RADAR PESSOAL</small>
        <h2>${notConfigured ? 'Radar pessoal ainda não conectado' : 'Não consegui ler o Radar pessoal agora'}</h2>
        <p>${notConfigured
          ? 'Chamados e dados da Planet continuam separados e não serão usados como substitutos das suas tarefas.'
          : 'A operação pode continuar aparecendo ao lado sem virar tarefa pessoal.'}</p>
        <button type="button" data-radar-refresh-home>Tentar novamente</button>
      </section>
      ${sideMarkup([], operational)}`;
  };

  const renderTasks = (root, payload, mode = 'today', operational = {}) => {
    const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
    if (!tasks.length) return renderEmpty(root, operational);
    const recommendedId = String(payload.recommended_task_id || tasks[0]?.id || '');
    const focus = tasks.find((task) => String(task.id) === recommendedId) || tasks[0];
    const secondary = tasks.filter((task) => String(task.id) !== String(focus.id)).slice(0, 3);
    const isToday = mode === 'today';

    root.innerHTML = `
      <section class="aos-radar-focus-card">
        <header><div><small>🎯 ${isToday ? 'FOCO PESSOAL DE HOJE' : 'PRÓXIMO FOCO PESSOAL'}</small><span>${isToday ? 'Hoje' : dueLabel(focus.due)}</span></div></header>
        <h2>${esc(focus.title || 'Tarefa sem título')}</h2>
        <div class="aos-radar-focus-meta">${esc(taskMeta(focus))}</div>
        <p>${isToday ? 'Esta é a primeira tarefa vencida ou prevista para hoje na fila oficial do Radar pessoal.' : 'Não há tarefa pessoal vencida ou prevista para hoje. Esta é a próxima da fila oficial.'}</p>
      </section>
      ${sideMarkup(secondary, operational)}`;
  };

  const getJson = async (url) => {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) {
      const error = new Error(payload.error || `Falha HTTP ${response.status}`);
      error.payload = payload;
      throw error;
    }
    return payload;
  };

  const load = async (force = false) => {
    const root = claimHome();
    if (!root) return;
    const id = ++requestId;
    renderLoading(root);

    const operationalPromise = loadOperational(force).catch(() => ({
      items: [], total: 0, sourceErrors: ['Operação'], unavailable: true,
    }));

    try {
      const todayPayload = await getJson('/api/radar/today');
      if (id !== requestId || !homeContent()) return;
      const operational = await operationalPromise;
      if (id !== requestId || !homeContent()) return;
      if (Array.isArray(todayPayload.tasks) && todayPayload.tasks.length) {
        return renderTasks(root, todayPayload, 'today', operational);
      }

      const nextPayload = await getJson('/api/radar/next');
      if (id !== requestId || !homeContent()) return;
      renderTasks(root, nextPayload, 'next', operational);
    } catch (error) {
      const operational = await operationalPromise;
      if (id === requestId && homeContent()) {
        renderUnavailable(root, error?.payload || { code: 'RADAR_UNAVAILABLE' }, operational);
      }
    }
  };

  const schedule = () => requestAnimationFrame(() => { if (homeContent()) load(); });
  window.addEventListener('andre-os:home-page-rendered', (event) => { if (event.detail?.page === 'hoje') schedule(); });
  window.addEventListener('pmh:view-rendered', (event) => { if (event.detail?.page === 'hoje') schedule(); });
  document.addEventListener('click', (event) => { if (event.target.closest?.('[data-radar-refresh-home]')) load(true); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
})();
