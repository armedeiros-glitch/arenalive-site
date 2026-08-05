(() => {
  'use strict';

  const FINANCE_API = '/api/hub/financeiro';
  const paymentDocument = window.PlanetPaymentDocument;
  if (!paymentDocument) return;

  const loadFinance = async () => {
    const response = await fetch(FINANCE_API, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
    return payload;
  };

  const generateRequest = async (paymentId, popup) => {
    try {
      const payload = await loadFinance();
      const payment = (payload.payments || []).find((item) => String(item.id) === String(paymentId));
      if (!payment) throw new Error('Pagamento não encontrado. Atualize a página e tente novamente.');
      const supplier = (payload.suppliers || []).find((item) => String(item.id) === String(payment.supplierId));
      if (!supplier) throw new Error('Fornecedor vinculado ao pagamento não foi encontrado.');
      paymentDocument.writePopup(
        popup,
        paymentDocument.renderReport(payment, supplier, { mode: 'registered' }),
        { detachOpener: true },
      );
    } catch (error) {
      paymentDocument.writePopup(
        popup,
        paymentDocument.renderError(error instanceof Error ? error.message : String(error), { mode: 'registered' }),
      );
    }
  };

  const decorate = () => {
    const exportButton = document.querySelector('[data-finance-export]');
    if (exportButton && exportButton.dataset.printLabelApplied !== 'true') {
      exportButton.textContent = 'Exportar planilha (CSV)';
      exportButton.title = 'Exportação geral para conferência. O documento para assinatura fica em cada pagamento.';
      exportButton.dataset.printLabelApplied = 'true';
    }

    document.querySelectorAll('[data-finance-edit-payment]').forEach((editButton) => {
      const paymentId = editButton.dataset.financeEditPayment;
      const row = editButton.closest('.pmh-payment-row');
      if (!paymentId || !row || row.querySelector(`[data-payment-request="${CSS.escape(paymentId)}"]`)) return;

      let actions = editButton.closest('.pmh-payment-actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.className = 'pmh-payment-actions';
        editButton.replaceWith(actions);
        actions.appendChild(editButton);
      }

      const printButton = document.createElement('button');
      printButton.type = 'button';
      printButton.className = 'pmh-payment-request-button';
      printButton.dataset.paymentRequest = paymentId;
      printButton.textContent = 'Gerar solicitação';
      printButton.title = 'Gerar documento A4 para imprimir, assinar e entregar ao financeiro';
      actions.prepend(printButton);
    });
  };

  const style = document.createElement('style');
  style.textContent = `
    .pmh-payment-actions{display:grid;gap:7px;min-width:150px}
    .pmh-payment-actions button{width:100%}
    .pmh-payment-request-button{min-height:38px;padding:0 10px;border:1px solid #ef651d!important;border-radius:9px!important;color:#fff!important;background:#ef651d!important;font-size:14px!important;font-weight:850!important}
    @media(max-width:1050px){.pmh-payment-actions{justify-self:start;width:210px}}
  `;
  document.head.appendChild(style);

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-payment-request]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();

    const popup = window.open('', '_blank');
    if (!popup) {
      window.alert('O navegador bloqueou a nova janela. Libere pop-ups para este site e tente novamente.');
      return;
    }
    paymentDocument.writePopup(
      popup,
      paymentDocument.renderLoading({ mode: 'registered' }),
    );
    generateRequest(button.dataset.paymentRequest, popup);
  }, true);

  const observer = new MutationObserver(decorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  decorate();
})();
