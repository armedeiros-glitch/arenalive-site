import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const html = read('index.html');
const hub = read('planet-hub/assets/hub-access-v1.js');
const ownerRules = read('planet-hub/assets/inauguration-owner-rules-v1.js');
const radar = read('planet-hub/assets/radar-data-v1.js');
const eject = read('planet-hub/assets/andre-os-eject-v1.js');

const published = new Map([
  ['hub-access-v1.js', '20260828-4'],
  ['radar-data-v1.js', '20260828-1'],
  ['inauguration-owner-rules-v1.js', '20260828-1'],
  ['planet-overview-desktop-v1.js', '20260828-1'],
  ['andre-os-eject-v1.js', '20260828-3'],
]);

for (const [file, version] of published) {
  assert.match(
    html,
    new RegExp(`${file.replaceAll('.', '\\.') }\\?v=${version}`),
    `${file} precisa publicar a revisão JS ${version}`,
  );
}

assert.match(hub, /planet-expansion-v1\.js\?v=20260828-2/,
  'bootstrap publicado precisa carregar a Expansão atual');
assert.match(hub, /planet-expansion-contact-trail-v1\.js\?v=20260828-1/,
  'bootstrap publicado precisa carregar a trilha de contato');
assert.match(hub, /inauguration-timing-core-v1\.js\?v=20260828-1/,
  'bootstrap publicado precisa carregar o timing operacional');
assert.match(hub, /andre-os-operational-reconciliation-v1\.js\?v=20260828-2/,
  'bootstrap publicado precisa carregar a reconciliação operacional');
assert.match(hub, /andre-os-radar-home-v1\.js\?v=20260828-1/,
  'bootstrap publicado precisa carregar a Home separando Radar pessoal e operação');
assert.match(hub, /planet-notifications-v1\.js\?v=20260828-2/,
  'bootstrap publicado precisa carregar o centro de notificações atual');

assert.match(ownerRules, /Enviar contato\/indicação de Social Media local/,
  'owner-rules publicado precisa conter a expansão do checklist de inauguração');
assert.match(ownerRules, /if \(key === 'criacao\/ajuste do instagram'\) return 'Franqueadora'/,
  'owner-rules publicado precisa preservar os responsáveis corrigidos');
assert.match(radar, /ticketHasAndreSupport/,
  'RadarData publicado precisa preservar a leitura atual de apoio do SULTS');
assert.match(eject, /implantacoes\?start=0&limit=100&scope=all/,
  'EJECT publicado precisa preservar a leitura histórica explícita do SULTS');

console.log('Publicação JS: cache-busters e marcadores críticos validados.');
