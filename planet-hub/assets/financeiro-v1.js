(() => {
  'use strict';

  const API = {
    finance: '/api/hub/financeiro',
    inaugurations: '/api/hub/inauguracoes',
  };
  const STATUS_LABELS = {
    draft: 'Rascunho',
    docs_pending: 'Documentação pendente',
    awaiting_approval: 'Aguardando aprovação',
    sent_finance: 'Enviado ao financeiro',
    paid: 'Pago',
    rejected: 'Recusado',
  };
  const state = {
    loading: false,
    configured: null,
    suppliers: [],
    payments: [],
    revision: null,
    error: '',
    panelContext: null,
  };

  let closeCallback = null;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));
  const money = (value) => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0);
  const digits = (value) => String(value || '').replace(/\D/g, '');
  const maskDocument = (value) => {
    const doc = digits(value);
    if (doc.length === 11) return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (doc.length === 14) return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return doc;
  };
  const manualActionId = (paymentId) => `manual-${paymentId}`;
  const cloneItems = (items) => items.map((item) => ({ ...item }));
  const mergeChangedItems = (remoteItems, localItems, changedIds = []) => {
    const merged = new Map((remoteItems || []).map((item) => [String(item.id || ''), item]));
    const localById = new Map((localItems || []).map((item) => [String(item.id || ''), item]));
    changedIds.forEach((id) => {
      const key = String(id || '');
      const local = localById.get(key);
      if (key && local) merged.set(key, local);
    });
    return [...merged.values()];
  };

  const apiJson = async (url, options = {}) => {
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      cache: 'no-store',
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `Falha HTTP ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  };

  const supplierById = (id) => state.suppliers.find((item) => item.id === id);
  const statusOptions = (selected) => Object.entries(STATUS_LABELS)
    .map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`)
    .join('');
  const metrics = (payments) => {
    const active = payments.filter((item) => item.status !== 'rejected');
    return {
      total: active.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      sent: active
        .filter((item) => ['sent_finance', 'paid'].includes(item.status))
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
      paid: active
        .filter((item) => item.status === 'paid')
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
      pending: active.filter((item) => item.status !== 'paid').length,
    };
  };
  const committedAmount = (payments, actualValue = 0) => Math.max(
    Number(actualValue) || 0,
    metrics(payments).total,
  );

  const closeModal = (runCallback = true) => {
    document.querySelector('.pmh-finance-modal')?.remove();
    const callback = closeCallback;
    closeCallback = null;
    if (runCallback && typeof callback === 'function') callback();
  };

  const showModal = (html, onClose = null) => {
    closeModal(false);
    closeCallback = onClose;
    const modal = document.createElement('div');
    modal.className = 'pmh-finance-modal';
    modal.innerHTML = html;
    document.body.appendChild(modal);
    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.closest('[data-finance-close]')) closeModal();
    });
    return modal;
  };

  const loadFinance = async (force = false) => {
    if (!force && state.configured !== null && !state.error) return;
    state.loading = true;
    state.error = '';
    try {
      const payload = await apiJson(API.finance);
      state.configured = payload.configured !== false;
      state.suppliers = payload.suppliers || [];
      state.payments = payload.payments || [];
      state.revision = payload.revision || null;
    } catch (error) {
      state.configured = error.status !== 503;
      state.error = error.message;
    } finally {
      state.loading = false;
    }
  };

  const saveFinance = async ({
    changedSupplierIds = [],
    changedPaymentIds = [],
    attempt = 0,
  } = {}) => {
    const localSuppliers = cloneItems(state.suppliers);
    const localPayments = cloneItems(state.payments);
    try {
      const payload = await apiJson(API.finance, {
        method: 'PUT',
        body: JSON.stringify({
          suppliers: state.suppliers,
          payments: state.payments,
          baseRevision: state.revision,
        }),
      });
      state.suppliers = payload.suppliers || state.suppliers;
      state.payments = payload.payments || state.payments;
      state.revision = payload.revision || state.revision;
      state.configured = true;
      state.error = '';
    } catch (error) {
      if (error.status === 409 && error.payload && attempt < 2) {
        state.suppliers = mergeChangedItems(
          error.payload.suppliers || [],
          localSuppliers,
          changedSupplierIds,
        );
        state.payments = mergeChangedItems(
          error.payload.payments || [],
          localPayments,
          changedPaymentIds,
        );
        state.revision = error.payload.revision || null;
        return saveFinance({
          changedSupplierIds,
          changedPaymentIds,
          attempt: attempt + 1,
        });
      }
      const finalError = error.status === 409
        ? new Error('Os dados financeiros mudaram novamente. Reabra o painel e tente salvar outra vez.')
        : error;
      state.error = finalError.message;
      throw finalError;
    }
  };

  const deletePaymentById = async (paymentId, document = null, attempt = 0) => {
    const targetId = String(paymentId || '');
    if (!targetId) throw new Error('Pagamento inválido para exclusão.');

    const current = document || {
      suppliers: cloneItems(state.suppliers),
      payments: cloneItems(state.payments),
      revision: state.revision,
    };
    const suppliers = cloneItems(current.suppliers || []);
    const payments = (current.payments || [])
      .filter((item) => String(item.id || '') !== targetId)
      .map((item) => ({ ...item }));

    try {
      const payload = await apiJson(API.finance, {
        method: 'PUT',
        body: JSON.stringify({
          suppliers,
          payments,
          baseRevision: current.revision || null,
        }),
      });
      state.suppliers = payload.suppliers || suppliers;
      state.payments = payload.payments || payments;
      state.revision = payload.revision || current.revision || null;
      state.configured = true;
      state.error = '';
      return payload;
    } catch (error) {
      if (error.status === 409 && attempt < 2) {
        const remote = error.payload?.suppliers && error.payload?.payments
          ? error.payload
          : await apiJson(API.finance);
        return deletePaymentById(targetId, remote, attempt + 1);
      }
      const finalError = error.status === 409
        ? new Error('Os dados financeiros mudaram novamente. Reabra o painel e tente excluir outra vez.')
        : error;
      throw finalError;
    }
  };

  const panelPayments = () => {
    const id = String(state.panelContext?.inaugurationId || '');
    return state.payments
      .filter((payment) => String(payment.inaugurationId || '') === id)
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  };

  const renderPaymentRows = (payments) => payments.length
    ? payments.map((payment) => {
      const supplier = supplierById(payment.supplierId);
      return `<article class="pmh-payment-row">
        <div><strong>${esc(payment.actionName || 'Pagamento da implantação')}</strong><small>${esc(supplier?.legalName || 'Fornecedor não encontrado')}</small></div>
        <div><strong>${money(payment.amount)}</strong><small>Vencimento: ${esc(payment.dueDate || 'não definido')}</small></div>
        <select data-payment-status="${esc(payment.id)}">${statusOptions(payment.status)}</select>
        <div><strong>${esc(STATUS_LABELS[payment.status] || payment.status)}</strong><small>${esc(payment.documentNumber || 'Sem NF/recibo')}</small></div>
        <div><button data-finance-edit-payment="${esc(payment.id)}">Editar</button><button data-finance-delete-payment="${esc(payment.id)}">Excluir</button></div>
      </article>`;
    }).join('')
    : '<div class="pmh-finance-empty"><h3>Nenhum pagamento nesta implantação</h3><p>Use “Novo pagamento” para criar o primeiro registro financeiro da unidade.</p></div>';

  const renderSupplierCards = () => state.suppliers.length
    ? state.suppliers.map((supplier) => `<article class="pmh-supplier-card"><header><div><strong>${esc(supplier.legalName)}</strong><small>${esc(supplier.tradeName || supplier.serviceType || 'Fornecedor')}</small></div><button data-finance-edit-supplier="${esc(supplier.id)}">Editar</button></header><code>${esc(maskDocument(supplier.document))}</code><small>${esc(supplier.pixKey ? `Pix: ${supplier.pixKey}` : 'Pix não informado')}</small></article>`).join('')
    : '<div class="pmh-finance-empty"><h3>Nenhum fornecedor</h3><p>Cadastre o primeiro fornecedor da implantação.</p></div>';

  const renderPanel = () => {
    const context = state.panelContext;
    if (!context) return;

    if (state.loading) {
      showModal('<section class="pmh-inauguration-finance-panel"><div class="pmh-inauguration-finance-body"><div class="pmh-loading">Carregando o financeiro da implantação…</div></div></section>');
      return;
    }

    if (state.configured === false) {
      showModal(`<section class="pmh-inauguration-finance-panel"><header><div><small>FINANCEIRO DA IMPLANTAÇÃO</small><h2>${esc(context.unit)}</h2></div><button data-finance-close>×</button></header><div class="pmh-inauguration-finance-body"><section class="pmh-finance-setup"><h2>Proteção necessária</h2><p>Configure no Cloudflare os segredos <strong>PLANET_HUB_ACCESS_PASSWORD</strong> e <strong>PLANET_HUB_ENCRYPTION_KEY</strong>. Nenhum CPF, CNPJ ou Pix será salvo antes disso.</p></section></div></section>`);
      return;
    }

    const payments = panelPayments();
    const kpi = metrics(payments);
    const budget = Number(context.budget || 0);
    const actualValue = Number(context.actualValue || 0);
    const committedValue = committedAmount(payments, actualValue);
    const balanceValue = budget - committedValue;
    const balanceLabel = money(balanceValue);

    showModal(`<section class="pmh-inauguration-finance-panel">
      <header><div><small>FINANCEIRO DA IMPLANTAÇÃO</small><h2>${esc(context.unit)}</h2><p>${esc(context.openingDate || 'Data não informada')} · ${payments.length} pagamento(s)</p></div><button data-finance-close>×</button></header>
      <div class="pmh-inauguration-finance-body">
        ${state.error ? `<div class="pmh-alert">${esc(state.error)}</div>` : ''}
        <section class="pmh-inauguration-finance-summary">
          <label><small>VERBA DO PACOTE</small><input type="number" min="0" step="0.01" value="${budget}" data-inauguration-panel-budget="${esc(context.inaugurationId)}"></label>
          <article><small>PLANEJADO</small><strong>${esc(context.planned || money(0))}</strong></article>
          <article><small>GASTO</small><strong>${esc(context.actual || money(actualValue))}</strong></article>
          <article class="${balanceValue < 0 ? 'negative' : ''}" data-inauguration-balance-card><small>SALDO</small><strong>${esc(balanceLabel)}</strong></article>
          ${context.unitCost ? `<article><small>CUSTO DA UNIDADE</small><strong>${esc(context.unitCost)}</strong></article>` : ''}
        </section>
        <section class="pmh-inauguration-payment-kpis">
          <article><small>VALOR SOLICITADO</small><strong>${money(kpi.total)}</strong></article>
          <article><small>ENVIADO AO FINANCEIRO</small><strong>${money(kpi.sent)}</strong></article>
          <article><small>VALOR PAGO</small><strong>${money(kpi.paid)}</strong></article>
          <article><small>PENDENTES</small><strong>${kpi.pending}</strong></article>
        </section>
        <div class="pmh-inauguration-finance-toolbar">
          <div><button class="primary" data-inauguration-finance-new-payment>+ Novo pagamento</button><button data-inauguration-finance-new-supplier>+ Novo fornecedor</button></div>
          <button data-inauguration-finance-export>Exportar esta implantação</button>
        </div>
        <section class="pmh-inauguration-finance-grid">
          <div class="pmh-finance-panel"><header><h3>Pagamentos</h3><span>${payments.length} registros</span></header><div class="pmh-payment-list">${renderPaymentRows(payments)}</div></div>
          <aside class="pmh-finance-panel"><header><h3>Fornecedores</h3><span>${state.suppliers.length}</span></header><div class="pmh-supplier-list">${renderSupplierCards()}</div></aside>
        </section>
      </div>
    </section>`);
  };

  const supplierModal = (existing = null, afterSave = null) => {
    const supplier = existing || {
      id: `supplier-${crypto.randomUUID()}`,
      legalName: '', tradeName: '', document: '', phone: '', email: '', pixKey: '',
      bankDetails: '', serviceType: '', notes: '', createdAt: new Date().toISOString(),
    };
    const modal = showModal(`<section class="pmh-finance-dialog"><header><div><h2>${existing ? 'Editar' : 'Novo'} fornecedor</h2><p>Dados bancários e fiscais criptografados antes de entrar no KV.</p></div><button data-finance-close>×</button></header><form class="pmh-finance-form"><label>Nome / razão social<input name="legalName" value="${esc(supplier.legalName)}" required></label><label>Nome fantasia<input name="tradeName" value="${esc(supplier.tradeName)}"></label><label>CPF ou CNPJ<input name="document" value="${esc(supplier.document)}" required></label><label>Tipo de serviço<input name="serviceType" value="${esc(supplier.serviceType)}"></label><label>Telefone<input name="phone" value="${esc(supplier.phone)}"></label><label>E-mail<input name="email" type="email" value="${esc(supplier.email)}"></label><label class="wide">Chave Pix<input name="pixKey" value="${esc(supplier.pixKey)}"></label><label class="wide">Dados bancários<textarea name="bankDetails">${esc(supplier.bankDetails)}</textarea></label><label class="wide">Observações<textarea name="notes">${esc(supplier.notes)}</textarea></label><p class="pmh-alert wide" data-finance-supplier-error hidden></p><footer><button type="button" data-finance-close>Cancelar</button><button class="primary" type="submit">Salvar fornecedor</button></footer></form></section>`, renderPanel);

    modal.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submitButton = form.querySelector('button[type="submit"]');
      const errorBox = form.querySelector('[data-finance-supplier-error]');
      const originalButtonText = submitButton?.textContent || 'Salvar fornecedor';
      const previousSuppliers = cloneItems(state.suppliers);
      const data = Object.fromEntries(new FormData(form));
      const updated = {
        ...supplier,
        ...data,
        document: digits(data.document),
        updatedAt: new Date().toISOString(),
      };
      const index = state.suppliers.findIndex((item) => item.id === updated.id);
      if (index >= 0) state.suppliers[index] = updated;
      else state.suppliers.push(updated);

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Salvando…';
      }
      if (errorBox) {
        errorBox.hidden = true;
        errorBox.textContent = '';
      }

      try {
        await saveFinance({ changedSupplierIds: [updated.id] });
        closeModal(false);
        if (afterSave) afterSave(updated);
        else renderPanel();
      } catch (error) {
        state.suppliers = previousSuppliers;
        state.error = '';
        if (errorBox) {
          errorBox.textContent = error instanceof Error ? error.message : 'Não foi possível salvar o fornecedor.';
          errorBox.hidden = false;
        }
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
        }
      }
    });
  };

  const paymentModal = (context = {}, existing = null) => {
    if (!state.suppliers.length) {
      supplierModal(null, (supplier) => paymentModal(context, { supplierId: supplier.id }));
      return;
    }

    const paymentId = String(existing?.id || `payment-${crypto.randomUUID()}`);
    const payment = {
      id: paymentId,
      inaugurationId: context.inaugurationId || existing?.inaugurationId || '',
      actionId: context.actionId || existing?.actionId || manualActionId(paymentId),
      unit: context.unit || existing?.unit || '',
      openingDate: context.openingDate || existing?.openingDate || '',
      actionName: context.actionName || existing?.actionName || '',
      supplierId: '',
      amount: context.amount || 0,
      dueDate: '',
      status: 'draft',
      documentNumber: '',
      documentReference: '',
      notes: '',
      approvedBy: '',
      createdAt: new Date().toISOString(),
      ...(existing || {}),
      id: paymentId,
      actionId: context.actionId || existing?.actionId || manualActionId(paymentId),
    };

    const modal = showModal(`<section class="pmh-finance-dialog"><header><div><h2>${existing?.id ? 'Editar' : 'Gerar'} pagamento</h2><p>${esc(payment.unit || 'Implantação')} · ${esc(payment.actionName || 'Novo registro')}</p></div><button data-finance-close>×</button></header><form class="pmh-finance-form"><input type="hidden" name="actionId" value="${esc(payment.actionId)}"><label>Unidade<input name="unit" value="${esc(payment.unit)}" required></label><label>Ação<input name="actionName" value="${esc(payment.actionName)}" placeholder="Ex.: influenciador, decoração, material" required></label><label>Fornecedor<select name="supplierId" required><option value="">Selecione</option>${state.suppliers.map((supplier) => `<option value="${esc(supplier.id)}" ${supplier.id === payment.supplierId ? 'selected' : ''}>${esc(supplier.legalName)}</option>`).join('')}</select></label><label>Valor<input name="amount" type="number" min="0.01" step="0.01" value="${Number(payment.amount) || ''}" required></label><label>Vencimento<input name="dueDate" type="date" value="${esc(payment.dueDate)}"></label><label>Status<select name="status">${statusOptions(payment.status)}</select></label><label>Nº da NF / recibo<input name="documentNumber" value="${esc(payment.documentNumber)}"></label><label>Referência do documento<input name="documentReference" value="${esc(payment.documentReference)}"></label><label>Aprovado por<input name="approvedBy" value="${esc(payment.approvedBy)}"></label><label class="wide">Observações<textarea name="notes">${esc(payment.notes)}</textarea></label><p class="pmh-finance-note wide">O pagamento ficará vinculado à implantação e ao fornecedor.</p><p class="pmh-alert wide" data-finance-payment-error hidden></p><footer><button type="button" data-finance-close>Cancelar</button><button class="primary" type="submit">Salvar pagamento</button></footer></form></section>`, renderPanel);

    modal.querySelector('form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const submitButton = form.querySelector('button[type="submit"]');
      const errorBox = form.querySelector('[data-finance-payment-error]');
      const originalButtonText = submitButton?.textContent || 'Salvar pagamento';
      const previousPayments = cloneItems(state.payments);
      const data = Object.fromEntries(new FormData(form));
      const updated = {
        ...payment,
        ...data,
        actionId: String(data.actionId || payment.actionId || manualActionId(payment.id)),
        amount: Number(data.amount),
        updatedAt: new Date().toISOString(),
      };
      if (updated.status === 'sent_finance' && !updated.sentAt) updated.sentAt = new Date().toISOString();
      if (updated.status === 'paid' && !updated.paidAt) updated.paidAt = new Date().toISOString();
      const index = state.payments.findIndex((item) => item.id === updated.id);
      if (index >= 0) state.payments[index] = updated;
      else state.payments.push(updated);

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Salvando…';
      }
      if (errorBox) {
        errorBox.hidden = true;
        errorBox.textContent = '';
      }

      try {
        await saveFinance({ changedPaymentIds: [updated.id] });
        closeModal(false);
        renderPanel();
      } catch (error) {
        state.payments = previousPayments;
        state.error = '';
        if (errorBox) {
          errorBox.textContent = error instanceof Error ? error.message : 'Não foi possível salvar o pagamento.';
          errorBox.hidden = false;
        }
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
        }
      }
    });
  };

  const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const exportCsv = (payments) => {
    const rows = [['Unidade', 'Ação', 'Fornecedor', 'CPF/CNPJ', 'Valor', 'Vencimento', 'Status', 'Pix', 'Dados bancários', 'NF/Recibo', 'Observações']];
    payments.forEach((payment) => {
      const supplier = supplierById(payment.supplierId) || {};
      rows.push([
        payment.unit, payment.actionName, supplier.legalName, supplier.document,
        payment.amount, payment.dueDate, STATUS_LABELS[payment.status], supplier.pixKey,
        supplier.bankDetails, payment.documentNumber, payment.notes,
      ]);
    });
    const csv = `\ufeff${rows.map((row) => row.map(csvCell).join(';')).join('\n')}`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `financeiro-${String(state.panelContext?.unit || 'implantacao').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const readButtonContext = async (button) => {
    const inaugurationId = String(button.dataset.inaugurationFinanceOpen || '');
    const payload = await apiJson(API.inaugurations);
    const inauguration = (payload.data || [])
      .find((item) => String(item.id || '') === inaugurationId) || {};
    const budgetBridge = [...document.querySelectorAll('[data-budget]')]
      .find((input) => String(input.dataset.budget || '') === inaugurationId);

    return {
      inaugurationId,
      unit: inauguration.unit || button.dataset.inaugurationUnit || 'Implantação',
      openingDate: inauguration.openingDate || '',
      budget: Number(budgetBridge?.value || inauguration.packageBudget || 0),
      planned: button.dataset.financePlanned || '',
      actual: button.dataset.financeActual || '',
      actualValue: Number(button.dataset.financeActualValue || 0),
      balance: button.dataset.financeBalance || '',
      unitCost: button.dataset.financeUnitCost || '',
    };
  };

  const openPanel = async (button) => {
    state.panelContext = {
      inaugurationId: String(button.dataset.inaugurationFinanceOpen || ''),
      unit: button.dataset.inaugurationUnit || 'Implantação',
    };
    state.loading = true;
    renderPanel();
    try {
      const [context] = await Promise.all([
        readButtonContext(button),
        loadFinance(),
      ]);
      state.panelContext = context;
    } catch (error) {
      state.error = error.message;
    } finally {
      state.loading = false;
      renderPanel();
    }
  };

  const updateBudget = (input) => {
    const inaugurationId = String(input.dataset.inaugurationPanelBudget || '');
    const bridge = [...document.querySelectorAll('[data-budget]')]
      .find((candidate) => String(candidate.dataset.budget || '') === inaugurationId);
    if (bridge) {
      bridge.value = input.value;
      bridge.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (state.panelContext) {
      state.panelContext.budget = Number(input.value || 0);
      const committedValue = committedAmount(
        panelPayments(),
        Number(state.panelContext.actualValue || 0),
      );
      const balance = state.panelContext.budget - committedValue;
      state.panelContext.balance = money(balance);
      const card = document.querySelector('[data-inauguration-balance-card]');
      if (card) {
        card.classList.toggle('negative', balance < 0);
        const value = card.querySelector('strong');
        if (value) value.textContent = money(balance);
      }
    }
  };

  document.addEventListener('click', async (event) => {
    const financeButton = event.target.closest?.('[data-inauguration-finance-open]');
    if (financeButton) {
      event.preventDefault();
      event.stopPropagation();
      openPanel(financeButton);
      return;
    }

    if (event.target.closest?.('[data-inauguration-finance-new-supplier]')) {
      supplierModal();
      return;
    }

    if (event.target.closest?.('[data-inauguration-finance-new-payment]')) {
      const context = state.panelContext || {};
      paymentModal({
        inaugurationId: context.inaugurationId,
        unit: context.unit,
        openingDate: context.openingDate,
      });
      return;
    }

    if (event.target.closest?.('[data-inauguration-finance-export]')) {
      exportCsv(panelPayments());
      return;
    }

    const editSupplier = event.target.closest?.('[data-finance-edit-supplier]');
    if (editSupplier) {
      supplierModal(supplierById(editSupplier.dataset.financeEditSupplier));
      return;
    }

    const deletePayment = event.target.closest?.('[data-finance-delete-payment]');
    if (deletePayment) {
      const payment = state.payments.find((item) => String(item.id) === String(deletePayment.dataset.financeDeletePayment));
      if (!payment) return;
      const supplier = supplierById(payment.supplierId);
      const confirmed = window.confirm([
        'Excluir este pagamento?',
        '',
        `Ação: ${payment.actionName || 'Pagamento da implantação'}`,
        `Fornecedor: ${supplier?.legalName || 'Fornecedor não encontrado'}`,
        `Valor: ${money(payment.amount)}`,
        '',
        'O lançamento financeiro desta implantação será removido.',
      ].join('\n'));
      if (!confirmed) return;

      const originalText = deletePayment.textContent;
      deletePayment.disabled = true;
      deletePayment.textContent = 'Excluindo…';
      try {
        await deletePaymentById(payment.id);
        renderPanel();
      } catch (error) {
        state.error = error instanceof Error ? error.message : 'Não foi possível excluir o pagamento.';
        renderPanel();
      } finally {
        if (document.contains(deletePayment)) {
          deletePayment.disabled = false;
          deletePayment.textContent = originalText;
        }
      }
      return;
    }

    const editPayment = event.target.closest?.('[data-finance-edit-payment]');
    if (editPayment) {
      paymentModal({}, state.payments.find((item) => item.id === editPayment.dataset.financeEditPayment));
    }
  }, true);

  document.addEventListener('change', async (event) => {
    const budget = event.target.closest?.('[data-inauguration-panel-budget]');
    if (budget) {
      updateBudget(budget);
      return;
    }

    const select = event.target.closest?.('[data-payment-status]');
    if (!select) return;
    const payment = state.payments.find((item) => item.id === select.dataset.paymentStatus);
    if (!payment) return;
    const previousPayments = cloneItems(state.payments);
    select.disabled = true;
    payment.status = select.value;
    payment.updatedAt = new Date().toISOString();
    if (payment.status === 'sent_finance') payment.sentAt = payment.sentAt || new Date().toISOString();
    if (payment.status === 'paid') payment.paidAt = payment.paidAt || new Date().toISOString();
    try {
      await saveFinance({ changedPaymentIds: [payment.id] });
      renderPanel();
    } catch (error) {
      state.payments = previousPayments;
      state.error = error instanceof Error ? error.message : 'Não foi possível atualizar o status.';
      renderPanel();
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal(false);
  });
})();