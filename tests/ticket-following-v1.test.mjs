import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('planet-hub/assets/ticket-command-v1.js');
const context = read('planet-hub/assets/radar-context-v1.js');
const ignored = read('functions/api/hub/chamados-ignorados.js');
const details = read('planet-hub/assets/ticket-details-v1.js');
const index = read('index.html');

assert.doesNotMatch(source, /FOLLOWING_API|chamados-acompanhados|data-command-follow|Adicionar aos meus chamados|Remover dos meus chamados/);
assert.match(source, /const myActiveTickets = activeTickets\.filter\(isMine\)/);
assert.match(source, /Todos os chamados ativos do SULTS/);
assert.match(source, /responsável ou apoio/);
assert.match(source, /data-ticket-context/);
assert.match(source, /const CONTEXT_API = '\/api\/hub\/radar-contextos'/);
assert.doesNotMatch(source, /localStorage|sessionStorage/);
assert.match(context, /radar-contextos/);
assert.match(ignored, /chamados-ignorados/);
assert.match(details, /event\.target\.closest\('button, a, input, select, textarea, label'\)/,
  'ações dentro do card não devem abrir o drawer');
assert.match(index, /ticket-command-v1\.js\?v=20260807-2&rev=20260819-2/);
assert.doesNotMatch(index, /ticket-following-empty-discovery-v1/);

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
  { sultsTicketId: '1', situation: 1, responsible: 'André Roberto Medeiros' },
  { sultsTicketId: '2', situation: 4, responsible: 'Outra Pessoa', support: [{ pessoa: { nome: 'André Roberto Medeiros' } }] },
  { sultsTicketId: '3', situation: 5, responsible: 'Outra Pessoa', support: [{ person: { name: 'André Roberto Medeiros' } }] },
  { sultsTicketId: '4', situation: 6, responsible: 'Outra Pessoa' },
  { sultsTicketId: '5', situation: 2, responsible: 'André Roberto Medeiros' },
  { sultsTicketId: '6', situation: 3, responsible: 'André Roberto Medeiros' },
  { sultsTicketId: '7', situation: 4, responsible: 'Outra Pessoa' },
];

assert.deepEqual(
  Array.from(api.activeMineTickets(tickets), (ticket) => ticket.sultsTicketId),
  ['1', '2', '3'],
  'fila principal deve conter somente chamados ativos em que André é responsável ou apoio',
);
assert.equal(api.isMine(tickets[0]), true, 'responsável André entra na fila');
assert.equal(api.isMine(tickets[1]), true, 'André em apoio entra na fila');
assert.equal(api.isMine(tickets[3]), false, 'chamado sem vínculo com André não entra');
assert.equal(api.isActiveTicket({ situation: 2 }), false);
assert.equal(api.isActiveTicket({ situation: 3 }), false);
for (const situation of [1, 4, 5, 6]) assert.equal(api.isActiveTicket({ situation }), true);

console.log('Chamados: vínculo SULTS de André, descoberta e status ativos validados.');