(() => {
  'use strict';

  const HOME_HASHES = new Set(['', 'inicio', 'hoje']);
  const MODE_HASHES = new Set(['laboratorio', 'pessoal']);
  const LAB_API = '/api/hub/laboratory/projects';
  const state = { projects: [], projectsLoaded: false, personalTasks: [], personalMode: 'next' };
  let frame = 0;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));
  const hash = () => String(location.hash || '#inicio').replace(/^#/, '').toLowerCase();
  const content = () => document.querySelector('[data-content]');
  const title = () => document.querySelector('[data-title]');
  const statusLabel = (status) => ({
    explorando: 'Explorando', validando: 'Validando', executando: 'Executando', pausado: 'Pausado',
  }[status] || 'Explorando');
  const statusIcon = (status) => ({ explorando: '⌁', validando: '◇', executando: '▶', pausado: 'Ⅱ' }[status] || '⌁');

  const fetchJson = async (url, options = {}) => {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(options.headers || {}) },
      cache: 'no-store',
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.error || `Falha HTTP ${response.status}`);
    return payload;
  };

  const launcherMarkup = () => `
    <section class="aos-mode-launcher" data-aos-mode-launcher aria-label="Escolher ambiente do André OS">
      <header>
        <small>ANDRÉ OS</small>
        <h2>O que você quer fazer?</h2>
        <p>Escolha o ambiente. O André OS abre a gaveta certa e mostra o que dá para fazer agora.</p>
      </header>
      <div class="aos-mode-launcher-grid">
        <button type="button" class="aos-mode-card work" data-aos-mode-destination="planet">
          <i aria-hidden="true">▦</i>
          <span><small>TRABALHO</small><strong>Planet Chocolate</strong><em>Entrar na operação de marketing e rede.</em></span>
          <b aria-hidden="true">→</b>
        </button>
        <button type="button" class="aos-mode-card lab" data-aos-mode-destination="laboratorio">
          <i aria-hidden="true">⌁</i>
          <span><small>LABORATÓRIO</small><strong>Projetos e ideias</strong><em data-aos-lab-home-status>Carregando projetos…</em></span>
          <b aria-hidden="true">→</b>
        </button>
        <button type="button" class="aos-mode-card personal" data-aos-mode-destination="pessoal">
          <i aria-hidden="true">◉</i>
          <span><small>VIDA PESSOAL</small><strong>Foco e tarefas</strong><em data-aos-personal-home-status>Ler o Radar pessoal.</em></span>
          <b aria-hidden="true">→</b>
        </button>
      </div>
    </section>`;

  const ensureSidebarModes = () => {
    const nav = document.querySelector('.pmh-sidebar nav');
    if (!nav) return;
    const items = [
      ['laboratorio', '⌁', 'Laboratório', 40],
      ['pessoal', '◉', 'Pessoal', 50],
    ];
    items.forEach(([mode, icon, label, order]) => {
      let button = nav.querySelector(`:scope > [data-aos-sidebar-mode="${mode}"]`);
      if (!button) {
        button = document.createElement('button');
        button.type = 'button';
        button.dataset.aosSidebarMode = mode;
        button.dataset.aosModeDestination = mode;
        button.className = 'aos-mode-sidebar-item';
        nav.appendChild(button);
      }
      button.style.order = String(order);
      button.innerHTML = `<i aria-hidden="true">${icon}</i><span>${label}</span>`;
      button.classList.toggle('active', hash() === mode);
    });
  };

  const loadProjects = async (force = false) => {
    if (state.projectsLoaded && !force) return state.projects;
    const payload = await fetchJson(LAB_API);
    state.projects = Array.isArray(payload.data) ? payload.data : [];
    state.projectsLoaded = true;
    return state.projects;
  };

  const loadPersonalTasks = async () => {
    const today = await fetchJson('/api/radar/today');
    if (Array.isArray(today.tasks) && today.tasks.length) {
      state.personalTasks = today.tasks;
      state.personalMode = 'today';
      return state.personalTasks;
    }
    const next = await fetchJson('/api/radar/next');
    state.personalTasks = Array.isArray(next.tasks) ? next.tasks : [];
    state.personalMode = 'next';
    return state.personalTasks;
  };

  const hydrateLauncher = async () => {
    const root = document.querySelector('[data-aos-mode-launcher]');
    if (!root) return;
    try {
      const projects = await loadProjects();
      const status = root.querySelector('[data-aos-lab-home-status]');
      if (status) status.textContent = projects.length
        ? `${projects.length} ${projects.length === 1 ? 'projeto ativo ou salvo' : 'projetos ativos ou salvos'}.`
        : 'Criar ou organizar um projeto experimental.';
    } catch {
      const status = root.querySelector('[data-aos-lab-home-status]');
      if (status) status.textContent = 'Abrir o espaço de projetos e ideias.';
    }
    try {
      const tasks = await loadPersonalTasks();
      const status = root.querySelector('[data-aos-personal-home-status]');
      if (status) status.textContent = tasks.length
        ? `${tasks.length} ${state.personalMode === 'today' ? 'item(ns) para hoje' : 'próximo(s) item(ns) no Radar'}.`
        : 'Radar pessoal sem pendências ativas.';
    } catch {
      const status = root.querySelector('[data-aos-personal-home-status]');
      if (status) status.textContent = 'Abrir foco e tarefas pessoais.';
    }
  };

  const mountLauncher = () => {
    if (!HOME_HASHES.has(hash())) return;
    const home = document.querySelector('[data-content][data-home-page="hoje"] .aos-home-page-today');
    if (!home) return;
    if (!home.querySelector('[data-aos-mode-launcher]')) home.insertAdjacentHTML('beforeend', launcherMarkup());
    hydrateLauncher();
  };

  const projectCards = () => {
    if (!state.projects.length) return `<section class="aos-mode-action-empty">
      <i>⌁</i><strong>Nenhum projeto no Laboratório ainda</strong>
      <span>Aqui não tem card decorativo: crie um projeto para ele virar uma ficha de trabalho.</span>
      <button type="button" data-aos-lab-new>+ Novo projeto</button>
    </section>`;
    return `<div class="aos-lab-project-grid">${state.projects.map((project) => `
      <article class="aos-lab-project-card">
        <header><span class="aos-lab-status ${esc(project.status)}"><i>${statusIcon(project.status)}</i>${statusLabel(project.status)}</span><button type="button" data-aos-lab-edit="${esc(project.id)}">Editar</button></header>
        <h3>${esc(project.name)}</h3>
        <p>${esc(project.summary || 'Sem resumo ainda.')}</p>
        <footer><small>PRÓXIMO PASSO</small><strong>${esc(project.nextStep || 'Definir o próximo passo.')}</strong></footer>
      </article>`).join('')}</div>`;
  };

  const laboratoryMarkup = () => `
    <section class="aos-mode-page aos-lab-page" data-aos-mode-page="laboratorio">
      <header class="aos-mode-page-hero with-action">
        <div><small>LABORATÓRIO</small><h2>Projetos, hipóteses e testes</h2><p>Uma área para transformar ideia solta em algo que tenha estado e próximo passo.</p></div>
        <button type="button" data-aos-lab-new>+ Novo projeto</button>
      </header>
      <section class="aos-mode-workspace" data-aos-lab-projects><div class="aos-mode-loading">Carregando projetos…</div></section>
    </section>`;

  const dueText = (task) => {
    const raw = task?.due ? String(task.due).slice(0, 10) : '';
    if (!raw) return 'Sem prazo';
    return raw.split('-').reverse().join('/');
  };

  const personalTaskMarkup = () => {
    if (!state.personalTasks.length) return `<section class="aos-mode-action-empty compact">
      <i>✓</i><strong>Radar pessoal sem tarefas ativas</strong>
      <span>Quando existir tarefa registrada no Radar, ela aparece aqui automaticamente.</span>
      <button type="button" data-aos-personal-refresh>Atualizar Radar</button>
    </section>`;
    return `<div class="aos-personal-task-list">${state.personalTasks.map((task, index) => `
      <article class="aos-personal-task ${index === 0 ? 'focus' : ''}">
        <b>${index === 0 ? 'FOCO' : String(index + 1)}</b>
        <span><strong>${esc(task.title || 'Tarefa sem título')}</strong><small>${task.duration_minutes ? `${Number(task.duration_minutes)} min · ` : ''}${esc(dueText(task))}${Number(task.priority) ? ` · P${Number(task.priority)}` : ''}</small></span>
      </article>`).join('')}</div>`;
  };

  const personalMarkup = () => `
    <section class="aos-mode-page aos-personal-page" data-aos-mode-page="pessoal">
      <header class="aos-mode-page-hero with-action">
        <div><small>VIDA PESSOAL</small><h2>Seu foco fora do trabalho</h2><p>O Radar continua sendo a fonte das tarefas. Aqui a ideia é enxergar a vida pessoal sem misturar com a operação da Planet.</p></div>
        <button type="button" data-aos-personal-refresh>↻ Atualizar</button>
      </header>
      <div class="aos-personal-grid">
        <section class="aos-mode-panel"><header><small>${state.personalMode === 'today' ? 'HOJE' : 'RADAR'}</small><h3>${state.personalMode === 'today' ? 'O que pede atenção agora' : 'Próximos focos'}</h3></header><div data-aos-personal-tasks><div class="aos-mode-loading">Lendo o Radar…</div></div></section>
        <section class="aos-mode-panel aos-personal-rule"><header><small>REGRA</small><h3>Uma fonte só</h3></header><p>Tarefas pessoais não são copiadas para dentro do André OS. Esta tela lê o Radar e mostra a fila oficial, evitando duas listas diferentes.</p><button type="button" data-aos-mode-destination="inicio">Voltar para a Home</button></section>
      </div>
    </section>`;

  const hydrateLaboratory = async () => {
    const target = document.querySelector('[data-aos-lab-projects]');
    if (!target) return;
    try {
      await loadProjects(true);
      if (target.isConnected) target.innerHTML = projectCards();
    } catch (error) {
      if (target.isConnected) target.innerHTML = `<section class="aos-mode-action-empty"><strong>Não consegui carregar o Laboratório</strong><span>${esc(error.message)}</span><button type="button" data-aos-lab-reload>Tentar novamente</button></section>`;
    }
  };

  const hydratePersonal = async () => {
    const target = document.querySelector('[data-aos-personal-tasks]');
    if (!target) return;
    target.innerHTML = '<div class="aos-mode-loading">Lendo o Radar…</div>';
    try {
      await loadPersonalTasks();
      const page = document.querySelector('[data-aos-mode-page="pessoal"]');
      const label = page?.querySelector('.aos-mode-panel header small');
      const heading = page?.querySelector('.aos-mode-panel header h3');
      if (label) label.textContent = state.personalMode === 'today' ? 'HOJE' : 'RADAR';
      if (heading) heading.textContent = state.personalMode === 'today' ? 'O que pede atenção agora' : 'Próximos focos';
      if (target.isConnected) target.innerHTML = personalTaskMarkup();
    } catch (error) {
      if (target.isConnected) target.innerHTML = `<section class="aos-mode-action-empty compact"><strong>Não consegui ler o Radar</strong><span>${esc(error.message)}</span><button type="button" data-aos-personal-refresh>Tentar novamente</button></section>`;
    }
  };

  const mountModePage = () => {
    const current = hash();
    if (!MODE_HASHES.has(current)) return false;
    const target = content();
    if (!target) return false;
    if (!target.querySelector(`[data-aos-mode-page="${current}"]`)) {
      target.removeAttribute('data-home-page');
      target.innerHTML = current === 'laboratorio' ? laboratoryMarkup() : personalMarkup();
      const heading = title();
      if (heading) heading.textContent = current === 'laboratorio' ? 'Laboratório' : 'Pessoal';
      window.dispatchEvent(new CustomEvent('andre-os:mode-page-rendered', { detail: { mode: current, content: target } }));
    }
    if (current === 'laboratorio') hydrateLaboratory();
    else hydratePersonal();
    return true;
  };

  const openProjectModal = (project = null) => {
    document.querySelector('[data-aos-lab-modal]')?.remove();
    const current = project || { name: '', summary: '', nextStep: '', status: 'explorando' };
    const backdrop = document.createElement('div');
    backdrop.className = 'aos-mode-modal-backdrop';
    backdrop.dataset.aosLabModal = 'true';
    backdrop.innerHTML = `<section class="aos-mode-modal" role="dialog" aria-modal="true"><header><div><small>LABORATÓRIO</small><h2>${project ? 'Editar projeto' : 'Novo projeto'}</h2></div><button type="button" data-aos-lab-close>×</button></header><form data-aos-lab-form data-project-id="${esc(project?.id || '')}">
      <label><span>Nome do projeto</span><input name="name" maxlength="160" value="${esc(current.name)}" placeholder="Ex.: novo produto, experimento, hipótese" required></label>
      <label><span>Estado</span><select name="status"><option value="explorando" ${current.status === 'explorando' ? 'selected' : ''}>Explorando</option><option value="validando" ${current.status === 'validando' ? 'selected' : ''}>Validando</option><option value="executando" ${current.status === 'executando' ? 'selected' : ''}>Executando</option><option value="pausado" ${current.status === 'pausado' ? 'selected' : ''}>Pausado</option></select></label>
      <label><span>Resumo</span><textarea name="summary" maxlength="700" rows="3" placeholder="O que é e o que estamos tentando descobrir?">${esc(current.summary)}</textarea></label>
      <label><span>Próximo passo</span><textarea name="nextStep" maxlength="500" rows="2" placeholder="Qual é a próxima ação ou pergunta?">${esc(current.nextStep)}</textarea></label>
      <div class="aos-mode-form-error" data-aos-lab-error hidden></div>
      <footer>${project ? '<button type="button" class="danger" data-aos-lab-delete>Excluir</button>' : '<span></span>'}<div><button type="button" class="secondary" data-aos-lab-close>Cancelar</button><button type="submit">Salvar projeto</button></div></footer>
    </form></section>`;
    document.body.appendChild(backdrop);
    requestAnimationFrame(() => backdrop.querySelector('input[name="name"]')?.focus());
  };

  const saveProject = async (form) => {
    const data = new FormData(form);
    const project = {
      ...(form.dataset.projectId ? { id: form.dataset.projectId } : {}),
      name: String(data.get('name') || '').trim(),
      status: String(data.get('status') || 'explorando'),
      summary: String(data.get('summary') || '').trim(),
      nextStep: String(data.get('nextStep') || '').trim(),
    };
    const error = form.querySelector('[data-aos-lab-error]');
    const buttons = form.querySelectorAll('button');
    buttons.forEach((button) => { button.disabled = true; });
    try {
      await fetchJson(LAB_API, { method: 'POST', body: JSON.stringify({ project }) });
      document.querySelector('[data-aos-lab-modal]')?.remove();
      state.projectsLoaded = false;
      await hydrateLaboratory();
    } catch (cause) {
      if (error) { error.textContent = cause.message; error.hidden = false; }
      buttons.forEach((button) => { button.disabled = false; });
    }
  };

  const deleteProject = async (form) => {
    const id = form.dataset.projectId;
    if (!id) return;
    const project = state.projects.find((item) => item.id === id);
    if (!window.confirm(`Excluir ${project?.name || 'este projeto'} do Laboratório?`)) return;
    await fetchJson(LAB_API, { method: 'DELETE', body: JSON.stringify({ id }) });
    document.querySelector('[data-aos-lab-modal]')?.remove();
    state.projectsLoaded = false;
    await hydrateLaboratory();
  };

  const schedule = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => requestAnimationFrame(() => {
      ensureSidebarModes();
      if (!mountModePage()) mountLauncher();
    }));
  };

  document.addEventListener('click', (event) => {
    const destination = event.target.closest?.('[data-aos-mode-destination]');
    if (destination) {
      const target = destination.dataset.aosModeDestination;
      if (target === 'planet') location.hash = '#planet';
      else if (target === 'laboratorio') location.hash = '#laboratorio';
      else if (target === 'pessoal') location.hash = '#pessoal';
      else location.hash = '#inicio';
      return;
    }
    if (event.target.closest?.('[data-aos-lab-new]')) { openProjectModal(); return; }
    const edit = event.target.closest?.('[data-aos-lab-edit]');
    if (edit) { const project = state.projects.find((item) => item.id === edit.dataset.aosLabEdit); if (project) openProjectModal(project); return; }
    if (event.target.closest?.('[data-aos-lab-close]') || event.target.matches?.('[data-aos-lab-modal]')) { document.querySelector('[data-aos-lab-modal]')?.remove(); return; }
    const del = event.target.closest?.('[data-aos-lab-delete]');
    if (del) { const form = del.closest('[data-aos-lab-form]'); if (form) deleteProject(form).catch((error) => window.alert(error.message)); return; }
    if (event.target.closest?.('[data-aos-lab-reload]')) { state.projectsLoaded = false; hydrateLaboratory(); return; }
    if (event.target.closest?.('[data-aos-personal-refresh]')) { hydratePersonal(); return; }
  });

  document.addEventListener('submit', (event) => {
    const form = event.target.closest?.('[data-aos-lab-form]');
    if (!form) return;
    event.preventDefault();
    saveProject(form);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') document.querySelector('[data-aos-lab-modal]')?.remove();
  });

  window.addEventListener('hashchange', schedule);
  window.addEventListener('andre-os:home-page-rendered', schedule);
  window.addEventListener('pmh:view-rendered', schedule);
  window.addEventListener('pmh:access-ready', schedule);

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true });
  else schedule();
})();
