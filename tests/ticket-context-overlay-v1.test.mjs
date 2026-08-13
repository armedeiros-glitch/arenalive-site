import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [context, details, detailsCss, compact, readings, ignored, index] = await Promise.all([
  read('planet-hub/assets/radar-context-v1.js'),
  read('planet-hub/assets/ticket-details-v1.js'),
  read('planet-hub/assets/ticket-details-v1.css'),
  read('planet-hub/assets/ticket-context-compact-v1.js'),
  read('planet-hub/assets/ticket-readings-v1.js'),
  read('planet-hub/assets/ignored-tickets-v1.js'),
  read('index.html'),
]);

assert.match(context, /document\.body\.appendChild\(modal\)/, 'Contexto deve usar portal no body.');
assert.match(context, /returnFocus\s*=\s*document\.activeElement/, 'Abertura deve memorizar o foco do drawer.');
assert.match(context, /modal\.querySelector\('\[name="state"\]'\)\?\.focus\(\)/, 'Modal deve receber foco inicial útil.');
assert.match(context, /const liftAboveTicketDrawer[\s\S]*getComputedStyle\(drawer\)\.zIndex[\s\S]*drawerZ \+ 2/s, 'Contexto deve subir acima do z-index real do drawer.');
assert.match(context, /event\.key !== 'Escape'[\s\S]*data-radar-context-modal[\s\S]*stopImmediatePropagation/s, 'Escape deve ser consumido pelo modal.');
assert.match(context, /focusTarget\?\.isConnected[\s\S]*focusTarget\.focus/s, 'Fechamento deve devolver foco ao drawer.');
assert.match(context, /data-radar-context-close/, 'Cancelar/fechar continua no fluxo atual.');
assert.match(context, /method:\s*'PUT'/, 'Salvar contexto continua usando PUT existente.');
assert.match(context, /new FormData\(form\)/, 'Campos continuam editáveis pelo formulário existente.');
assert.match(context, /event\.target\.matches\('\[data-radar-context-modal\]'\)/, 'Clique no backdrop continua fechando apenas o contexto.');

const drawerZ = Number(detailsCss.match(/\.pmh-ticket-drawer\{[^}]*z-index:(\d+)/)?.[1]);
assert.equal(drawerZ, 999999, 'Contrato atual do drawer deve permanecer conhecido pelo teste.');
assert.match(details, /data-radar-context-modal[\s\S]*return;[\s\S]*closeDrawer/s, 'Drawer deve ignorar Escape enquanto contexto estiver aberto.');
assert.match(details, /Abrir no SULTS/, 'Abrir no SULTS deve permanecer.');
assert.match(compact, /\+ Adicionar contexto/, 'Adicionar contexto deve permanecer no drawer.');
assert.match(readings, /ticket-readings|ticketReading|reading/i, 'Ticket readings permanece no runtime.');
assert.match(ignored, /chamados-ignorados|ignored|ignore/i, 'Chamados ignorados permanecem no runtime.');
assert.doesNotMatch(context + details, /localStorage\.setItem|sessionStorage\.setItem/, 'Overlay não cria persistência local.');
assert.match(index, /radar-context-v1\.js\?v=20260813-1/);
assert.match(index, /ticket-details-v1\.js\?v=20260813-1/);

console.log('Chamados: modal de contexto acima do drawer, foco e Escape validados sem alterar persistência.');
