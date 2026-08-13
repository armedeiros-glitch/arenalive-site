import fs from 'node:fs';
import assert from 'node:assert/strict';

const css = fs.readFileSync('planet-hub/assets/content-library-v1.css', 'utf8');
const source = fs.readFileSync('planet-hub/assets/content-library-v1.js', 'utf8');
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

assert.match(source, /canonicalValues/);
assert.match(source, /resolveCanonicalValue/);
assert.match(source, /name="campaign" list="pmh-content-campaigns"/);
assert.match(source, /name="unit" list="pmh-content-units"/);
assert.match(source, /normalize\(item\.campaign\) !== normalize\(state\.filters\.campaign\)/);
assert.match(source, /normalize\(item\.unit\) !== normalize\(state\.filters\.unit\)/);
assert.doesNotMatch(source, /campaignId|unitId|relationId/);

console.log('visual system content library + autocomplete: ok');
