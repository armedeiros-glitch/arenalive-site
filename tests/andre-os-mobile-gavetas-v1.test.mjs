import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [index, mobileBase, pageStyles, navigationStyles, shell, ticketDetailsJs, ticketDetailsCss, ticketCompactStyles, darkThemeCss, calendarStyles, inaugurationStyles, acquisitionStyles, fiveStarsStyles, centralStyles] = await Promise.all([
  read('index.html'),
  read('planet-hub/assets/andre-os-mobile-v1.css'),
  read('planet-hub/assets/andre-os-mobile-gavetas-v1.css'),
  read('planet-hub/assets/andre-os-mobile-navigation-v2.css'),
  read('planet-hub/assets/andre-os-mobile-shell-v2.js'),
  read('planet-hub/assets/ticket-details-v1.js'),
  read('planet-hub/assets/ticket-details-v1.css'),
  read('planet-hub/assets/ticket-context-compact-v1.css'),
  read('planet-hub/assets/andre-os-dark-theme-v1.css'),
  read('planet-hub/assets/calendar-operations-v1.css'),
  read('planet-hub/assets/inauguration-workspace-v2.css'),
  read('planet-hub/assets/planet-acquisition-v1.css'),
  read('planet-hub/assets/planet-five-stars-v1.css'),
  read('planet-hub/assets/content-library-v1.css'),
]);

const mobileBaseAsset = 'andre-os-mobile-v1.css?v=20260808-1';
const mobilePages = 'andre-os-mobile-gavetas-v1.css?v=20260808-4';
const mobileNavigation = 'andre-os-mobile-navigation-v2.css?v=20260807-2';
const mobileShell = 'andre-os-mobile-shell-v2.js?v=20260807-11';
const darkTheme = 'andre-os-dark-theme-v1.css?v=20260808-1';
const ticketDetailsStyles = 'ticket-details-v1.css?v=20260808-1';
const ticketDetailsScript = 'ticket-details-v1.js?v=20260808-1';
const ticketCompactStylesAsset = 'ticket-context-compact-v1.css?v=20260808-1';
const calendarStylesAsset = 'calendar-operations-v1.css?v=20260808-1';
const inaugurationStylesAsset = 'inauguration-workspace-v2.css?v=20260808-2';
const acquisitionStylesAsset = 'planet-acquisition-v1.css?v=20260808-1';
const fiveStarsStylesAsset = 'planet-five-stars-v1.css?v=20260808-1';
const centralStylesAsset = 'content-library-v1.css?v=20260808-1';

assert.ok(index.includes(`/planet-hub/assets/${mobileBaseAsset}`));
assert.ok(index.includes(`media="(max-width: 820px)" href="/planet-hub/assets/${mobilePages}"`));
assert.ok(index.includes(`/planet-hub/assets/${mobileNavigation}`));
assert.ok(index.includes(`/planet-hub/assets/${mobileShell}`));
assert.ok(index.includes(darkTheme));
assert.ok(index.includes(ticketDetailsStyles));
assert.ok(index.includes(ticketDetailsScript));
assert.ok(index.includes(ticketCompactStylesAsset));
assert.ok(index.includes(calendarStylesAsset));
assert.ok(index.includes(inaugurationStylesAsset));
assert.ok(index.includes(acquisitionStylesAsset));
assert.ok(index.includes(fiveStarsStylesAsset));
assert.ok(index.includes(centralStylesAsset));
assert.ok(index.indexOf(ticketDetailsStyles) < index.indexOf(ticketDetailsScript), 'O CSS de detalhes deve estar disponível antes do comportamento do drawer.');
assert.ok(index.indexOf(mobilePages) > index.indexOf(darkTheme), 'A camada tardia mobile precisa continuar depois do tema escuro enquanto estabilizamos a cascata.');
assert.doesNotMatch(index, /andre-os-mobile-polish-v1\.css/, 'Refinamentos estáveis devem pertencer ao mobile base, não a uma camada polish separada.');
assert.doesNotMatch(index, /andre-os-dark-demand-card-fix-v1\.css/, 'Correções temporárias devem ser absorvidas pelo dono do tema.');
assert.doesNotMatch(index, /andre-os-dark-surfaces-v2\.css/, 'Superfícies escuras compartilhadas devem pertencer ao tema consolidado.');
assert.doesNotMatch(index, /andre-os-dark-palette-polish-v1\.css/, 'Tokens finais de paleta devem pertencer ao tema consolidado.');

