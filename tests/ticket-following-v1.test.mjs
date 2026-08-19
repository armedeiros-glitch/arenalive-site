import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { onRequestGet, onRequestPost, onRequestDelete } from '../functions/api/hub/chamados-acompanhados.js';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('planet-hub/assets/ticket-command-v1.js');
const backend = read('functions/api/hub/chamados-acompanhados.js');
const context = read('planet-hub/assets/radar-context-v1.js');
const ignored = read('functions/api/hub/chamados-ignorados.js');
const details = read('planet-hub/assets/ticket-details-v1.js');
const index = read('index.html');

assert.match(source, /const FOLLOWING_API = '\/api\/hub\/chamados-acompanhados'/);
assert.match(source, /const followedActiveTickets = activeTickets\.filter\(isFollowed\)/);
assert.match(source, /Todos os chamados ativos do SULTS/);
assert.match(source, /Adicionar aos meus chamados/);
assert.match(source, /Remover dos meus chamados/);
assert.match(source, /data-ticket-context/);
assert.match(source, /const CONTEXT_API = '\/api\/hub\/radar-contextos'/);
assert.doesNotMatch(source, /localStorage|sessionStorage/);
assert.match(backend, /planet-hub:chamado-acompanhado:v1:/);
assert.doesNotMatch(backend, /title:|unit:|situation:|responsible:/,
  'storage de acompanhamento não deve copiar payload do SULTS');
assert.doesNotMatch(backend, /api\/sults|fetch\(/,
  'backend de acompanhamento não escreve nem consulta SULTS');
assert.match(context, /radar-contextos/);
assert.match(ignored, /chamados-ignorados/);
assert.match(details, /event\.target\.closest\('button, a, input, select, textarea, label'\)/,
  'ações dentro do card não devem abrir o drawer');
assert.match(index, /ticket-command-v1\.js\?v=20260807-2&rev=20260819-1/);

const sandbox = {
  console,
  Intl,
  Date,
  Set,
  Map,
  window: {
    addEventListener: () => {},
    alert: () => {},
  },
  document: {
    addEventListener: () => {},
    querySelector: () => null,
    documentElement: {},
  },
  MutationObserver: class { observe() {} },
  fetch: async () => ({ ok: true, json: async () => ({ data: [] }) }),
};
sandbox.globalThis = sandbox;
vm.runInNewContext(source, sandbox, { filename: 'ticket-command-v1.js' });
const api = sandbox.window.TicketCommandFollowing;
assert.ok(api, 'owner deve expor helpers de leitura para teste');

const tickets = [
  { sultsTicketId: '1', situation: 1 },
  { sultsTicketId: '2', situation: 4 },
  { sultsTicketId: '3', situation: 5 },
  { sultsTicketId: '4', situation: 6 },
  { sultsTicketId: '5', situation: 2 },
  { sultsTicketId: '6', situation: 3 },
  { sultsTicketId: '7', situation: 4 },
];

assert.deepEqual(
  Array.from(api.activeFollowedTickets(tickets, ['1', '2', '3', '4', '5', '6']), (ticket) => ticket.sultsTicketId),
  ['1', '2', '3', '4'],
  'fila principal deve ser interseção entre acompanhados e status ativos',
);
assert.deepEqual(
  Array.from(api.activeFollowedTickets(tickets, ['2']), (ticket) => ticket.sultsTicketId),
  ['2'],
  'chamado ativo acompanhado aparece',
);
assert.deepEqual(
  Array.from(api.activeFollowedTickets(tickets, []), (ticket) => ticket.sultsTicketId),
  [],
  'chamado ativo não acompanhado não aparece',
);
assert.equal(api.isActiveTicket({ situation: 2 }), false);
assert.equal(api.isActiveTicket({ situation: 3 }), false);
for (const situation of [1, 4, 5, 6]) assert.equal(api.isActiveTicket({ situation }), true);

class FakeKV {
  constructor() { this.data = new Map(); }
  async put(key, value) { this.data.set(key, JSON.parse(value)); }
  async get(key) { return this.data.get(key) || null; }
  async list({ prefix }) {
    return {
      keys: [...this.data.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })),
      list_complete: true,
    };
  }
}

const store = new FakeKV();
const env = { PLANET_HUB_DATA: store };
const post = await onRequestPost({
  env,
  request: new Request('https://local/api/hub/chamados-acompanhados', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: '123' }),
  }),
});
assert.equal(post.status, 200);
let get = await onRequestGet({ env });
let payload = await get.json();
assert.deepEqual(payload.data.map((item) => item.id), ['123'], 'reload via GET preserva acompanhamento');
const stored = [...store.data.values()][0];
assert.deepEqual(Object.keys(stored).sort(), ['followedAt', 'id', 'state', 'updatedAt'].sort(),
  'registro KV deve conter somente metadados mínimos');

const del = await onRequestDelete({
  env,
  request: new Request('https://local/api/hub/chamados-acompanhados', {
    method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: '123' }),
  }),
});
assert.equal(del.status, 200);
get = await onRequestGet({ env });
payload = await get.json();
assert.deepEqual(payload.data, [], 'remover acompanhamento tira ID da seleção sem tocar no SULTS');

console.log('Chamados: seleção per-item, descoberta, status ativos e persistência mínima validados.');
