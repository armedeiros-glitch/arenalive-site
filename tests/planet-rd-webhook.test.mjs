import assert from 'node:assert/strict';
import fs from 'node:fs';

const file = fs.readFileSync('functions/api/integrations/planet/rd/events.js', 'utf8');

assert.match(file, /RD_WEBHOOK_SECRET/);
assert.match(file, /Authorization|authorization/);
assert.match(file, /x-rd-webhook-secret/);
assert.match(file, /source: 'rd_station'/);
assert.match(file, /PLANET_HUB_DATA/);
assert.match(file, /Lead sem telefone e e-mail/);
assert.match(file, /duplicate/);
assert.doesNotMatch(file, /TELEGRAM_BOT_TOKEN/);
assert.doesNotMatch(file, /console\.log\(JSON\.stringify\(payload\)\)/);

console.log('planet-rd-webhook: ok');
