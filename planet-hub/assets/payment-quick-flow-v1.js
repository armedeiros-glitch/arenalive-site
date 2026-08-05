(() => {
  'use strict';

  const API = {
    finance: '/api/hub/financeiro',
    inaugurations: '/api/hub/inauguracoes',
  };
  const paymentDocument = window.PlanetPaymentDocument;
  if (!paymentDocument) return;

  const esc = paymentDocument.escapeHtml;
  const digits = paymentDocument.digits;
  const documentBr = paymentDocument.formatDocument;

  const apiJson = async (url, options = {}) => {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
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

  const closeModal = () => document.querySelector('.pmh-quick-payment-modal')?.remove();

  const upsertAndSave = async ({ supplier, payment, preferredRevision }) => {
    const attempt = async (document, allowRetry) => {
      const suppliers = [...(document.suppliers || [])];
      const payments = [...(document.payments || [])];

      const supplierIndex = suppliers.findIndex((item) => item.id === supplier.id);
      if (supplierIndex >= 0) suppliers[supplierIndex] = supplier;
      else suppliers.push(supplier);

      const paymentIndex = payments.findIndex((item) => item.id === payment.id);
      if (paymentIndex >= 0) payments[paymentIndex] = payment;
      else payments.push(payment);

      try {
        return await apiJson(API.finance, {
          method: 'PUT',
          body: JSON.stringify({
            suppliers,
            payments,
            baseRevision: document.revision || preferredRevision || null,
          }),
        });
      } catch (error) {
        if (error.status === 409 && allowRetry) {
          const fresh = await apiJson(API.finance);
          return attempt(fresh, false);
        }
        throw error;
      }
    };

    const latest = await apiJson(API.finance);
    return attempt(latest, true);
  };

  const openCombinedModal = ({ finance, inauguration, action, originButton }) => {
    closeModal();
    const existingPayment = (finance.payments || []).find((item) =>
      String(item.inaugurationId) === String(inauguration.id)
      && String(item.actionId) === String(action.id));
    const existingSupplier = (finance.suppliers || []).find((item) =>
      String(item.id) === String(existingPayment?.supplierId || ''));

    const modal = document.createElement('div');
    modal.className = 'pmh-finance-modal pmh-quick-payment-modal';
    modal.innerHTML = `<section class="pmh-finance-dialog pmh-quick-payment-dialog">
      <header><div><h2>${existingPayment ? 'Editar e imprimir pagamento' : 'Gerar solicitação de pagamento'}</h2><p>${esc(inauguration.unit)} · ${esc(action.name)}</p></div><button type="button" data-quick-close>×</button></header>
      <form class="pmh-finance-form" data-quick-payment-form>
        <div class="pmh-quick-section wide"><strong>Fornecedor</strong><span>Escolha um já cadastrado ou preencha um novo. Ao imprimir, o cadastro será salvo automaticamente.</span></div>
        <label class="wide">Fornecedor já cadastrado<select name="supplierChoice" data-quick-supplier-choice><option value="">Novo fornecedor</option>${(finance.suppliers || []).map((item) => `<option value="${esc(item.id)}" ${item.id === existingSupplier?.id ? 'selected' : ''}>${esc(item.legalName)} · ${esc(documentBr(item.document))}</option>`).join('')}</select></label>
        <label>Nome / razão social<input name="legalName" value="${esc(existingSupplier?.legalName || '')}" required></label>
        <label>Nome fantasia<input name="tradeName" value="${esc(existingSupplier?.tradeName || '')}"></label>
        <label>CPF ou CNPJ<input name="document" value="${esc(existingSupplier?.document || '')}" required></label>
        <label>Tipo de serviço<input name="serviceType" value="${esc(existingSupplier?.serviceType || action.name || '')}"></label>
        <label>Telefone<input name="phone" value="${esc(existingSupplier?.phone || '')}"></label>
        <label>E-mail<input name="email" type="email" value="${esc(existingSupplier?.email || '')}"></label>
        <label class="wide">Chave Pix<input name="pixKey" value="${esc(existingSupplier?.pixKey || '')}"></label>
        <label class="wide">Dados bancários<textarea name="bankDetails">${esc(existingSupplier?.bankDetails || '')}</textarea></label>

        <div class="pmh-quick-section wide"><strong>Pagamento</strong><span>Os dados da unidade e da ação já estão vinculados automaticamente.</span></div>
        <label>Unidade<input value="${esc(inauguration.unit)}" readonly></label>
        <label>Ação<input value="${esc(action.name)}" readonly></label>
        <label>Valor<input name="amount" type="number" min="0.01" step="0.01" value="${Number(existingPayment?.amount || action.actualAmount || action.plannedAmount || 0) || ''}" required></label>
        <label>Vencimento<input name="dueDate" type="date" value="${esc(existingPayment?.dueDate || '')}"></label>
        <label>Nº da NF / recibo<input name="documentNumber" value="${esc(existingPayment?.documentNumber || '')}"></label>
        <label>Referência do documento<input name="documentReference" value="${esc(existingPayment?.documentReference || '')}"></label>
        <label class="wide">Responsável pela solicitação<input name="approvedBy" value="${esc(existingPayment?.approvedBy || 'André Medeiros')}"></label>
        <label class="wide">Observações<textarea name="notes">${esc(existingPayment?.notes || action.notes || '')}</textarea></label>
        <p class="pmh-finance-note wide">Ao clicar em <strong>Salvar e imprimir</strong>, o fornecedor e o pagamento serão gravados e a solicitação A4 abrirá pronta para assinatura.</p>
        <footer><button type="button" data-quick-close>Cancelar</button><button class="primary" type="submit">Salvar e imprimir</button></footer>
      </form>
    </section>`;
    document.body.appendChild(modal);

    const form = modal.querySelector('[data-quick-payment-form]');
    const choice = modal.querySelector('[data-quick-supplier-choice]');
    const fillSupplier = (supplier) => {
      const values = supplier || {};
      ['legalName', 'tradeName', 'document', 'serviceType', 'phone', 'email', 'pixKey', 'bankDetails'].forEach((name) => {
        const field = form.elements.namedItem(name);
        if (!field) return;
        field.value = name === 'serviceType' ? (values[name] || action.name || '') : (values[name] || '');
      });
    };

    choice.addEventListener('change', () => {
      const selected = (finance.suppliers || []).find((item) => item.id === choice.value);
      fillSupplier(selected || null);
    });
    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.closest('[data-quick-close]')) closeModal();
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submitButton = form.querySelector('[type="submit"]');
      const popup = window.open('', '_blank');
      if (!popup) {
        window.alert('O navegador bloqueou a impressão. Libere pop-ups para este site e tente novamente.');
        return;
      }
      paymentDocument.writePopup(
        popup,
        paymentDocument.renderLoading({ mode: 'quick' }),
      );
      submitButton.disabled = true;
      submitButton.textContent = 'Salvando…';

      try {
        const data = Object.fromEntries(new FormData(form));
        const supplierDocument = digits(data.document);
        if (![11, 14].includes(supplierDocument.length)) throw new Error('Informe um CPF ou CNPJ válido.');
        const amount = Number(data.amount);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('Informe um valor válido para o pagamento.');

        const latest = await apiJson(API.finance);
        const chosenSupplier = (latest.suppliers || []).find((item) => item.id === data.supplierChoice)
          || (latest.suppliers || []).find((item) => digits(item.document) === supplierDocument);
        const timestamp = new Date().toISOString();
        const supplier = {
          ...(chosenSupplier || {}),
          id: chosenSupplier?.id || `supplier-${crypto.randomUUID()}`,
          legalName: String(data.legalName || '').trim(),
          tradeName: String(data.tradeName || '').trim(),
          document: supplierDocument,
          phone: String(data.phone || '').trim(),
          email: String(data.email || '').trim(),
          pixKey: String(data.pixKey || '').trim(),
          bankDetails: String(data.bankDetails || '').trim(),
          serviceType: String(data.serviceType || action.name || '').trim(),
          notes: chosenSupplier?.notes || '',
          createdAt: chosenSupplier?.createdAt || timestamp,
          updatedAt: timestamp,
        };
        if (!supplier.legalName) throw new Error('Informe o nome ou razão social do fornecedor.');

        const currentPayment = (latest.payments || []).find((item) =>
          String(item.inaugurationId) === String(inauguration.id)
          && String(item.actionId) === String(action.id));
        const payment = {
          ...(currentPayment || existingPayment || {}),
          id: currentPayment?.id || existingPayment?.id || `payment-${crypto.randomUUID()}`,
          inaugurationId: String(inauguration.id),
          actionId: String(action.id),
          unit: inauguration.unit,
          openingDate: inauguration.openingDate || '',
          actionName: action.name,
          supplierId: supplier.id,
          amount,
          dueDate: String(data.dueDate || ''),
          status: currentPayment?.status || existingPayment?.status || 'awaiting_approval',
          documentNumber: String(data.documentNumber || '').trim(),
          documentReference: String(data.documentReference || '').trim(),
          notes: String(data.notes || '').trim(),
          approvedBy: String(data.approvedBy || '').trim(),
          createdAt: currentPayment?.createdAt || existingPayment?.createdAt || timestamp,
          updatedAt: timestamp,
        };

        const saved = await upsertAndSave({ supplier, payment, preferredRevision: latest.revision });
        const savedSupplier = (saved.suppliers || []).find((item) => item.id === supplier.id) || supplier;
        const savedPayment = (saved.payments || []).find((item) => item.id === payment.id) || payment;

        closeModal();
        if (originButton) {
          originButton.textContent = 'Pagamento salvo · imprimir novamente';
          originButton.title = 'Editar os dados ou imprimir novamente a solicitação';
        }
        paymentDocument.writePopup(
          popup,
          paymentDocument.renderReport(savedPayment, savedSupplier, { mode: 'quick' }),
        );
        popup.focus();
        setTimeout(() => {
          try { popup.print(); } catch (_) { /* O botão de impressão permanece disponível. */ }
        }, 450);
      } catch (error) {
        submitButton.disabled = false;
        submitButton.textContent = 'Salvar e imprimir';
        paymentDocument.writePopup(
          popup,
          paymentDocument.renderError(error instanceof Error ? error.message : String(error), { mode: 'quick' }),
        );
      }
    });
  };

  const handleGenerate = async (button) => {
    const originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Carregando…';
    try {
      const [finance, inaugurations] = await Promise.all([
        apiJson(API.finance),
        apiJson(API.inaugurations),
      ]);
      const inauguration = (inaugurations.data || []).find((item) =>
        String(item.id) === String(button.dataset.inaugurationId));
      const action = inauguration?.inauguralActions?.find((item) =>
        String(item.id) === String(button.dataset.actionId));
      if (!inauguration || !action) throw new Error('Não encontrei a inauguração ou a ação selecionada.');
      openCombinedModal({ finance, inauguration, action, originButton: button });
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    } finally {
      button.disabled = false;
      if (button.textContent === 'Carregando…') button.textContent = originalText;
    }
  };

  window.addEventListener('click', (event) => {
    const button = event.target.closest?.('[data-generate-payment]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    handleGenerate(button);
  }, true);

  const style = document.createElement('style');
  style.textContent = `
    .pmh-quick-payment-dialog{width:min(880px,100%)}
    .pmh-quick-section{padding:12px 14px;border-radius:11px;background:#fff3eb}
    .pmh-quick-section strong,.pmh-quick-section span{display:block}
    .pmh-quick-section strong{font-size:16px;color:#572f1f}
    .pmh-quick-section span{margin-top:4px;color:#806d64;font-size:14px;line-height:1.45}
    .pmh-pay-button{min-width:190px}
  `;
  document.head.appendChild(style);

  const decorate = () => {
    document.querySelectorAll('[data-generate-payment]').forEach((button) => {
      if (button.dataset.quickFlowReady === 'true') return;
      button.textContent = 'Preencher e imprimir';
      button.title = 'Preencher fornecedor e pagamento, salvar tudo e imprimir a solicitação';
      button.dataset.quickFlowReady = 'true';
    });
    document.querySelectorAll('[data-finance-new-supplier], [data-finance-new-payment]').forEach((button) => {
      button.hidden = true;
    });
  };

  const observer = new MutationObserver(decorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  decorate();
})();
