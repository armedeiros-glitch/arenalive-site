import assert from 'node:assert/strict';
import fs from 'node:fs';

globalThis.window = { addEventListener() {} };
globalThis.document = { querySelector() { return null; }, addEventListener() {}, dispatchEvent() {}, body: { appendChild() {} } };
globalThis.localStorage = { getItem() { return null; }, setItem() {} };
globalThis.requestAnimationFrame = () => 1;
globalThis.CustomEvent = class CustomEvent {};
globalThis.confirm = () => true;

await import('../planet-hub/assets/internal-demands-v1.js');
const queue = globalThis.window.PlanetInternalDemandsQueue;
const source = fs.readFileSync('planet-hub/assets/internal-demands-v1.js', 'utf8');
const css = fs.readFileSync('planet-hub/assets/internal-demands-v1.css', 'utf8');
const marketing = fs.readFileSync('planet-hub/assets/andre-os-home-pages-v1.js', 'utf8');
assert.ok(queue?.nextStepMeta);

const steps = [
  { id: '1', text: 'Briefing aprovado', done: true },
  { id: '2', text: 'Criar primeira arte', done: false },
  { id: '3', text: 'Enviar para aprovação', done: false },
];
assert.deepEqual(queue.nextStepMeta(steps), { state: 'pending', text: 'Criar primeira arte' });
steps[1].done = true;
assert.deepEqual(queue.nextStepMeta(steps), { state: 'pending', text: 'Enviar para aprovação' });
steps[2].done = true;
assert.deepEqual(queue.nextStepMeta(steps), { state: 'completed', text: '' });
assert.equal(queue.nextStepMeta([]), null);

const longText = 'Etapa longa '.repeat(40).trim();
assert.equal(queue.nextStepMeta([{ id: '4', text: longText, done: false }]).text, longText);
assert.match(css, /-webkit-line-clamp:2/);
assert.match(source, /PRÓXIMA ETAPA/);
assert.match(source, /ETAPAS CONCLUÍDAS/);
assert.match(source, /step\.done = checkbox\.checked/);
assert.match(source, /data-demand-edit=/);
assert.match(source, /data-demand-complete=/);
assert.match(source, /\.filter\(\(item\) => item\.status === 'completed'\)/);
assert.doesNotMatch(marketing, /PRÓXIMA ETAPA|ETAPAS CONCLUÍDAS/);

const ref = '2026-08-13';
const demand = (id, dueDate, priority, updatedAt, demandSteps = []) => ({ id, title: id, status: 'new', dueDate, priority, updatedAt, responsible: id, steps: demandSteps });
assert.deepEqual(queue.sortActiveDemands([
  demand('sem', '', 'urgent', '2026-08-13T12:00:00Z'),
  demand('alta', '2026-08-15', 'high', '2026-08-13T10:00:00Z'),
  demand('urgente', '2026-08-15', 'urgent', '2026-08-13T09:00:00Z'),
  demand('atrasada', '2026-08-12', 'low', '2026-08-13T08:00:00Z'),
], ref).map((item) => item.id), ['atrasada', 'urgente', 'alta', 'sem']);

console.log('Demandas internas: próxima etapa derivada de steps[] validada.');
