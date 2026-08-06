import assert from 'node:assert/strict';
import fs from 'node:fs';

const shell = fs.readFileSync('planet-hub/assets/andre-os-mobile-shell-v2.js', 'utf8');
const css = fs.readFileSync('planet-hub/assets/andre-os-mobile-navigation-v2.css', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

assert.ok(!shell.includes('MutationObserver'), 'mobile shell must not use a global MutationObserver');
assert.ok(!shell.includes('ensureDock'), 'mobile shell must not recreate the bottom dock');
assert.ok(shell.includes('EDGE_START_PX'), 'edge swipe threshold must exist');
assert.ok(shell.includes('pointerdown'), 'pointer gesture listeners must exist');
assert.ok(shell.includes('data-mobile-menu-backdrop'), 'backdrop control must exist');
assert.ok(shell.includes('data-expansion-nav'), 'Expansion route must close the drawer normally');
assert.ok(css.includes('.aos-mobile-backdrop'), 'drawer backdrop styles must exist');
assert.ok(css.includes('translate3d(-102%, 0, 0)'), 'drawer must start off-canvas');
assert.ok(css.includes('.aos-mobile-sidebar-open .pmh-sidebar'), 'open drawer state must exist');
assert.ok(css.includes('.aos-mobile-dock'), 'legacy dock must be explicitly disabled');
assert.ok(css.includes('button b[hidden]'), 'hidden navigation badges must remain hidden');
assert.ok(index.includes('andre-os-mobile-navigation-v2.css'), 'navigation CSS must load from the official entry');
assert.ok(index.includes('andre-os-mobile-shell-v2.js?v=20260805-9'), 'new shell cache version must load');

console.log('mobile navigation v2 checks passed');
