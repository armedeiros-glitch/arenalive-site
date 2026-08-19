(() => {
  'use strict';

  const TRACKED_KEY = 'planet-hub-inaugurations-v2';

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
  }[char]));

  const readTracked = () => {
    try {
      const items = JSON.parse(window.localStorage.getItem(TRACKED_KEY) || '[]');
      return Array.isArray(items) ? items : [];
    } catch (_) {
      return [];
    }
  };

  const formatDate = (value) => {
    if (!value) return '';
    const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
    return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat('pt-BR').format(date);
  };

  const effectiveDue = (project, step) => {
    if (step?.dueDate) return formatDate(step.dueDate);
    if (!project?.openingDate || !Number.isFinite(Number(step?.daysBefore))) return '';
    const opening = new Date(`${String(project.openingDate).slice(0, 10)}T12:00:00`);
    if (Number.isNaN(opening.getTime())) return '';
    opening.setDate(opening.getDate() - Number(step.daysBefore));
    return new Intl.DateTimeFormat('pt-BR').format(opening);
  };

  const effectiveOwner = (step) => String(step?.ownerOverride || step?.owner || '').trim();
  const referenceFor = (step) => Number.isFinite(Number(step?.daysBefore)) ? `D-${Number(step.daysBefore)}` : '—';
  const generatedAt = () => new Intl.DateTimeFormat('pt-BR').format(new Date());

  const currentProjectId = () => String(
    document.querySelector('[data-inauguration-browser-detail] .pmh-inauguration-card')?.dataset.inaugurationProjectId
      || document.querySelector('[data-inauguration-browser-detail] [data-inauguration-workspace]')?.dataset.inaugurationWorkspace
      || '',
  );

  const projectFor = (projectId) => readTracked()
    .find((item) => String(item?.id || '') === String(projectId || '')) || null;

  const metadataRows = (project) => {
    const format = String(project?.format || project?.model || '').trim();
    return [
      ['Unidade', project?.unit],
      ['Data prevista de abertura', formatDate(project?.openingDate)],
      ...(format ? [['Formato', format]] : []),
    ].filter(([, value]) => value);
  };

  const scheduleRows = (project) => (Array.isArray(project?.checklist) ? project.checklist : [])
    .map((step) => `<tr>
      <td>${esc(step?.action || 'Etapa sem nome')}</td>
      <td>${esc(effectiveOwner(step) || '—')}</td>
      <td>${esc(referenceFor(step))}</td>
      <td>${esc(effectiveDue(project, step) || '—')}</td>
    </tr>`)
    .join('');

  const buildPrintHtml = (project) => {
    const rows = scheduleRows(project);
    const metadata = metadataRows(project);
    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cronograma de Inauguração · ${esc(project?.unit || 'Planet Chocolate')}</title>
<style>
  @page { size: A4 portrait; margin: 10mm 11mm 11mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #171717; font-family: Arial, Helvetica, sans-serif; }
  body { font-size: 10px; line-height: 1.28; }
  .sheet { width: 100%; max-width: 188mm; margin: 0 auto; }
  .report-head { padding-bottom: 7px; margin-bottom: 8px; border-bottom: 2px solid #222; }
  .brand { font-size: 9px; font-weight: 900; letter-spacing: .14em; }
  h1 { margin: 3px 0 7px; font-size: 19px; line-height: 1.05; }
  .meta { display: flex; flex-wrap: wrap; gap: 4px 18px; }
  .meta span { font-size: 9.5px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  th { background: #f0f0f0; text-align: left; font-size: 8px; text-transform: uppercase; letter-spacing: .04em; }
  th, td { border: 1px solid #d6d6d6; padding: 4px 5px; vertical-align: top; overflow-wrap: anywhere; }
  th:nth-child(1) { width: 44%; }
  th:nth-child(2) { width: 24%; }
  th:nth-child(3) { width: 12%; }
  th:nth-child(4) { width: 20%; }
  td:nth-child(3), td:nth-child(4) { white-space: nowrap; }
  .report-footer { margin-top: 7px; padding-top: 5px; border-top: 1px solid #ddd; color: #666; font-size: 8px; text-align: right; }
  @media print {
    html, body { width: 210mm; min-height: 297mm; background: #fff !important; }
    .sheet { max-width: none; margin: 0; }
    nav, aside, button, .screen-only { display: none !important; }
  }
</style>
</head>
<body>
<main class="sheet" data-inauguration-schedule-print>
  <header class="report-head">
    <div class="brand">PLANET CHOCOLATE</div>
    <h1>CRONOGRAMA DE INAUGURAÇÃO</h1>
    <div class="meta">${metadata.map(([label, value]) => `<span><b>${esc(label)}:</b> ${esc(value)}</span>`).join('')}</div>
  </header>
  <table>
    <thead><tr><th>Etapa</th><th>Responsável</th><th>Referência</th><th>Prazo</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="4">Nenhuma etapa disponível.</td></tr>'}</tbody>
  </table>
  <footer class="report-footer">Planet Chocolate · Cronograma inaugural · Gerado em ${esc(generatedAt())}</footer>
</main>
</body>
</html>`;
  };

  const openSchedulePrint = (projectId) => {
    const project = projectFor(projectId || currentProjectId());
    if (!project) {
      window.alert('Não foi possível identificar os dados atuais desta inauguração.');
      return;
    }
    const reportWindow = window.open('', '_blank', 'width=960,height=900');
    if (!reportWindow) {
      window.alert('O navegador bloqueou a abertura do cronograma.');
      return;
    }
    try { reportWindow.opener = null; } catch (_) {}
    reportWindow.document.open();
    reportWindow.document.write(buildPrintHtml(project));
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
  };

  const ensureExportButton = () => {
    const detail = document.querySelector('[data-inauguration-browser-detail]:not([hidden])');
    const head = detail?.querySelector('.pmh-inauguration-project-detail-head');
    const projectId = currentProjectId();
    if (!head || !projectId || head.querySelector('[data-inauguration-schedule-export]')) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pmh-inauguration-schedule-export';
    button.dataset.inaugurationScheduleExport = projectId;
    button.textContent = 'Exportar cronograma';
    head.appendChild(button);
  };

  document.addEventListener('click', (event) => {
    const exportButton = event.target.closest?.('[data-inauguration-schedule-export]');
    if (exportButton) {
      event.preventDefault();
      openSchedulePrint(String(exportButton.dataset.inaugurationScheduleExport || ''));
      return;
    }
    if (event.target.closest?.('[data-inauguration-open]')) {
      requestAnimationFrame(ensureExportButton);
    }
  });

  window.addEventListener('pmh:view-rendered', (event) => {
    if (String(event.detail?.view || '') === 'inauguracoes') requestAnimationFrame(ensureExportButton);
  });

  requestAnimationFrame(ensureExportButton);

  window.PlanetInaugurationSchedulePrint = Object.freeze({
    buildPrintHtml,
    effectiveDue,
    effectiveOwner,
    open: openSchedulePrint,
  });
})();