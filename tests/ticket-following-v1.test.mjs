import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('planet-hub/assets/ticket-command-v2.js');
const endpoint = read('functions/api/hub/chamados-acompanhados.js');
const details = read('planet-hub/assets/ticket-details-v1.js');
const index = read('index.html');

assert.match(source, /const FOLLOWING_API = '\/api\/hub\/chamados-acompanhados'/);
assert.match(source, /data-command-follow/);
assert.match(source, /Adicionar aos meus chamados/);
assert.match(source, /Remover dos meus chamados/);
assert.match(source, /activeFollowedTickets/);
assert.doesNotMatch(source, /localStorage|sessionStorage/);
assert.doesNotMatch(source, /filter\(isMine\)/);
assert.match(endpoint, /planet-hub:chamado-acompanhado:v1:/);
assert.match(endpoint, /state === 'followed'/);
assert.match(endpoint, /state,\n    updatedAt/);
assert.match(details, /event\.target\.closest\('button, a, input, select, textarea, label'\)/,
  'ações dentro do card não devem abrir o drawer');
assert.match(index, /ticket-command-v2\.js\?v=20260820-1/);
assert.doesNotMatch(index, /ticket-command-v1\.js\?v=/);

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
vm.runInNewContext(source, sandbox, { filename: 'ticket-command-v2.js' });
const api = sandbox.window.TicketCommandFollowing;
assert.ok(api, 'owner deve expor helpers de leitura para teste');

const tickets = [
  { sultsTicketId: '1', situation: 1, responsible: 'André Roberto Medeiros' },
  { sultsTicketId: '2', situation: 4, responsible: 'Outra Pessoa' },
  { sultsTicketId: '3', situation: 5, responsible: 'Outra Pessoa' },
  { sultsTicketId: '4', situation: 6, responsible: 'Outra Pessoa' },
  { sultsTicketId: '5', situation: 2, responsible: 'André Roberto Medeiros' },
  { sultsTicketId: '6', situation: 3, responsible: 'André Roberto Medeiros' },
  { sultsTicketId: '7', situation: 4, responsible: 'André Roberto Medeiros' },
];

assert.deepEqual(
  Array.from(api.activeFollowedTickets(tickets, new Set(['2', '3', '5', '7'])), (ticket) => ticket.sultsTicketId),
  ['2', '3', '7'],
  'fila principal deve conter somente IDs acompanhados com status ativo',
);
assert.equal(api.isActiveTicket({ situation: 2 }), false);
assert.equal(api.isActiveTicket({ situation: 3 }), false);
for (const situation of [1, 4, 5, 6]) assert.equal(api.isActiveTicket({ situation }), true);
assert.deepEqual(
  Array.from(api.activeFollowedTickets(tickets, new Set()), (ticket) => ticket.sultsTicketId),
  [],
  'sem seleção explícita, a fila principal deve ficar vazia',
);

console.log('Chamados: acompanhamento explícito, descoberta e status ativos validados.');
