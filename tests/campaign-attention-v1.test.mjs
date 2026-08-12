import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('planet-hub/assets/calendar-operations-v1.js');
const styles = read('planet-hub/assets/campaign-attention-v1.css');
const index = read('index.html');
const backend = read('functions/api/hub/campanhas.js');

assert.match(source, /MARCO ATRASADO/);
assert.match(source, /MARCO HOJE/);
assert.match(source, /PRÓXIMO MARCO/);
assert.match(source, /PRECISA DE ATENÇÃO/);
assert.match(source, /attentionItems\.slice\(0, 6\)/);
assert.match(source, /operation\.responsible \? `<small>Responsável:/);
assert.match(source, /await saveOperation\(updated\);[\s\S]*?render\(\);/,
  'salvar marco/data/status deve recalcular a leitura sem reload');
assert.match(index, /campaign-attention-v1\.css\?v=20260812-1/);
assert.match(index, /calendar-operations-v1\.js\?v=20260812-1/);
assert.match(styles, /\.pmh-campaign-attention/);
assert.match(styles, /\.pmh-campaign-attention-badge/);

const persistedFields = ['status', 'responsible', 'nextMilestone', 'milestoneDate', 'materials', 'notes', 'updatedAt'];
for (const field of persistedFields) assert.match(source, new RegExp(`${field}:`));
assert.doesNotMatch(backend, /overdue|attention|urgency|daysRemaining/,
  'backend não deve ganhar campos derivados de atenção');
assert.doesNotMatch(source, /overdue:\s|attention:\s*String|urgency:\s|daysRemaining:\s/,
  'estado derivado não deve entrar no objeto persistido');

const instrumented = source.replace(
  /  const observer = new MutationObserver\(transform\);[\s\S]*?\n\}\)\(\);\s*$/,
  `  window.__campaignAttentionTest = { milestoneAttention, sortAttentionItems, renderAttentionItem };\n})();`,
);
assert.notEqual(instrumented, source, 'instrumentação do teste deve localizar o final do módulo');

const document = {
  addEventListener() {},
  querySelector() { return null; },
  body: { appendChild() {} },
};
const window = {};
vm.runInNewContext(instrumented, {
  window,
  document,
  localStorage: { getItem() { return '[]'; }, setItem() {} },
  fetch: async () => ({ ok: true, json: async () => ({ data: [] }) }),
  FormData: class {},
  Intl,
  Date,
  Map,
  String,
  Number,
  Math,
  console,
  requestAnimationFrame(callback) { callback(); },
  setTimeout() { return 1; },
});

const { milestoneAttention, sortAttentionItems, renderAttentionItem } = window.__campaignAttentionTest;
const localReference = {
  getFullYear: () => 2026,
  getMonth: () => 7,
  getDate: () => 12,
};
const operation = (milestoneDate, status = 'producao') => ({
  status,
  milestoneDate,
  nextMilestone: 'Aprovar peças finais',
  responsible: 'André',
});

const overdue = milestoneAttention(operation('2026-08-10'), localReference);
assert.equal(overdue.kind, 'overdue');
assert.equal(overdue.label, 'MARCO ATRASADO');
assert.equal(overdue.days, -2);

const today = milestoneAttention(operation('2026-08-12'), localReference);
assert.equal(today.kind, 'today');
assert.equal(today.label, 'MARCO HOJE');
assert.equal(today.days, 0);

const tomorrow = milestoneAttention(operation('2026-08-13'), localReference);
assert.equal(tomorrow.kind, 'upcoming');
assert.equal(tomorrow.label, 'PRÓXIMO MARCO');
assert.equal(tomorrow.detail, 'em 1 dia');

const sevenDays = milestoneAttention(operation('2026-08-19'), localReference);
assert.equal(sevenDays.kind, 'upcoming');
assert.equal(sevenDays.detail, 'em 7 dias');
assert.equal(milestoneAttention(operation('2026-08-20'), localReference), null,
  'marco além de 7 dias não deve entrar em atenção');
assert.equal(milestoneAttention(operation('2026-08-10', 'concluida'), localReference), null,
  'concluída prevalece mesmo com marco vencido');
assert.equal(milestoneAttention(operation(''), localReference), null,
  'sem milestoneDate não deve inventar atenção');

const ordered = [
  { id: 'upcoming-later', attention: milestoneAttention(operation('2026-08-18'), localReference) },
  { id: 'today', attention: milestoneAttention(operation('2026-08-12'), localReference) },
  { id: 'overdue-newer', attention: milestoneAttention(operation('2026-08-10'), localReference) },
  { id: 'upcoming-sooner', attention: milestoneAttention(operation('2026-08-13'), localReference) },
  { id: 'overdue-older', attention: milestoneAttention(operation('2026-08-05'), localReference) },
].sort(sortAttentionItems);
assert.deepEqual(Array.from(ordered, (item) => item.id), [
  'overdue-older',
  'overdue-newer',
  'today',
  'upcoming-sooner',
  'upcoming-later',
]);

const rendered = renderAttentionItem({
  campaign: { id: 'c1', name: 'Dia do Chocolate' },
  operation: operation('2026-08-10'),
  attention: overdue,
});
assert.match(rendered, /Dia do Chocolate/);
assert.match(rendered, /Aprovar peças finais/);
assert.match(rendered, /Responsável: André/);
assert.match(rendered, /MARCO ATRASADO/);

const editedDate = milestoneAttention({ ...operation('2026-08-10'), milestoneDate: '2026-08-15' }, localReference);
assert.equal(editedDate.kind, 'upcoming', 'editar milestoneDate deve mudar a leitura derivada');
assert.equal(milestoneAttention({ ...operation('2026-08-10'), status: 'concluida' }, localReference), null,
  'mudar status para concluída deve retirar da atenção');

assert.match(source, /reference\.getFullYear\(\)/);
assert.match(source, /reference\.getMonth\(\)/);
assert.match(source, /reference\.getDate\(\)/);
assert.doesNotMatch(source, /milestoneDate[^\n]*toISOString|new Date\(operation\.milestoneDate\)/,
  'comparação de marco não deve deslocar o dia por UTC');

assert.match(source, /CAMPANHA ATIVA/);
assert.match(source, /PRÓXIMA CAMPANHA/);
assert.match(source, /AGORA E PRÓXIMOS 60 DIAS/);
assert.match(source, /Calendário completo de 2026/);
assert.match(source, /response\.status === 409 && retry/,
  'tratamento 409 operacional deve permanecer');

console.log('Campanhas: atenção por marco atrasado, hoje e próximos 7 dias validada.');
