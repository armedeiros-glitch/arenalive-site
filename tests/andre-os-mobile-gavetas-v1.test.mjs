import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [index, pageStyles, navigationStyles, shell] = await Promise.all([
  read('index.html'),
  read('planet-hub/assets/andre-os-mobile-gavetas-v1.css'),
  read('planet-hub/assets/andre-os-mobile-navigation-v2.css'),
  read('planet-hub/assets/andre-os-mobile-shell-v2.js'),
]);

const mobilePages = 'andre-os-mobile-gavetas-v1.css?v=20260807-7';
const mobileNavigation = 'andre-os-mobile-navigation-v2.css?v=20260807-2';
const mobileShell = 'andre-os-mobile-shell-v2.js?v=20260807-11';
const darkDemandFix = 'andre-os-dark-demand-card-fix-v1.css?v=20260806-2';

assert.ok(index.includes(`media="(max-width: 820px)" href="/planet-hub/assets/${mobilePages}"`));
assert.ok(index.includes(`/planet-hub/assets/${mobileNavigation}`));
assert.ok(index.includes(`/planet-hub/assets/${mobileShell}`));
assert.ok(index.indexOf(mobilePages) > index.indexOf(darkDemandFix), 'A camada de páginas mobile precisa continuar depois do tema escuro.');

assert.match(shell, /PLANET_ROUTES/);
assert.match(shell, /label: 'Visão Geral'/);
assert.match(shell, /label: 'Marketing'/);
assert.match(shell, /label: 'Campanhas'/);
assert.match(shell, /label: 'Aquisição'/);
assert.match(shell, /label: 'Planet 5 Estrelas'/);
assert.match(shell, /label: 'Central Planet'/);
assert.match(shell, /data-mobile-navigation/);
assert.match(shell, /data-mobile-panel="planet"/);
assert.match(shell, /data-mobile-route="laboratorio"/);
assert.match(shell, /data-mobile-route="pessoal"/);
assert.match(shell, /TRABALHO/);
assert.match(shell, /Planet Chocolate/);
assert.doesNotMatch(shell, /MutationObserver|setInterval/);

assert.match(navigationStyles, /html:not\(\.aos-mobile\).*\[data-mobile-navigation\]/s);
assert.match(navigationStyles, /\.pmh-sidebar > nav > :not\(\[data-mobile-navigation\]\)/);
assert.match(navigationStyles, /\.aos-mobile-nav-context/);
assert.match(navigationStyles, /\.aos-mobile-nav-row\.environment/);
assert.match(navigationStyles, /\.aos-mobile-nav-route-list/);
assert.match(navigationStyles, /\.pmh-sidebar > footer[\s\S]*display:\s*none !important/);

assert.match(pageStyles, /html\.aos-mobile \.aos-home-page-shortcuts/);
assert.match(pageStyles, /html\.aos-mobile \.aos-planet-overview-page/);
assert.match(pageStyles, /html\.aos-mobile \.aos-planet-attention-item/);
assert.match(pageStyles, /html\.aos-mobile \.aos-planet-drawer-card/);
assert.match(pageStyles, /min-height:\s*57px\s*!important/);
assert.match(pageStyles, /html\.aos-mobile \.aos-marketing-kpis/);
assert.match(pageStyles, /html\.aos-mobile \.pmh-campaign-metrics/);
assert.match(pageStyles, /html\.aos-mobile \.pmh-inauguration-summary-grid/);
assert.match(pageStyles, /html\.aos-mobile \.pmh-ticket-compact-active \.pmh-command-metrics/);
assert.match(pageStyles, /html\.aos-mobile \.pa-summary/);
assert.match(pageStyles, /html\.aos-mobile \.p5-kpis/);
assert.match(pageStyles, /html\.aos-mobile \.pmh-assets-metrics/);
assert.match(pageStyles, /html\.aos-mobile \.aos-lab-project-grid/);
assert.match(pageStyles, /html\.aos-mobile \.aos-personal-rule/);
assert.match(pageStyles, /html\.aos-mobile \.pmh-internal-demands/);
assert.match(pageStyles, /html\.aos-mobile \.aos-radar-workspace/);
assert.match(pageStyles, /html\.aos-mobile \.pmh-expansion-tabs/);
assert.match(pageStyles, /html\.aos-mobile \.pmh-expansion-shell > \[hidden\]/);
assert.match(pageStyles, /env\(safe-area-inset-bottom/);
assert.match(pageStyles, /font-size:\s*16px\s*!important/);
assert.doesNotMatch(pageStyles, /aos-nav-drawer-toggle|data-navigation-drawer-item/);
assert.doesNotMatch(pageStyles, /html:not\(\.aos-mobile\)/);
assert.doesNotMatch(pageStyles, /@media\s*\(min-width/);
assert.doesNotMatch(pageStyles, /MutationObserver/);

console.log('Contrato mobile por ambientes, gavetas e densidade operacional validado.');
