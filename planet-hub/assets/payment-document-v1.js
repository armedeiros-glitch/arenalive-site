(() => {
  'use strict';

  if (window.PlanetPaymentDocument) return;

  const STATUS_LABELS = {
    draft: 'Rascunho',
    docs_pending: 'Documentação pendente',
    awaiting_approval: 'Aguardando aprovação',
    sent_finance: 'Enviado ao financeiro',
    paid: 'Pago',
    rejected: 'Recusado',
  };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const digits = (value) => String(value || '').replace(/\D/g, '');

  const money = (value) => new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
  }).format(Number(value) || 0);

  const formatDate = (value) => {
    if (!value) return 'Não informado';
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime())
      ? String(value)
      : new Intl.DateTimeFormat('pt-BR').format(date);
  };

  const formatDocument = (value) => {
    const valueDigits = digits(value);
    if (valueDigits.length === 11) return valueDigits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    if (valueDigits.length === 14) return valueDigits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    return valueDigits || 'Não informado';
  };

  const multiline = (value) => escapeHtml(value || 'Não informado').replace(/\n/g, '<br>');

  const requestNumber = (payment) => {
    const suffix = String(payment?.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();
    return `PG-${suffix || Date.now().toString().slice(-8)}`;
  };

  const modeOf = (options = {}) => options.mode === 'quick' ? 'quick' : 'registered';

  const renderLoading = (options = {}) => {
    if (modeOf(options) === 'quick') {
      return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Salvando solicitação</title><style>body{font-family:Arial,sans-serif;display:grid;place-items:center;min-height:90vh;color:#382720}p{font-size:18px}</style></head><body><p>Salvando os dados e preparando a impressão…</p></body></html>';
    }
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Preparando solicitação</title><style>body{font-family:Arial,sans-serif;display:grid;place-items:center;min-height:90vh;color:#382720}p{font-size:18px}</style></head><body><p>Preparando a solicitação de pagamento…</p></body></html>';
  };

  const renderError = (message, options = {}) => {
    if (modeOf(options) === 'quick') {
      return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Falha ao gerar solicitação</title><style>body{font-family:Arial,sans-serif;max-width:720px;margin:60px auto;padding:24px;color:#382720}div{padding:22px;border:1px solid #e0c9bf;border-radius:14px;background:#fff6f2}h1{font-size:24px}p{font-size:16px;line-height:1.5}</style></head><body><div><h1>Não foi possível gerar a solicitação</h1><p>${escapeHtml(message)}</p></div></body></html>`;
    }
    return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Falha ao gerar documento</title><style>body{font-family:Arial,sans-serif;max-width:720px;margin:60px auto;padding:24px;color:#382720}div{padding:20px;border:1px solid #e0c9bf;border-radius:14px;background:#fff6f2}h1{font-size:24px}p{font-size:16px;line-height:1.5}</style></head><body><div><h1>Não foi possível gerar o documento</h1><p>${escapeHtml(message)}</p></div></body></html>`;
  };

  const renderReport = (payment = {}, supplier = {}, options = {}) => {
    const mode = modeOf(options);
    const isQuick = mode === 'quick';
    const generatedAt = new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'long', timeStyle: 'short',
    }).format(new Date());
    const status = STATUS_LABELS[payment.status] || payment.status || 'Rascunho';
    const metaClass = isQuick ? 'meta' : 'doc-meta';
    const checksClass = isQuick ? 'checks' : 'checkline';
    const statusLine = isQuick ? '' : `<span>Status: ${escapeHtml(status)}</span>`;
    const h1LetterSpacing = isQuick ? '' : 'letter-spacing:.03em;';

    return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Solicitação de pagamento · ${escapeHtml(payment.unit)}</title>
  <style>
    @page{size:A4;margin:8mm}
    *{box-sizing:border-box}
    body{margin:0;background:#ece7e3;color:#2d211c;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.42}
    .toolbar{position:sticky;top:0;z-index:4;display:flex;justify-content:center;gap:10px;padding:12px;background:#2f211c}
    .toolbar button{min-height:42px;padding:0 18px;border:0;border-radius:9px;font-size:14px;font-weight:700;cursor:pointer}
    .toolbar .print{color:#fff;background:#f26419}.toolbar .close{color:#382820;background:#fff}
    .page{width:210mm;min-height:297mm;margin:18px auto;padding:15mm;background:#fff;box-shadow:0 18px 55px rgba(42,25,18,.18)}
    .header{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;padding-bottom:16px;border-bottom:4px solid #f26419}
    .brand{display:flex;align-items:center;gap:12px}.mark{display:grid;place-items:center;width:48px;height:48px;border-radius:13px;color:#fff;background:#f26419;font-size:25px;font-weight:900}
    .brand strong,.brand span,.meta strong,.meta span,.doc-meta strong,.doc-meta span{display:block}.brand strong{font-size:18px}.brand span{margin-top:3px;color:#765f54;font-size:11px;letter-spacing:.13em;text-transform:uppercase}.meta,.doc-meta{text-align:right}.meta strong,.doc-meta strong{font-size:15px}.meta span,.doc-meta span{margin-top:4px;color:#79685f}
    h1{margin:24px 0 5px;font-size:25px;text-align:center;text-transform:uppercase;${h1LetterSpacing}}.subtitle{margin:0 0 22px;color:#79685f;text-align:center}
    .section{margin-top:15px;border:1px solid #d9cec8;border-radius:10px;overflow:hidden;break-inside:avoid}.section h2{margin:0;padding:9px 12px;color:#fff;background:#3a2922;font-size:12px;letter-spacing:.08em;text-transform:uppercase}
    .grid{display:grid;grid-template-columns:1fr 1fr}.field{min-height:62px;padding:10px 12px;border-right:1px solid #e6ddd8;border-bottom:1px solid #e6ddd8}.field:nth-child(2n){border-right:0}.field.full{grid-column:1/-1;border-right:0}.field label,.field strong,.field span{display:block}.field label{margin-bottom:5px;color:#7d6c63;font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.field strong{font-size:13px}.field span{color:#44342d}
    .amount{padding:18px;border:2px solid #f26419;background:#fff8f3;text-align:center}.amount label{display:block;color:#91502d;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.amount strong{display:block;margin-top:6px;font-size:29px}
    .declaration{margin-top:12px;padding:10px 12px;border:1px solid #d9cec8;border-radius:9px;break-inside:avoid}.declaration p{margin:0;color:#44342d;font-size:10.5px;line-height:1.4}.checks,.checkline{display:flex;gap:14px;flex-wrap:wrap;margin-top:8px;font-size:9.5px}.checks span::before,.checkline span::before{content:'☐';margin-right:5px;font-size:12px}
    .signatures{display:grid;grid-template-columns:1fr 1fr;gap:35px;margin-top:22px;break-inside:avoid}.signature{padding-top:8px;border-top:1px solid #3b2c26;text-align:center}.signature strong,.signature span{display:block}.signature strong{font-size:12px}.signature span{margin-top:3px;color:#74635a;font-size:10px}
    .receipt{margin-top:14px;padding-top:9px;border-top:1px dashed #a99489;break-inside:avoid}.receipt h3{margin:0 0 8px;font-size:10px;text-align:center;text-transform:uppercase}.receipt-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.receipt-line{min-height:28px;padding-top:12px;border-bottom:1px solid #514139;color:#7b6960;font-size:9px}
    @media print{
      html,body{width:210mm!important;margin:0!important;font-size:9.5px!important;line-height:1.24!important}
      body{background:#fff!important}
      .toolbar{display:none!important}
      .page{width:auto!important;min-height:auto!important;margin:0!important;padding:0!important;box-shadow:none!important}
      .header{gap:10px!important;padding-bottom:6px!important;border-bottom-width:2px!important}
      .mark{width:34px!important;height:34px!important;border-radius:8px!important;font-size:18px!important}
      .brand{gap:8px!important}.brand strong{font-size:14px!important}.brand span{margin-top:1px!important;font-size:7.5px!important}
      .meta strong,.doc-meta strong{font-size:10px!important}.meta span,.doc-meta span{margin-top:1px!important;font-size:7.5px!important}
      h1{margin:8px 0 1px!important;font-size:17px!important}.subtitle{margin:0 0 5px!important;font-size:8.5px!important}
      .section{margin-top:5px!important;border-radius:6px!important;break-inside:avoid!important}
      .section h2{padding:4px 7px!important;font-size:8px!important}
      .grid{display:grid!important;grid-template-columns:1fr 1fr!important}
      .field{min-height:0!important;padding:4px 6px!important;border-right:1px solid #e6ddd8!important;border-bottom:1px solid #e6ddd8!important}
      .field:nth-child(2n){border-right:0!important}.field.full{grid-column:1/-1!important;border-right:0!important}
      .field label{margin-bottom:1px!important;font-size:7px!important}.field strong{font-size:9.5px!important}.field span{font-size:8.5px!important;line-height:1.22!important}
      .amount{padding:6px!important;border-width:1.5px!important}.amount label{font-size:7.5px!important}.amount strong{margin-top:1px!important;font-size:18px!important}
      .declaration{margin-top:5px!important;padding:5px 7px!important;border-radius:6px!important}.declaration p{font-size:7.5px!important;line-height:1.25!important}.checks,.checkline{gap:10px!important;margin-top:4px!important;font-size:7px!important}.checks span::before,.checkline span::before{font-size:9px!important}
      .signatures{display:grid!important;grid-template-columns:1fr 1fr!important;gap:22px!important;margin-top:12px!important;break-inside:avoid!important}
      .signature{padding-top:3px!important}.signature strong{font-size:8.5px!important}.signature span{margin-top:1px!important;font-size:7px!important}
      .receipt{margin-top:7px!important;padding-top:5px!important}.receipt h3{margin-bottom:4px!important;font-size:7.5px!important}.receipt-grid{grid-template-columns:1fr 1fr!important;gap:12px!important}.receipt-line{min-height:18px!important;padding-top:7px!important;font-size:7px!important}
    }
    @media screen and (max-width:850px){.page{width:100%;min-height:0;margin:0;padding:24px}.grid,.signatures,.receipt-grid{grid-template-columns:1fr}.field{border-right:0}.toolbar{position:static}}
  </style>
</head>
<body>
  <div class="toolbar"><button class="print" onclick="window.print()">Imprimir / Salvar em PDF</button><button class="close" onclick="window.close()">Fechar</button></div>
  <main class="page">
    <header class="header">
      <div class="brand"><div class="mark">P</div><div><strong>Planet Chocolate</strong><span>Marketing Hub</span></div></div>
      <div class="${metaClass}"><strong>${requestNumber(payment)}</strong><span>Gerado em ${escapeHtml(generatedAt)}</span>${statusLine}</div>
    </header>

    <h1>Solicitação de pagamento</h1>
    <p class="subtitle">Ação de inauguração de unidade Planet Chocolate</p>

    <section class="section"><h2>Origem da solicitação</h2><div class="grid">
      <div class="field"><label>Unidade</label><strong>${escapeHtml(payment.unit || 'Não informada')}</strong></div>
      <div class="field"><label>Data da inauguração</label><strong>${escapeHtml(formatDate(payment.openingDate))}</strong></div>
      <div class="field full"><label>Ação / serviço contratado</label><strong>${escapeHtml(payment.actionName || 'Não informado')}</strong></div>
    </div></section>

    <section class="section"><h2>Fornecedor</h2><div class="grid">
      <div class="field"><label>Nome / razão social</label><strong>${escapeHtml(supplier.legalName || 'Não informado')}</strong></div>
      <div class="field"><label>Nome fantasia</label><strong>${escapeHtml(supplier.tradeName || 'Não informado')}</strong></div>
      <div class="field"><label>CPF / CNPJ</label><strong>${escapeHtml(formatDocument(supplier.document))}</strong></div>
      <div class="field"><label>Tipo de serviço</label><strong>${escapeHtml(supplier.serviceType || payment.actionName || 'Não informado')}</strong></div>
      <div class="field"><label>Telefone</label><span>${escapeHtml(supplier.phone || 'Não informado')}</span></div>
      <div class="field"><label>E-mail</label><span>${escapeHtml(supplier.email || 'Não informado')}</span></div>
    </div></section>

    <section class="section"><h2>Dados para pagamento</h2><div class="grid">
      <div class="field"><label>Vencimento solicitado</label><strong>${escapeHtml(formatDate(payment.dueDate))}</strong></div>
      <div class="field"><label>Chave Pix</label><strong>${escapeHtml(supplier.pixKey || 'Não informada')}</strong></div>
      <div class="field full"><label>Dados bancários</label><span>${multiline(supplier.bankDetails)}</span></div>
      <div class="field"><label>Nº da nota fiscal / recibo</label><strong>${escapeHtml(payment.documentNumber || 'Não informado')}</strong></div>
      <div class="field"><label>Referência do documento</label><span>${escapeHtml(payment.documentReference || 'Não informado')}</span></div>
    </div><div class="amount"><label>Valor solicitado</label><strong>${money(payment.amount)}</strong></div></section>

    <section class="section"><h2>Justificativa e observações</h2><div class="field full"><span>${multiline(payment.notes || `Pagamento referente à ação “${payment.actionName || 'inaugural'}” da unidade ${payment.unit || 'Planet Chocolate'}.`)}</span></div></section>

    <div class="declaration"><p>Solicito o pagamento acima descrito, declarando que os dados do fornecedor foram conferidos e que o serviço está relacionado à ação de inauguração informada neste documento.</p><div class="${checksClass}"><span>Serviço executado</span><span>Documento fiscal conferido</span><span>Dados de pagamento conferidos</span></div></div>
    <section class="signatures"><div class="signature"><strong>${escapeHtml(payment.approvedBy || 'Responsável pelo Marketing')}</strong><span>Solicitante / aprovação</span></div><div class="signature"><strong>Financeiro</strong><span>Recebimento e conferência</span></div></section>
    <section class="receipt"><h3>Protocolo de recebimento pelo financeiro</h3><div class="receipt-grid"><div class="receipt-line">Recebido por</div><div class="receipt-line">Data e horário</div></div></section>
  </main>
</body>
</html>`;
  };

  const writePopup = (popup, html, options = {}) => {
    if (!popup || popup.closed) return false;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
    if (options.detachOpener) popup.opener = null;
    return true;
  };

  window.PlanetPaymentDocument = Object.freeze({
    escapeHtml,
    digits,
    money,
    formatDate,
    formatDocument,
    multiline,
    requestNumber,
    renderLoading,
    renderError,
    renderReport,
    writePopup,
  });
})();
