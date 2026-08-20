import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const details = await readFile(new URL('../planet-hub/assets/ticket-details-v1.js', import.meta.url), 'utf8');
const command = await readFile(new URL('../planet-hub/assets/ticket-command-v1.js', import.meta.url), 'utf8');
const ignored = await readFile(new URL('../planet-hub/assets/ignored-tickets-v1.js', import.meta.url), 'utf8');

assert.equal(details.includes('activeFilter'), false);
assert.equal(details.includes('injectFilters'), false);
assert.equal(details.includes('applyFilter'), false);
assert.equal(details.includes('data-ticket-filters'), false);
assert.equal(details.includes('data-ticket-filter'), false);
assert.equal(details.includes('card.hidden'), false);
assert.equal(details.includes('lane.hidden'), false);

assert.ok(command.includes('data-command-filter="unit"'));
assert.ok(command.includes('data-command-filter="responsible"'));
assert.ok(command.includes('data-command-filter="subject"'));
assert.ok(command.includes('data-command-filter="status"'));
assert.ok(command.includes('data-command-discovery'));
assert.ok(command.includes('data-command-urgency'));
assert.ok(command.includes("/api/sults/chamados?start=0&limit=100"));
assert.equal(command.includes('activeTickets.filter(isMine)'), false, 'frontend não deve refiltrar a fila pessoal');

assert.ok(details.includes("const card = event.target.closest('.pmh-ticket[data-ticket-id]')"));
assert.ok(details.includes("if (card) openDrawer(card.dataset.ticketId)"));
assert.ok(details.includes("event.key === 'Enter' || event.key === ' '"));
assert.ok(details.includes('fetch(`${DETAIL_API}/${encodeURIComponent(id)}`'));
assert.ok(details.includes("event.target.closest('[data-ticket-close]')"));
assert.ok(details.includes('(drawer && event.target === drawer)'));
assert.ok(details.includes("event.key === 'Escape' && drawer"));
assert.ok(details.includes("card.dataset.ticketId = id"));
assert.ok(details.includes("card.tabIndex = 0"));
assert.ok(details.includes("card.setAttribute('role', 'button')"));
assert.ok(details.includes("new MutationObserver(decorateCards)"));

assert.ok(ignored.includes("document.querySelectorAll('.pmh-ticket-drawer-panel')"));
assert.ok(ignored.includes("actions.querySelector('[data-ignore-ticket]')"));
assert.ok(ignored.includes("button.textContent = 'Excluir do Hub'"));

console.log('Chamados: filtros pertencem ao ticket-command e a lista usa a mesma fonte da Visão Geral.');
