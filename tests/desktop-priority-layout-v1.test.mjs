import assert from 'node:assert/strict';
import fs from 'node:fs';

const script = fs.readFileSync('planet-hub/assets/desktop-priority-layout-v1.js', 'utf8');
const css = fs.readFileSync('planet-hub/assets/desktop-priority-layout-v1.css', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

assert.ok(script.includes('DESKTOP_MIN = 821'), 'desktop layout must not run on mobile');
assert.ok(script.includes('MAX_OTHER_ITEMS = 3'), 'desktop secondary points must stay bounded');
assert.ok(script.includes('pmh-desktop-priority-focus-section'), 'focus section must be separate');
assert.ok(script.includes('pmh-desktop-priority-others-section'), 'secondary section must be separate');
assert.ok(!script.includes('MutationObserver'), 'desktop priority layout must not use MutationObserver');
assert.ok(css.includes('grid-template-columns: repeat(3, minmax(0, 1fr))'), 'desktop must show three secondary cards when space allows');
assert.ok(css.includes('.pmh-desktop-priority-card.is-focus'), 'focus card styles must exist');
assert.ok(css.includes('.pmh-desktop-priority-card.is-other'), 'lighter secondary card styles must exist');
assert.ok(index.includes('desktop-priority-layout-v1.css?v=20260805-1'), 'official entry must load desktop CSS');
assert.ok(index.includes('desktop-priority-layout-v1.js?v=20260805-1'), 'official entry must load desktop JS');

console.log('desktop priority layout checks passed');
