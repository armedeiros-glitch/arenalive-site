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

assert.match(source, /const activeTickets = state\.tickets\.filter\(isActiveTicket\);/);
assert.match(source, /const myActiveTickets = activeTickets\.filter\(isMine\);/);
assert.match(source, /const base = myActiveTickets\.filter\(matchesBaseFilters\);/);
assert.match(source, /const optionSource = state\.discovery \? activeTickets : myActiveTickets/);
assert.match(source, /!ACTIVE_SITUATIONS\.has\(Number\(state\.status\)\)/);
assert.match(source, /responsável ou apoio/);
assert.doesNotMatch(source, /FOLLOWING_API|chamados-acompanhados|data-command-follow/);
assert.doesNotMatch(source, /localStorage|sessionStorage/);
assert.match(ignored, /ignored|ignorado/i);
assert.match(readings, /ticket-readings|readings|leitura/i);

console.log('Chamados: status terminais fora da fila e vínculo SULTS preservado.');