assert.match(mobileBase, /mobile shell v3/);
assert.match(mobileBase, /html\.aos-mobile \.pmh-topbar/);
assert.match(mobileBase, /html\.aos-mobile \.aos-mobile-dock/);
assert.match(mobileBase, /html\.aos-mobile \.pmh-decision-actions/);
assert.match(mobileBase, /html\.aos-mobile \.pmh-demand-capture\.pmh-demand-capture-compact/);
assert.match(mobileBase, /html\.aos-mobile \.aos-thinking-floating-trigger/);

assert.match(darkThemeCss, /--aos-page:\s*#0d0c11/);
assert.match(darkThemeCss, /html\.aos-mobile \.pmh-command-metric/);
assert.match(darkThemeCss, /html\.aos-mobile \.aos-mobile-menu-toggle/);
assert.match(darkThemeCss, /html\.aos-mobile \.pmh-priority-focus/);

assert.match(calendarStyles, /Mobile ownership: density and responsive presentation of Campaigns/);
assert.match(calendarStyles, /html\.aos-mobile \.pmh-campaign-metrics/);
assert.match(calendarStyles, /html\.aos-mobile \.pmh-campaign-focus-card/);
assert.match(calendarStyles, /html\.aos-mobile \.pmh-campaign-timeline-card/);

assert.match(inaugurationStyles, /Mobile ownership · densidade aprovada de Inaugurações/);
assert.match(inaugurationStyles, /html\.aos-mobile \.pmh-inauguration-summary-grid/);
assert.match(inaugurationStyles, /html\.aos-mobile \.pmh-inauguration-project-tabs/);
assert.match(inaugurationStyles, /html\.aos-mobile \.pmh-inauguration-finance-summary/);

assert.match(ticketCompactStyles, /pmh-ticket-compact-active \.pmh-command-metrics/);
assert.match(ticketCompactStyles, /grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
assert.match(ticketCompactStyles, /pmh-ticket-compact-active \.pmh-command-ticket\{min-height:64px/);

assert.match(acquisitionStyles, /Mobile ownership · densidade aprovada de Aquisição/);
assert.match(acquisitionStyles, /html\.aos-mobile \.pa-summary/);
assert.match(acquisitionStyles, /html\.aos-mobile \.pa-step/);
assert.match(acquisitionStyles, /html\.aos-mobile \.pa-diagnostics/);
assert.match(acquisitionStyles, /@media\(max-width:380px\)\{html\.aos-mobile \.pa-summary/);

assert.match(fiveStarsStyles, /Mobile ownership · densidade aprovada do Planet 5 Estrelas/);
assert.match(fiveStarsStyles, /html\.aos-mobile \.p5-kpis/);
assert.match(fiveStarsStyles, /html\.aos-mobile \.p5-classification-strip/);
assert.match(fiveStarsStyles, /@media\(max-width:380px\)/);

assert.match(centralStyles, /Mobile ownership · densidade aprovada da Central Planet/);
assert.match(centralStyles, /html\.aos-mobile \.pmh-assets-metrics/);
assert.match(centralStyles, /html\.aos-mobile \.pmh-assets-grid/);
assert.match(centralStyles, /html\.aos-mobile \.pmh-asset-card/);

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

/* Stabilization contract: until the module-specific mobile sheets are split and loaded after the dark theme,
   the approved page overrides intentionally remain in this late layer so the visual cannot regress. */
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

assert.match(ticketDetailsCss, /\.pmh-ticket-drawer-panel/);
assert.match(ticketDetailsCss, /\.pmh-ticket-summary/);
assert.match(ticketDetailsCss, /\.pmh-ticket-event/);
assert.doesNotMatch(ticketDetailsJs, /createElement\(['"]style['"]\)|style\.textContent|appendChild\(style\)/, 'ticket-details-v1.js não pode voltar a injetar CSS em runtime.');

console.log('Contrato mobile por ambientes, gavetas, densidade e camada tardia de estabilização validado.');
