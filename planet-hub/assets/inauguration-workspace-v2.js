(() => {
  'use strict';

  const OLD_CHECKLIST_LABEL = 'Separar brindes/cupons';
  const NEW_CHECKLIST_LABEL = '50 potes P para degustação';
  const TRACKED_KEY = 'planet-hub-inaugurations-v2';
  const DESKTOP = window.matchMedia('(min-width: 821px)');

  let selectedProjectId = '';
  let selectedTab = 'summary';

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const currencyNumber = (value) => {
    const normalized = String(value || '')
      .replace(/[^\d,.-]/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    return Number(normalized) || 0;
  };

  const summaryValue = (finance, label) => {
    const target = normalize(label);
    const card = [...(finance?.querySelectorAll('article') || [])]
      .find((entry) => normalize(entry.querySelector('small')?.textContent) === target);
    return card?.querySelector('strong')?.textContent?.trim() || '';
  };

  const checklistDetails = (card) => [...card.children]
    .find((child) => child.tagName === 'DETAILS' && !child.classList.contains('pmh-actions'));

  const projectIdFromCard = (card) => String(
    card.querySelector('[data-item]')?.dataset.item
      || card.querySelector('[data-inauguration-workspace]')?.dataset.inaugurationWorkspace
      || '',
  );

  const replaceChecklistLabel = (checklist) => {
    checklist.querySelectorAll('strong').forEach((label) => {
      if (normalize(label.textContent) === normalize(OLD_CHECKLIST_LABEL)) {
        label.textContent = NEW_CHECKLIST_LABEL;
      }
    });
  };

  const ensureOverrideStyles = () => {
    if (!document.head?.appendChild || document.querySelector('style[data-inauguration-checklist-overrides]')) return;
    const style = document.createElement('style');
    style.dataset.inaugurationChecklistOverrides = '1';
    style.textContent = `
      .pmh-checklist-override{margin:-3px 0 7px 38px;padding:0;border:1px solid var(--os-border);border-radius:10px;background:var(--os-surface-subtle)}
      .pmh-checklist-override>summary{padding:7px 10px;color:var(--os-text-muted);font-size:10px;font-weight:800;cursor:pointer;list-style:none}
      .pmh-checklist-override>summary::-webkit-details-marker{display:none}
      .pmh-checklist-override.is-customized>summary{color:var(--os-accent)}
      .pmh-checklist-override-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;padding:0 10px 9px}
      .pmh-checklist-override-grid>div>small,.pmh-checklist-override-grid>div>em{display:block}
      .pmh-checklist-override-grid>div>small{margin-bottom:4px;color:var(--os-text-faint);font-size:8px;font-weight:900;letter-spacing:.06em}
      .pmh-checklist-override-grid>div>div{display:flex;gap:5px}
      .pmh-checklist-override-grid input{min-width:0;width:100%;height:32px;padding:0 8px;border:1px solid var(--os-border);border-radius:8px;color:var(--os-text);background:var(--os-surface);font:inherit;font-size:11px}
      .pmh-checklist-override-grid button{height:32px;padding:0 8px;border:1px solid var(--os-border);border-radius:8px;color:var(--os-text-muted);background:var(--os-surface);font-size:9px;font-weight:800;cursor:pointer}
      .pmh-checklist-override-grid>div>em{margin-top:4px;color:var(--os-text-faint);font-size:8px;font-style:normal}
      .pmh-checklist-save-status{min-height:14px;margin:0;padding:0 10px 8px;color:var(--os-text-faint);font-size:9px}
      .pmh-checklist-save-status.saving{color:var(--os-text-muted)}
      .pmh-checklist-save-status.saved{color:var(--os-success,#2f9e62)}
      .pmh-checklist-save-status.error{color:var(--os-danger)}
      @media(max-width:820px){.pmh-checklist-override{margin-left:30px}.pmh-checklist-override-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  };

  const readTracked = () => {
    try {
      const items = JSON.parse(window.localStorage.getItem(TRACKED_KEY) || '[]');
      return Array.isArray(items) ? items : [];
    } catch (_) {
      return [];
    }
  };

  const trackedProject = (itemId) => readTracked()
    .find((item) => String(item?.id || '') === String(itemId || '')) || null;

  const displayChecklistAction = (value) => normalize(value) === normalize(OLD_CHECKLIST_LABEL)
    ? NEW_CHECKLIST_LABEL
    : String(value || 'Etapa sem nome');

  const checklistDueDate = (item, step) => {
    if (step?.dueDate) {
      const override = new Date(`${String(step.dueDate).slice(0, 10)}T12:00:00`);
      if (!Number.isNaN(override.getTime())) return override;
    }
    if (!item?.openingDate || !Number.isFinite(Number(step?.daysBefore))) return null;
    const opening = new Date(`${String(item.openingDate).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(opening.getTime())) return null;
    opening.setDate(opening.getDate() - Number(step.daysBefore));
    return opening;
  };

  const formatStepDate = (date) => date
    ? new Intl.DateTimeFormat('pt-BR').format(date)
    : '';

  const nextChecklistStep = (item) => {
    const checklist = Array.isArray(item?.checklist) ? item.checklist : [];
    const pending = checklist.filter((step) => !step?.done);
    if (!pending.length) return { state: 'completed', action: 'Checklist concluído', owner: '', due: '' };

    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const overdue = pending.find((step) => {
      const dueDate = checklistDueDate(item, step);
      return dueDate && dueDate.getTime() < today.getTime();
    });
    const step = overdue || pending[0];
    const dueDate = checklistDueDate(item, step);
    return {
      state: overdue ? 'overdue' : 'pending',
      action: displayChecklistAction(step?.action),
      owner: String(step?.ownerOverride || step?.owner || ''),
      due: formatStepDate(dueDate),
    };
  };

  const projectNextStep = (itemId) => {
    const item = trackedProject(itemId);
    return item ? nextChecklistStep(item) : null;
  };

  const nextStepMarkup = (step, mode = 'summary') => {
    if (!step) return '';
    const completed = step.state === 'completed';
    const overdue = step.state === 'overdue';
    const label = completed
      ? 'CHECKLIST'
      : overdue
        ? 'ETAPA ATRASADA'
        : mode === 'list' ? 'PRÓXIMA ETAPA' : 'PRÓXIMA ETAPA';
    const meta = [step.owner ? `Responsável: ${step.owner}` : '', step.due ? `Prazo: ${step.due}` : '']
      .filter(Boolean)
      .join(' · ');
    return `<small>${esc(label)}</small><strong>${esc(step.action)}</strong>${meta ? `<span>${esc(meta)}</span>` : ''}`;
  };

  const applyNextStep = (node, step, mode) => {
    if (!node || !step) return;
    node.classList.toggle('is-overdue', step.state === 'overdue');
    node.classList.toggle('is-completed', step.state === 'completed');
    node.innerHTML = nextStepMarkup(step, mode);
  };

  const refreshProjectNextStep = (itemId) => {
    const step = projectNextStep(itemId);
    if (!step) return;
    document.querySelectorAll('[data-inauguration-next-step]').forEach((node) => {
      if (String(node.dataset.inaugurationNextStep || '') !== String(itemId)) return;
      applyNextStep(node, step, node.dataset.inaugurationNextStepMode || 'summary');
    });
  };

  const buildFinanceButton = ({ itemId, unit, planned, actual, balance, unitCost }) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'aos-thinking-floating-trigger pmh-inauguration-finance-access';
    button.style.display = 'grid';
    button.style.placeItems = 'center';
    button.style.padding = '0';
    button.style.lineHeight = '1';
    button.dataset.inaugurationFinanceOpen = itemId;
    button.dataset.inaugurationUnit = unit;
    button.dataset.financePlanned = planned;
    button.dataset.financeActual = actual;
    button.dataset.financeBalance = balance;
    button.dataset.financeActualValue = String(currencyNumber(actual));
    button.dataset.financeUnitCost = unitCost;
    button.setAttribute('aria-label', `Abrir financeiro da implantação ${unit}`);
    button.title = `Financeiro · ${unit}`;
    button.innerHTML = '<span class="aos-thinking-orb" aria-hidden="true"><span class="pmh-finance-glyph">$</span></span>';

    const glyph = button.querySelector('.pmh-finance-glyph');
    if (glyph) {
      glyph.style.display = 'grid';
      glyph.style.placeItems = 'center';
      glyph.style.width = '100%';
      glyph.style.height = '100%';
      glyph.style.margin = '0';
      glyph.style.color = '#39e58c';
      glyph.style.fontSize = '16px';
      glyph.style.fontWeight = '900';
      glyph.style.lineHeight = '1';
      glyph.style.transform = 'translateY(-1px)';
    }

    return button;
  };

  const buildSummaryPanel = ({ card, checklist, planned, actual, balance, itemId }) => {
    const progress = card.querySelector('.pmh-progress-label b')?.textContent?.trim() || '0%';
    const progressText = card.querySelector('.pmh-progress-label span')?.textContent?.trim() || 'Sem etapas';
    const opening = card.querySelector('.pmh-date strong')?.textContent?.trim() || 'Sem data';
    const countdown = card.querySelector('.pmh-date span')?.textContent?.trim() || 'Sem contagem';
    const owner = card.querySelector(':scope > header p')?.textContent?.trim() || 'Responsável não definido';
    const total = checklist.querySelectorAll(':scope > label').length || checklist.querySelectorAll('label').length;
    const done = checklist.querySelectorAll(':scope > label.done').length || checklist.querySelectorAll('label.done').length;
    const pending = Math.max(0, total - done);
    const nextStep = projectNextStep(itemId);

    const panel = document.createElement('section');
    panel.className = 'pmh-inauguration-project-summary';
    panel.dataset.inaugurationPanel = 'summary';
    panel.innerHTML = `
      <div class="pmh-inauguration-summary-grid">
        <article><small>PROGRESSO</small><strong>${progress}</strong><span>${progressText}</span></article>
        <article><small>ABERTURA</small><strong>${opening}</strong><span>${countdown}</span></article>
        <article><small>PENDÊNCIAS</small><strong>${pending}</strong><span>etapas ainda abertas</span></article>
        <article><small>SALDO DO PACOTE</small><strong>${balance || '—'}</strong><span>${actual || '—'} gasto · ${planned || '—'} planejado</span></article>
      </div>
      ${nextStep ? `<div class="pmh-inauguration-summary-next ${nextStep.state === 'overdue' ? 'is-overdue' : ''} ${nextStep.state === 'completed' ? 'is-completed' : ''}" data-inauguration-next-step="${esc(itemId)}" data-inauguration-next-step-mode="summary">${nextStepMarkup(nextStep, 'summary')}</div>` : ''}
      <div class="pmh-inauguration-summary-owner"><small>RESPONSÁVEL / LOCAL</small><strong>${owner}</strong></div>`;
    return panel;
  };

  const activateTab = (card, tab = 'summary') => {
    const safeTab = ['summary', 'checklist'].includes(tab) ? tab : 'summary';
    selectedTab = safeTab;
    card.querySelectorAll('[data-inauguration-tab]').forEach((button) => {
      button.classList.toggle('active', button.dataset.inaugurationTab === safeTab);
    });
    card.querySelector('[data-inauguration-panel="summary"]')?.toggleAttribute('hidden', safeTab !== 'summary');
    card.querySelector('[data-inauguration-panel="checklist"]')?.toggleAttribute('hidden', safeTab !== 'checklist');
  };

  const upgradeCard = (card) => {
    if (card.dataset.inaugurationWorkspace === 'v3') return;

    const details = checklistDetails(card);
    const checklist = details?.querySelector('.pmh-checklist');
    const actions = [...card.children].find((child) => child.classList?.contains('pmh-actions'));
    const itemInput = checklist?.querySelector('[data-item]');
    const itemId = String(itemInput?.dataset.item || '');
    if (!details || !checklist || !itemId) return;

    replaceChecklistLabel(checklist);

    const unit = card.querySelector(':scope > header h3')?.textContent?.trim() || 'Implantação';
    const finance = actions?.querySelector('.pmh-finance');
    const budgetInput = finance?.querySelector('[data-budget]') || null;
    const planned = summaryValue(finance, 'Planejado');
    const actual = summaryValue(finance, 'Gasto');
    const balance = summaryValue(finance, 'Saldo');
    const unitCost = summaryValue(finance, 'Custo da unidade');
    const progress = card.querySelector('.pmh-progress-label')?.textContent?.replace(/\s+/g, ' ').trim() || '';

    const financeButton = buildFinanceButton({ itemId, unit, planned, actual, balance, unitCost });

    const tabs = document.createElement('nav');
    tabs.className = 'pmh-inauguration-project-tabs';
    tabs.setAttribute('aria-label', `Seções da implantação ${unit}`);
    tabs.innerHTML = `
      <button type="button" class="active" data-inauguration-tab="summary">Visão geral</button>
      <button type="button" data-inauguration-tab="checklist">Checklist</button>
      <button type="button" data-inauguration-tab="finance">Financeiro</button>`;

    const summaryPanel = buildSummaryPanel({ card, checklist, planned, actual, balance, itemId });

    const workspace = document.createElement('section');
    workspace.className = 'pmh-inauguration-workspace';
    workspace.dataset.inaugurationWorkspace = itemId;
    workspace.dataset.inaugurationPanel = 'checklist';
    workspace.hidden = true;

    const toolbar = document.createElement('div');
    toolbar.className = 'pmh-inauguration-workspace-bar';
    toolbar.innerHTML = `<div class="pmh-inauguration-workspace-title"><i aria-hidden="true">☑️</i><div><strong>Checklist</strong><small>${progress}</small></div></div>`;
    toolbar.appendChild(financeButton);

    workspace.append(toolbar, checklist);

    if (budgetInput) {
      budgetInput.hidden = true;
      budgetInput.classList.add('pmh-finance-budget-bridge');
      workspace.appendChild(budgetInput);
    }

    details.replaceWith(tabs, summaryPanel, workspace);
    actions?.remove();
    card.dataset.inaugurationWorkspace = 'v3';
    card.dataset.inaugurationProjectId = itemId;
    activateTab(card, selectedTab);
  };

  const projectSummary = (card) => {
    const itemId = projectIdFromCard(card);
    const unit = card.querySelector(':scope > header h3')?.textContent?.trim() || 'Implantação';
    const subtitle = card.querySelector(':scope > header p')?.textContent?.trim() || 'Sem responsável';
    const opening = card.querySelector('.pmh-date strong')?.textContent?.trim() || 'Sem data';
    const countdown = card.querySelector('.pmh-date span')?.textContent?.trim() || 'Sem contagem';
    const progress = card.querySelector('.pmh-progress-label b')?.textContent?.trim() || '0%';
    const progressText = card.querySelector('.pmh-progress-label span')?.textContent?.trim() || 'Sem etapas';
    const width = card.querySelector('.pmh-progress i')?.style.width || progress;
    const nextStep = projectNextStep(itemId);
    return { itemId, unit, subtitle, opening, countdown, progress, progressText, width, nextStep };
  };

  const buildProjectRow = (card) => {
    const itemId = projectIdFromCard(card);
    const data = projectSummary(card);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pmh-inauguration-project-row';
    button.dataset.inaugurationOpen = itemId;
    button.innerHTML = `
      <div class="pmh-inauguration-project-row-main">
        <small>EM IMPLANTAÇÃO</small>
        <strong>${data.unit}</strong>
        <span>${data.subtitle}</span>
        ${data.nextStep ? `<div class="pmh-inauguration-project-row-next ${data.nextStep.state === 'overdue' ? 'is-overdue' : ''} ${data.nextStep.state === 'completed' ? 'is-completed' : ''}" data-inauguration-next-step="${esc(itemId)}" data-inauguration-next-step-mode="list">${nextStepMarkup(data.nextStep, 'list')}</div>` : ''}
      </div>
      <div class="pmh-inauguration-project-row-progress">
        <div><span>Progresso</span><b>${data.progress}</b></div>
        <i><em style="width:${data.width}"></em></i>
        <small>${data.progressText}</small>
      </div>
      <div class="pmh-inauguration-project-row-date">
        <strong>${data.opening}</strong>
        <span>${data.countdown}</span>
      </div>
      <span class="pmh-inauguration-project-row-open">Abrir implantação →</span>`;
    return button;
  };

  const closeProject = (browser) => {
    const list = browser.querySelector('[data-inauguration-browser-list]');
    const detail = browser.querySelector('[data-inauguration-browser-detail]');
    const store = browser.querySelector('[data-inauguration-browser-store]');
    const card = detail?.querySelector('.pmh-inauguration-card');
    if (card && store) store.appendChild(card);
    if (detail) {
      detail.replaceChildren();
      detail.hidden = true;
    }
    if (list) list.hidden = false;
    selectedProjectId = '';
    selectedTab = 'summary';
  };

  const openProject = (browser, itemId) => {
    if (!browser || !itemId) return;
    const list = browser.querySelector('[data-inauguration-browser-list]');
    const detail = browser.querySelector('[data-inauguration-browser-detail]');
    const store = browser.querySelector('[data-inauguration-browser-store]');
    const cards = [...browser.querySelectorAll('.pmh-inauguration-card')];
    const card = cards.find((candidate) => projectIdFromCard(candidate) === itemId);
    if (!card || !detail || !store) return;

    const previous = detail.querySelector('.pmh-inauguration-card');
    if (previous && previous !== card) store.appendChild(previous);

    selectedProjectId = itemId;
    const unit = card.querySelector(':scope > header h3')?.textContent?.trim() || 'Implantação';
    detail.replaceChildren();

    const back = document.createElement('header');
    back.className = 'pmh-inauguration-project-detail-head';
    back.innerHTML = `<button type="button" data-inauguration-back>← Todas as implantações</button><div><small>PROJETO DE INAUGURAÇÃO</small><strong>${unit}</strong></div>`;
    detail.append(back, card);
    detail.hidden = false;
    list.hidden = true;
    activateTab(card, selectedTab);
  };

  const buildBrowser = (content) => {
    const tracked = content.querySelector('.pmh-tracked');
    if (!tracked || tracked.dataset.inaugurationBrowser === 'v3') return;

    const cards = [...tracked.querySelectorAll(':scope > .pmh-inauguration-card')];
    cards.forEach(upgradeCard);
    if (!DESKTOP.matches || !cards.length) return;

    const browser = document.createElement('section');
    browser.className = 'pmh-inauguration-browser';
    browser.dataset.inaugurationBrowserRoot = 'v3';

    const list = document.createElement('section');
    list.className = 'pmh-inauguration-browser-list';
    list.dataset.inaugurationBrowserList = '1';
    list.innerHTML = `<header><div><small>PROJETOS ATIVOS</small><h3>Implantações em acompanhamento</h3><p>Abra uma unidade para trabalhar no projeto sem misturar todos os checklists na mesma tela.</p></div><span>${cards.length} projeto${cards.length === 1 ? '' : 's'}</span></header>`;

    const grid = document.createElement('div');
    grid.className = 'pmh-inauguration-project-grid';
    cards.forEach((card) => grid.appendChild(buildProjectRow(card)));
    list.appendChild(grid);

    const detail = document.createElement('section');
    detail.className = 'pmh-inauguration-browser-detail';
    detail.dataset.inaugurationBrowserDetail = '1';
    detail.hidden = true;

    const store = document.createElement('div');
    store.dataset.inaugurationBrowserStore = '1';
    store.hidden = true;
    cards.forEach((card) => store.appendChild(card));

    browser.append(list, detail, store);
    tracked.replaceChildren(browser);
    tracked.dataset.inaugurationBrowser = 'v3';

    if (selectedProjectId && cards.some((card) => projectIdFromCard(card) === selectedProjectId)) {
      openProject(browser, selectedProjectId);
    } else {
      selectedProjectId = '';
      selectedTab = 'summary';
    }
  };

  const updateCopy = (view, content) => {
    if (view === 'inauguracoes') {
      ensureOverrideStyles();
      const intro = content.querySelector('.pmh-section-head p');
      if (intro) intro.textContent = 'Visão da implantação primeiro. Checklist e financeiro só aparecem quando você entra na unidade.';
      buildBrowser(content);
    }

    if (view === 'inicio') {
      const shortcut = content.querySelector('.pmh-shortcuts [data-view="inauguracoes"] span');
      if (shortcut) shortcut.textContent = 'Projetos, checklist e financeiro';
    }

    if (view === 'conteudos') {
      const card = content.querySelector('.pmh-library [data-view="inauguracoes"]')?.closest('article');
      const description = card?.querySelector('p');
      if (description) description.textContent = 'Projetos de implantação com checklist de 15 etapas e financeiro integrado.';
    }
  };

  const upgradeNewInaugurationModal = () => {
    const note = document.querySelector('.pmh-modal form > p.wide');
    if (note) note.textContent = 'Ao salvar, a unidade entra como um projeto com checklist e verba padrão de R$ 4.100.';
  };

  window.addEventListener('pmh:view-rendered', (event) => {
    const view = String(event.detail?.view || '');
    const content = event.detail?.content || document.querySelector('[data-content]');
    if (content) updateCopy(view, content);
  });

  document.addEventListener('change', (event) => {
    const checkbox = event.target.closest?.('.pmh-checklist input[type="checkbox"]');
    if (!checkbox) return;
    const card = checkbox.closest('.pmh-inauguration-card');
    const itemId = projectIdFromCard(card);
    if (!itemId) return;
    window.setTimeout(() => refreshProjectNextStep(itemId), 0);
  });

  document.addEventListener('click', (event) => {
    const open = event.target.closest?.('[data-inauguration-open]');
    if (open) {
      const browser = open.closest('[data-inauguration-browser-root]');
      selectedTab = 'summary';
      openProject(browser, String(open.dataset.inaugurationOpen || ''));
      return;
    }

    const back = event.target.closest?.('[data-inauguration-back]');
    if (back) {
      closeProject(back.closest('[data-inauguration-browser-root]'));
      return;
    }

    const tab = event.target.closest?.('[data-inauguration-tab]');
    if (tab) {
      const card = tab.closest('.pmh-inauguration-card');
      if (!card) return;
      if (tab.dataset.inaugurationTab === 'finance') {
        card.querySelector('[data-inauguration-finance-open]')?.click();
        return;
      }
      activateTab(card, tab.dataset.inaugurationTab || 'summary');
      return;
    }

    if (event.target.closest?.('[data-remove-inauguration]')) {
      selectedProjectId = '';
      selectedTab = 'summary';
    }

    if (!event.target.closest?.('[data-new-inauguration], [data-start-project]')) return;
    requestAnimationFrame(upgradeNewInaugurationModal);
  }, true);

  ensureOverrideStyles();
})();