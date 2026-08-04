(() => {
  const TRACKED_KEY = 'planet-hub-inaugurations-v2';
  const ACTIONS_VERSION = 1;
  const DEFAULT_BUDGET = 4100;

  const actionTemplate = [
    {
      id: 'decoracao',
      name: 'Decoração com balões',
      description: 'Arco, totem, ponto instagramável ou ambientação da unidade.',
      owner: 'Franqueado',
      timing: 'D-1 a D0',
      plannedAmount: 350,
      actualAmount: 0,
      costType: 'package',
      included: true,
      done: false,
      quantity: 1,
      notes: '',
    },
    {
      id: 'corte-fita',
      name: 'Corte de fita',
      description: 'Fita personalizada, tesoura e registro simbólico da abertura.',
      owner: 'Franqueado',
      timing: 'D0',
      plannedAmount: 0,
      actualAmount: 0,
      costType: 'included',
      included: true,
      done: false,
      quantity: 1,
      notes: '',
    },
    {
      id: 'degustacao',
      name: 'Degustação sensorial',
      description: 'Mini porções de fondue, frutas ou produto definido pela operação.',
      owner: 'Franqueado',
      timing: 'D0',
      plannedAmount: 0,
      actualAmount: 0,
      costType: 'unit',
      included: true,
      done: false,
      quantity: 50,
      notes: '',
    },
    {
      id: 'trafego-pago',
      name: 'Tráfego pago local',
      description: 'Campanhas geolocalizadas antes, durante e depois da inauguração.',
      owner: 'Franqueadora',
      timing: 'D-15 a D+15',
      plannedAmount: 1300,
      actualAmount: 0,
      costType: 'package',
      included: true,
      done: false,
      quantity: 1,
      notes: '',
    },
    {
      id: 'influenciadores',
      name: 'Influenciadores locais',
      description: 'Criadores regionais para gerar expectativa, visita e prova social.',
      owner: 'Franqueadora + unidade',
      timing: 'D-10 a D0',
      plannedAmount: 2000,
      actualAmount: 0,
      costType: 'package',
      included: true,
      done: false,
      quantity: 2,
      notes: '',
    },
    {
      id: 'panfletagem',
      name: 'Panfletagem e relacionamento',
      description: 'Divulgação para lojistas, entorno, parceiros e pontos de alto fluxo.',
      owner: 'Franqueado',
      timing: 'D-7 a D0',
      plannedAmount: 450,
      actualAmount: 0,
      costType: 'package',
      included: true,
      done: false,
      quantity: 1,
      notes: '',
    },
  ];

  const money = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  }[char]));

  const toNumber = (value) => {
    const number = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(number) && number >= 0 ? number : 0;
  };

  const read = () => {
    try {
      const items = JSON.parse(window.localStorage.getItem(TRACKED_KEY) || '[]');
      return Array.isArray(items) ? items : [];
    } catch (_) {
      return [];
    }
  };

  const write = (items) => window.localStorage.setItem(TRACKED_KEY, JSON.stringify(items));

  const normalizeAction = (action, template) => ({
    ...template,
    ...(action || {}),
    id: template.id,
    included: action?.included !== false,
    done: Boolean(action?.done),
    plannedAmount: toNumber(action?.plannedAmount ?? template.plannedAmount),
    actualAmount: toNumber(action?.actualAmount ?? template.actualAmount),
    quantity: Math.max(0, Number.parseInt(action?.quantity ?? template.quantity, 10) || 0),
    notes: String(action?.notes || '').slice(0, 300),
  });

  const ensureActions = () => {
    const items = read();
    let changed = false;

    items.forEach((item) => {
      const current = Array.isArray(item.inauguralActions) ? item.inauguralActions : [];
      const byId = new Map(current.map((action) => [String(action?.id || ''), action]));
      const normalized = actionTemplate.map((template) => normalizeAction(byId.get(template.id), template));

      if (item.actionsVersion !== ACTIONS_VERSION || JSON.stringify(current) !== JSON.stringify(normalized)) {
        item.actionsVersion = ACTIONS_VERSION;
        item.inauguralActions = normalized;
        changed = true;
      }
      if (!Number.isFinite(Number(item.packageBudget))) {
        item.packageBudget = DEFAULT_BUDGET;
        changed = true;
      }
    });

    if (changed) write(items);
    return items;
  };

  const costLabel = (action) => {
    if (action.costType === 'unit') return 'Custo da unidade';
    if (action.costType === 'included') return 'Incluso em outra ação';
    return 'Dentro do pacote';
  };

  const actionTotals = (item) => {
    const included = (item.inauguralActions || []).filter((action) => action.included !== false);
    const packageActions = included.filter((action) => action.costType === 'package');
    return {
      included,
      completed: included.filter((action) => action.done).length,
      planned: packageActions.reduce((sum, action) => sum + toNumber(action.plannedAmount), 0),
      actual: packageActions.reduce((sum, action) => sum + toNumber(action.actualAmount), 0),
      unitActual: included
        .filter((action) => action.costType === 'unit')
        .reduce((sum, action) => sum + toNumber(action.actualAmount), 0),
    };
  };

  const renderMoneyInput = (itemId, action, field, disabled = false) => `
    <label class="pmh-action-money">
      <span>${field === 'plannedAmount' ? 'Previsto' : 'Real'}</span>
      <div><b>R$</b><input type="number" min="0" step="0.01" value="${toNumber(action[field])}" data-pmh-action-field="${field}" data-pmh-inauguration-id="${esc(itemId)}" data-pmh-action-id="${esc(action.id)}" ${disabled ? 'disabled' : ''}></div>
    </label>`;

  const renderAction = (item, action) => {
    const disabledMoney = action.costType === 'included';
    return `
      <article class="pmh-inaugural-action ${action.done ? 'is-done' : ''} ${action.included === false ? 'is-disabled' : ''}">
        <header>
          <label class="pmh-action-toggle">
            <input type="checkbox" data-pmh-action-field="done" data-pmh-inauguration-id="${esc(item.id)}" data-pmh-action-id="${esc(action.id)}" ${action.done ? 'checked' : ''} ${action.included === false ? 'disabled' : ''}>
            <span></span>
          </label>
          <div class="pmh-action-copy">
            <div><h5>${esc(action.name)}</h5><em>${esc(costLabel(action))}</em></div>
            <p>${esc(action.description)}</p>
          </div>
          <label class="pmh-action-use"><input type="checkbox" data-pmh-action-field="included" data-pmh-inauguration-id="${esc(item.id)}" data-pmh-action-id="${esc(action.id)}" ${action.included !== false ? 'checked' : ''}> Usar</label>
        </header>
        <div class="pmh-action-meta">
          <div><small>RESPONSÁVEL</small><strong>${esc(action.owner)}</strong></div>
          <div><small>PERÍODO</small><strong>${esc(action.timing)}</strong></div>
          ${action.id === 'influenciadores' ? `
            <label><small>QUANTIDADE</small><input class="pmh-action-quantity" type="number" min="1" max="6" value="${action.quantity || 2}" data-pmh-action-field="quantity" data-pmh-inauguration-id="${esc(item.id)}" data-pmh-action-id="${esc(action.id)}"></label>` : ''}
          ${renderMoneyInput(item.id, action, 'plannedAmount', disabledMoney)}
          ${renderMoneyInput(item.id, action, 'actualAmount', disabledMoney)}
        </div>
        <label class="pmh-action-notes"><span>Observação / fornecedor</span><input type="text" maxlength="300" value="${esc(action.notes || '')}" placeholder="Ex.: fornecedor confirmado, perfil contratado, link da campanha..." data-pmh-action-field="notes" data-pmh-inauguration-id="${esc(item.id)}" data-pmh-action-id="${esc(action.id)}"></label>
      </article>`;
  };

  const renderPanel = (item) => {
    const totals = actionTotals(item);
    const budget = toNumber(item.packageBudget || DEFAULT_BUDGET);
    const balance = budget - totals.actual;
    const progress = totals.included.length
      ? Math.round((totals.completed / totals.included.length) * 100)
      : 0;

    return `
      <details class="pmh-inaugural-actions" data-pmh-actions-for="${esc(item.id)}">
        <summary>
          <span><strong>Ações inaugurais</strong><small>${totals.completed}/${totals.included.length} concluídas · ${progress}%</small></span>
          <b>${money.format(balance)} disponível</b>
        </summary>
        <section class="pmh-action-finance">
          <label><small>VERBA DO PACOTE</small><div><b>R$</b><input type="number" min="0" step="0.01" value="${budget}" data-pmh-package-budget="${esc(item.id)}"></div></label>
          <article><small>PLANEJADO</small><strong>${money.format(totals.planned)}</strong></article>
          <article><small>GASTO</small><strong>${money.format(totals.actual)}</strong></article>
          <article class="${balance < 0 ? 'is-negative' : ''}"><small>SALDO</small><strong>${money.format(balance)}</strong></article>
          ${totals.unitActual > 0 ? `<article><small>CUSTO DA UNIDADE</small><strong>${money.format(totals.unitActual)}</strong></article>` : ''}
        </section>
        <div class="pmh-inaugural-action-list">
          ${(item.inauguralActions || []).map((action) => renderAction(item, action)).join('')}
        </div>
      </details>`;
  };

  const sortedItems = () => ensureActions().sort((a, b) => {
    const aDate = Date.parse(`${a.openingDate || '9999-12-31'}T12:00:00`) || Number.MAX_SAFE_INTEGER;
    const bDate = Date.parse(`${b.openingDate || '9999-12-31'}T12:00:00`) || Number.MAX_SAFE_INTEGER;
    return aDate - bDate;
  });

  const decorate = () => {
    const cards = [...document.querySelectorAll('.pmh-tracked-card')];
    if (!cards.length) return;
    const items = sortedItems();

    cards.forEach((card, index) => {
      const item = items[index];
      if (!item) return;
      const oldPanel = card.querySelector('.pmh-inaugural-actions');
      const panelSignature = JSON.stringify({
        packageBudget: item.packageBudget,
        actions: item.inauguralActions,
      });
      if (oldPanel?.dataset.pmhSignature === panelSignature) return;

      const wrapper = document.createElement('div');
      wrapper.innerHTML = renderPanel(item).trim();
      const panel = wrapper.firstElementChild;
      panel.dataset.pmhSignature = panelSignature;
      if (oldPanel?.open) panel.open = true;
      if (oldPanel) oldPanel.replaceWith(panel);
      else card.appendChild(panel);
    });
  };

  const updateItem = (itemId, updater) => {
    const items = ensureActions();
    const item = items.find((candidate) => String(candidate.id) === String(itemId));
    if (!item) return;
    updater(item);
    write(items);
    decorate();
  };

  document.addEventListener('change', (event) => {
    const packageInput = event.target.closest('[data-pmh-package-budget]');
    if (packageInput) {
      updateItem(packageInput.dataset.pmhPackageBudget, (item) => {
        item.packageBudget = toNumber(packageInput.value);
      });
      return;
    }

    const input = event.target.closest('[data-pmh-action-field]');
    if (!input) return;
    const itemId = input.dataset.pmhInaugurationId;
    const actionId = input.dataset.pmhActionId;
    const field = input.dataset.pmhActionField;

    updateItem(itemId, (item) => {
      const action = item.inauguralActions?.find((candidate) => candidate.id === actionId);
      if (!action) return;
      if (field === 'done' || field === 'included') action[field] = input.checked;
      else if (field === 'quantity') action.quantity = Math.max(1, Math.min(6, Number.parseInt(input.value, 10) || 1));
      else if (field === 'plannedAmount' || field === 'actualAmount') action[field] = toNumber(input.value);
      else if (field === 'notes') action.notes = String(input.value || '').slice(0, 300);
    });
  });

  const observer = new MutationObserver(() => {
    window.clearTimeout(observer.timer);
    observer.timer = window.setTimeout(decorate, 40);
  });

  const start = () => {
    ensureActions();
    observer.observe(document.getElementById('pmh-command-center') || document.body, {
      childList: true,
      subtree: true,
    });
    decorate();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
