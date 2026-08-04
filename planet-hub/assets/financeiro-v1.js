(() => {
  'use strict';
  const API = { finance: '/api/hub/financeiro', inaugurations: '/api/hub/inauguracoes' };
  const STATUS_LABELS = { draft: 'Rascunho', docs_pending: 'Documentação pendente', awaiting_approval: 'Aguardando aprovação', sent_finance: 'Enviado ao financeiro', paid: 'Pago', rejected: 'Recusado' };
  const state = { active: false, loading: false, configured: null, suppliers: [], payments: [], revision: null, error: '' };
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
  const digits = (value) => String(value || '').replace(/\D/g, '');
  const maskDocument = (value) => { const doc = digits(value); if (doc.length === 11) return doc.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'); if (doc.length === 14) return doc.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'); return doc; };
  const content = () => document.querySelector('[data-content]');
  const title = () => document.querySelector('[data-title]');
  const searchWrap = () => document.querySelector('[data-search-wrap]');

  const apiJson = async (url, options = {}) => {
    const response = await fetch(url, { headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, cache: 'no-store', ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) { const error = new Error(payload.error || `Falha HTTP ${response.status}`); error.status = response.status; error.payload = payload; throw error; }
    return payload;
  };

  const loadFinance = async () => {
    state.loading = true; state.error = ''; render();
    try { const payload = await apiJson(API.finance); state.configured = payload.configured !== false; state.suppliers = payload.suppliers || []; state.payments = payload.payments || []; state.revision = payload.revision || null; }
    catch (error) { state.configured = error.status !== 503; state.error = error.message; }
    state.loading = false; render();
  };

  const saveFinance = async () => {
    try {
      const payload = await apiJson(API.finance, { method: 'PUT', body: JSON.stringify({ suppliers: state.suppliers, payments: state.payments, baseRevision: state.revision }) });
      state.suppliers = payload.suppliers || state.suppliers; state.payments = payload.payments || state.payments; state.revision = payload.revision || state.revision; state.configured = true; state.error = ''; render(); refreshPaymentButtons();
    } catch (error) {
      if (error.status === 409 && error.payload) { state.suppliers = error.payload.suppliers || state.suppliers; state.payments = error.payload.payments || state.payments; state.revision = error.payload.revision || null; return saveFinance(); }
      state.error = error.message; render();
    }
  };

  const supplierById = (id) => state.suppliers.find((item) => item.id === id);
  const statusOptions = (selected) => Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${label}</option>`).join('');
  const metrics = () => ({ total: state.payments.reduce((sum, item) => sum + Number(item.amount || 0), 0), sent: state.payments.filter((item) => ['sent_finance', 'paid'].includes(item.status)).reduce((sum, item) => sum + Number(item.amount || 0), 0), paid: state.payments.filter((item) => item.status === 'paid').reduce((sum, item) => sum + Number(item.amount || 0), 0), pending: state.payments.filter((item) => !['paid', 'rejected'].includes(item.status)).length });

  const render = () => {
    if (!state.active || !content()) return;
    title().textContent = 'Pagamentos de inauguração'; if (searchWrap()) searchWrap().hidden = true;
    if (state.loading) { content().innerHTML = '<div class="pmh-loading">Carregando fornecedores e pagamentos…</div>'; return; }
    if (state.configured === false) { content().innerHTML = '<section class="pmh-finance-setup"><h2>Proteção necessária</h2><p>Configure no Cloudflare os segredos <strong>PLANET_HUB_ACCESS_PASSWORD</strong> e <strong>PLANET_HUB_ENCRYPTION_KEY</strong>. Nenhum CPF, CNPJ ou Pix será salvo antes disso.</p></section>'; return; }
    const kpi = metrics(); const payments = [...state.payments].sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
    content().innerHTML = `${state.error ? `<div class="pmh-alert">${esc(state.error)}</div>` : ''}<section class="pmh-section-head"><div><small>FINANCEIRO DE INAUGURAÇÕES</small><h2>Do fornecedor ao pagamento</h2><p>Controle por unidade, ação, fornecedor e situação do pagamento.</p></div></section><div class="pmh-finance-toolbar"><div><button class="primary" data-finance-new-supplier>+ Novo fornecedor</button><button data-finance-new-payment>+ Novo pagamento</button></div><button data-finance-export>Exportar relatório para o financeiro</button></div><section class="pmh-finance-kpis"><article><small>VALOR SOLICITADO</small><strong>${money(kpi.total)}</strong></article><article><small>ENVIADO AO FINANCEIRO</small><strong>${money(kpi.sent)}</strong></article><article><small>VALOR PAGO</small><strong>${money(kpi.paid)}</strong></article><article><small>PAGAMENTOS PENDENTES</small><strong>${kpi.pending}</strong></article></section><section class="pmh-finance-grid"><div class="pmh-finance-panel"><header><h3>Pagamentos</h3><span>${payments.length} registros</span></header><div class="pmh-payment-list">${payments.length ? payments.map((payment) => { const supplier = supplierById(payment.supplierId); return `<article class="pmh-payment-row"><div><strong>${esc(payment.unit)} · ${esc(payment.actionName)}</strong><small>${esc(supplier?.legalName || 'Fornecedor não encontrado')}</small></div><div><strong>${money(payment.amount)}</strong><small>Vencimento: ${esc(payment.dueDate || 'não definido')}</small></div><select data-payment-status="${esc(payment.id)}">${statusOptions(payment.status)}</select><div><strong>${esc(STATUS_LABELS[payment.status] || payment.status)}</strong><small>${esc(payment.documentNumber || 'Sem NF/recibo')}</small></div><button data-finance-edit-payment="${esc(payment.id)}">Editar</button></article>`; }).join('') : '<div class="pmh-finance-empty"><h3>Nenhum pagamento gerado</h3><p>Abra uma ação inaugural e clique em “Gerar pagamento”.</p></div>'}</div></div><aside class="pmh-finance-panel"><header><h3>Fornecedores</h3><span>${state.suppliers.length}</span></header><div class="pmh-supplier-list">${state.suppliers.length ? state.suppliers.map((supplier) => `<article class="pmh-supplier-card"><header><div><strong>${esc(supplier.legalName)}</strong><small>${esc(supplier.tradeName || supplier.serviceType || 'Fornecedor')}</small></div><button data-finance-edit-supplier="${esc(supplier.id)}">Editar</button></header><code>${esc(maskDocument(supplier.document))}</code><small>${esc(supplier.pixKey ? `Pix: ${supplier.pixKey}` : 'Pix não informado')}</small></article>`).join('') : '<div class="pmh-finance-empty"><h3>Nenhum fornecedor</h3><p>Cadastre o primeiro para gerar pagamentos.</p></div>'}</div></aside></section>`;
  };

  const closeModal = () => document.querySelector('.pmh-finance-modal')?.remove();
  const showModal = (html) => { closeModal(); const modal = document.createElement('div'); modal.className = 'pmh-finance-modal'; modal.innerHTML = html; document.body.appendChild(modal); modal.addEventListener('click', (event) => { if (event.target === modal || event.target.closest('[data-finance-close]')) closeModal(); }); return modal; };

  const supplierModal = (existing = null, afterSave = null) => {
    const supplier = existing || { id: `supplier-${crypto.randomUUID()}`, legalName: '', tradeName: '', document: '', phone: '', email: '', pixKey: '', bankDetails: '', serviceType: '', notes: '', createdAt: new Date().toISOString() };
    const modal = showModal(`<section class="pmh-finance-dialog"><header><div><h2>${existing ? 'Editar' : 'Novo'} fornecedor</h2><p>Dados bancários e fiscais criptografados antes de entrar no KV.</p></div><button data-finance-close>×</button></header><form class="pmh-finance-form"><label>Nome / razão social<input name="legalName" value="${esc(supplier.legalName)}" required></label><label>Nome fantasia<input name="tradeName" value="${esc(supplier.tradeName)}"></label><label>CPF ou CNPJ<input name="document" value="${esc(supplier.document)}" required></label><label>Tipo de serviço<input name="serviceType" value="${esc(supplier.serviceType)}"></label><label>Telefone<input name="phone" value="${esc(supplier.phone)}"></label><label>E-mail<input name="email" type="email" value="${esc(supplier.email)}"></label><label class="wide">Chave Pix<input name="pixKey" value="${esc(supplier.pixKey)}"></label><label class="wide">Dados bancários<textarea name="bankDetails">${esc(supplier.bankDetails)}</textarea></label><label class="wide">Observações<textarea name="notes">${esc(supplier.notes)}</textarea></label><footer><button type="button" data-finance-close>Cancelar</button><button class="primary" type="submit">Salvar fornecedor</button></footer></form></section>`);
    modal.querySelector('form').addEventListener('submit', async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); const updated = { ...supplier, ...data, document: digits(data.document), updatedAt: new Date().toISOString() }; const index = state.suppliers.findIndex((item) => item.id === updated.id); if (index >= 0) state.suppliers[index] = updated; else state.suppliers.push(updated); closeModal(); await saveFinance(); if (afterSave) afterSave(updated); });
  };

  const paymentModal = (context = {}, existing = null) => {
    if (!state.suppliers.length) { supplierModal(null, (supplier) => paymentModal(context, { supplierId: supplier.id })); return; }
    const payment = { id: `payment-${crypto.randomUUID()}`, inaugurationId: context.inaugurationId || '', actionId: context.actionId || '', unit: context.unit || '', openingDate: context.openingDate || '', actionName: context.actionName || '', supplierId: '', amount: context.amount || 0, dueDate: '', status: 'draft', documentNumber: '', documentReference: '', notes: '', approvedBy: '', createdAt: new Date().toISOString(), ...(existing || {}) };
    const modal = showModal(`<section class="pmh-finance-dialog"><header><div><h2>${existing?.id ? 'Editar' : 'Gerar'} pagamento</h2><p>${esc(payment.unit || 'Selecione a origem')} · ${esc(payment.actionName || 'Ação inaugural')}</p></div><button data-finance-close>×</button></header><form class="pmh-finance-form"><label>Unidade<input name="unit" value="${esc(payment.unit)}" required></label><label>Ação<input name="actionName" value="${esc(payment.actionName)}" required></label><label>Fornecedor<select name="supplierId" required><option value="">Selecione</option>${state.suppliers.map((supplier) => `<option value="${esc(supplier.id)}" ${supplier.id === payment.supplierId ? 'selected' : ''}>${esc(supplier.legalName)}</option>`).join('')}</select></label><label>Valor<input name="amount" type="number" min="0.01" step="0.01" value="${Number(payment.amount) || ''}" required></label><label>Vencimento<input name="dueDate" type="date" value="${esc(payment.dueDate)}"></label><label>Status<select name="status">${statusOptions(payment.status)}</select></label><label>Nº da NF / recibo<input name="documentNumber" value="${esc(payment.documentNumber)}"></label><label>Referência do documento<input name="documentReference" value="${esc(payment.documentReference)}"></label><label>Aprovado por<input name="approvedBy" value="${esc(payment.approvedBy)}"></label><label class="wide">Observações<textarea name="notes">${esc(payment.notes)}</textarea></label><p class="pmh-finance-note wide">O pagamento ficará vinculado à unidade, inauguração, ação e fornecedor.</p><footer><button type="button" data-finance-close>Cancelar</button><button class="primary" type="submit">Salvar pagamento</button></footer></form></section>`);
    modal.querySelector('form').addEventListener('submit', async (event) => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); const updated = { ...payment, ...data, amount: Number(data.amount), updatedAt: new Date().toISOString() }; if (updated.status === 'sent_finance' && !updated.sentAt) updated.sentAt = new Date().toISOString(); if (updated.status === 'paid' && !updated.paidAt) updated.paidAt = new Date().toISOString(); const index = state.payments.findIndex((item) => item.id === updated.id); if (index >= 0) state.payments[index] = updated; else state.payments.push(updated); closeModal(); await saveFinance(); });
  };

  const openFromAction = async (inaugurationId, actionId) => {
    if (!state.configured || !state.suppliers.length) await loadFinance();
    if (state.configured === false) { openFinance(); return; }
    const payload = await apiJson(API.inaugurations); const inauguration = (payload.data || []).find((item) => String(item.id) === String(inaugurationId)); const action = inauguration?.inauguralActions?.find((item) => String(item.id) === String(actionId));
    if (!inauguration || !action) throw new Error('Não encontrei a inauguração ou a ação selecionada.');
    const existing = state.payments.find((item) => item.inaugurationId === inaugurationId && item.actionId === actionId);
    paymentModal({ inaugurationId, actionId, unit: inauguration.unit, openingDate: inauguration.openingDate, actionName: action.name, amount: Number(action.actualAmount || action.plannedAmount || 0) }, existing || null);
  };

  const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const exportCsv = () => { const rows = [['Unidade', 'Ação', 'Fornecedor', 'CPF/CNPJ', 'Valor', 'Vencimento', 'Status', 'Pix', 'Dados bancários', 'NF/Recibo', 'Observações']]; state.payments.forEach((payment) => { const supplier = supplierById(payment.supplierId) || {}; rows.push([payment.unit, payment.actionName, supplier.legalName, supplier.document, payment.amount, payment.dueDate, STATUS_LABELS[payment.status], supplier.pixKey, supplier.bankDetails, payment.documentNumber, payment.notes]); }); const csv = `\ufeff${rows.map((row) => row.map(csvCell).join(';')).join('\n')}`; const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); link.download = `pagamentos-inauguracoes-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href); };

  const openFinance = () => { state.active = true; document.querySelectorAll('.pmh-sidebar nav button').forEach((button) => button.classList.toggle('active', button.hasAttribute('data-finance-open'))); loadFinance(); };
  const injectNav = () => { const nav = document.querySelector('.pmh-sidebar nav'); if (!nav || nav.querySelector('[data-finance-open]')) return; const button = document.createElement('button'); button.type = 'button'; button.dataset.financeOpen = '1'; button.innerHTML = '<i>◈</i><span>Pagamentos</span><b></b>'; const contentsButton = nav.querySelector('[data-view="conteudos"]'); nav.insertBefore(button, contentsButton || null); };
  const refreshPaymentButtons = () => { document.querySelectorAll('.pmh-action').forEach((article) => { if (article.querySelector('[data-generate-payment]')) return; const input = article.querySelector('[data-action-field="actualAmount"]'); if (!input || input.disabled) return; const button = document.createElement('button'); button.type = 'button'; button.className = 'pmh-pay-button'; button.dataset.generatePayment = '1'; button.dataset.inaugurationId = input.dataset.item || ''; button.dataset.actionId = input.dataset.action || ''; button.textContent = 'Gerar pagamento'; article.appendChild(button); }); };

  document.addEventListener('click', (event) => {
    const financeOpen = event.target.closest('[data-finance-open]'); if (financeOpen) { event.preventDefault(); event.stopImmediatePropagation(); openFinance(); return; }
    if (event.target.closest('.pmh-sidebar nav button:not([data-finance-open])')) state.active = false;
    if (event.target.closest('[data-finance-new-supplier]')) supplierModal(); if (event.target.closest('[data-finance-new-payment]')) paymentModal(); if (event.target.closest('[data-finance-export]')) exportCsv();
    const editSupplier = event.target.closest('[data-finance-edit-supplier]'); if (editSupplier) supplierModal(supplierById(editSupplier.dataset.financeEditSupplier));
    const editPayment = event.target.closest('[data-finance-edit-payment]'); if (editPayment) paymentModal({}, state.payments.find((item) => item.id === editPayment.dataset.financeEditPayment));
    const generate = event.target.closest('[data-generate-payment]'); if (generate) openFromAction(generate.dataset.inaugurationId, generate.dataset.actionId).catch((error) => alert(error.message));
  }, true);

  document.addEventListener('change', (event) => { const select = event.target.closest('[data-payment-status]'); if (!select) return; const payment = state.payments.find((item) => item.id === select.dataset.paymentStatus); if (!payment) return; payment.status = select.value; payment.updatedAt = new Date().toISOString(); if (payment.status === 'sent_finance') payment.sentAt = payment.sentAt || new Date().toISOString(); if (payment.status === 'paid') payment.paidAt = payment.paidAt || new Date().toISOString(); saveFinance(); });
  const observer = new MutationObserver(() => { injectNav(); refreshPaymentButtons(); }); observer.observe(document.documentElement, { childList: true, subtree: true }); injectNav(); refreshPaymentButtons();
})();
