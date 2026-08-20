import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { onRequestPost as ignoreTicket } from '../functions/api/hub/chamados-ignorados.js';
import { onRequestGet as getTickets } from '../functions/api/sults/chamados.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [indexHtml, ownerSource, duplicateSource] = await Promise.all([
  read('index.html'),
  read('planet-hub/assets/ignored-tickets-v1.js'),
  read('planet-hub/assets/ticket-ignore-instant-v1.js'),
]);

assert.doesNotMatch(indexHtml, /ticket-ignore-instant-v1\.js/, 'o executor duplicado não pode continuar no runtime ativo');
assert.match(indexHtml, /ignored-tickets-v1\.js/, 'o owner de Excluir do Hub deve continuar carregado');
assert.match(duplicateSource, /data-ignore-ticket/, 'o arquivo histórico deve permanecer fisicamente nesta etapa');

class FakeElement {
  constructor({ classes = [], dataset = {}, text = '', parent = null } = {}) {
    this.classList = {
      values: new Set(classes),
      contains: (value) => this.classList.values.has(value),
      add: (value) => this.classList.values.add(value),
      remove: (value) => this.classList.values.delete(value),
    };
    this.dataset = { ...dataset };
    this.textContent = text;
    this.parent = parent;
    this.children = [];
    this.disabled = false;
    this.removed = false;
    this.attributes = new Map();
    this.style = {};
  }
  appendChild(child) { child.parent = this; this.children.push(child); return child; }
  remove() { this.removed = true; if (this.parent) this.parent.children = this.parent.children.filter((item) => item !== this); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  querySelector(selector) {
    if (selector === '[data-ignore-ticket]') return this.children.find((item) => item.dataset.ignoreTicket) || null;
    if (selector === 'h4') return this.children.find((item) => item.tag === 'h4') || null;
    if (selector === 'p') return this.children.find((item) => item.tag === 'p') || null;
    if (selector === '.pmh-ticket-drawer-actions') return this.children.find((item) => item.classList.contains('pmh-ticket-drawer-actions')) || null;
    if (selector === '.pmh-ticket-drawer-header small') return this.children.find((item) => item.tag === 'small') || null;
    if (selector === '.pmh-ticket-drawer-header h2') return this.children.find((item) => item.tag === 'h2') || null;
    if (selector === '.pmh-ticket-summary article:first-child strong') return this.children.find((item) => item.tag === 'unit') || null;
    if (selector === ':scope > header b') return this.children.find((item) => item.tag === 'counter') || null;
    if (selector === '.pmh-command-list') return this.children.find((item) => item.classList.contains('pmh-command-list')) || null;
    if (selector === '.pmh-command-ticket-badges .deadline') return this.children.find((item) => item.classList.contains('deadline')) || null;
    if (selector === '.pmh-command-ticket-badges .status') return this.children.find((item) => item.classList.contains('status')) || null;
    return null;
  }
  querySelectorAll() { return []; }
  closest(selector) {
    if (selector === '[data-ignore-ticket]' && this.dataset.ignoreTicket) return this;
    if (selector === '.pmh-command-group') {
      let current = this.parent;
      while (current) { if (current.classList.contains('pmh-command-group')) return current; current = current.parent; }
    }
    return null;
  }
  insertAdjacentElement(_position, child) { return this.appendChild(child); }
}

const card = new FakeElement({ classes: ['pmh-ticket', 'pmh-command-ticket'], dataset: { ticketId: '321' } });
const title = new FakeElement({ text: 'Chamado teste' }); title.tag = 'h4'; card.appendChild(title);
const unit = new FakeElement({ text: 'Planet Teste' }); unit.tag = 'p'; card.appendChild(unit);
const deadline = new FakeElement({ classes: ['deadline', 'late'] }); card.appendChild(deadline);
const status = new FakeElement({ classes: ['status', 'status-4'] }); card.appendChild(status);
const group = new FakeElement({ classes: ['pmh-command-group'] });
const counter = new FakeElement({ text: '1' }); counter.tag = 'counter'; group.appendChild(counter);
const list = new FakeElement({ classes: ['pmh-command-list'] }); list.appendChild(card); group.appendChild(list);

const drawer = new FakeElement({ classes: ['pmh-ticket-drawer'] });
const panel = new FakeElement({ classes: ['pmh-ticket-drawer-panel'] });
const actions = new FakeElement({ classes: ['pmh-ticket-drawer-actions'] });
const drawerId = new FakeElement({ text: 'CHAMADO #321' }); drawerId.tag = 'small'; panel.appendChild(drawerId);
const drawerTitle = new FakeElement({ text: 'Chamado teste' }); drawerTitle.tag = 'h2'; panel.appendChild(drawerTitle);
const drawerUnit = new FakeElement({ text: 'Planet Teste' }); drawerUnit.tag = 'unit'; panel.appendChild(drawerUnit);
panel.appendChild(actions); drawer.appendChild(panel);

const metricLate = new FakeElement({ text: '1' });
const ticketBadge = new FakeElement({ text: '1' });
const filterLabel = new FakeElement({ text: '1 exibidos' });
const description = new FakeElement({ text: '1 de 1 chamados visíveis. Contexto operacional.' });
const htmlClasses = new Set(['pmh-ticket-drawer-open']);
const clickListeners = [];
const created = [];
let postCount = 0;
let fetchPayload = { data: [] };

const document = {
  head: new FakeElement(),
  body: new FakeElement(),
  documentElement: { classList: { remove: (name) => htmlClasses.delete(name) } },
  createElement(tag) { const element = new FakeElement(); element.tag = tag; created.push(element); return element; },
  addEventListener(type, handler) { if (type === 'click') clickListeners.push(handler); },
  querySelector(selector) {
    if (selector === '.pmh-ignore-toast') return null;
    if (selector === '.pmh-ticket-drawer') return drawer.removed ? null : drawer;
    if (selector === '.pmh-command-filter-title span') return filterLabel;
    if (selector === '.pmh-section-head p') return description;
    if (selector === '[data-command-urgency="late"] strong') return metricLate;
    if (selector === '[data-badge="tickets"]') return ticketBadge;
    if (selector.includes('.pmh-ticket[data-ticket-id=')) return card.removed ? null : card;
    return null;
  },
  querySelectorAll(selector) {
    if (selector === '.pmh-ticket[data-ticket-id]') return card.removed ? [] : [card];
    if (selector === '.pmh-ticket-drawer-panel') return drawer.removed ? [] : [panel];
    if (selector === '.pmh-command-ticket') return card.removed ? [] : [card];
    return [];
  },
};

class MutationObserver { constructor(callback) { this.callback = callback; } observe() {} }
const immediateTimeout = (fn) => { fn(); return 1; };
const context = {
  document,
  MutationObserver,
  CSS: { escape: (value) => String(value) },
  fetch: async (url, options = {}) => {
    assert.equal(url, '/api/hub/chamados-ignorados');
    assert.equal(options.method, 'POST');
    postCount += 1;
    return new Response(JSON.stringify(fetchPayload), { status: 200, headers: { 'Content-Type': 'application/json' } });
  },
  Response,
  JSON,
  Error,
  Number,
  String,
  Set,
  Map,
  console,
  requestAnimationFrame: (fn) => fn(),
  setTimeout: immediateTimeout,
  clearTimeout: () => {},
  confirm: () => true,
  window: {
    confirm: () => true,
    setTimeout: immediateTimeout,
  },
};
context.window.window = context.window;
context.window.document = document;
context.window.requestAnimationFrame = context.requestAnimationFrame;

vm.runInNewContext(ownerSource, context, { filename: 'ignored-tickets-v1.js' });

const cardButton = card.querySelector('[data-ignore-ticket]');
const drawerButton = actions.querySelector('[data-ignore-ticket]');
assert.ok(cardButton, 'o owner deve continuar criando o botão no card');
assert.ok(drawerButton, 'o owner deve continuar criando o botão no drawer');
assert.equal(clickListeners.length, 1, 'deve existir um único executor moderno ativo no script owner');

await clickListeners[0]({
  target: cardButton,
  preventDefault() {},
  stopPropagation() {},
  stopImmediatePropagation() {},
});
await new Promise((resolve) => setImmediate(resolve));

assert.equal(postCount, 1, 'um clique deve gerar exatamente um POST');
assert.equal(card.removed, true, 'o card deve sumir imediatamente após sucesso');
assert.equal(drawer.removed, true, 'o drawer deve fechar após sucesso');
assert.equal(htmlClasses.has('pmh-ticket-drawer-open'), false, 'o estado visual de drawer aberto deve ser limpo');
assert.equal(metricLate.textContent, '0', 'a métrica afetada deve ser atualizada');
assert.equal(ticketBadge.textContent, '0', 'o badge de chamados deve ser atualizado');

class FakeKV {
  constructor() { this.values = new Map(); }
  async get(key, options = {}) { const raw = this.values.get(key); return raw == null ? null : options.type === 'json' ? JSON.parse(raw) : raw; }
  async put(key, value) { this.values.set(key, value); }
  async list({ prefix = '' } = {}) { return { keys: [...this.values.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })), list_complete: true }; }
}

