import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../planet-hub/assets/inauguration-timing-core-v1.js', import.meta.url), 'utf8');
const window = {};
const sandbox = { window, Intl, Date, Number, String, Array, Object, RegExp, Math, console };
vm.runInNewContext(source, sandbox, { filename: 'inauguration-timing-core-v1.js' });

const timing = window.PMHInaugurationTiming;
assert.ok(timing, 'núcleo temporal deve ser publicado sem criar uma segunda persistência');
assert.equal(typeof timing.stepDueDate, 'function');
assert.equal(typeof timing.nextStep, 'function');
assert.equal(typeof timing.attentionItems, 'function');

const guarulhos = {
  id: 'guarulhos',
  unit: 'Parque Shopping Maia / Guarulhos',
  location: 'Guarulhos/SP',
  responsible: 'André',
  openingDate: '2026-09-24',
  checklist: [
    { action: 'Confirmar fornecedores locais', owner: 'Franqueado', daysBefore: 30, done: false },
    { action: 'Liberar campanha de inauguração', owner: 'Franqueadora', daysBefore: 20, done: false },
  ],
};

assert.equal(
  timing.stepDueDate(guarulhos, guarulhos.checklist[0]),
  '2026-08-25',
  'D-30 deve ser calculado a partir da data real de abertura',
);

const guarulhosStep = timing.nextStep(guarulhos, '2026-08-28');
assert.equal(guarulhosStep.state, 'overdue');
assert.equal(guarulhosStep.action, 'Confirmar fornecedores locais');
assert.equal(guarulhosStep.owner, 'Franqueado');
assert.equal(guarulhosStep.dueDate, '2026-08-25');

const [guarulhosAttention] = timing.attentionItems([guarulhos], '2026-08-28');
assert.equal(guarulhosAttention.dueDate, '2026-08-25');
assert.equal(guarulhosAttention.priority, 0, 'etapa D-30 vencida precisa entrar com prioridade operacional alta');
assert.equal(guarulhosAttention.ownership, 'tracking', 'etapa do franqueado deve ser acompanhamento, não ação pessoal do André');
assert.match(guarulhosAttention.title, /Confirmar fornecedores locais/);

const franqueadora = {
  ...guarulhos,
  id: 'franqueadora',
  checklist: [
    { action: 'Liberar campanha de inauguração', owner: 'Franqueadora', daysBefore: 30, done: false },
  ],
};
const [franqueadoraAttention] = timing.attentionItems([franqueadora], '2026-08-28');
assert.equal(franqueadoraAttention.ownership, 'mine', 'etapa da franqueadora deve permanecer como ação do responsável interno');

const grandeRio = {
  id: 'grande-rio',
  unit: 'Grande Rio',
  location: 'Rio de Janeiro/RJ',
  responsible: 'André',
  openingDate: '2026-08-15',
  checklist: [
    { action: 'Registrar fechamento pós-inauguração', owner: 'Franqueadora', dueDate: '2026-08-30', done: false },
  ],
};
const [grandeRioAttention] = timing.attentionItems([grandeRio], '2026-08-28');
assert.match(grandeRioAttention.status, /^Pós-inauguração/,
  'projeto com abertura passada e checklist pendente não pode desaparecer da operação');
assert.equal(grandeRioAttention.dueDate, '2026-08-30');
assert.equal(grandeRioAttention.priority, 1);

const completed = timing.attentionItems([{
  ...guarulhos,
  id: 'done',
  checklist: guarulhos.checklist.map((step) => ({ ...step, done: true })),
}], '2026-08-28');
assert.equal(completed.length, 0, 'checklist concluído deve sair da atenção operacional');

assert.doesNotMatch(source, /localStorage|sessionStorage|fetch\(|\/api\//,
  'núcleo temporal deve ser puro e não criar fonte, persistência ou backend paralelo');

console.log('Inaugurações: D-30, ownership e pós-inauguração operacional validados.');
