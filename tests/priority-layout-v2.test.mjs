import assert from 'node:assert/strict';
import fs from 'node:fs';

const script = fs.readFileSync('planet-hub/assets/priority-layout-v2.js', 'utf8');
const css = fs.readFileSync('planet-hub/assets/priority-layout-v2.css', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

assert.ok(script.includes('MOBILE_MAX = 820'), 'responsive boundary must remain explicit');
assert.ok(script.includes('MAX_OTHER_ITEMS = 3'), 'secondary priorities must remain bounded');
assert.ok(script.includes('buildFocus'), 'focus must be rendered by the shared component');
assert.ok(script.includes('buildOthers'), 'secondary priorities must be rendered by the shared component');
assert.ok(script.includes("currentMode === 'mobile' ? 'pmh-priority-track' : 'pmh-priority-grid'"), 'one renderer must choose carousel or grid by mode');
assert.ok(!script.includes('MutationObserver'), 'priority layout must not use MutationObserver');
assert.ok(css.includes('.pmh-priority-card.is-focus'), 'shared focus styles must exist');
assert.ok(css.includes('.pmh-priority-card.is-other'), 'shared secondary styles must exist');
assert.ok(css.includes('scroll-snap-type: x mandatory'), 'mobile carousel behavior must remain');
assert.ok(css.includes('grid-template-columns: repeat(3, minmax(0, 1fr))'), 'desktop grid behavior must remain');
assert.ok(css.includes('.pmh-priority-ready > :not(.pmh-priority-layout)'), 'original cockpit must remain as fallback until ready');
assert.ok(index.includes('priority-layout-v2.css?v=20260805-1'), 'official entry must load unified CSS');
assert.ok(index.includes('priority-layout-v2.js?v=20260805-1'), 'official entry must load unified JS');
assert.ok(!index.includes('mobile-priority-carousel-v1'), 'old mobile priority layer must not be loaded');
assert.ok(!index.includes('desktop-priority-layout-v1'), 'old desktop priority layer must not be loaded');

console.log('priority layout v2 checks passed');
