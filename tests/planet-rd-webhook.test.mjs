import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = fs.readFileSync('functions/api/integrations/planet/rd/events.js', 'utf8');

assert.match(file, /RD_WEBHOOK_SECRET/);
assert.match(file, /Authorization|authorization/);
assert.match(file, /x-rd-webhook-secret/);
assert.match(file, /searchParams\.get\('secret'\)/);
assert.match(file, /source: 'rd_station'/);
assert.match(file, /PLANET_HUB_DATA/);
assert.match(file, /Lead sem telefone e e-mail/);
assert.match(file, /relevantChanges/);
assert.match(file, /NOTIFICATIONS_KEY/);
assert.match(file, /lead\.new/);
assert.match(file, /lead\.updated/);
assert.match(file, /MOVEMENT_GROUP_WINDOW_MS/);
assert.match(file, /Movimentação recebida do RD Station/);
assert.match(file, /destination: 'andre-os'/);
assert.doesNotMatch(file, /TELEGRAM_BOT_TOKEN/);
assert.doesNotMatch(file, /TELEGRAM_CHAT_ID/);
assert.doesNotMatch(file, /api\.telegram\.org/);
assert.doesNotMatch(file, /console\.log\(JSON\.stringify\(payload\)\)/);

console.log('planet-rd-webhook: ok');
