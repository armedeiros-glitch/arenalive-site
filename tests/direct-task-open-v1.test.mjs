import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('planet-hub/assets/direct-task-open-v1.js');
const rootEntry = read('index.html');
const hubEntry = read('planet-hub/index.html');

assert.match(source, /const HANDOFF_KEY = 'pmh:attention-handoff:v1'/);
assert.match(source, /const HANDLED_KEY = 'pmh:direct-task-opened:v1'/);
assert.match(source, /const waitForSelector = .*MutationObserver/s);
assert.match(source, /observer\.disconnect\(\)/);
assert.match(source, /clearTimeout\(timeout\)/);
assert.match(source, /const sourceIdOf =/);
assert.match(source, /const OPENERS = \{\s*chamados: openTicket,\s*demand: openDemand,\s*conteudos: openContent,\s*calendario: openCampaign,\s*inauguracoes: openInauguration,/s);

assert.match(source, /proxy\.className = 'pmh-ticket'/);
assert.match(source, /proxy\.dataset\.ticketId = id/);
assert.match(source, /new MouseEvent\('click'/);
assert.match(source, /data-demand-edit/);
assert.match(source, /data-content-edit/);
assert.match(source, /data-edit-campaign/);
assert.match(source, /data-inauguration-workspace/);
assert.match(source, /data-active-filter="all"/);
assert.match(source, /data-content-clear/);
assert.doesNotMatch(source, /highlightByTitle|targetTitle|textContent\)\.includes\(targetTitle\)/);

for (const entry of [rootEntry, hubEntry]) {
  const cockpitIndex = entry.indexOf('/planet-hub/assets/decision-cockpit-v1.js');
  const directIndex = entry.indexOf('/planet-hub/assets/direct-task-open-v1.js?v=20260805-1');
  assert.ok(cockpitIndex >= 0, 'o cockpit precisa estar carregado');
  assert.ok(directIndex > cockpitIndex, 'o controlador direto deve carregar depois do handoff do cockpit');
}

console.log('AndreOS direct task open: tests passed');
