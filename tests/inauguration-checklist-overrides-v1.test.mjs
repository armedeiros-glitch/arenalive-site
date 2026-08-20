import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const workspace = read('planet-hub/assets/inauguration-workspace-v2.js');
const hub = read('planet-hub/assets/unified-hub-v1.js');
const controls = read('planet-hub/assets/inauguration-controls-v1.js');
const finance = read('planet-hub/assets/financeiro-v1.js');

assert.match(hub, /const normalizeChecklistEntry = \(entry = \{\}\) =>/);
assert.match(hub, /normalized\.ownerOverride = ownerOverride/);
assert.match(hub, /normalized\.dueDate = dueDate/);
assert.match(hub, /const checklistEffectiveOwner = \(entry\) => String\(entry\?\.ownerOverride \|\| entry\?\.owner/);
assert.match(hub, /const checklistEffectiveDue = \(item, entry\) => asDate\(entry\?\.dueDate\) \|\| checklistDefaultDue\(item, entry\)/);
assert.match(hub, /data-check-field="ownerOverride"/);
assert.match(hub, /data-check-field="dueDate"/);
assert.match(hub, /data-check-reset="ownerOverride"/);
assert.match(hub, /data-check-reset="dueDate"/);
assert.match(hub, /status: 'saving', message: 'Salvando…'/);
assert.match(hub, /status: 'saved', message: 'Salvo'/);
assert.match(hub, /status: 'error', message: 'Não foi salvo\. Valor anterior restaurado\.'/);
assert.match(hub, /current\.checklist\[index\] = previous/);
assert.match(hub, /const completed = item\.checklist\.filter\(\(entry\) => entry\.done\)\.length/);
assert.match(hub, /if \(event\.target\.dataset\.checkIndex != null\) item\.checklist\[Number\(event\.target\.dataset\.checkIndex\)\]\.done = event\.target\.checked/);
assert.match(hub, /const API = \{[\s\S]*inaugurations: '\/api\/hub\/inauguracoes'/);
assert.doesNotMatch(hub, /\/api\/hub\/inauguracoes\/(checklist|override|etapas)/, 'não deve existir backend separado para overrides');
assert.match(controls, /const checklistTemplate = \[/);
assert.match(controls, /\{ action: 'Número de telefone para redes sociais', owner: 'Franqueado', daysBefore: 30 \}/);
assert.doesNotMatch(controls, /ownerOverride|dueDate/, 'template global deve continuar sem campos de override');
assert.match(finance, /data-inauguration-finance-new-payment/);
assert.match(finance, /data-inauguration-finance-new-supplier/);

assert.match(workspace, /if \(step\?\.dueDate\)/);
assert.match(workspace, /owner: String\(step\?\.ownerOverride \|\| step\?\.owner \|\| ''\)/);
assert.doesNotMatch(workspace, /localStorage\.setItem|fetch\(|\/api\//, 'workspace não deve virar owner de persistência');

const runnable = workspace.replace(/\}\)\(\);\s*$/, 'globalThis.__overrideTest = { nextChecklistStep };})();');
const sandbox = {
  console,
  Intl,
  Date,
  window: {
    matchMedia: () => ({ matches: true }),
    addEventListener: () => {},
    localStorage: { getItem: () => '[]' },
    setTimeout: () => {},
  },
  document: {
    head: null,
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
  },
  requestAnimationFrame: () => {},
};
sandbox.globalThis = sandbox;
vm.runInNewContext(runnable, sandbox, { filename: 'inauguration-workspace-v2.js' });
const { nextChecklistStep } = sandbox.__overrideTest;

const today = new Date();
today.setHours(12, 0, 0, 0);
const opening = new Date(today);
opening.setDate(opening.getDate() + 20);
const openingDate = opening.toISOString().slice(0, 10);
const defaultStep = { action: 'Aprovar artes', owner: 'Franqueadora', daysBefore: 10, done: false };

const legacy = nextChecklistStep({ openingDate, checklist: [{ ...defaultStep }] });
assert.equal(legacy.owner, 'Franqueadora', 'inauguração antiga mantém responsável padrão');
assert.ok(legacy.due, 'inauguração antiga continua calculando prazo padrão');

const ownerOverride = nextChecklistStep({
  openingDate,
  checklist: [{ ...defaultStep, ownerOverride: 'André' }],
});
assert.equal(ownerOverride.owner, 'André', 'responsável customizado deve aparecer na próxima etapa');

const anotherUnit = nextChecklistStep({ openingDate, checklist: [{ ...defaultStep }] });
assert.equal(anotherUnit.owner, 'Franqueadora', 'override de uma unidade não altera outra unidade');

const yesterday = new Date(today);
yesterday.setDate(yesterday.getDate() - 1);
const dueDate = yesterday.toISOString().slice(0, 10);
const overdueOverride = nextChecklistStep({
  openingDate,
  checklist: [{ ...defaultStep, dueDate }],
});
assert.equal(overdueOverride.state, 'overdue', 'prazo customizado vencido deve gerar etapa atrasada');
assert.equal(overdueOverride.due, new Intl.DateTimeFormat('pt-BR').format(yesterday));

const resetEquivalent = nextChecklistStep({ openingDate, checklist: [{ ...defaultStep }] });
assert.equal(resetEquivalent.owner, legacy.owner, 'remover ownerOverride volta ao padrão');
assert.equal(resetEquivalent.due, legacy.due, 'remover dueDate volta ao prazo calculado');

const beforeDone = nextChecklistStep({ openingDate, checklist: [
  { ...defaultStep, ownerOverride: 'André' },
  { action: 'Próxima', owner: 'Franqueado', daysBefore: 5, done: false },
] });
const afterDone = nextChecklistStep({ openingDate, checklist: [
  { ...defaultStep, ownerOverride: 'André', done: true },
  { action: 'Próxima', owner: 'Franqueado', daysBefore: 5, done: false },
] });
assert.equal(beforeDone.action, 'Aprovar artes');
assert.equal(afterDone.action, 'Próxima', 'concluir etapa deve continuar promovendo a próxima');

console.log('Inaugurações: overrides per-item de responsável/prazo, reset, atraso e compatibilidade validados.');
