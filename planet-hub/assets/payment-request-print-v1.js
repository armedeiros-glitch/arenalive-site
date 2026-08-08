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

  const saveFinance = async ({ suppliers, payments, baseRevision }) => {
    const response = await fetch(FINANCE_API, {
      method: 'PUT',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({ suppliers, payments, baseRevision }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || `Falha HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }
    return payload;
  };

  const deletePayment = async (paymentId) => {
    const attempt = async (document, allowRetry) => {
      const payments = (document.payments || []).filter((item) => String(item.id) !== String(paymentId));
      try {
        return await saveFinance({
          suppliers: [...(document.suppliers || [])],
          payments,
          baseRevision: document.revision || null,
        });
      } catch (error) {
        if (error.status === 409 && allowRetry) {
          const fresh = await loadFinance();
          return attempt(fresh, false);
        }
        throw error;
      }
    };

    const latest = await loadFinance();
    return attempt(latest, true);
  };

  const refreshPaymentCounters = () => {
    const rows = document.querySelectorAll('.pmh-payment-row').length;
    document.querySelectorAll('.pmh-finance-dialog, .pmh-inauguration-finance-panel').forEach((scope) => {
      scope.querySelectorAll('span, p').forEach((element) => {
        const text = element.textContent || '';
        if (/^\d+ registros?$/.test(text.trim())) {
          element.textContent = `${rows} ${rows === 1 ? 'registro' : 'registros'}`;
        } else if (/\d+ pagamento\(s\)/.test(text)) {
          element.textContent = text.replace(/\d+ pagamento\(s\)/, `${rows} pagamento(s)`);
        }
      });
    });
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
      if (!paymentId || !row) return;

      let actions = editButton.closest('.pmh-payment-actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.className = 'pmh-payment-actions';
        editButton.replaceWith(actions);
        actions.appendChild(editButton);
      }

      if (!actions.querySelector(`[data-payment-request="${CSS.escape(paymentId)}"]`)) {
        const printButton = document.createElement('button');
        printButton.type = 'button';
        printButton.className = 'pmh-payment-request-button';
        printButton.dataset.paymentRequest = paymentId;
        printButton.textContent = 'Gerar solicitação';
        printButton.title = 'Gerar documento A4 para imprimir, assinar e entregar ao financeiro';
        actions.prepend(printButton);
      }

      if (!actions.querySelector(`[data-payment-delete="${CSS.escape(paymentId)}"]`)) {
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'pmh-payment-delete-button';
        deleteButton.dataset.paymentDelete = paymentId;
        deleteButton.textContent = 'Excluir';
        deleteButton.title = 'Excluir este pagamento sem apagar o fornecedor';
        actions.appendChild(deleteButton);
      }
    });
  };

  document.addEventListener('click', async (event) => {
    const deleteButton = event.target.closest('[data-payment-delete]');
    if (deleteButton) {
      event.preventDefault();
      event.stopPropagation();

      const paymentId = deleteButton.dataset.paymentDelete;
      const row = deleteButton.closest('.pmh-payment-row');
      if (!paymentId || !row) return;

      const confirmed = window.confirm('Excluir este pagamento?\n\nO fornecedor continuará cadastrado.');
      if (!confirmed) return;

      const originalText = deleteButton.textContent;
      deleteButton.disabled = true;
      deleteButton.textContent = 'Excluindo…';
      try {
        await deletePayment(paymentId);
        row.remove();
        refreshPaymentCounters();
      } catch (error) {
        deleteButton.disabled = false;
        deleteButton.textContent = originalText;
        window.alert(error instanceof Error ? error.message : 'Não foi possível excluir o pagamento.');
      }
      return;
    }

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

  window.addEventListener('pmh:view-rendered', decorate);
  decorate();
})();
