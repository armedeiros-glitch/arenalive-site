import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('planet-hub/assets/ticket-command-v1.js');
const details = read('planet-hub/assets/ticket-details-v1.js');

assert.match(source, /const MINE_API = '\/api\/sults\/chamados\?scope=mine&includeIgnored=1'/);
assert.match(source, /const ALL_API = '\/api\/sults\/chamados\?scope=all&includeIgnored=1'/);
assert.match(source, /Todos os chamados ativos do SULTS/);
assert.doesNotMatch(source, /activeTickets\.filter\(isMine\)/);
assert.doesNotMatch(source, /FOLLOWING_API|chamados-acompanhados|data-command-follow|Adicionar aos meus chamados|Remover dos meus chamados/);
assert.doesNotMatch(source, /localStorage|sessionStorage/);
assert.match(details, /event\.target\.closest\('button, a, input, select, textarea, label'\)/,
  'ações dentro do card não devem abrir o drawer');

const sandbox = {
  console,
  window: { addEventListener() {} },
  document: {
    documentElement: {},
    querySelector() { return null; },
    addEventListener() {},
  },
  MutationObserver: class { observe() {} },
  fetch: async () => ({ ok: true, json: async () => ({ data: [] }) }),
  Intl,
  Date,
  Set,
  Map,
};
sandbox.globalThis = sandbox;
vm.runInNewContext(source, sandbox, { filename: 'ticket-command-v1.js' });
const api = sandbox.window.TicketCommandFollowing;
assert.ok(api, 'owner deve expor helpers de leitura para teste');

const ticketsFromMineApi = [
  { sultsTicketId: '1', situation: 1, responsible: 'André Roberto Medeiros' },
  { sultsTicketId: '2', situation: 4, responsible: 'Outra Pessoa', support: [{ pessoa: { nome: 'André Roberto Medeiros' } }] },
  { sultsTicketId: '3', situation: 5, responsible: 'Outra Pessoa' },
  { sultsTicketId: '4', situation: 6, responsible: 'Outra Pessoa' },
  { sultsTicketId: '5', situation: 2, responsible: 'André Roberto Medeiros' },
  { sultsTicketId: '6', situation: 3, responsible: 'André Roberto Medeiros' },
];

assert.deepEqual(
  Array.from(api.activeMineTickets(ticketsFromMineApi), (ticket) => ticket.sultsTicketId),
  ['1', '2', '3', '4'],
  'frontend só deve remover status terminais; pertencimento já foi resolvido pelo backend',
);
assert.equal(api.isActiveTicket({ situation: 2 }), false);
assert.equal(api.isActiveTicket({ situation: 3 }), false);
for (const situation of [1, 4, 5, 6]) assert.equal(api.isActiveTicket({ situation }), true);

console.log('Chamados: scope=mine no backend, descoberta separada e status ativos validados.');
