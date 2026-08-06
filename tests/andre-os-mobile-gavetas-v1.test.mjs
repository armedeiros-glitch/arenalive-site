import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [index, styles] = await Promise.all([
  read('index.html'),
  read('planet-hub/assets/andre-os-mobile-gavetas-v1.css'),
]);

const mobileLayer = 'andre-os-mobile-gavetas-v1.css?v=20260806-1';
const darkDemandFix = 'andre-os-dark-demand-card-fix-v1.css?v=20260806-2';

assert.ok(index.includes(`media="(max-width: 820px)" href="/planet-hub/assets/${mobileLayer}"`));
assert.ok(index.indexOf(mobileLayer) > index.indexOf(darkDemandFix), 'A camada mobile final precisa carregar por último.');

assert.match(styles, /html\.aos-mobile \.pmh-sidebar > nav\.aos-nav-drawers/);
assert.match(styles, /html\.aos-mobile \.aos-home-page-shortcuts/);
assert.match(styles, /html\.aos-mobile \.pmh-internal-demands/);
assert.match(styles, /html\.aos-mobile \.aos-radar-workspace/);
assert.match(styles, /html\.aos-mobile \.pmh-expansion-tabs/);
assert.match(styles, /html\.aos-mobile \.pmh-expansion-shell > \[hidden\]/);
assert.match(styles, /env\(safe-area-inset-bottom/);
assert.match(styles, /font-size:\s*16px\s*!important/);
assert.doesNotMatch(styles, /html:not\(\.aos-mobile\)/);
assert.doesNotMatch(styles, /@media\s*\(min-width/);
assert.doesNotMatch(styles, /MutationObserver/);

console.log('Contrato mobile de gavetas e páginas validado.');
