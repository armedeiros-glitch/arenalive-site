import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [expansion, expansionStyles, index, access, webhook, leadsApi, leadCore, notificationCore] = await Promise.all([
  read('planet-hub/assets/planet-expansion-v1.js'),
  read('planet-hub/assets/planet-expansion-v1.css'),
  read('index.html'),
  read('planet-hub/assets/hub-access-v1.js'),
  read('functions/_lib/planet-rd-webhook.js'),
  read('functions/api/hub/planet/leads.js'),
  read('functions/_lib/planet-leads.js'),
  read('functions/_lib/planet-notifications.js'),
]);

assert.ok(!expansion.includes('cloneNode('));
assert.ok(!expansion.includes('new MutationObserver'));
assert.ok(!expansion.includes('insertAdjacentElement'));
assert.ok(!expansion.includes('injectStyles'));
assert.ok(!expansion.includes("createElement('style')"));
assert.ok(!expansion.includes('setTimeout(activate'));
assert.ok(expansion.includes('scheduleActivate'));
assert.ok(expansion.includes('data-expansion-badge'));
assert.ok(expansion.includes('data-lead-whatsapp'));
assert.ok(expansion.includes('data-lead-status'));
assert.ok(expansion.includes("events.on('notifications.updated'"));
assert.ok(expansion.includes('payload.updatedAt'));
assert.ok(expansion.includes('planet:open-lead'));
assert.ok(!expansion.includes('data-lead-hunter-root'));
assert.ok(!expansion.includes('planet:open-candidate'));
assert.match(expansionStyles, /\.pmh-expansion-shell/);
assert.doesNotMatch(expansionStyles, /!important/);

const baseStyleIndex = index.indexOf('planet-expansion-v1.css?v=20260806-1');
const operationsStyleIndex = index.indexOf('andre-os-operations-v1.css');
const accessScriptIndex = index.indexOf('hub-access-v1.js?v=20260812-1');
assert.ok(baseStyleIndex >= 0 && operationsStyleIndex > baseStyleIndex);
assert.ok(accessScriptIndex >= 0);
assert.ok(!index.includes('planet-lead-hunter'));
assert.ok(/planet-expansion-v1\.js\?v=20260811-1/.test(access));
assert.ok(/andre-os-navigation-drawers-v1\.js\?v=20260811-1/.test(access));
assert.ok(!access.includes('planet-lead-hunter'));
assert.ok(leadsApi.includes('upsertLead'));
assert.ok(webhook.includes('upsertLead'));
assert.ok(webhook.includes('readNotificationDocument'));
assert.equal([leadCore, leadsApi, webhook].filter((source) => source.includes('planet-hub:planet-expansion-leads:v1')).length, 1);
assert.equal([notificationCore, webhook].filter((source) => source.includes('planet-hub:planet-notifications:v1')).length, 1);
assert.ok(webhook.includes('root.contact'));

console.log('Fluxo RD -> lead da Expansão validado sem Caça Leads.');