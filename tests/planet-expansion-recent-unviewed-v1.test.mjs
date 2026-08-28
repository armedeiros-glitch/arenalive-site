import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../planet-hub/assets/planet-expansion-v1.js', import.meta.url), 'utf8');

const badge = { hidden: true, textContent: '', title: '' };
const attributes = {};
const button = {
  classList: { toggle() {}, add() {}, remove() {} },
  querySelector(selector) {
    if (selector === '[data-expansion-badge]') return badge;
    return null;
  },
  setAttribute(name, value) { attributes[name] = value; },
};
const nav = {
  querySelector() { return button; },
  appendChild() {},
};

const document = {
  querySelector(selector) {
    if (selector === '.pmh-sidebar nav') return nav;
    if (selector === '.pmh-sidebar nav [data-expansion-nav]') return button;
    return null;
  },
  querySelectorAll() { return []; },
  createElement() { throw new Error('não deve criar navegação quando o botão já existe'); },
  addEventListener() {},
  execCommand() { return true; },
  body: { appendChild() {} },
};

const window = {
  AndreOS: null,
  PlanetExpansion: null,
  addEventListener() {},
  setTimeout() { return 1; },
  open() {},
};

const context = vm.createContext({
  window,
  document,
  location: { hash: '#inicio' },
  sessionStorage: { getItem() { return ''; }, removeItem() {}, setItem() {} },
  navigator: {},
  CSS: { escape: (value) => String(value) },
  fetch: async () => ({ ok: true, json: async () => ({ data: [], revision: 'test', updatedAt: null }) }),
  requestAnimationFrame(callback) { callback(); return 1; },
  cancelAnimationFrame() {},
  clearTimeout() {},
  console,
});

vm.runInContext(source, context, { filename: 'planet-expansion-v1.js' });
assert.ok(window.PlanetExpansion?.recentUnviewedCount, 'helper recente deve ficar disponível para teste');

const now = Date.parse('2026-08-28T15:00:00Z');
const leads = [
  { id: 'recent', createdAt: '2026-08-28T14:00:00Z', viewedAt: '' },
  { id: 'old', createdAt: '2026-08-26T14:00:00Z', viewedAt: '' },
  { id: 'viewed', createdAt: '2026-08-28T13:00:00Z', viewedAt: '2026-08-28T14:30:00Z' },
  { id: 'boundary', createdAt: '2026-08-27T15:00:00Z', viewedAt: '' },
];

assert.equal(window.PlanetExpansion.recentUnviewedCount(leads, now), 1, 'somente o lead não visto com menos de 24h deve entrar no badge');
assert.equal(leads.filter((lead) => !lead.viewedAt).length, 3, 'backlog total deve continuar independente da contagem recente');

console.log('Expansão: badge recente separado do backlog total de leads.');
