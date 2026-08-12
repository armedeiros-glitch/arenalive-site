import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('planet-hub/assets/inauguration-workspace-v2.js');
const finance = read('planet-hub/assets/financeiro-v1.js');
const controls = read('planet-hub/assets/inauguration-controls-v1.js');

assert.match(source, /const nextChecklistStep = \(item\) => \{/);
assert.match(source, /const projectNextStep = \(itemId\) =>/);
assert.match(source, /pending\.find\(\(step\) => \{/);
assert.match(source, /const step = overdue \|\| pending\[0\]/);
assert.match(source, /state: 'completed', action: 'Checklist concluído'/);
assert.match(source, /data-inauguration-next-step-mode="summary"/);
assert.match(source, /data-inauguration-next-step-mode="list"/);
assert.match(source, /window\.setTimeout\(\(\) => refreshProjectNextStep\(itemId\), 0\)/);
assert.doesNotMatch(source, /localStorage\.setItem|fetch\(|\/api\//, 'workspace não deve criar persistência ou backend novo');
assert.match(controls, /checklist: makeChecklist\(\)/, 'modelo atual do checklist deve permanecer o mesmo');
assert.match(finance, /data-inauguration-finance-new-payment/);
assert.match(finance, /data-inauguration-finance-new-supplier/);

const runnable = source.replace(/\}\)\(\);\s*$/, 'globalThis.__inaugurationTest = { nextChecklistStep };})();');
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
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
  },
  requestAnimationFrame: () => {},
};
sandbox.globalThis = sandbox;
vm.runInNewContext(runnable, sandbox, { filename: 'inauguration-workspace-v2.js' });
const { nextChecklistStep } = sandbox.__inaugurationTest;
assert.equal(typeof nextChecklistStep, 'function');

const today = new Date();
today.setHours(12, 0, 0, 0);
const opening = new Date(today);
opening.setDate(opening.getDate() + 10);
const openingDate = opening.toISOString().slice(0, 10);
const project = (checklist) => ({ openingDate, checklist });

const multipleOverdue = nextChecklistStep(project([
  { action: 'Primeira atrasada', owner: 'Franqueado', daysBefore: 30, done: false },
  { action: 'Segunda atrasada', owner: 'Franqueadora', daysBefore: 20, done: false },
  { action: 'Pendente futura', owner: 'Franqueado', daysBefore: 5, done: false },
]));
assert.equal(multipleOverdue.state, 'overdue');
assert.equal(multipleOverdue.action, 'Primeira atrasada', 'mais de uma atrasada deve respeitar a ordem do checklist');
assert.equal(multipleOverdue.owner, 'Franqueado');
assert.ok(multipleOverdue.due, 'prazo calculado deve aparecer');

const firstPending = nextChecklistStep(project([
  { action: 'Concluída', owner: 'Franqueado', daysBefore: 30, done: true },
  { action: 'Primeira pendente', owner: 'Franqueadora', daysBefore: 5, done: false },
  { action: 'Segunda pendente', owner: 'Franqueado', daysBefore: 1, done: false },
]));
assert.equal(firstPending.state, 'pending');
assert.equal(firstPending.action, 'Primeira pendente');
assert.equal(firstPending.owner, 'Franqueadora');

const completed = nextChecklistStep(project([
  { action: 'A', owner: 'Franqueado', daysBefore: 30, done: true },
  { action: 'B', owner: 'Franqueadora', daysBefore: 5, done: true },
]));
assert.equal(completed.state, 'completed');
assert.equal(completed.action, 'Checklist concluído');

const before = nextChecklistStep(project([
  { action: 'Atual', owner: 'Franqueado', daysBefore: 5, done: false },
  { action: 'Próxima', owner: 'Franqueadora', daysBefore: 1, done: false },
]));
const after = nextChecklistStep(project([
  { action: 'Atual', owner: 'Franqueado', daysBefore: 5, done: true },
  { action: 'Próxima', owner: 'Franqueadora', daysBefore: 1, done: false },
]));
assert.equal(before.action, 'Atual');
assert.equal(after.action, 'Próxima', 'concluir a etapa atual deve promover a próxima');

console.log('Inaugurações: próxima etapa, atraso, conclusão e consistência lista/resumo validados.');
