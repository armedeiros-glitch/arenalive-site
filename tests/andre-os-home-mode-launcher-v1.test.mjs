import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { onRequestGet, onRequestPost, onRequestDelete } from '../functions/api/hub/laboratory/projects.js';

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
const request = (method, body) => new Request('https://example.com/api/hub/laboratory/projects', {
  method,
  headers: { 'Content-Type': 'application/json' },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

const createdResponse = await onRequestPost({ request: request('POST', { project: {
  name: 'Projeto Teste', status: 'validando', summary: 'Hipótese em teste', nextStep: 'Entrevistar usuários',
} }), env });
assert.equal(createdResponse.status, 201);
const created = await createdResponse.json();
assert.equal(created.project.name, 'Projeto Teste');
assert.equal(created.project.status, 'validando');

const list = await (await onRequestGet({ request: request('GET'), env })).json();
assert.equal(list.data.length, 1);
assert.equal(list.data[0].nextStep, 'Entrevistar usuários');

const updatedResponse = await onRequestPost({ request: request('POST', { project: {
  id: created.project.id, name: 'Projeto Teste', status: 'executando', nextStep: 'Rodar piloto',
} }), env });
assert.equal(updatedResponse.status, 200);
const updated = await updatedResponse.json();
assert.equal(updated.project.status, 'executando');

const deleteResponse = await onRequestDelete({ request: request('DELETE', { id: created.project.id }), env });
assert.equal(deleteResponse.status, 200);
const empty = await (await onRequestGet({ request: request('GET'), env })).json();
assert.equal(empty.data.length, 0);

const [js, css, html, api] = await Promise.all([
  readFile(new URL('../planet-hub/assets/andre-os-home-mode-launcher-v1.js', import.meta.url), 'utf8'),
  readFile(new URL('../planet-hub/assets/andre-os-home-mode-launcher-v1.css', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../functions/api/hub/laboratory/projects.js', import.meta.url), 'utf8'),
]);

assert.match(js, /O que você quer fazer\?/);
assert.match(js, /\/api\/hub\/laboratory\/projects/);
assert.match(js, /\/api\/radar\/today/);
assert.match(js, /\/api\/radar\/next/);
assert.match(js, /\+ Novo projeto/);
assert.match(js, /Salvar projeto/);
assert.match(js, /data-aos-sidebar-mode/);
assert.doesNotMatch(js, /\/api\/v1\/tasks|method:\s*['\"]POST['\"].*radar/i, 'Pessoal deve apenas ler o Radar, sem registrar tarefa por UI.');
assert.doesNotMatch(js, /localStorage|sessionStorage|MutationObserver|setInterval/);
assert.doesNotMatch(css, /!important/);
assert.match(css, /aos-personal-task-list/);
assert.match(css, /aos-lab-project-grid/);
assert.match(html, /andre-os-home-mode-launcher-v1\.js\?v=20260807-2/);
assert.match(html, /andre-os-home-mode-launcher-v1\.css\?v=20260807-2/);
assert.match(api, /andre-os:lab-project:v1:/);

console.log('Home funcional, Laboratório persistente e Pessoal em leitura do Radar validados.');
