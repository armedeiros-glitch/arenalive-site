import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('planet-hub/assets/inauguration-schedule-print-v1.js');
const css = read('planet-hub/assets/inauguration-schedule-print-v1.css');
const index = read('index.html');
const financeReport = read('planet-hub/assets/inauguration-finance-report-v1.js');
const backend = read('functions/api/hub/inauguracoes.js');

assert.match(source, /Exportar cronograma/);
assert.match(source, /window\.print|reportWindow\.print\(\)/);
assert.match(source, /project\?\.checklist/);
assert.doesNotMatch(source, /checklistTemplate|Número de telefone para redes sociais/,
  'exportação não pode duplicar a base fixa de etapas');
assert.doesNotMatch(source, /localStorage\.setItem|sessionStorage\.setItem|fetch\(|\/api\//,
  'exportação não cria persistência nem backend');
assert.match(source, /ownerOverride \|\| step\?\.owner/);
assert.match(source, /if \(step\?\.dueDate\)/);
assert.match(source, /`D-\$\{Number\(step\.daysBefore\)\}`/);
assert.match(source, /@page \{ size: A4 portrait;/);
assert.match(source, /@media print/);
assert.match(source, /Planet Chocolate · Cronograma inaugural · Gerado em/);
assert.match(source, /data-inauguration-browser-detail/);
assert.match(css, /pmh-inauguration-schedule-export/);
assert.match(index, /inauguration-schedule-print-v1\.css\?v=20260819-1/);
assert.match(index, /inauguration-schedule-print-v1\.js\?v=20260819-1/);
assert.match(financeReport, /Relatório Financeiro de Inauguração/,
  'relatório financeiro existente deve permanecer intacto');
assert.match(backend, /const LEGACY_STORAGE_KEY = 'planet-hub:inauguracoes:v1'/,
  'backend de inaugurações permanece o mesmo owner');

const sandbox = {
  console,
  Intl,
  Date,
  window: {
    localStorage: { getItem: () => '[]' },
    addEventListener: () => {},
    alert: () => {},
  },
  document: {
    addEventListener: () => {},
    querySelector: () => null,
  },
  requestAnimationFrame: () => {},
};
sandbox.globalThis = sandbox;
vm.runInNewContext(source, sandbox, { filename: 'inauguration-schedule-print-v1.js' });
const api = sandbox.window.PlanetInaugurationSchedulePrint;
assert.ok(api, 'módulo deve expor helpers somente-leitura para validação');

const project = {
  id: 'inauguration-1',
  unit: 'Planet Mueller',
  openingDate: '2026-09-26',
  checklist: [
    { action: 'Primeira etapa', owner: 'Franqueado', daysBefore: 30, done: false },
    { action: 'Segunda etapa', owner: 'Franqueadora', ownerOverride: 'André', daysBefore: 20, dueDate: '2026-09-10', done: true },
    { action: 'Terceira etapa', owner: 'Franqueado', daysBefore: 5, done: false },
  ],
};

const html = api.buildPrintHtml(project);
assert.match(html, /CRONOGRAMA DE INAUGURAÇÃO/);
assert.match(html, /Planet Mueller/);
assert.match(html, /26\/09\/2026/);
assert.match(html, /Primeira etapa/);
assert.match(html, /Franqueado/);
assert.match(html, /D-30/);
assert.match(html, /27\/08\/2026/,
  'prazo padrão deve ser calculado a partir da abertura');
assert.match(html, /Segunda etapa[\s\S]*André[\s\S]*D-20[\s\S]*10\/09\/2026/,
  'overrides de responsável e prazo devem substituir os valores efetivos');
assert.ok(
  html.indexOf('Primeira etapa') < html.indexOf('Segunda etapa')
    && html.indexOf('Segunda etapa') < html.indexOf('Terceira etapa'),
  'ordem original do checklist deve ser preservada',
);
assert.doesNotMatch(html, /Ajustar responsável \/ prazo|Padrão|checkbox|data-check-field|data-check-reset/,
  'controles operacionais não pertencem ao documento');
assert.doesNotMatch(html, /pmh-sidebar|pmh-topbar|data-inauguration-tab|Remover acompanhamento/,
  'shell e ações do André OS não pertencem ao documento');
assert.equal(api.effectiveOwner(project.checklist[1]), 'André');
assert.equal(api.effectiveDue(project, project.checklist[1]), '10/09/2026');

console.log('Inaugurações: exportação A4 do cronograma, ordem e overrides validados.');
