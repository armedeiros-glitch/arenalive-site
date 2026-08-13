import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../planet-hub/assets/ticket-command-v1.js', import.meta.url), 'utf8');
const ignored = await readFile(new URL('../planet-hub/assets/ignored-tickets-v1.js', import.meta.url), 'utf8');
const readings = await readFile(new URL('../planet-hub/assets/ticket-readings-v1.js', import.meta.url), 'utf8');

const activeSetMatch = source.match(/const ACTIVE_SITUATIONS = new Set\(\[([^\]]+)\]\);/);
assert.ok(activeSetMatch);
const activeSituations = new Set(activeSetMatch[1].split(',').map((value) => Number(value.trim())));
const isActiveTicket = (ticket) => activeSituations.has(Number(ticket?.situation));

for (const situation of [1, 4, 5, 6]) assert.equal(isActiveTicket({ situation }), true);
for (const situation of [2, 3]) assert.equal(isActiveTicket({ situation }), false);

const tickets = [
  { id: 'novo', situation: 1, due: 'late' },
  { id: 'andamento', situation: 4, due: 'today' },
  { id: 'aguarda-solicitante', situation: 5, due: 'week' },
  { id: 'aguarda-responsavel', situation: 6, due: 'week' },
  { id: 'concluido', situation: 2, due: 'late', context: { state: 'blocked' } },
  { id: 'resolvido', situation: 3, due: 'today' },
];
const active = tickets.filter(isActiveTicket);
assert.deepEqual(active.map((ticket) => ticket.id), ['novo', 'andamento', 'aguarda-solicitante', 'aguarda-responsavel']);
assert.equal(active.filter((ticket) => ticket.due === 'late').length, 1);
assert.equal(active.filter((ticket) => ticket.due === 'today' || ticket.due === 'week').length, 3);
assert.equal(active.some((ticket) => ticket.id === 'concluido'), false);

let reading = [{ id: 'x', situation: 4 }];
assert.equal(reading.filter(isActiveTicket).length, 1);
reading = [{ id: 'x', situation: 2 }];
assert.equal(reading.filter(isActiveTicket).length, 0);
reading = [{ id: 'y', situation: 5 }];
assert.equal(reading.filter(isActiveTicket).length, 1);
reading = [{ id: 'y', situation: 3 }];
assert.equal(reading.filter(isActiveTicket).length, 0);
reading = [{ id: 'x', situation: 4 }];
assert.equal(reading.filter(isActiveTicket).length, 1);

assert.match(source, /const activeTickets = state\.tickets\.filter\(isActiveTicket\);/);
assert.match(source, /const base = activeTickets\.filter\(matchesBaseFilters\);/);
assert.match(source, /uniqueSorted\(activeTickets\.map\(\(ticket\) => String\(ticket\.situation \|\| ''\)\)\)/);
assert.match(source, /!ACTIVE_SITUATIONS\.has\(Number\(state\.status\)\)/);
assert.doesNotMatch(source, /fetch\(API,[\s\S]{0,180}method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/);
assert.doesNotMatch(source, /localStorage|sessionStorage/);
assert.match(ignored, /ignored|ignorado/i);
assert.match(readings, /ticket-readings|readings|leitura/i);

console.log('Chamados: status terminais do SULTS ficam fora da fila ativa, KPIs e filtros.');
