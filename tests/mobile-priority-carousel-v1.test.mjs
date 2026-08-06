import assert from 'node:assert/strict';
import fs from 'node:fs';

const script = fs.readFileSync('planet-hub/assets/mobile-priority-carousel-v1.js', 'utf8');
const css = fs.readFileSync('planet-hub/assets/mobile-priority-carousel-v1.css', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

assert.ok(script.includes('buildFocusSection'), 'must build the primary focus as its own section');
assert.ok(script.includes('buildOthersSection'), 'must build other attention points separately');
assert.ok(script.includes('dataset.priorityFocus'), 'primary focus marker must exist');
assert.ok(script.includes('dataset.priorityOthers'), 'secondary carousel marker must exist');
assert.ok(!script.includes('MutationObserver'), 'mobile priority layout must not use MutationObserver');
assert.ok(script.includes('MAX_OTHER_ITEMS = 3'), 'secondary carousel must remain bounded');
assert.ok(css.includes('.pmh-priority-focus-section'), 'focus section styles must exist');
assert.ok(css.includes('.pmh-priority-others-section'), 'other points section styles must exist');
assert.ok(css.includes('.pmh-priority-ready > :not(.pmh-priority-mobile)'), 'original cockpit must remain as fallback until ready');
assert.ok(css.includes('scroll-snap-type: x mandatory'), 'secondary points must use native horizontal snapping');
assert.ok(index.includes('mobile-priority-carousel-v1.css?v=20260805-1'), 'official entry must load carousel CSS');
assert.ok(index.includes('mobile-priority-carousel-v1.js?v=20260805-1'), 'official entry must load carousel JS');

console.log('mobile priority split checks passed');
