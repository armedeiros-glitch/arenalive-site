import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { onRequestGet, onRequestPost, onRequestDelete } from '../functions/api/hub/planet/five-stars/evaluations.js';

class MemoryKV {
  constructor() { this.map = new Map(); }
  async get(key, options = {}) {
    const value = this.map.get(key);
    if (value == null) return null;
    return options?.type === 'json' ? JSON.parse(value) : value;
  }
  async put(key, value) { this.map.set(key, value); }
}

const store = new MemoryKV();
const env = { PLANET_HUB_DATA: store };

const createResponse = await onRequestPost({
  env,
  request: new Request('https://example.com/api/hub/planet/five-stars/evaluations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      evaluation: {
        unit: 'Unidade Piloto',
        cycle: '2026-S2',
        evaluatedAt: '2026-08-07',
        scores: { commercial: 40, experience: 22.5, marketing: 18, management: 19 },
        requirements: { hiddenShopper: 'ok', reportsOnTime: 'ok', noSeriousPending: 'pending' },
        notes: 'Avaliação de teste',
      },
    }),
  }),
});
assert.equal(createResponse.status, 201);
const created = await createResponse.json();
assert.equal(created.evaluation.unit, 'Unidade Piloto');
assert.equal(created.evaluation.scores.commercial, 35, 'Comercial deve respeitar o teto oficial de 35 pontos.');
assert.equal(created.evaluation.total, 94.5);
assert.equal(created.evaluation.starsByScore, 5);
assert.equal(created.evaluation.requirements.noSeriousPending, 'pending');

const listResponse = await onRequestGet({ env });
assert.equal(listResponse.status, 200);
const list = await listResponse.json();
assert.equal(list.storage, 'shared');
assert.equal(list.data.length, 1);
assert.equal(list.data[0].id, created.evaluation.id);

const invalidResponse = await onRequestPost({
  env,
  request: new Request('https://example.com/api/hub/planet/five-stars/evaluations', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ evaluation: { unit: '', cycle: '2026-S2', evaluatedAt: '2026-08-07' } }),
  }),
});
assert.equal(invalidResponse.status, 400);

const deleteResponse = await onRequestDelete({
  env,
  request: new Request('https://example.com/api/hub/planet/five-stars/evaluations', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: created.evaluation.id }),
  }),
});
assert.equal(deleteResponse.status, 200);
const afterDelete = await (await onRequestGet({ env })).json();
assert.equal(afterDelete.data.length, 0);

const [ui, css, access, html, api] = await Promise.all([
  readFile(new URL('../planet-hub/assets/planet-five-stars-data-v1.js', import.meta.url), 'utf8'),
  readFile(new URL('../planet-hub/assets/planet-five-stars-data-v1.css', import.meta.url), 'utf8'),
  readFile(new URL('../planet-hub/assets/hub-access-v1.js', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../functions/api/hub/planet/five-stars/evaluations.js', import.meta.url), 'utf8'),
]);

assert.match(ui, /\/api\/hub\/planet\/five-stars\/evaluations/);
assert.match(ui, /\+ Nova avaliação/);
assert.match(ui, /Salvar e lançar próxima/);
assert.match(ui, /max=\"35\"/);
assert.match(ui, /max=\"25\"/);
assert.match(ui, /max=\"20\"/);
assert.match(ui, /2 ciclos consecutivos são verificados automaticamente/);
assert.match(ui, /certificação pendente/);
assert.doesNotMatch(ui, /localStorage|sessionStorage|MutationObserver|setInterval/);
assert.match(css, /\.p5-modal/);
assert.match(css, /\.p5-unit-row/);
assert.match(access, /planet-five-stars-data-v1\.js\?v=20260807-1/);
assert.match(html, /planet-five-stars-data-v1\.css\?v=20260807-1/);
assert.match(api, /planet-hub:planet-five-stars-evaluations:v1/);
assert.match(api, /commercial, 35/);
assert.match(api, /experience, 25/);
assert.equal((api.match(/PLANET_HUB_DATA/g) || []).length >= 1, true);

console.log('Entrada e persistência do Planet 5 Estrelas validadas.');
