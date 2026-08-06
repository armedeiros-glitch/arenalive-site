import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { normalizeCandidate } from '../functions/_lib/planet-lead-candidates.js';
import { SCORE_CONFIG, scoreCandidate } from '../functions/_lib/planet-lead-scoring.js';

const candidate = normalizeCandidate({
  source: 'authorized_list', sourceRecordId: 'abc-1', sourceName: 'Lista autorizada',
  name: 'Maria', company: 'Café Central', phone: '(47) 99999-0000', email: 'MARIA@EXEMPLO.COM',
  city: 'Joinville', state: 'sc', franchiseModel: 'Loja',
  unknownField: 'não deve sobreviver',
  evidences: [{ type: 'fact', description: 'Operação em shopping', confidence: 90 }],
});
assert.equal(candidate.tenantId, 'planet');
assert.equal(candidate.normalizedPhone, '47999990000');
assert.equal(candidate.normalizedEmail, 'maria@exemplo.com');
assert.equal(candidate.state, 'SC');
assert.equal(candidate.reviewStatus, 'pending');
assert.equal(candidate.enrichmentStatus, 'pending');
assert.equal(candidate.scoreVersion, 'planet-fit-v1');
assert.equal('unknownField' in candidate, false);
assert.ok(candidate.finalScore >= 0 && candidate.finalScore <= 100);
assert.equal(Object.values(SCORE_CONFIG.weights).reduce((sum, value) => sum + value, 0), 1);
assert.deepEqual(scoreCandidate(candidate).finalScore, candidate.finalScore);

const js = await readFile(new URL('../planet-hub/assets/planet-lead-hunter-v1.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../planet-hub/assets/planet-lead-hunter-v1.css', import.meta.url), 'utf8');
const expansion = await readFile(new URL('../planet-hub/assets/planet-expansion-v1.js', import.meta.url), 'utf8');
const candidateLib = await readFile(new URL('../functions/_lib/planet-lead-candidates.js', import.meta.url), 'utf8');
const notificationsLib = await readFile(new URL('../functions/_lib/planet-notifications.js', import.meta.url), 'utf8');
const rdWebhook = await readFile(new URL('../functions/_lib/planet-rd-webhook.js', import.meta.url), 'utf8');
const notificationsApi = await readFile(new URL('../functions/api/hub/planet/notifications.js', import.meta.url), 'utf8');
const access = await readFile(new URL('../planet-hub/assets/hub-access-v1.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
assert.doesNotMatch(js, /planet-expansion-section|sessionStorage\.setItem\(SECTION_KEY/);
assert.match(expansion, /planet-expansion-section/);
assert.match(expansion, /data-lead-hunter-root/);
assert.match(expansion, /planet:expansion-section-rendered/);
assert.match(js, /data-hunter-import-confirm/);
assert.match(js, /Fato confirmado/);
assert.doesNotMatch(js, /MutationObserver|setInterval|mountTimers|data-hunter-hidden/);
assert.match(js, /planet:expansion-section-rendered/);
assert.doesNotMatch(js, /pmh-expansion-shell|insertAdjacentElement/);
assert.doesNotMatch(css, /!important/);
assert.match(css, /@media \(max-width: 760px\)/);
assert.match(css, /var\(--aos-/);
assert.match(access, /planet-lead-hunter-v1\.js\?v=20260806-2/);
assert.match(html, /planet-lead-hunter-v1\.css\?v=20260806-2/);
assert.doesNotMatch(candidateLib, /planet-hub:planet-notifications|const normalizeNotification/);
assert.match(candidateLib, /appendNotification/);
assert.equal([notificationsLib, candidateLib, rdWebhook, notificationsApi].filter((source) => source.includes('planet-hub:planet-notifications:v1')).length, 1);
assert.match(rdWebhook, /readNotificationDocument/);
assert.match(notificationsApi, /summarizeNotifications/);
console.log('Contrato do Caça Lead validado.');
