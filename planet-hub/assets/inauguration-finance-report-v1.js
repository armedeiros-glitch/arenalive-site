(() => {
  'use strict';

  const TRACKED_KEY = 'planet-hub-inaugurations-v2';
  const FINANCE_API = '/api/hub/financeiro';
  const INAUGURATIONS_API = '/api/hub/inauguracoes';
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
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value) || 0);

  const formatDate = (value) => {
    if (!value) return '';
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat('pt-BR').format(date);
  };

  const emissionDate = () => new Intl.DateTimeFormat('pt-BR').format(new Date());
  const truncate = (value, max = 120) => {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
  };

  const readTracked = () => {
    try {
      const items = JSON.parse(window.localStorage.getItem(TRACKED_KEY) || '[]');
      return Array.isArray(items) ? items : [];
    } catch (_) {
      return [];
    }
  };

  const currentInaugurationId = () => String(
    document.querySelector('[data-inauguration-panel-budget]')?.dataset.inaugurationPanelBudget || '',
  );

  const apiJson = async (url) => {
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || `Falha HTTP ${response.status}`);
    return payload;
  };

  const resolveInauguration = async (inaugurationId) => {
    const local = readTracked().find((item) => String(item?.id || '') === inaugurationId);
    if (local) return local;
    const payload = await apiJson(INAUGURATIONS_API);
    return (payload.data || []).find((item) => String(item?.id || '') === inaugurationId) || null;
  };

  const paymentsFor = (inaugurationId) => {
    const payments = window.PlanetInaugurationFinance?.payments || [];
    return payments.filter((payment) => String(payment?.inaugurationId || '') === inaugurationId);
  };

  const supplierMap = (suppliers) => new Map(
    (suppliers || []).map((supplier) => [String(supplier.id || ''), supplier]),
  );

  const metadataRows = (inauguration) => [
    ['Unidade', inauguration?.unit],
    ['Cidade / local', inauguration?.location],
    ['Data prevista da inauguração', formatDate(inauguration?.openingDate)],
    ['Responsável', inauguration?.responsible],
    ['Data de emissão', emissionDate()],
  ].filter(([, value]) => value);

  const paymentRows = (payments, suppliersById) => payments.length
    ? payments.map((payment) => {
      const supplier = suppliersById.get(String(payment.supplierId || ''));
      const note = truncate(payment.notes, 105);
      return `<tr class="${payment.status === 'rejected' ? 'is-rejected' : ''}">
        <td><strong>${esc(payment.actionName || 'Pagamento da implantação')}</strong>${note ? `<small>Obs.: ${esc(note)}</small>` : ''}</td>
        <td>${esc(supplier?.legalName || '—')}</td>
        <td class="num">${money(payment.amount)}</td>
        <td>${esc(formatDate(payment.dueDate) || '—')}</td>
        <td>${esc(STATUS_LABELS[payment.status] || payment.status || '—')}</td>
        <td>${esc(payment.documentNumber || '—')}</td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="6" class="empty">Nenhum pagamento registrado para esta inauguração.</td></tr>';

  const paymentSupplierIds = (payments) => [...new Set(
    payments.map((payment) => String(payment.supplierId || '')).filter(Boolean),
  )];

  const paymentDetails = (payments, suppliersById) => {
    const suppliers = paymentSupplierIds(payments)
      .map((id) => suppliersById.get(id))
      .filter(Boolean)
      .filter((supplier) => supplier.document || supplier.pixKey || supplier.bankDetails);

    if (!suppliers.length) return '';

    return `<section class="report-block supplier-block">
      <h2>Dados para pagamento</h2>
      <div class="supplier-grid">${suppliers.map((supplier) => {
        const lines = [
          supplier.document ? `<span><b>CPF/CNPJ:</b> ${esc(supplier.document)}</span>` : '',
          supplier.pixKey ? `<span><b>Pix:</b> ${esc(supplier.pixKey)}</span>` : '',
          supplier.bankDetails ? `<span><b>Dados bancários:</b> ${esc(truncate(supplier.bankDetails, 150))}</span>` : '',
        ].filter(Boolean).join('');
        return `<article><strong>${esc(supplier.legalName || supplier.tradeName || 'Fornecedor')}</strong>${lines}</article>`;
      }).join('')}</div>
    </section>`;
  };

  const summaryCards = (financial) => [
    ['Verba do pacote', financial.budget],
    ['Planejado', financial.planned],
    ['Gasto realizado', financial.actual],
    ['Valor comprometido', financial.committed],
    ['Saldo disponível', financial.availableBalance],
    ['Valor solicitado', financial.requested],
    ['Enviado ao financeiro', financial.sent],
    ['Valor pago', financial.paid],
  ].map(([label, value]) => `<article class="${label === 'Saldo disponível' && Number(value) < 0 ? 'negative' : ''}"><small>${esc(label)}</small><strong>${money(value)}</strong></article>`).join('');

  const buildReportHtml = ({ inauguration, payments, suppliers }) => {
    const financeDomain = window.PlanetInaugurationFinance;
    if (!financeDomain?.calculate) throw new Error('Cálculo financeiro central indisponível.');
    const financial = financeDomain.calculate(inauguration, financeDomain.payments || []);
    const suppliersById = supplierMap(suppliers);
    const metadata = metadataRows(inauguration);

    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório Financeiro de Inauguração · ${esc(inauguration?.unit || 'Planet Chocolate')}</title>
<style>
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #171717; font-family: Arial, Helvetica, sans-serif; }
  body { font-size: 10.5px; line-height: 1.32; }
  .sheet { width: 100%; max-width: 190mm; margin: 0 auto; background: #fff; }
  .report-actions { display: flex; justify-content: flex-end; gap: 8px; margin: 0 0 8px; }
  .report-actions button { border: 1px solid #bbb; border-radius: 6px; padding: 8px 12px; background: #fff; color: #111; font: inherit; font-weight: 700; cursor: pointer; }
  .report-actions .primary { background: #111; color: #fff; border-color: #111; }
  .report-head { border-bottom: 2px solid #222; padding: 0 0 8px; margin-bottom: 8px; break-inside: avoid; page-break-inside: avoid; }
  .brand { font-size: 10px; font-weight: 900; letter-spacing: .14em; }
  h1 { margin: 2px 0 7px; font-size: 20px; line-height: 1.05; }
  .meta { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 3px 14px; }
  .meta span { display: block; }
  .meta b { font-weight: 700; }
  .report-block { margin-top: 8px; break-inside: avoid; page-break-inside: avoid; }
  .report-block h2 { margin: 0 0 5px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; }
  .summary { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 5px; }
  .summary article { border: 1px solid #d7d7d7; padding: 5px 6px; min-height: 41px; }
  .summary small { display: block; color: #555; font-size: 8px; text-transform: uppercase; letter-spacing: .025em; }
  .summary strong { display: block; margin-top: 2px; font-size: 12px; }
  .summary .negative strong { color: #8a1f1f; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th { background: #f2f2f2; text-align: left; font-size: 8px; text-transform: uppercase; letter-spacing: .025em; }
  th, td { border: 1px solid #d8d8d8; padding: 4px 5px; vertical-align: top; overflow-wrap: anywhere; }
  th:nth-child(1) { width: 24%; } th:nth-child(2) { width: 20%; } th:nth-child(3) { width: 12%; } th:nth-child(4) { width: 13%; } th:nth-child(5) { width: 16%; } th:nth-child(6) { width: 15%; }
  td strong { display: block; font-size: 9.5px; }
  td small { display: block; margin-top: 2px; color: #666; font-size: 8px; line-height: 1.2; }
  td.num { white-space: nowrap; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  tr.is-rejected td { color: #777; background: #fafafa; text-decoration-color: #aaa; }
  tr.is-rejected td:nth-child(5) { font-weight: 800; color: #8a1f1f; }
  .empty { text-align: center; color: #666; padding: 10px; }
  .supplier-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 5px; }
  .supplier-grid article { border: 1px solid #ddd; padding: 5px 6px; break-inside: avoid; page-break-inside: avoid; }
  .supplier-grid article > strong { display: block; margin-bottom: 2px; font-size: 9.5px; }
  .supplier-grid span { display: block; color: #444; font-size: 8.5px; overflow-wrap: anywhere; }
  .report-note { margin-top: 7px; color: #666; font-size: 8px; }
  @media print {
    .report-actions { display: none !important; }
    html, body { width: 210mm; min-height: 297mm; background: #fff !important; }
    .sheet { max-width: none; margin: 0; }
    a, button, nav, aside[data-andre-os], .andre-os-sidebar, .pmh-sidebar { display: none !important; }
  }
</style>
</head>
<body>
<main class="sheet">
  <div class="report-actions"><button type="button" onclick="window.close()">Fechar</button><button type="button" class="primary" onclick="window.print()">Imprimir / Salvar em PDF</button></div>
  <header class="report-head">
    <div class="brand">PLANET CHOCOLATE</div>
    <h1>Relatório Financeiro de Inauguração</h1>
    <div class="meta">${metadata.map(([label, value]) => `<span><b>${esc(label)}:</b> ${esc(value)}</span>`).join('')}</div>
  </header>
  <section class="report-block">
    <h2>Resumo financeiro</h2>
    <div class="summary">${summaryCards(financial)}</div>
  </section>
  <section class="report-block payments-block">
    <h2>Pagamentos da inauguração</h2>
    <table>
      <thead><tr><th>Ação</th><th>Fornecedor</th><th>Valor</th><th>Vencimento</th><th>Status</th><th>NF/Recibo</th></tr></thead>
      <tbody>${paymentRows(payments, suppliersById)}</tbody>
    </table>
  </section>
  ${paymentDetails(payments, suppliersById)}
  <p class="report-note">Relatório gerado sob demanda com os dados atuais do Financeiro protegido do André OS. Pagamentos recusados podem constar na relação, mas permanecem fora dos totais oficiais.</p>
</main>
</body>
</html>`;
  };

  const renderLoading = (reportWindow) => {
    reportWindow.document.open();
    reportWindow.document.write('<!doctype html><title>Relatório financeiro</title><body style="font-family:Arial,sans-serif;padding:32px;color:#222">Preparando relatório financeiro…</body>');
    reportWindow.document.close();
  };

  const openReport = async () => {
    const inaugurationId = currentInaugurationId();
    if (!inaugurationId) throw new Error('Não foi possível identificar a inauguração atual.');
    const reportWindow = window.open('', '_blank', 'width=960,height=900');
    if (!reportWindow) throw new Error('O navegador bloqueou a abertura do relatório.');
    try { reportWindow.opener = null; } catch (_) {}
    renderLoading(reportWindow);

    try {
      const [inauguration, financePayload] = await Promise.all([
        resolveInauguration(inaugurationId),
        apiJson(FINANCE_API),
      ]);
      if (!inauguration) throw new Error('Inauguração não encontrada.');
      const payments = paymentsFor(inaugurationId);
      const html = buildReportHtml({
        inauguration,
        payments,
        suppliers: financePayload.suppliers || [],
      });
      reportWindow.document.open();
      reportWindow.document.write(html);
      reportWindow.document.close();
      reportWindow.focus();
    } catch (error) {
      reportWindow.document.open();
      reportWindow.document.write(`<!doctype html><title>Relatório financeiro</title><body style="font-family:Arial,sans-serif;padding:32px;color:#222"><h1>Não foi possível gerar o relatório</h1><p>${esc(error instanceof Error ? error.message : String(error))}</p></body>`);
      reportWindow.document.close();
    }
  };

  const ensureReportButton = () => {
    const toolbar = document.querySelector('.pmh-inauguration-finance-toolbar');
    const exportButton = toolbar?.querySelector('[data-inauguration-finance-export]');
    if (!toolbar || !exportButton || toolbar.querySelector('[data-inauguration-finance-report]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.inaugurationFinanceReport = '1';
    button.textContent = 'Gerar relatório para o Financeiro';
    exportButton.before(button);
  };

  const scheduleButton = () => {
    window.setTimeout(ensureReportButton, 0);
    window.setTimeout(ensureReportButton, 180);
  };

  document.addEventListener('click', (event) => {
    const report = event.target.closest?.('[data-inauguration-finance-report]');
    if (report) {
      event.preventDefault();
      openReport().catch((error) => window.alert(error instanceof Error ? error.message : String(error)));
      return;
    }
    if (event.target.closest?.('[data-inauguration-finance-open], [data-finance-close], [data-inauguration-finance-new-payment], [data-finance-edit-payment], [data-finance-delete-payment]')) {
      scheduleButton();
    }
  }, true);

  document.addEventListener('change', (event) => {
    if (event.target.closest?.('[data-payment-status], [data-inauguration-panel-budget]')) scheduleButton();
  });

  window.addEventListener('pmh:inauguration-finance-updated', scheduleButton);
  window.addEventListener('pmh:view-rendered', scheduleButton);

  window.PlanetInaugurationFinanceReport = {
    buildReportHtml,
    paymentsFor,
  };

  scheduleButton();
})();