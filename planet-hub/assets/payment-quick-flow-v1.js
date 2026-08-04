(() => {
  'use strict';

  const API = {
    finance: '/api/hub/financeiro',
    inaugurations: '/api/hub/inauguracoes',
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));
  const digits = (value) => String(value || '').replace(/\D/g, '');
  const money = (value) => new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
  }).format(Number(value) || 0);
  const dateBr = (value) => {
    if (!value) return 'Não informado';
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('pt-BR').format(date);
  };
  const documentBr = (value) => {
    const valueDigits = digits(value);
    if (valueDigits.length === 11) return valueDigits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (valueDigits.length === 14) return valueDigits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return valueDigits || 'Não informado';
  };
  const lines = (value) => esc(value || 'Não informado').replace(/\n/g, '<br>');

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

  const loadingDocument = () => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Salvando solicitação</title><style>body{font-family:Arial,sans-serif;display:grid;place-items:center;min-height:90vh;color:#382720}p{font-size:18px}</style></head><body><p>Salvando os dados e preparando a impressão…</p></body></html>`;
  const errorDocument = (message) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Falha ao gerar solicitação</title><style>body{font-family:Arial,sans-serif;max-width:720px;margin:60px auto;padding:24px;color:#382720}div{padding:22px;border:1px solid #e0c9bf;border-radius:14px;background:#fff6f2}h1{font-size:24px}p{font-size:16px;line-height:1.5}</style></head><body><div><h1>Não foi possível gerar a solicitação</h1><p>${esc(message)}</p></div></body></html>`;

  const reportDocument = (payment, supplier) => {
    const generatedAt = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'long', timeStyle: 'short',
    }).format(new Date());
    const requestId = String(payment.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();

    return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Solicitação de pagamento · ${esc(payment.unit)}</title>
  <style>
    @page{size:A4;margin:14mm}
    *{box-sizing:border-box}
    body{margin:0;background:#ece7e3;color:#2d211c;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.42}
    .toolbar{position:sticky;top:0;z-index:4;display:flex;justify-content:center;gap:10px;padding:12px;background:#2f211c}
    .toolbar button{min-height:42px;padding:0 18px;border:0;border-radius:9px;font-size:14px;font-weight:700;cursor:pointer}
    .toolbar .print{color:#fff;background:#f26419}.toolbar .close{color:#382820;background:#fff}
    .page{width:210mm;min-height:297mm;margin:18px auto;padding:15mm;background:#fff;box-shadow:0 18px 55px rgba(42,25,18,.18)}
    .header{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding-bottom:16px;border-bottom:4px solid #f26419}
    .brand{display:flex;align-items:center;gap:12px}.mark{display:grid;place-items:center;width:48px;height:48px;border-radius:13px;color:#fff;background:#f26419;font-size:25px;font-weight:900}
    .brand strong,.brand span,.meta strong,.meta span{display:block}.brand strong{font-size:18px}.brand span{margin-top:3px;color:#765f54;font-size:11px;letter-spacing:.13em;text-transform:uppercase}.meta{text-align:right}.meta strong{font-size:15px}.meta span{margin-top:4px;color:#79685f}
    h1{margin:24px 0 5px;font-size:25px;text-align:center;text-transform:uppercase}.subtitle{margin:0 0 22px;color:#79685f;text-align:center}
    .section{margin-top:15px;border:1px solid #d9cec8;border-radius:10px;overflow:hidden;break-inside:avoid}.section h2{margin:0;padding:9px 12px;color:#fff;background:#3a2922;font-size:12px;letter-spacing:.08em;text-transform:uppercase}
    .grid{display:grid;grid-template-columns:1fr 1fr}.field{min-height:62px;padding:10px 12px;border-right:1px solid #e6ddd8;border-bottom:1px solid #e6ddd8}.field:nth-child(2n){border-right:0}.field.full{grid-column:1/-1;border-right:0}.field label,.field strong,.field span{display:block}.field label{margin-bottom:5px;color:#7d6c63;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.field strong{font-size:13px}.field span{color:#44342d}
    .amount{padding:18px;border:2px solid #f26419;background:#fff8f3;text-align:center}.amount label{display:block;color:#91502d;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.amount strong{display:block;margin-top:6px;font-size:29px}
    .declaration{margin-top:20px;padding:15px;border:1px solid #d9cec8;border-radius:10px;text-align:justify}.declaration p{margin:0}.checks{display:flex;gap:22px;margin-top:13px;font-size:11px}.checks span::before{content:'☐';margin-right:6px;font-size:15px}
    .signatures{display:grid;grid-template-columns:1fr 1fr;gap:35px;margin-top:60px;break-inside:avoid}.signature{padding-top:8px;border-top:1px solid #3b2c26;text-align:center}.signature strong,.signature span{display:block}.signature strong{font-size:12px}.signature span{margin-top:3px;color:#74635a;font-size:10px}
    .receipt{margin-top:55px;padding-top:14px;border-top:1px dashed #a99489}.receipt h3{margin:0 0 12px;font-size:13px;text-align:center;text-transform:uppercase}.receipt-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.receipt-line{min-height:38px;padding-top:20px;border-bottom:1px solid #514139;color:#7b6960;font-size:10px}
    footer{margin-top:25px;padding-top:10px;border-top:1px solid #e2d8d3;color:#8b7b73;font-size:9px;text-align:center}
    @media print{body{background:#fff}.toolbar{display:none}.page{width:auto;min-height:auto;margin:0;padding:0;box-shadow:none}}
    @media(max-width:850px){.page{width:100%;min-height:0;margin:0;padding:24px}.grid,.signatures,.receipt-grid{grid-template-columns:1fr}.field{border-right:0}.toolbar{position:static}}
  </style>
</head>
<body>
  <div class="toolbar"><button class="print" onclick="window.print()">Imprimir / Salvar em PDF</button><button class="close" onclick="window.close()">Fechar</button></div>
  <main class="page">
    <header class="header">
      <div class="brand"><div class="mark">P</div><div><strong>Planet Chocolate</strong><span>Marketing Hub</span></div></div>
      <div class="meta"><strong>PG-${esc(requestId || Date.now().toString().slice(-8))}</strong><span>Gerado em ${esc(generatedAt)}</span></div>
    </header>
    <h1>Solicitação de pagamento</h1>
    <p class="subtitle">Ação de inauguração de unidade Planet Chocolate</p>

    <section class="section"><h2>Origem da solicitação</h2><div class="grid">
      <div class="field"><label>Unidade</label><strong>${esc(payment.unit || 'Não informada')}</strong></div>
      <div class="field"><label>Data da inauguração</label><strong>${esc(dateBr(payment.openingDate))}</strong></div>
      <div class="field full"><label>Ação / serviço contratado</label><strong>${esc(payment.actionName || 'Não informado')}</strong></div>
    </div></section>

    <section class="section"><h2>Fornecedor</h2><div class="grid">
      <div class="field"><label>Nome / razão social</label><strong>${esc(supplier.legalName || 'Não informado')}</strong></div>
      <div class="field"><label>Nome fantasia</label><strong>${esc(supplier.tradeName || 'Não informado')}</strong></div>
      <div class="field"><label>CPF / CNPJ</label><strong>${esc(documentBr(supplier.document))}</strong></div>
      <div class="field"><label>Tipo de serviço</label><strong>${esc(supplier.serviceType || payment.actionName || 'Não informado')}</strong></div>
      <div class="field"><label>Telefone</label><span>${esc(supplier.phone || 'Não informado')}</span></div>
      <div class="field"><label>E-mail</label><span>${esc(supplier.email || 'Não informado')}</span></div>
    </div></section>

    <section class="section"><h2>Dados para pagamento</h2><div class="grid">
      <div class="field"><label>Vencimento solicitado</label><strong>${esc(dateBr(payment.dueDate))}</strong></div>
      <div class="field"><label>Chave Pix</label><strong>${esc(supplier.pixKey || 'Não informada')}</strong></div>
      <div class="field full"><label>Dados bancários</label><span>${lines(supplier.bankDetails)}</span></div>
      <div class="field"><label>Nº da nota fiscal / recibo</label><strong>${esc(payment.documentNumber || 'Não informado')}</strong></div>
      <div class="field"><label>Referência do documento</label><span>${esc(payment.documentReference || 'Não informado')}</span></div>
    </div><div class="amount"><label>Valor solicitado</label><strong>${money(payment.amount)}</strong></div></section>

    <section class="section"><h2>Justificativa e observações</h2><div class="field full"><span>${lines(payment.notes || `Pagamento referente à ação “${payment.actionName || 'inaugural'}” da unidade ${payment.unit || 'Planet Chocolate'}.`)}</span></div></section>

    <div class="declaration"><p>Solicito o pagamento acima descrito, declarando que os dados do fornecedor foram conferidos e que o serviço está relacionado à ação de inauguração informada neste documento.</p><div class="checks"><span>Serviço executado</span><span>Documento fiscal conferido</span><span>Dados de pagamento conferidos</span></div></div>
    <section class="signatures"><div class="signature"><strong>${esc(payment.approvedBy || 'Responsável pelo Marketing')}</strong><span>Solicitante / aprovação</span></div><div class="signature"><strong>Financeiro</strong><span>Recebimento e conferência</span></div></section>
    <section class="receipt"><h3>Protocolo de recebimento pelo financeiro</h3><div class="receipt-grid"><div class="receipt-line">Recebido por</div><div class="receipt-line">Data e horário</div></div></section>
    <footer>Documento gerado pelo Planet Marketing Hub. Contém dados financeiros de uso interno.</footer>
  </main>
</body>
</html>`;
  };

  const closeModal = () => document.querySelector('.pmh-quick-payment-modal')?.remove();

  const writePopup = (popup, html) => {
    if (!popup || popup.closed) return;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  };

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
      writePopup(popup, loadingDocument());
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
        writePopup(popup, reportDocument(savedPayment, savedSupplier));
        popup.focus();
        setTimeout(() => {
          try { popup.print(); } catch (_) { /* O botão de impressão permanece disponível. */ }
        }, 450);
      } catch (error) {
        submitButton.disabled = false;
        submitButton.textContent = 'Salvar e imprimir';
        writePopup(popup, errorDocument(error instanceof Error ? error.message : String(error)));
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