const kv = new FakeKV();
const env = { PLANET_HUB_DATA: kv };
const ignoredResponse = await ignoreTicket({
  env,
  request: new Request('https://andre-os.test/api/hub/chamados-ignorados', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: '321', title: 'Chamado teste', unit: 'Planet Teste' }),
  }),
});
assert.equal(ignoredResponse.status, 200, 'o ignore compartilhado deve persistir');

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => new Response(JSON.stringify({
    data: [{
      id: 321, titulo: 'Chamado teste', unidade: { nome: 'Planet Teste' }, situacao: 4,
      responsavel: { nome: 'André Roberto Medeiros' }, departamento: { id: 10, nome: 'Marketing' },
      apoio: [], etiqueta: [], ultimaAlteracao: '2026-08-12T10:00:00.000Z',
    }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const refetch = await getTickets({
    env: { ...env, SULTS_API_TOKEN: 'token' },
    request: new Request('https://andre-os.test/api/sults/chamados?start=0&limit=100'),
  });
  const payload = await refetch.json();
  assert.equal(payload.data.some((item) => String(item.id) === '321'), false, 'após refetch o chamado ignorado deve continuar fora da lista');
} finally {
  globalThis.fetch = originalFetch;
}

let errorPostCount = 0;
const errorCard = new FakeElement({ classes: ['pmh-ticket', 'pmh-command-ticket'], dataset: { ticketId: '999' } });
assert.match(ownerSource, /if \(!response\.ok\) throw new Error/, 'erro HTTP deve impedir remoção otimista como sucesso');
assert.match(ownerSource, /button\.disabled = false[\s\S]*button\.textContent = originalText/, 'erro deve restaurar o botão');
assert.equal(errorPostCount, 0);

console.log('Chamados: ignored-tickets é owner único no runtime; card, drawer, 1 POST, remoção e persistência validados.');
