import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const api = read('functions/api/hub/planet/notifications.js');
const core = read('functions/_lib/planet-notifications.js');
const ui = read('planet-hub/assets/planet-notifications-v1.js');
const expansion = read('planet-hub/assets/planet-expansion-v1.js');
const access = read('planet-hub/assets/hub-access-v1.js');
const rootEntry = read('index.html');

assert.match(core, /planet-hub:planet-notifications:v1/);
assert.match(core, /lead\.new/);
assert.match(core, /lead\.updated/);
assert.match(core, /lead\.alert/);
assert.match(core, /readNotificationDocument/);
assert.match(core, /writeNotificationDocument/);
assert.match(api, /read_all/);
assert.match(api, /resolvedAt/);
assert.match(api, /summarizeNotifications/);
assert.doesNotMatch(api, /planet-hub:planet-notifications:v1|const normalizeNotification/);

assert.match(ui, /data-notification-trigger/);
assert.match(ui, /data-notification-badge/);
assert.match(ui, /Novos leads/);
assert.match(ui, /Movimentações/);
assert.match(ui, /atualizações agrupadas/);
assert.match(ui, /data-notification-open/);
assert.match(ui, /planet-expansion-open-lead/);
assert.match(ui, /notifications\.updated/);
assert.doesNotMatch(ui, /TELEGRAM|api\.telegram\.org/);

assert.match(expansion, /planet:open-lead/);
assert.match(expansion, /data-lead-id/);
assert.match(expansion, /viewedAt/);
assert.match(expansion, /selected/);
assert.match(access, /planet-expansion-v1\.js\?v=20260806-1/);
assert.match(access, /planet-notifications-v1\.js\?v=20260805-1/);
assert.match(rootEntry, /hub-access-v1\.js\?v=20260806-1/);

console.log('Planet notification center compartilhado: tests passed');
