import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('planet-hub/assets/content-library-stability-v1.js', 'utf8');
const library = fs.readFileSync('planet-hub/assets/content-library-v1.js', 'utf8');

const match = source.match(/const detectContentPlatform = ([\s\S]+?);\n\n  const decorateLinks =/);
assert.ok(match);
const detectContentPlatform = Function(`return (${match[1]});`)();

assert.equal(detectContentPlatform('https://drive.google.com/file/d/abc/view'), 'Google Drive');
assert.equal(detectContentPlatform('https://docs.google.com/document/d/abc/edit'), 'Google Docs');
assert.equal(detectContentPlatform('https://docs.google.com/spreadsheets/d/abc/edit'), 'Google Sheets');
assert.equal(detectContentPlatform('https://docs.google.com/presentation/d/abc/edit'), 'Google Slides');
assert.equal(detectContentPlatform('https://youtube.com/watch?v=abc'), 'YouTube');
assert.equal(detectContentPlatform('https://youtu.be/abc'), 'YouTube');
assert.equal(detectContentPlatform('https://canva.com/design/abc'), 'Canva');
assert.equal(detectContentPlatform('https://example.com/material'), 'Link externo');
assert.equal(detectContentPlatform(''), '');
assert.equal(detectContentPlatform('texto invalido'), '');

assert.doesNotMatch(match[1], /fetch\s*\(|XMLHttpRequest|sendBeacon/);
assert.match(source, /pmh-asset-link-origin/);
assert.match(source, /insertBefore\(label, link\)/);
assert.match(library, /Abrir material ↗/);
assert.doesNotMatch(library, /\bplatform\s*:|\borigin\s*:|\bprovider\s*:/);

console.log('Central Planet: origem derivada dos links validada.');
