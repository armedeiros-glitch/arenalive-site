import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [expansion, hunter, index, access, webhook, leadsApi, leadCore, notificationCore] = await Promise.all([
  read('planet-hub/assets/planet-expansion-v1.js'),
  read('planet-hub/assets/planet-lead-hunter-v1.js'),
  read('index.html'),
  read('planet-hub/assets/hub-access-v1.js'),
  read('functions/_lib/planet-rd-webhook.js'),
  read('functions/api/hub/planet/leads.js'),
  read('functions/_lib/planet-leads.js'),
  read('functions/_lib/planet-notifications.js'),
]);

assert.ok(!expansion.includes('cloneNode('));
assert.ok(!expansion.includes('new MutationObserver'));
assert.ok(expansion.includes('data-expansion-badge'));
assert.ok(expansion.includes('data-lead-whatsapp'));
assert.ok(expansion.includes('data-lead-status'));
assert.ok(expansion.includes("events.on('notifications.updated'"));
assert.ok(expansion.includes('payload.updatedAt'));
assert.ok(expansion.includes('data-lead-hunter-root'));
assert.ok(expansion.includes('planet:expansion-section-rendered'));
assert.doesNotMatch(hunter, /setInterval|MutationObserver|insertAdjacentElement|data-hunter-hidden/);

const accessScriptIndex = index.indexOf('hub-access-v1.js');
assert.ok(accessScriptIndex >= 0);
assert.ok(access.includes('planet-expansion-v1.js?v=20260806-1'));
assert.ok(access.includes('planet-lead-hunter-v1.js?v=20260806-2'));
assert.ok(leadsApi.includes('upsertLead'));
assert.ok(webhook.includes('upsertLead'));
assert.ok(webhook.includes('readNotificationDocument'));
assert.equal([leadCore, leadsApi, webhook].filter((source) => source.includes('planet-hub:planet-expansion-leads:v1')).length, 1);
assert.equal([notificationCore, webhook].filter((source) => source.includes('planet-hub:planet-notifications:v1')).length, 1);
assert.ok(webhook.includes('root.contact'));

console.log('Fluxo integrado e sem camadas paralelas validado.');
