import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [context, details, detailsCss, compact, readings, ignored] = await Promise.all([
  read('planet-hub/assets/radar-context-v1.js'),
  read('planet-hub/assets/ticket-details-v1.js'),
  read('planet-hub/assets/ticket-details-v1.css'),
  read('planet-hub/assets/ticket-context-compact-v1.js'),
  read('planet-hub/assets/ticket-readings-v1.js'),
  read('planet-hub/assets/ignored-tickets-v1.js'),
]);

assert.match(context, /document\.body\.appendChild\(modal\)/);
assert.match(context, /returnFocus\s*=\s*document\.activeElement/);
assert.match(context, /\[name="state"\][^\n]+focus/);
assert.match(context, /getComputedStyle\(drawer\)\.zIndex/);
assert.match(context, /drawerZ \+ 2/);
assert.match(context, /stopImmediatePropagation/);
assert.match(context, /focusTarget\?\.isConnected/);
assert.match(context, /focusTarget\.focus\(\)/);
assert.match(context, /new FormData\(form\)/);
assert.match(context, /method:\s*'PUT'/);
assert.match(context, /data-radar-context-close/);
assert.match(context, /event\.target\.matches\('\[data-radar-context-modal\]'\)/);

assert.equal(Number(detailsCss.match(/\.pmh-ticket-drawer\{[^}]*z-index:(\d+)/)?.[1]), 999999);
assert.match(details, /data-radar-context-modal[\s\S]*return;[\s\S]*closeDrawer/);
assert.match(details, /Abrir no SULTS/);
assert.match(compact, /\+ Adicionar contexto/);
assert.match(readings, /reading/i);
assert.match(ignored, /ignore|ignorado/i);
assert.doesNotMatch(context + details, /localStorage\.setItem|sessionStorage\.setItem/);

console.log('Chamados: overlay, foco e Escape do contexto validados.');
