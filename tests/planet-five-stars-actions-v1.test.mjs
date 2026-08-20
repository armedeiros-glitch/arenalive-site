import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { onRequestGet, onRequestPost, onRequestDelete } from '../functions/api/hub/planet/five-stars/action-plans.js';

class MemoryKV {
  constructor() { this.map = new Map(); }
  async get(key, options = {}) {
    const value = this.map.get(key);
    if (value == null) return null;
    return options?.type === 'json' ? JSON.parse(value) : value;
  }
  async put(key, value) { this.map.set(key, value); }
  async delete(key) { this.map.delete(key); }
  async list({ prefix = '', limit = 1000 } = {}) {
    const keys = [...this.map.keys()].filter((name) => name.startsWith(prefix)).slice(0, limit).map((name) => ({ name }));
    return { keys, list_complete: true };
  }
}

const env = { PLANET_HUB_DATA: new MemoryKV() };
const req = (method, body) => new Request('https://example.com/api/hub/planet/five-stars/action-plans', {
  method,
  headers: { 'Content-Type': 'application/json' },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

const createResponse = await onRequestPost({ request: req('POST', { plan: {
  unit: 'Planet Teste', title: 'Melhorar adesão às campanhas', pillar: 'marketing', ownerArea: 'marketing', deadline: '2026-08-20', status: 'aberto',
} }), env });
assert.equal(createResponse.status, 201);
const created = await createResponse.json();
assert.equal(created.plan.unit, 'Planet Teste');
assert.equal(created.plan.ownerArea, 'marketing');

const list = await (await onRequestGet({ request: req('GET'), env })).json();
assert.equal(list.data.length, 1);
assert.equal(list.data[0].title, 'Melhorar adesão às campanhas');

const updateResponse = await onRequestPost({ request: req('POST', { plan: {
  ...created.plan, status: 'concluido',
} }), env });
assert.equal(updateResponse.status, 200);
const updated = await updateResponse.json();
assert.equal(updated.plan.status, 'concluido');

const deleteResponse = await onRequestDelete({ request: req('DELETE', { id: created.plan.id }), env });
assert.equal(deleteResponse.status, 200);
const empty = await (await onRequestGet({ request: req('GET'), env })).json();
assert.equal(empty.data.length, 0);

const [js, css, access, html, api] = await Promise.all([
  readFile(new URL('../planet-hub/assets/planet-five-stars-actions-v1.js', import.meta.url), 'utf8'),
  readFile(new URL('../planet-hub/assets/planet-five-stars-actions-v1.css', import.meta.url), 'utf8'),
  readFile(new URL('../planet-hub/assets/hub-access-v1.js', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../functions/api/hub/planet/five-stars/action-plans.js', import.meta.url), 'utf8'),
]);

assert.match(js, /Da avaliação para a correção/);
assert.match(js, /\+ Novo plano/);
assert.match(js, /data-p5-plan-unit/);
assert.match(js, /suggestionFor/);
assert.match(js, /\/api\/hub\/planet\/five-stars\/evaluations/);
assert.match(js, /data-p5-plan-destination/);
assert.doesNotMatch(js, /localStorage|sessionStorage|MutationObserver|setInterval/);
assert.doesNotMatch(css, /!important/);
assert.match(css, /p5-action-list/);
assert.match(access, /planet-five-stars-actions-v1\.js\?v=20260813-1/);
assert.match(html, /planet-five-stars-actions-v1\.css\?v=20260813-1/);
assert.match(api, /planet-hub:planet-five-stars-action-plan:v1:/);

console.log('Planos de ação do Planet 5 Estrelas validados.');