import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [indexHtml, access, pages, styles, drawers, demands] = await Promise.all([
  read('index.html'),
  read('planet-hub/assets/hub-access-v1.js'),
  read('planet-hub/assets/andre-os-home-pages-v1.js'),
  read('planet-hub/assets/andre-os-home-pages-v1.css'),
  read('planet-hub/assets/andre-os-navigation-drawers-v1.js'),
  read('planet-hub/assets/internal-demands-v1.js'),
]);

const drawerIndex = access.indexOf('andre-os-navigation-drawers-v1.js');
const pagesIndex = access.indexOf('andre-os-home-pages-v1.js');
const notificationsIndex = access.indexOf('planet-notifications-v1.js');
assert.ok(drawerIndex >= 0, 'O módulo de gavetas precisa continuar carregado.');
assert.ok(pagesIndex > drawerIndex, 'As páginas do André OS devem carregar depois da navegação por gavetas.');
assert.ok(notificationsIndex > pagesIndex, 'As páginas devem estar montadas antes do replay final de notificações.');

assert.match(indexHtml, /andre-os-home-pages-v1\.css\?v=/);
assert.match(indexHtml, /andre-os-home-refine-v3\.css\?v=/);
assert.match(access, /andre-os-home-pages-v1\.js\?v=/);
assert.match(pages, /hoje:\s*\{/);
assert.match(pages, /planet:\s*\{/);
assert.match(pages, /marketing:\s*\{/);
assert.match(pages, /demandas:\s*\{/);
assert.match(pages, /radar:\s*\{/);
assert.match(pages, /data-decision-cockpit/);
assert.match(pages, /data-planet-overview/);
assert.match(pages, /data-marketing-hub/);
assert.match(pages, /data-internal-demands/);
assert.match(pages, /data-active-workstream/);
assert.match(pages, /eventView:\s*'planet'/);
assert.match(pages, /eventView:\s*'marketing'/);
assert.match(pages, /eventView:\s*'inicio'/);
assert.match(pages, /segmented:\s*true/);
assert.match(pages, /andre-os:home-page-rendered/);
assert.match(pages, /PMHRadarData\.collect/);
assert.match(pages, /sources:\s*\['demands',\s*'contents'\]/, 'Marketing deve ler somente Demandas e Conteúdos pelo RadarData.');
assert.doesNotMatch(pages, /sources:\s*\[[^\]]*tickets[^\]]*\]/, 'Marketing não deve solicitar tickets na leitura seletiva.');
assert.match(demands, /event\.detail\?\.view === 'inicio'/);
assert.doesNotMatch(pages, /MutationObserver/);
assert.doesNotMatch(pages, /createElement\('link'\)|appendChild\(link\)/);
assert.doesNotMatch(pages, /ensureDestination|ensureDestinations/);

assert.match(drawers, /demandas:\s*\{\s*label:\s*'Demandas'/);
assert.match(drawers, /radar:\s*\{\s*label:\s*'Radar'/);
assert.match(drawers, /ensureViewItem/);

assert.match(styles, /@media \(min-width: 821px\)/);
assert.match(styles, /height:\s*100dvh/);
assert.match(styles, /overflow:\s*hidden/);
assert.match(styles, /\.aos-planet-overview-grid/);
assert.match(styles, /\.aos-marketing-hub-grid/);
assert.match(styles, /\.pmh-internal-demands[\s\S]*overflow:\s*auto/);
assert.match(styles, /\.aos-radar-workspace[\s\S]*overflow:\s*auto/);
assert.match(styles, /@media \(max-width: 820px\)/);

console.log('Contrato das páginas Hoje, Planet, Marketing, Demandas e Radar validado.');