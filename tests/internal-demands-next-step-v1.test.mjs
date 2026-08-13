import fs from 'node:fs';
import assert from 'node:assert/strict';

globalThis.window = { addEventListener() {} };
globalThis.document = {
  querySelector() { return null; },
  addEventListener() {},
  dispatchEvent() {},
  body: { appendChild() {} },
};
globalThis.localStorage = { getItem() { return null; }, setItem() {} };
globalThis.requestAnimationFrame = () => 1;
globalThis.CustomEvent = class CustomEvent {};
globalThis.confirm = () => true;

await import('../planet-hub/assets/internal-demands-v1.js');

const source = fs.readFileSync('planet-hub/assets/internal-demands-v1.js', 'utf8');
const css = fs.readFileSync('planet-hub/assets/internal-demands-v1.css', 'utf8');
const backend = fs.readFileSync('functions/api/hub/demandas-internas.js', 'utf8');
const marketing = fs.readFileSync('planet-hub/assets/andre-os-home-pages-v1.js', 'utf8');
const queue = globalThis.window.PlanetInternalDemandsQueue;
assert.ok(queue?.nextStepMeta);

const steps = [
  { id: 's1', text: 'Briefing aprovado', done: true },
  { id: 's2', text: 'Criar primeira arte', done: false },
  { id: 's3', text: 'Enviar para aprovação', done: false },
];
assert.deepEqual(queue.nextStepMeta(steps), { state: 'pending', text: 'Criar primeira arte' });

steps[1].done = true;
assert.deepEqual(queue.nextStepMeta(steps), { state: 'pending', text: 'Enviar para aprovação' });

steps[2].done = true;
assert.deepEqual(queue.nextStepMeta(steps), { state: 'completed', text: '' });
assert.equal(queue.nextStepMeta([]), null);
assert.equal(queue.nextStepMeta(null), null);

const longText = 'Etapa muito longa '.repeat(30).trim();
assert.deepEqual(queue.nextStepMeta([{ id: 'long', text: longText, done: false }]), { state: 'pending', text: longText });
assert.match(css, /-webkit-line-clamp:2/);
assert.match(source, /PRÓXIMA ETAPA/);
assert.match(source, /ETAPAS CONCLUÍDAS/);
assert.match(source, /nextStepMeta\(item\.steps\)/);
assert.match(source, /data-demand-edit=/);
assert.match(source, /data-demand-complete=/);
assert.match(source, /item\.status = 'completed'/);
assert.match(source, /\.filter\(\(item\) => item\.status === 'completed'\)/);
assert.match(source, /step\.done = checkbox\.checked/);
assert.match(source, /await save\(\)/);

const reference = '2026-08-13';
const demand = (id, dueDate, priority, updatedAt, demandSteps = []) => ({
  id, title: id, status: 'new', dueDate, priority, updatedAt, responsible: id, steps: demandSteps,
});
const ordered = queue.sortActiveDemands([
  demand('sem-prazo', '', 'urgent', '2026-08-13T12:00:00.000Z', [{ id: 'a', text: 'A', done: false }]),
  demand('futura-alta', '2026-08-15', 'high', '2026-08-13T10:00:00.000Z', [{ id: 'b', text: 'B', done: false }]),
  demand('futura-urgente', '2026-08-15', 'urgent', '2026-08-13T09:00:00.000Z', []),
  demand('atrasada', '2026-08-12', 'low', '2026-08-13T08:00:00.000Z', [{ id: 'c', text: 'C', done: true }]),
], reference).map((item) => item.id);
assert.deepEqual(ordered, ['atrasada', 'futura-urgente', 'futura-alta', 'sem-prazo']);

assert.doesNotMatch(source, /\bnextAction\s*:|\bnextStep\s*:|\bcurrentStep\s*:|\bprogress\s*:/);
assert.doesNotMatch(backend, /nextAction|nextStep|currentStep|progress/);
assert.match(backend, /ITEM_STORAGE_PREFIX = 'planet-hub:internal-demand:v2:'/);
assert.match(backend, /writeTombstone/);
assert.match(backend, /conflictingIds/);
assert.match(backend, /\}, 409\)/);
assert.match(marketing, /data-marketing-queue/);
assert.doesNotMatch(marketing, /PRÓXIMA ETAPA|ETAPAS CONCLUÍDAS/);

console.log('Demandas internas: próxima etapa derivada de steps[] validada.');
