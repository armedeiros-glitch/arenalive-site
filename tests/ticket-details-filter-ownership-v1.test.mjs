import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const details = await readFile(new URL('../planet-hub/assets/ticket-details-v1.js', import.meta.url), 'utf8');
const command = await readFile(new URL('../planet-hub/assets/ticket-command-v1.js', import.meta.url), 'utf8');
const ignored = await readFile(new URL('../planet-hub/assets/ignored-tickets-v1.js', import.meta.url), 'utf8');

assert.equal(details.includes('activeFilter'), false, 'ticket-details não deve manter estado de filtro legado');
assert.equal(details.includes('injectFilters'), false, 'ticket-details não deve injetar barra de filtros antiga');
assert.equal(details.includes('applyFilter'), false, 'ticket-details não deve reaplicar filtros antigos');
assert.equal(details.includes('data-ticket-filters'), false, 'ticket-details não deve criar [data-ticket-filters]');
assert.equal(details.includes('data-ticket-filter'), false, 'ticket-details não deve escutar filtros legados');
assert.equal(details.includes("filter === 'all'"), false);
assert.equal(details.includes("filter === 'late'"), false);
assert.equal(details.includes("filter === 'today'"), false);
assert.equal(details.includes("filter === 'waiting'"), false);
assert.equal(details.includes("filter === 'progress'"), false);
assert.equal(details.includes('card.hidden'), false, 'ticket-details não deve ocultar cards por filtro');
assert.equal(details.includes('lane.hidden'), false, 'ticket-details não deve ocultar lanes por filtro');

assert.ok(command.includes('data-command-filter="unit"'), 'ticket-command mantém filtro por unidade');
assert.ok(command.includes('data-command-filter="responsible"'), 'ticket-command mantém filtro por responsável');
assert.ok(command.includes('data-command-filter="subject"'), 'ticket-command mantém filtro por assunto');
assert.ok(command.includes('data-command-filter="status"'), 'ticket-command mantém filtro por status');
assert.ok(command.includes('data-command-mine'), 'ticket-command mantém filtro "Só os meus"');
assert.ok(command.includes('data-command-urgency'), 'ticket-command mantém filtros de urgência');

assert.ok(details.includes("const card = event.target.closest('.pmh-ticket[data-ticket-id]')"), 'clique no card continua abrindo detalhe');
assert.ok(details.includes("if (card) openDrawer(card.dataset.ticketId)"), 'card continua encaminhando ID para o drawer');
assert.ok(details.includes("event.key === 'Enter' || event.key === ' '"), 'teclado continua abrindo detalhe');
assert.ok(details.includes('openDrawer(card.dataset.ticketId)'), 'teclado continua chamando openDrawer');
assert.ok(details.includes('fetch(`${DETAIL_API}/${encodeURIComponent(id)}`'), 'detalhe continua chamando /api/sults/chamados/<id>');
assert.ok(details.includes("event.target.closest('[data-ticket-close]')"), 'botão X continua fechando drawer');
assert.ok(details.includes('(drawer && event.target === drawer)'), 'backdrop continua fechando drawer');
assert.ok(details.includes("event.key === 'Escape' && drawer"), 'Escape continua fechando drawer');
assert.ok(details.includes("card.dataset.ticketId = id"), 'cards novos continuam recebendo data-ticket-id');
assert.ok(details.includes("card.tabIndex = 0"), 'cards continuam navegáveis por teclado');
assert.ok(details.includes("card.setAttribute('role', 'button')"), 'semântica acessível continua aplicada');
assert.ok(details.includes("new MutationObserver(decorateCards)"), 'observer continua limitado à decoração de cards novos');

assert.ok(ignored.includes("document.querySelectorAll('.pmh-ticket-drawer-panel')"), 'ignored-tickets continua decorando o drawer');
assert.ok(ignored.includes("actions.querySelector('[data-ignore-ticket]')"), 'ignored-tickets evita botão duplicado no drawer');
assert.ok(ignored.includes("button.textContent = 'Excluir do Hub'"), 'botão de excluir continua sendo adicionado ao drawer');

console.log('Chamados: ticket-command é owner único dos filtros; ticket-details preserva drawer, teclado, API e integração do ignore.');
