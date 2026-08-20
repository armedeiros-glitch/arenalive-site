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
const radar = fs.readFileSync('planet-hub/assets/radar-data-v1.js', 'utf8');
const queue = globalThis.window.PlanetInternalDemandsQueue;
assert.ok(queue);

const reference = '2026-08-13';
const demand = (id, status, dueDate, priority = 'normal', updatedAt = '2026-08-13T10:00:00.000Z') => ({
  id, title: id, status, dueDate, priority, updatedAt, responsible: `Resp ${id}`,
});

const statuses = queue.sortActiveDemands([
  demand('nova', 'new', '2026-08-20'),
  demand('andamento', 'in_progress', '2026-08-20'),
  demand('aguardando', 'waiting', '2026-08-20'),
  demand('concluida', 'completed', '2026-08-10'),
  demand('cancelada', 'cancelled', '2026-08-10'),
], reference).map((item) => item.id).sort();
assert.deepEqual(statuses, ['aguardando', 'andamento', 'nova'].sort());

assert.deepEqual(queue.sortActiveDemands([
  demand('sem-prazo', 'new', ''),
  demand('futura', 'new', '2026-08-21'),
  demand('breve', 'new', '2026-08-15'),
  demand('hoje', 'new', '2026-08-13'),
  demand('atrasada', 'new', '2026-08-10'),
], reference).map((item) => item.id), ['atrasada', 'hoje', 'breve', 'futura', 'sem-prazo']);

assert.deepEqual(queue.sortActiveDemands([
  demand('baixa', 'new', '2026-08-15', 'low'),
  demand('normal', 'new', '2026-08-15', 'normal'),
  demand('alta', 'new', '2026-08-15', 'high'),
  demand('urgente', 'new', '2026-08-15', 'urgent'),
], reference).map((item) => item.id), ['urgente', 'alta', 'normal', 'baixa']);

assert.equal(queue.dueMeta('2026-08-10', reference).label, 'ATRASADA · 3 dias');
assert.equal(queue.dueMeta('2026-08-13', reference).label, 'VENCE HOJE');
assert.equal(queue.dueMeta('2026-08-15', reference).label, 'em 2 dias');
assert.equal(queue.dueMeta('', reference).label, 'Sem prazo');
assert.equal(queue.dueMeta('2026-08-21', reference).label, '21/08/2026');

assert.deepEqual(queue.sortActiveDemands([
  demand('antiga', 'new', '2026-08-15', 'normal', '2026-08-13T09:00:00.000Z'),
  demand('recente', 'new', '2026-08-15', 'normal', '2026-08-13T11:00:00.000Z'),
], reference).map((item) => item.id), ['recente', 'antiga']);

assert.match(source, /Demandas em andamento/);
assert.match(source, /data-demand-active-queue/);
assert.match(source, /Responsável<\/small><strong>/);
assert.match(source, /Status<\/small><strong>/);
assert.match(source, /Prioridade<\/small><strong>/);
assert.match(source, /Prazo<\/small><strong>/);
assert.match(source, /data-demand-edit=/);
assert.match(source, /data-demand-complete=/);
assert.match(source, /item\.status = 'completed'/);
assert.match(source, /item\.completedAt = nowIso\(\)/);
assert.match(source, /\.filter\(\(item\) => item\.status === 'completed'\)/);
assert.match(source, /Nenhuma demanda ativa no momento\./);
assert.match(css, /\.pmh-demand-due\.tone-late/);
assert.match(css, /\.pmh-demand-active-card\.status-waiting/);
assert.doesNotMatch(source, /\bcampaign\s*:|\bunit\s*:|\bnextAction\s*:/);

assert.match(backend, /ITEM_STORAGE_PREFIX = 'planet-hub:internal-demand:v2:'/);
assert.match(backend, /LEGACY_STORAGE_KEY = 'planet-hub:demandas-internas:v1'/);
assert.match(backend, /writeTombstone/);
assert.match(backend, /conflictingIds/);
assert.match(backend, /\}, 409\)/);
assert.doesNotMatch(backend, /campaign|unit|nextAction/);
assert.match(marketing, /data-marketing-queue/);
assert.match(marketing, /const visible = marketingFlow\.slice\(0, 5\)/);
assert.match(radar, /const fromInternalDemands/);
assert.match(radar, /action: 'demand'/);
assert.doesNotMatch(source, /\/api\/radar\/|createTask|todoist/i);

console.log('Demandas internas: fila ativa, ordenação, cards, ações e persistência preservadas.');
