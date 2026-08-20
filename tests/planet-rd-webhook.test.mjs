import assert from 'node:assert/strict';
import fs from 'node:fs';

const route = fs.readFileSync('functions/api/integrations/planet/rd/webhook/[secret].js', 'utf8');
const webhook = fs.readFileSync('functions/_lib/planet-rd-webhook.js', 'utf8');
const leads = fs.readFileSync('functions/_lib/planet-leads.js', 'utf8');
const notifications = fs.readFileSync('functions/_lib/planet-notifications.js', 'utf8');

assert.match(route, /planet-rd-webhook\.js/);
assert.match(route, /X-RD-Webhook-Secret/);
assert.match(route, /params\?\.secret/);
assert.match(webhook, /RD_WEBHOOK_SECRET/);
assert.match(webhook, /Authorization|authorization/);
assert.match(webhook, /x-rd-webhook-secret/);
assert.match(webhook, /searchParams\.get\('secret'\)/);
assert.match(webhook, /source: 'rd_station'/);
assert.match(webhook, /PLANET_HUB_DATA/);
assert.match(webhook, /Lead sem telefone e e-mail/);
assert.match(webhook, /upsertLead/);
assert.match(webhook, /readNotificationDocument/);
assert.match(webhook, /writeNotificationDocument/);
assert.match(webhook, /MOVEMENT_GROUP_WINDOW_MS/);
assert.match(webhook, /Movimentação recebida do RD Station/);
assert.match(webhook, /destination: 'andre-os'/);
assert.doesNotMatch(webhook, /planet-hub:planet-expansion-leads:v1|planet-hub:planet-notifications:v1/);
assert.match(leads, /planet-hub:planet-expansion-leads:v1/);
assert.match(notifications, /planet-hub:planet-notifications:v1/);
assert.doesNotMatch(webhook, /TELEGRAM_BOT_TOKEN|TELEGRAM_CHAT_ID|api\.telegram\.org/);
assert.doesNotMatch(webhook, /console\.log\(JSON\.stringify\(payload\)\)/);

console.log('planet-rd-webhook compartilhado: ok');
