(() => {
  'use strict';

  const OLD_CHECKLIST_LABEL = 'Separar brindes/cupons';
  const NEW_CHECKLIST_LABEL = '50 potes P para degustação';

  const normalize = (value) => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

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

  const replaceChecklistLabel = (checklist) => {
    checklist.querySelectorAll('strong').forEach((label) => {
      if (normalize(label.textContent) === normalize(OLD_CHECKLIST_LABEL)) {
        label.textContent = NEW_CHECKLIST_LABEL;
      }
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

  const upgradeCard = (card) => {
    if (card.dataset.inaugurationWorkspace === 'v2') return;

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

    const workspace = document.createElement('section');
    workspace.className = 'pmh-inauguration-workspace';
    workspace.dataset.inaugurationWorkspace = itemId;

    const toolbar = document.createElement('div');
    toolbar.className = 'pmh-inauguration-workspace-bar';
    toolbar.innerHTML = `<div class="pmh-inauguration-workspace-title"><i aria-hidden="true">☑️</i><div><strong>Checklist</strong><small>${progress}</small></div></div>`;
    toolbar.appendChild(buildFinanceButton({ itemId, unit, planned, actual, balance, unitCost }));

    workspace.append(toolbar, checklist);

    if (budgetInput) {
      budgetInput.hidden = true;
      budgetInput.classList.add('pmh-finance-budget-bridge');
      workspace.appendChild(budgetInput);
    }

    details.replaceWith(workspace);
    actions?.remove();
    card.dataset.inaugurationWorkspace = 'v2';
  };

  const updateCopy = (view, content) => {
    if (view === 'inauguracoes') {
      const intro = content.querySelector('.pmh-section-head p');
      if (intro) intro.textContent = 'Uma única área para data real, checklist e financeiro da implantação.';
      content.querySelectorAll('.pmh-inauguration-card').forEach(upgradeCard);
    }

    if (view === 'inicio') {
      const shortcut = content.querySelector('.pmh-shortcuts [data-view="inauguracoes"] span');
      if (shortcut) shortcut.textContent = 'Checklist e financeiro';
    }

    if (view === 'conteudos') {
      const card = content.querySelector('.pmh-library [data-view="inauguracoes"]')?.closest('article');
      const description = card?.querySelector('p');
      if (description) description.textContent = 'Checklist de 15 etapas com financeiro integrado por implantação.';
    }
  };

  const upgradeNewInaugurationModal = () => {
    const note = document.querySelector('.pmh-modal form > p.wide');
    if (note) note.textContent = 'Ao salvar, entram automaticamente o checklist e a verba padrão de R$ 4.100.';
  };

  window.addEventListener('pmh:view-rendered', (event) => {
    const view = String(event.detail?.view || '');
    const content = event.detail?.content || document.querySelector('[data-content]');
    if (content) updateCopy(view, content);
  });

  document.addEventListener('click', (event) => {
    if (!event.target.closest?.('[data-new-inauguration], [data-start-project]')) return;
    requestAnimationFrame(upgradeNewInaugurationModal);
  }, true);
})();