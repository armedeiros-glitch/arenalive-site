(() => {
  'use strict';

  const FINANCE_API = '/api/hub/financeiro';
  const STATUS_LABELS = {
    draft: 'Rascunho',
    docs_pending: 'Documentação pendente',
    awaiting_approval: 'Aguardando aprovação',
    sent_finance: 'Enviado ao financeiro',
    paid: 'Pago',
    rejected: 'Recusado',
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const money = (value) => new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
  }).format(Number(value) || 0);

  const formatDate = (value) => {
    if (!value) return 'Não informado';
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? esc(value)
      : new Intl.DateTimeFormat('pt-BR').format(date);
  };

  const formatDocument = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return digits || 'Não informado';
  };

  const lines = (value) => esc(value || 'Não informado').replace(/\n/g, '<br>');

  const requestNumber = (payment) => {
    const suffix = String(payment.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();
    return `PG-${suffix || Date.now().toString().slice(-8)}`;
  };

  const loadingDocument = () => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Preparando solicitação</title><style>body{font-family:Arial,sans-serif;display:grid;place-items:center;min-height:90vh;color:#382720}p{font-size:18px}</style></head><body><p>Preparando a solicitação de pagamento…</p></body></html>`;

  const errorDocument = (message) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Falha ao gerar documento</title><style>body{font-family:Arial,sans-serif;max-width:720px;margin:60px auto;padding:24px;color:#382720}div{padding:20px;border:1px solid #e0c9bf;border-radius:14px;background:#fff6f2}h1{font-size:24px}p{font-size:16px;line-height:1.5}</style></head><body><div><h1>Não foi possível gerar o documento</h1><p>${esc(message)}</p></div></body></html>`;

  const reportDocument = (payment, supplier) => {
    const generatedAt = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'long', timeStyle: 'short',
    }).format(new Date());
    const status = STATUS_LABELS[payment.status] || payment.status || 'Rascunho';
    const documentNumber = payment.documentNumber || 'Não informado';
    const documentReference = payment.documentReference || 'Não informado';
    const approvedBy = payment.approvedBy || '';

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
    .brand strong,.brand span{display:block}.brand strong{font-size:18px}.brand span{margin-top:3px;color:#765f54;font-size:11px;letter-spacing:.13em;text-transform:uppercase}
    .doc-meta{text-align:right}.doc-meta strong,.doc-meta span{display:block}.doc-meta strong{font-size:15px}.doc-meta span{margin-top:4px;color:#79685f}
    h1{margin:24px 0 5px;font-size:25px;text-align:center;text-transform:uppercase;letter-spacing:.03em}.subtitle{margin:0 0 22px;color:#79685f;text-align:center}
    .section{margin-top:15px;border:1px solid #d9cec8;border-radius:10px;overflow:hidden;break-inside:avoid}.section h2{margin:0;padding:9px 12px;color:#fff;background:#3a2922;font-size:12px;letter-spacing:.08em;text-transform:uppercase}
    .grid{display:grid;grid-template-columns:1fr 1fr}.field{min-height:62px;padding:10px 12px;border-right:1px solid #e6ddd8;border-bottom:1px solid #e6ddd8}.field:nth-child(2n){border-right:0}.field.full{grid-column:1/-1;border-right:0}.field label,.field strong,.field span{display:block}.field label{margin-bottom:5px;color:#7d6c63;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.field strong{font-size:13px}.field span{color:#44342d}
    .amount{padding:18px;border:2px solid #f26419;background:#fff8f3;text-align:center}.amount label{display:block;color:#91502d;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.amount strong{display:block;margin-top:6px;font-size:29px}
    .declaration{margin-top:20px;padding:15px;border:1px solid #d9cec8;border-radius:10px;text-align:justify}.declaration p{margin:0}.checkline{display:flex;gap:22px;margin-top:13px;font-size:11px}.checkline span::before{content:'☐';margin-right:6px;font-size:15px}
    .signatures{display:grid;grid-template-columns:1fr 1fr;gap:35px;margin-top:60px;break-inside:avoid}.signature{padding-top:8px;border-top:1px solid #3b2c26;text-align:center}.signature strong,.signature span{display:block}.signature strong{font-size:12px}.signature span{margin-top:3px;color:#74635a;font-size:10px}
    .receipt{margin-top:55px;padding-top:14px;border-top:1px dashed #a99489;break-inside:avoid}.receipt h3{margin:0 0 12px;font-size:13px;text-align:center;text-transform:uppercase}.receipt-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.receipt-line{min-height:38px;padding-top:20px;border-bottom:1px solid #514139;color:#7b6960;font-size:10px}
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
      <div class="doc-meta"><strong>${requestNumber(payment)}</strong><span>Gerado em ${esc(generatedAt)}</span><span>Status: ${esc(status)}</span></div>
    </header>

    <h1>Solicitação de pagamento</h1>
    <p class="subtitle">Ação de inauguração de unidade Planet Chocolate</p>

    <section class="section">
      <h2>Origem da solicitação</h2>
      <div class="grid">
        <div class="field"><label>Unidade</label><strong>${esc(payment.unit || 'Não informada')}</strong></div>
        <div class="field"><label>Data da inauguração</label><strong>${formatDate(payment.openingDate)}</strong></div>
        <div class="field full"><label>Ação / serviço contratado</label><strong>${esc(payment.actionName || 'Não informado')}</strong></div>
      </div>
    </section>

    <section class="section">
      <h2>Fornecedor</h2>
      <div class="grid">
        <div class="field"><label>Nome / razão social</label><strong>${esc(supplier.legalName || 'Não informado')}</strong></div>
        <div class="field"><label>Nome fantasia</label><strong>${esc(supplier.tradeName || 'Não informado')}</strong></div>
        <div class="field"><label>CPF / CNPJ</label><strong>${esc(formatDocument(supplier.document))}</strong></div>
        <div class="field"><label>Tipo de serviço</label><strong>${esc(supplier.serviceType || payment.actionName || 'Não informado')}</strong></div>
        <div class="field"><label>Telefone</label><span>${esc(supplier.phone || 'Não informado')}</span></div>
        <div class="field"><label>E-mail</label><span>${esc(supplier.email || 'Não informado')}</span></div>
      </div>
    </section>

    <section class="section">
      <h2>Dados para pagamento</h2>
      <div class="grid">
        <div class="field"><label>Vencimento solicitado</label><strong>${formatDate(payment.dueDate)}</strong></div>
        <div class="field"><label>Chave Pix</label><strong>${esc(supplier.pixKey || 'Não informada')}</strong></div>
        <div class="field full"><label>Dados bancários</label><span>${lines(supplier.bankDetails)}</span></div>
        <div class="field"><label>Nº da nota fiscal / recibo</label><strong>${esc(documentNumber)}</strong></div>
        <div class="field"><label>Referência do documento</label><span>${esc(documentReference)}</span></div>
      </div>
      <div class="amount"><label>Valor solicitado</label><strong>${money(payment.amount)}</strong></div>
    </section>

    <section class="section">
      <h2>Justificativa e observações</h2>
      <div class="field full"><span>${lines(payment.notes || `Pagamento referente à ação “${payment.actionName || 'inaugural'}” da unidade ${payment.unit || 'Planet Chocolate'}.`)}</span></div>
    </section>

    <div class="declaration">
      <p>Solicito o pagamento acima descrito, declarando que os dados do fornecedor foram conferidos e que o serviço está relacionado à ação de inauguração informada neste documento.</p>
      <div class="checkline"><span>Serviço executado</span><span>Documento fiscal conferido</span><span>Dados de pagamento conferidos</span></div>
    </div>

    <section class="signatures">
      <div class="signature"><strong>${esc(approvedBy || 'Responsável pelo Marketing')}</strong><span>Solicitante / aprovação</span></div>
      <div class="signature"><strong>Financeiro</strong><span>Recebimento e conferência</span></div>
    </section>

    <section class="receipt">
      <h3>Protocolo de recebimento pelo financeiro</h3>
      <div class="receipt-grid"><div class="receipt-line">Recebido por</div><div class="receipt-line">Data e horário</div></div>
    </section>

    <footer>Documento gerado pelo Planet Marketing Hub. Contém dados financeiros de uso interno.</footer>
  </main>
</body>
</html>`;
  };

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
      popup.document.open();
      popup.document.write(reportDocument(payment, supplier));
      popup.document.close();
      popup.opener = null;
    } catch (error) {
      popup.document.open();
      popup.document.write(errorDocument(error instanceof Error ? error.message : String(error)));
      popup.document.close();
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
    popup.document.open();
    popup.document.write(loadingDocument());
    popup.document.close();
    generateRequest(button.dataset.paymentRequest, popup);
  }, true);

  const observer = new MutationObserver(decorate);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  decorate();
})();
