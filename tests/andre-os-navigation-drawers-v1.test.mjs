import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const [indexHtml, accessScript, drawersScript, drawersCss, pagesScript] = await Promise.all([
  read('index.html'),
  read('planet-hub/assets/hub-access-v1.js'),
  read('planet-hub/assets/andre-os-navigation-drawers-v1.js'),
  read('planet-hub/assets/andre-os-navigation-drawers-v1.css'),
  read('planet-hub/assets/andre-os-home-pages-v1.js'),
]);

assert.match(indexHtml, /andre-os-navigation-drawers-v1\.css\?v=20260806-1/);
assert.match(accessScript, /andre-os-navigation-drawers-v1\.js\?v=20260806-2/);

const hunterPosition = accessScript.indexOf('planet-lead-hunter-v1.js');
const drawersPosition = accessScript.indexOf('andre-os-navigation-drawers-v1.js');
const pagesPosition = accessScript.indexOf('andre-os-home-pages-v1.js');
const notificationsPosition = accessScript.indexOf('planet-notifications-v1.js');
assert.ok(hunterPosition >= 0 && drawersPosition > hunterPosition, 'As gavetas devem montar depois do Caça Lead.');
assert.ok(pagesPosition > drawersPosition, 'As páginas devem montar depois da navegação oficial.');
assert.ok(notificationsPosition > pagesPosition, 'As notificações devem continuar carregando depois do shell.');

assert.match(drawersScript, /Operação da rede/);
assert.match(drawersScript, /Marketing/);
assert.match(drawersScript, /Expansão/);
assert.match(drawersScript, /Leads recebidos/);
assert.match(drawersScript, /Caça Leads/);
assert.match(drawersScript, /data-expansion-section-destination/);
assert.match(drawersScript, /sessionStorage\.setItem/);
assert.match(drawersScript, /ensureViewItem/);
assert.match(drawersScript, /appendChild/);
assert.match(drawersScript, /style\.order/);

assert.doesNotMatch(drawersScript, /MutationObserver/);
assert.doesNotMatch(drawersScript, /cloneNode/);
assert.doesNotMatch(drawersScript, /insertAdjacentElement/);
assert.doesNotMatch(drawersScript, /setTimeout/);
assert.doesNotMatch(drawersScript, /innerHTML\s*\+=/);
assert.doesNotMatch(pagesScript, /ensureDestination|ensureDestinations/);

assert.match(drawersCss, /\.aos-nav-drawer-toggle/);
assert.match(drawersCss, /data-navigation-drawer-item/);
assert.match(drawersCss, /@media \(min-width: 821px\)/);
assert.match(drawersCss, /@media \(max-width: 820px\)/);

console.log('andre-os-navigation-drawers-v1: ok');
