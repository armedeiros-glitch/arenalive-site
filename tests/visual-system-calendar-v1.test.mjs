import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('planet-hub/assets/calendar-operations-v1.css', 'utf8');

assert.match(css, /var\(--os-surface\)/, 'Calendário deve consumir superfícies oficiais');
assert.match(css, /var\(--os-border\)/, 'Calendário deve consumir bordas oficiais');
assert.match(css, /var\(--os-text-muted\)/, 'Calendário deve consumir textos oficiais');
assert.match(css, /var\(--os-success-soft\)/, 'Estados semânticos devem usar tokens');
assert.match(css, /\.pmh-campaign-annual-card\.past/, 'Campanhas passadas devem manter tratamento visual');
assert.match(css, /@media \(max-width:760px\)/, 'Responsividade mobile deve permanecer explícita');
assert.doesNotMatch(css, /MutationObserver/, 'CSS não deve depender de observação do DOM');
assert.doesNotMatch(css, /!important/, 'Calendário migrado não deve iniciar nova disputa de especificidade');
assert.doesNotMatch(css, /background:\s*#fff(?:fff)?\b/i, 'Superfícies brancas fixas não devem voltar');

console.log('visual-system-calendar-v1: ok');
