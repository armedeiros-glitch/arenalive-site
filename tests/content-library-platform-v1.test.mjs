import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('planet-hub/assets/content-library-v1.js', 'utf8');

assert.match(source, /const detectContentPlatform =/);
assert.match(source, /drive\.google\.com/);
assert.match(source, /docs\.google\.com/);
assert.match(source, /Google Docs/);
assert.match(source, /Google Sheets/);
assert.match(source, /Google Slides/);
assert.match(source, /youtube\.com/);
assert.match(source, /youtu\.be/);
assert.match(source, /YouTube/);
assert.match(source, /canva\.com/);
assert.match(source, /Canva/);
assert.match(source, /Link externo/);
assert.match(source, /pmh-asset-link-origin/);
assert.match(source, /Abrir material ↗/);
assert.doesNotMatch(source, /\bplatform\s*:/);
assert.doesNotMatch(source, /\borigin\s*:/);
assert.doesNotMatch(source, /\bprovider\s*:/);

console.log('Central Planet: origem derivada dos links validada.');
