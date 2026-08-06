import fs from 'node:fs';
import assert from 'node:assert/strict';

const css = fs.readFileSync('planet-hub/assets/active-workstream-v1.css', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');

assert.match(css, /var\(--os-surface\)/, 'Radar deve consumir superfície oficial');
assert.match(css, /var\(--os-text-strong\)/, 'Radar deve consumir texto forte oficial');
assert.match(css, /var\(--os-border\)/, 'Radar deve consumir borda oficial');
assert.match(css, /var\(--os-accent\)/, 'Radar deve consumir destaque oficial');
assert.match(css, /var\(--os-danger-soft\)/, 'Radar deve consumir estados semânticos oficiais');
assert.match(css, /html:not\(\.aos-mobile\)/, 'Layout desktop deve continuar isolado');
assert.match(css, /@media \(max-width: 720px\)/, 'Layout mobile deve continuar preservado');
assert.doesNotMatch(css, /!important/, 'Migração não deve depender de !important');
assert.doesNotMatch(css, /MutationObserver/, 'Migração visual não deve observar DOM');
assert.doesNotMatch(css, /background:\s*#fff(?:fff)?\b/i, 'Radar não deve manter branco fixo');
assert.match(index, /active-workstream-v1\.css\?v=20260806-1/, 'Index deve invalidar cache do CSS migrado');

console.log('visual-system-radar-v1: ok');
