(() => {
  'use strict';

  let requestId = 0;

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
    const root = homeRoot();
    if (!root) return null;
    root.removeAttribute('data-decision-cockpit');
    root.dataset.radarAndreHome = '1';
    root.className = 'aos-radar-today';

    const shortcuts = homeContent()?.querySelector('.aos-home-page-shortcuts');
    if (shortcuts && shortcuts.dataset.radarAndreShortcuts !== '1') {
      shortcuts.dataset.radarAndreShortcuts = '1';
      shortcuts.innerHTML = `
        <button type="button" data-radar-refresh-home><i aria-hidden="true">↻</i><span><strong>Atualizar foco</strong><small>Ler novamente o Radar André</small></span></button>
        <button type="button" data-home-destination="planet"><i aria-hidden="true">▦</i><span><strong>Abrir Planet Chocolate</strong><small>Entrar na operação de trabalho</small></span></button>`;
    }

    return root;
  };

  const localDateKey = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
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
    return new Intl.DateTimeFormat('pt-BR').format(due);
  };

  const taskMeta = (task) => [
    Number(task.priority) ? `P${Number(task.priority)}` : '',
    task.duration_minutes ? `${Number(task.duration_minutes)} min` : '',
    dueLabel(task.due),
  ].filter(Boolean).join(' · ');

  const renderLoading = (root) => {
    root.innerHTML = `<div class="aos-radar-loading"><small>RADAR ANDRÉ</small><strong>Lendo seu foco real de hoje…</strong><span>Fonte única: Todoist via Radar André.</span></div>`;
  };

  const renderEmpty = (root) => {
    root.innerHTML = `
      <section class="aos-radar-focus-card is-empty">
        <small>RADAR ANDRÉ · HOJE</small>
        <h2>Nada urgente no Radar agora</h2>
        <p>Não há tarefa vencida ou prevista para hoje que exija foco imediato.</p>
        <button type="button" data-radar-refresh-home>Atualizar Radar</button>
      </section>`;
  };

  const renderUnavailable = (root, payload = {}) => {
    const notConfigured = payload.code === 'RADAR_NOT_CONFIGURED';
    root.innerHTML = `
      <section class="aos-radar-focus-card is-warning">
        <small>RADAR ANDRÉ</small>
        <h2>${notConfigured ? 'Radar pessoal ainda não conectado' : 'Não consegui ler o Radar agora'}</h2>
        <p>${notConfigured
          ? 'A Home não vai usar chamados do SULTS como substituto das suas tarefas.'
          : 'Mantive a Home sem inventar prioridades a partir da operação da Planet.'}</p>
        <button type="button" data-radar-refresh-home>Tentar novamente</button>
      </section>`;
  };

  const renderTasks = (root, payload) => {
    const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
    if (!tasks.length) return renderEmpty(root);

    const recommendedId = String(payload.recommended_task_id || tasks[0]?.id || '');
    const focus = tasks.find((task) => String(task.id) === recommendedId) || tasks[0];
    const secondary = tasks.filter((task) => String(task.id) !== String(focus.id)).slice(0, 3);

    root.innerHTML = `
      <section class="aos-radar-focus-card">
        <header><div><small>🎯 FOCO RECOMENDADO PELO RADAR</small><span>Hoje</span></div></header>
        <h2>${esc(focus.title || 'Tarefa sem título')}</h2>
        <div class="aos-radar-focus-meta">${esc(taskMeta(focus))}</div>
        <p>Esta é a primeira tarefa da fila oficial do Radar André.</p>
      </section>
      <aside class="aos-radar-secondary" aria-label="Próximas tarefas do Radar">
        <header><small>DEPOIS DO FOCO</small><strong>${secondary.length ? `${secondary.length} próximas` : 'Fila limpa'}</strong></header>
        ${secondary.length ? secondary.map((task, index) => `
          <article>
            <b>${index + 2}</b>
            <span><strong>${esc(task.title || 'Tarefa sem título')}</strong><small>${esc(taskMeta(task))}</small></span>
          </article>`).join('') : '<div class="aos-radar-secondary-empty">Nenhuma outra tarefa na fila de hoje.</div>'}
      </aside>`;
  };

  const load = async () => {
    const root = claimHome();
    if (!root) return;
    const id = ++requestId;
    renderLoading(root);

    try {
      const response = await fetch('/api/radar/today', { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const payload = await response.json().catch(() => ({}));
      if (id !== requestId || !homeContent()) return;
      if (!response.ok || payload.ok === false) return renderUnavailable(root, payload);
      renderTasks(root, payload);
    } catch {
      if (id === requestId && homeContent()) renderUnavailable(root, { code: 'RADAR_UNAVAILABLE' });
    }
  };

  const schedule = () => requestAnimationFrame(() => {
    if (homeContent()) load();
  });

  window.addEventListener('andre-os:home-page-rendered', (event) => {
    if (event.detail?.page === 'hoje') schedule();
  });

  window.addEventListener('pmh:view-rendered', (event) => {
    if (event.detail?.page === 'hoje') schedule();
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-radar-refresh-home]')) return;
    load();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', schedule, { once: true });
  } else {
    schedule();
  }
})();
