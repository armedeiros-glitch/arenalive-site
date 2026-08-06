import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [
  expansion,
  feedbackCss,
  feedbackJs,
  index,
  access,
  webhook,
  leadsApi,
  leadDomain,
] = await Promise.all([
  read('planet-hub/assets/planet-expansion-v1.js'),
  read('planet-hub/assets/andre-os-feedback-v1.css'),
  read('planet-hub/assets/andre-os-feedback-v1.js'),
  read('index.html'),
  read('planet-hub/assets/hub-access-v1.js'),
  read('functions/_lib/planet-rd-webhook.js'),
  read('functions/api/hub/planet/leads.js'),
  read('functions/_lib/planet-leads.js'),
]);

assert.ok(!expansion.includes('cloneNode('), 'Expansão não pode voltar a clonar item de navegação.');
assert.ok(!expansion.includes('new MutationObserver'), 'Expansão não pode reintroduzir observer global.');
assert.ok(expansion.includes('data-expansion-badge'), 'Navegação precisa exibir badge de leads.');
assert.ok(expansion.includes('data-lead-whatsapp'), 'Lead precisa oferecer ação de WhatsApp.');
assert.ok(expansion.includes('data-lead-status'), 'Lead precisa permitir avanço de status.');
assert.ok(expansion.includes("events.on('notifications.updated'"), 'Expansão deve reutilizar o relógio das notificações.');
assert.ok(expansion.includes('payload.updatedAt'), 'Tela deve informar o estado real da sincronização.');

assert.match(feedbackCss, /position:\s*fixed/);
assert.doesNotMatch(feedbackCss, /!important/);
assert.match(feedbackCss, /animation:\s*aos-feedback-toast-lifecycle 5s/);
assert.ok(feedbackJs.includes('const DISPLAY_MS = 5000'));
assert.ok(feedbackJs.includes("window.addEventListener('pmh:view-rendered'"));

const feedbackScriptIndex = index.indexOf('andre-os-feedback-v1.js');
const accessScriptIndex = index.indexOf('hub-access-v1.js');
assert.ok(feedbackScriptIndex >= 0 && feedbackScriptIndex < accessScriptIndex, 'Feedback deve iniciar antes do Hub.');
assert.ok(access.includes('planet-expansion-v1.js?v=20260805-3'));

assert.match(leadDomain, /PLANET_LEADS_KEY = 'planet-hub:planet-expansion-leads:v1'/);
assert.match(leadDomain, /'caca_lead'/);
assert.match(leadsApi, /from '\.\.\/\.\.\/\.\.\/_lib\/planet-leads\.js'/);
assert.match(webhook, /from '\.\/planet-leads\.js'/);
assert.ok(webhook.includes('root.contact'), 'Webhook precisa aceitar o payload oficial de contato do RD Station.');
assert.doesNotMatch(leadsApi, /const STORAGE_KEY =/);
assert.doesNotMatch(webhook, /const LEADS_KEY =/);

console.log('Fluxo integrado de Expansão e domínio compartilhado de leads validado.');
