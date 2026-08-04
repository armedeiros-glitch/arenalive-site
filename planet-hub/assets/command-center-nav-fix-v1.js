(() => {
  const shell = document.getElementById('pmh-command-center');
  const root = document.getElementById('root');
  if (!shell) return;

  const content = shell.querySelector('[data-pmh-content]');
  const title = shell.querySelector('[data-pmh-title]');
  const search = shell.querySelector('.pmh-cc-search');
  const IMPLANTATIONS_API = '/api/sults/implantacoes?start=0&limit=100';
  const TRACKED_KEY = 'planet-hub-inaugurations-v2';
  const LEGACY_KEY = 'planet-hub-implantations-v1';

  const checklistTemplate = [
    { action: 'Número de telefone para redes sociais', owner: 'Franqueado', daysBefore: 30 },
    { action: 'Criação/ajuste do Instagram', owner: 'Franqueado', daysBefore: 30 },
    { action: 'Criação/ajuste do Facebook', owner: 'Franqueado', daysBefore: 30 },
    { action: 'Google Meu Negócio', owner: 'Franqueado', daysBefore: 30 },
    { action: 'Vídeo de inauguração', owner: 'Franqueadora', daysBefore: 20 },
    { action: 'Enviar @ dos influenciadores', owner: 'Franqueado', daysBefore: 20 },
    { action: 'Contratar influenciadores', owner: 'Franqueado', daysBefore: 15 },
    { action: 'Contratar Social Media para inauguração', owner: 'Franqueado', daysBefore: 15 },
    { action: 'Contratar ornamentação / arco de bolas', owner: 'Franqueado', daysBefore: 15 },
    { action: 'Aprovar artes inaugurais', owner: 'Franqueadora', daysBefore: 12 },
    { action: 'Fazer 1000 panfletos', owner: 'Franqueado', daysBefore: 10 },
    { action: 'Entregar panfletos para lojistas', owner: 'Franqueado', daysBefore: 7 },
    { action: 'Configurar tráfego pago', owner: 'Franqueadora', daysBefore: 7 },
    { action: 'Separar brindes/cupons', owner: 'Franqueado', daysBefore: 5 },
    { action: 'Conferência final da operação', owner: 'Franqueadora', daysBefore: 3 },
  ];

  const labels = {
    inauguracoes: 'Inaugurações',
    calendario: 'Calendário de campanhas',
    conteudos: 'Conteúdos',
  };

  const patterns = {
    calendario: [/campanha/, /calend/],
    conteudos: [/conte[uú]do/, /biblioteca/, /materiais/],
  };

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[character]));

  const dateValue = (value) => {
    if (!value) return null;
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const dateInput = (value) => {
    const date = dateValue(value);
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDate = (value) => {
    const date = dateValue(value);
    if (!date) return 'Sem data prevista';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      timeZone: 'America/Sao_Paulo',
    }).format(date);
  };

  const daysUntil = (value) => {
    const date = dateValue(value);
    if (!date) return Number.POSITIVE_INFINITY;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((date.getTime() - today.getTime()) / 86400000);
  };

  const fullMode = new URLSearchParams(window.location.search).get('full') === '1';
  if (fullMode) {
    document.body.classList.remove('pmh-command-mode');
    shell.hidden = true;
    root?.removeAttribute('aria-hidden');
    return;
  }

  const normalizeKey = (key) => key === 'campanhas' ? 'calendario' : key;

  const setActive = (key) => {
    const normalizedKey = normalizeKey(key);
    shell.querySelectorAll('.pmh-cc-sidebar nav button').forEach((button) => {
      const openKey = normalizeKey(button.dataset.pmhOpen);
      button.classList.toggle('is-active', openKey === normalizedKey);
    });
  };

  const prepareArea = (key) => {
    document.body.classList.add('pmh-command-mode');
    shell.hidden = false;
    root?.setAttribute('aria-hidden', 'true');
    setActive(key);
    if (search) search.hidden = true;
    if (title) title.textContent = labels[key];
  };

  const makeChecklist = () => checklistTemplate.map((item) => ({ ...item, done: false }));

  const readTracked = () => {
    try {
      const current = JSON.parse(window.localStorage.getItem(TRACKED_KEY) || '[]');
      if (Array.isArray(current) && current.length) return current;

      const legacy = JSON.parse(window.localStorage.getItem(LEGACY_KEY) || '[]');
      if (!Array.isArray(legacy) || !legacy.length) return [];

      const migrated = legacy.map((item) => ({
        id: item.id || `inauguration-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        sourceProjectId: item.sultsProjectId || null,
        unit: item.unit || 'Unidade sem nome',
        responsible: item.franchisee || item.responsible || '',
        location: item.location || '',
        openingDate: item.openingDate || '',
        createdAt: item.createdAt || new Date().toISOString(),
        checklist: makeChecklist().map((check, index) => ({
          ...check,
          done: Array.isArray(item.checklistDone) && item.checklistDone.includes(index),
        })),
      }));
      window.localStorage.setItem(TRACKED_KEY, JSON.stringify(migrated));
      return migrated;
    } catch (_) {
      return [];
    }
  };

  const writeTracked = (items) => {
    window.localStorage.setItem(TRACKED_KEY, JSON.stringify(items));
  };

  let projectsCache = null;
  let projectsPromise = null;

  const ensureProjects = async () => {
    if (projectsCache) return projectsCache;
    if (projectsPromise) return projectsPromise;

    projectsPromise = fetch(IMPLANTATIONS_API, { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Falha ao consultar implantações');
        projectsCache = Array.isArray(payload.data) ? payload.data : [];
        return projectsCache;
      })
      .finally(() => { projectsPromise = null; });

    return projectsPromise;
  };

  const trackedUpcoming = (items) => items.filter((item) => {
    const days = daysUntil(item.openingDate);
    return days >= 0 && days <= 45;
  });

  const dueDateFor = (openingDate, daysBefore) => {
    const date = dateValue(openingDate);
    if (!date) return null;
    date.setDate(date.getDate() - Number(daysBefore || 0));
    return date;
  };

  const checklistStatus = (item, openingDate) => {
    if (item.done) return ['Concluído', 'is-done'];
    const due = dueDateFor(openingDate, item.daysBefore);
    if (!due) return ['Sem prazo', ''];
    const days = daysUntil(due);
    if (days < 0) return ['Atrasado', 'is-late'];
    if (days <= 5) return ['Atenção', 'is-warning'];
    return ['Em dia', 'is-ok'];
  };

  const checklistSummary = (tracked) => {
    let pending = 0;
    let late = 0;
    tracked.forEach((inauguration) => {
      (inauguration.checklist || []).forEach((item) => {
        if (item.done) return;
        pending += 1;
        if (checklistStatus(item, inauguration.openingDate)[1] === 'is-late') late += 1;
      });
    });
    return { pending, late };
  };

  const projectStatus = (item) => {
    if (item.completed) return ['CONCLUÍDA', 'is-completed'];
    if (item.paused) return ['PAUSADA', 'is-paused'];
    if (item.active !== false) return ['ATIVA', ''];
    return ['INATIVA', 'is-inactive'];
  };

  const renderProjects = (projects, tracked) => {
    if (!projects.length) {
      return '<div class="pmh-implant-command-empty">Nenhuma implantação encontrada no SULTS.</div>';
    }

    const trackedIds = new Set(tracked.map((item) => String(item.sourceProjectId || '')));
    const sorted = [...projects].sort((a, b) => {
      const statusWeight = (item) => item.completed ? 3 : item.paused ? 2 : item.active === false ? 1 : 0;
      const weightDiff = statusWeight(a) - statusWeight(b);
      if (weightDiff) return weightDiff;
      return String(a.unit || a.projectName || '').localeCompare(String(b.unit || b.projectName || ''), 'pt-BR');
    });

    return `<div class="pmh-implant-command-list">${sorted.map((item) => {
      const [status, statusClass] = projectStatus(item);
      const projectId = String(item.sultsProjectId || item.id || '');
      const isTracked = trackedIds.has(projectId);
      const unit = item.unit || item.projectName || 'Unidade sem nome';
      const context = [item.category, item.model].filter(Boolean).join(' · ') || 'Projeto de implantação';
      return `
        <article class="pmh-implant-command-card">
          <div>
            <header>
              <span class="${statusClass}">${status}</span>
              ${isTracked ? '<span class="is-tracked">CHECKLIST ATIVO</span>' : ''}
            </header>
            <h3>${esc(unit)}</h3>
            <p>${esc(context)}<br>Responsável: ${esc(item.responsible || 'Não informado')}</p>
          </div>
          <aside>
            <strong>${esc(formatDate(item.endDate || item.startDate))}</strong>
            <span>Data do projeto no SULTS</span>
          </aside>
          ${item.attentionNote ? `<div class="pmh-implant-command-note">Atenção: ${esc(item.attentionNote)}</div>` : ''}
        </article>`;
    }).join('')}</div>`;
  };

  const renderTracked = (tracked) => {
    if (!tracked.length) {
      return '<div class="pmh-implant-command-empty">Nenhuma inauguração em acompanhamento. Use “Nova inauguração” para iniciar um checklist.</div>';
    }

    const sorted = [...tracked].sort((a, b) => dateValue(a.openingDate) - dateValue(b.openingDate));
    return `<div class="pmh-tracked-list">${sorted.map((inauguration) => {
      const checks = Array.isArray(inauguration.checklist) && inauguration.checklist.length
        ? inauguration.checklist
        : makeChecklist();
      const completed = checks.filter((item) => item.done).length;
      const progress = Math.round((completed / checks.length) * 100);
      return `
        <article class="pmh-tracked-card">
          <header>
            <div><small>INAUGURAÇÃO EM ACOMPANHAMENTO</small><h3>${esc(inauguration.unit)}</h3><p>${esc(inauguration.location || 'Local não informado')} · ${esc(inauguration.responsible || 'Responsável não informado')}</p></div>
            <div class="pmh-tracked-date"><strong>${esc(formatDate(inauguration.openingDate))}</strong><span>${completed}/${checks.length} concluídas</span></div>
          </header>
          <div class="pmh-progress"><i style="width:${progress}%"></i></div>
          <div class="pmh-progress-label"><span>${progress}% concluído</span><b>${checks.length - completed} pendências</b></div>
          <details>
            <summary>Ver checklist de 15 etapas</summary>
            <div class="pmh-checklist">${checks.map((item, index) => {
              const [status, statusClass] = checklistStatus(item, inauguration.openingDate);
              const due = dueDateFor(inauguration.openingDate, item.daysBefore);
              return `
                <label class="${item.done ? 'is-completed' : ''}">
                  <input type="checkbox" data-pmh-check-inauguration="${esc(inauguration.id)}" data-pmh-check-index="${index}" ${item.done ? 'checked' : ''}>
                  <span><strong>${esc(item.action)}</strong><small>${esc(item.owner)} · D-${item.daysBefore} · ${esc(formatDate(due))}</small></span>
                  <em class="${statusClass}">${status}</em>
                </label>`;
            }).join('')}</div>
          </details>
        </article>`;
    }).join('')}</div>`;
  };

  const patchHomeMetrics = async () => {
    const welcome = content.querySelector('.pmh-cc-welcome');
    if (!welcome) return;

    try {
      const projects = await ensureProjects();
      const tracked = readTracked();
      const upcoming = trackedUpcoming(tracked).length;

      content.querySelectorAll('.pmh-cc-metric').forEach((card) => {
        const label = normalize(card.querySelector('small')?.textContent);
        if (label === 'implantacoes ativas' || label === 'implantacoes no sults') {
          const small = card.querySelector('small');
          const strong = card.querySelector('strong');
          const span = card.querySelector('span');
          if (small && small.textContent !== 'Implantações no SULTS') small.textContent = 'Implantações no SULTS';
          if (strong && strong.textContent !== String(projects.length)) strong.textContent = String(projects.length);
          if (span && span.textContent !== 'Projetos cadastrados') span.textContent = 'Projetos cadastrados';
        }
        if (label === 'proximas inauguracoes') {
          const strong = card.querySelector('strong');
          const span = card.querySelector('span');
          if (strong && strong.textContent !== String(upcoming)) strong.textContent = String(upcoming);
          if (span && span.textContent !== 'Checklists nos próximos 45 dias') span.textContent = 'Checklists nos próximos 45 dias';
        }
      });
    } catch (_) {}
  };

  let modal = null;

  const ensureModal = (projects) => {
    if (modal) return modal;

    modal = document.createElement('div');
    modal.className = 'pmh-inauguration-modal';
    modal.hidden = true;
    modal.innerHTML = `
      <section class="pmh-inauguration-dialog" role="dialog" aria-modal="true" aria-labelledby="pmh-new-inauguration-title">
        <header>
          <div><small>NOVA INAUGURAÇÃO</small><h2 id="pmh-new-inauguration-title">Iniciar checklist inaugural</h2><p>Escolha uma implantação do SULTS ou faça um cadastro manual.</p></div>
          <button type="button" data-pmh-close-inauguration aria-label="Fechar">×</button>
        </header>
        <form>
          <label class="pmh-field-wide">Implantação do SULTS<select name="projectId"><option value="">Cadastro manual</option></select></label>
          <label>Unidade<input name="unit" required></label>
          <label>Data real da inauguração<input name="openingDate" type="date" required></label>
          <label>Responsável<input name="responsible"></label>
          <label>Shopping / local<input name="location"></label>
          <p>A data do projeto no SULTS não será tratada automaticamente como inauguração. Aqui você informa a data real e cria o checklist.</p>
          <footer><button type="button" data-pmh-close-inauguration>Cancelar</button><button type="submit">Criar inauguração</button></footer>
        </form>
      </section>`;
    document.body.appendChild(modal);

    const select = modal.querySelector('select[name="projectId"]');
    const sortedProjects = [...projects].sort((a, b) =>
      String(a.unit || a.projectName || '').localeCompare(String(b.unit || b.projectName || ''), 'pt-BR'),
    );
    select.insertAdjacentHTML('beforeend', sortedProjects.map((item) => {
      const id = String(item.sultsProjectId || item.id || '');
      return `<option value="${esc(id)}">${esc(item.unit || item.projectName || 'Unidade sem nome')}</option>`;
    }).join(''));

    const fillProject = (projectId) => {
      const item = projects.find((project) => String(project.sultsProjectId || project.id || '') === String(projectId));
      if (!item) return;
      modal.querySelector('input[name="unit"]').value = item.unit || item.projectName || '';
      modal.querySelector('input[name="openingDate"]').value = '';
      modal.querySelector('input[name="responsible"]').value = item.responsible || '';
      modal.querySelector('input[name="location"]').value = item.category || item.model || '';
    };

    select.addEventListener('change', () => fillProject(select.value));
    modal.querySelectorAll('[data-pmh-close-inauguration]').forEach((button) => {
      button.addEventListener('click', () => {
        modal.hidden = true;
        document.body.style.overflow = '';
      });
    });
    modal.addEventListener('click', (event) => {
      if (event.target === modal) {
        modal.hidden = true;
        document.body.style.overflow = '';
      }
    });

    modal.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const data = new FormData(form);
      const projectId = String(data.get('projectId') || '');
      const tracked = readTracked();
      const existing = projectId && tracked.find((item) => String(item.sourceProjectId || '') === projectId);
      if (existing) {
        window.alert('Essa unidade já possui um checklist ativo.');
        return;
      }

      tracked.unshift({
        id: `inauguration-${Date.now()}`,
        sourceProjectId: projectId || null,
        unit: String(data.get('unit') || '').trim(),
        openingDate: String(data.get('openingDate') || ''),
        responsible: String(data.get('responsible') || '').trim(),
        location: String(data.get('location') || '').trim(),
        createdAt: new Date().toISOString(),
        checklist: makeChecklist(),
      });
      writeTracked(tracked);
      modal.hidden = true;
      document.body.style.overflow = '';
      openImplantations(false);
      patchHomeMetrics();
    });

    return modal;
  };

  const openNewInauguration = async () => {
    try {
      const projects = await ensureProjects();
      const dialog = ensureModal(projects);
      dialog.querySelector('form').reset();
      dialog.hidden = false;
      document.body.style.overflow = 'hidden';
      window.setTimeout(() => dialog.querySelector('select')?.focus(), 20);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    }
  };

  const openImplantations = async (updateUrl = true) => {
    prepareArea('inauguracoes');
    content.classList.remove('pmh-cc-embedded');
    content.innerHTML = `
      <section class="pmh-implant-command">
        <header class="pmh-implant-command-head">
          <div><small>IMPLANTAÇÕES E INAUGURAÇÕES</small><h2>Unidades no radar do Marketing</h2><p>As implantações ficam como referência. Só vira inauguração acompanhada quando você adicionar pelo botão.</p></div>
          <a role="button" tabindex="0" data-pmh-new-inauguration>＋ Nova inauguração</a>
        </header>
        <div class="pmh-implant-command-loading">Sincronizando implantações com o SULTS…</div>
      </section>`;

    if (updateUrl) history.replaceState(null, '', '#nucleo/inauguracoes');

    try {
      const projects = await ensureProjects();
      const tracked = readTracked();
      const upcoming = trackedUpcoming(tracked);
      const summary = checklistSummary(tracked);
      const page = content.querySelector('.pmh-implant-command');
      if (!page) return;
      page.querySelector('.pmh-implant-command-loading')?.remove();
      page.insertAdjacentHTML('beforeend', `
        <section class="pmh-implant-command-summary">
          <article><small>IMPLANTAÇÕES NO SULTS</small><strong>${projects.length}</strong><span>Todos os projetos cadastrados</span></article>
          <article><small>EM ACOMPANHAMENTO</small><strong>${tracked.length}</strong><span>Checklists ativos</span></article>
          <article><small>PRÓXIMAS INAUGURAÇÕES</small><strong>${upcoming.length}</strong><span>Nos próximos 45 dias</span></article>
          <article><small>ATRASADAS</small><strong>${summary.late}</strong><span>Etapas que precisam de ação</span></article>
        </section>
        <section class="pmh-inauguration-section"><header><div><small>REFERÊNCIA SULTS</small><h3>Todas as implantações</h3></div><span>${projects.length} projetos</span></header>${renderProjects(projects, tracked)}</section>
        <section class="pmh-inauguration-section"><header><div><small>ACOMPANHAMENTO REAL</small><h3>Checklists inaugurais</h3></div><span>${tracked.length} ativos</span></header>${renderTracked(tracked)}</section>`);
    } catch (error) {
      const loading = content.querySelector('.pmh-implant-command-loading');
      if (loading) {
        loading.className = 'pmh-implant-command-error';
        loading.textContent = error instanceof Error ? error.message : String(error);
      }
    }
  };

  const findTarget = (doc, key) => {
    const normalizedKey = normalizeKey(key);
    const candidates = [...doc.querySelectorAll('#root button, #root a')];
    return candidates.find((node) => {
      const text = normalize(node.textContent);
      return (patterns[normalizedKey] || []).some((pattern) => pattern.test(text));
    });
  };

  const navigateFrame = (frame, key) => {
    let attempts = 0;
    const normalizedKey = normalizeKey(key);
    const tryNavigate = () => {
      attempts += 1;
      try {
        const doc = frame.contentDocument;
        const target = doc && findTarget(doc, normalizedKey);
        if (target) {
          target.click();
          return;
        }
      } catch (error) {
        console.warn('Planet Hub: não foi possível acessar a página incorporada', error);
      }
      if (attempts < 30) window.setTimeout(tryNavigate, 120);
      else {
        try {
          frame.contentWindow.location.hash = normalizedKey === 'calendario' ? '#campanhas' : `#${normalizedKey}`;
        } catch (_) {}
      }
    };
    tryNavigate();
  };

  const openEmbedded = (key, updateUrl = true) => {
    const normalizedKey = normalizeKey(key);
    if (!labels[normalizedKey]) return;
    if (normalizedKey === 'inauguracoes') {
      openImplantations(updateUrl);
      return;
    }

    prepareArea(normalizedKey);
    content.classList.add('pmh-cc-embedded');
    content.innerHTML = '<div class="pmh-cc-embed-loading">Abrindo área do Marketing Hub…</div>';

    const frame = document.createElement('iframe');
    frame.className = 'pmh-cc-embedded-frame';
    frame.title = labels[normalizedKey];
    frame.src = normalizedKey === 'calendario'
      ? '/planet-hub/embed.html#campanhas'
      : `/planet-hub/embed.html#${normalizedKey}`;
    frame.addEventListener('load', () => navigateFrame(frame, normalizedKey));
    content.replaceChildren(frame);

    if (updateUrl) history.replaceState(null, '', `#nucleo/${normalizedKey}`);
  };

  shell.addEventListener('click', (event) => {
    const newInauguration = event.target.closest('[data-pmh-new-inauguration]');
    if (newInauguration) {
      event.preventDefault();
      event.stopImmediatePropagation();
      openNewInauguration();
      return;
    }

    const openButton = event.target.closest('[data-pmh-open]');
    if (!openButton) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const key = normalizeKey(openButton.dataset.pmhOpen);
    if (key === 'hub') {
      window.location.href = '/planet-hub/?full=1';
      return;
    }
    openEmbedded(key);
  }, true);

  shell.addEventListener('change', (event) => {
    const checkbox = event.target.closest('[data-pmh-check-inauguration]');
    if (!checkbox) return;
    const tracked = readTracked();
    const inauguration = tracked.find((item) => String(item.id) === String(checkbox.dataset.pmhCheckInauguration));
    const index = Number.parseInt(checkbox.dataset.pmhCheckIndex || '', 10);
    if (!inauguration || !Number.isInteger(index) || !inauguration.checklist?.[index]) return;
    inauguration.checklist[index].done = checkbox.checked;
    writeTracked(tracked);
    openImplantations(false);
    patchHomeMetrics();
  });

  shell.addEventListener('click', (event) => {
    const viewButton = event.target.closest('[data-pmh-view]');
    if (!viewButton) return;
    content.classList.remove('pmh-cc-embedded');
    if (viewButton.dataset.pmhView === 'inicio') history.replaceState(null, '', '#nucleo/inicio');
    if (viewButton.dataset.pmhView === 'chamados') history.replaceState(null, '', '#nucleo/chamados');
  }, true);

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.data?.type !== 'pmh-native-ready') return;
    const frame = content.querySelector('.pmh-cc-embedded-frame');
    const route = normalizeKey(window.location.hash.match(/^#nucleo\/(.+)$/)?.[1]);
    if (frame && labels[route] && route !== 'inauguracoes') navigateFrame(frame, route);
  });

  const contentObserver = new MutationObserver(() => patchHomeMetrics());
  contentObserver.observe(content, { childList: true, subtree: true });
  ensureProjects().then(patchHomeMetrics).catch(() => {});

  let initialRoute = normalizeKey(window.location.hash.match(/^#nucleo\/(.+)$/)?.[1]);
  if (initialRoute === 'campanhas') initialRoute = 'calendario';
  if (labels[initialRoute]) window.setTimeout(() => openEmbedded(initialRoute, false), 0);
})();
