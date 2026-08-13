import fs from 'node:fs';
import assert from 'node:assert/strict';

const css = fs.readFileSync('planet-hub/assets/content-library-v1.css', 'utf8');
const libraryBlock = css.split('.pmh-inauguration-finance-access')[0];

assert.match(libraryBlock, /var\(--os-surface\)/);
assert.match(libraryBlock, /var\(--os-text\)/);
assert.match(libraryBlock, /var\(--os-border\)/);
assert.match(libraryBlock, /var\(--os-accent\)/);
assert.match(libraryBlock, /var\(--os-success\)/);
assert.match(libraryBlock, /var\(--os-warning\)/);
assert.match(libraryBlock, /var\(--os-danger\)/);
assert.doesNotMatch(libraryBlock, /background:\s*#fff(?:fff)?\b/i);
assert.doesNotMatch(libraryBlock, /!important/);
assert.doesNotMatch(libraryBlock, /MutationObserver/);

console.log('visual system content library: ok');
