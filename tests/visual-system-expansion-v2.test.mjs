import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('planet-hub/assets/planet-expansion-v2.css', 'utf8');
const system = fs.readFileSync('planet-hub/assets/andre-os-visual-system-v1.css', 'utf8');

assert.match(system, /@import url\('\/planet-hub\/assets\/planet-expansion-v2\.css\?v=20260806-1'\)/);
assert.match(css, /body \.pmh-expansion-head/);
assert.match(css, /var\(--aos-surface\)/);
assert.match(css, /var\(--aos-line/);
assert.match(css, /var\(--aos-accent\)/);
assert.match(css, /var\(--aos-muted\)/);
assert.match(css, /\.pmh-expansion-lead\.selected/);
assert.match(css, /@media \(max-width: 760px\)/);
assert.doesNotMatch(css, /!important/);
assert.doesNotMatch(css, /MutationObserver/);
assert.doesNotMatch(css, /background:\s*#fff(?:fff)?\b/i);

console.log('Expansion visual contract is tokenized and registered.');
