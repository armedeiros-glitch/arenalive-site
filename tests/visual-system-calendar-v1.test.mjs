import assert from 'node:assert/strict';
import fs from 'node:fs';

const css = fs.readFileSync('planet-hub/assets/calendar-operations-v1.css', 'utf8');
const mobileMarker = '/* Mobile ownership: density and responsive presentation of Campaigns. */';
const mobileIndex = css.indexOf(mobileMarker);

assert.match(css, /var\(--os-surface\)/, 'Calendário deve consumir superfícies oficiais');
assert.match(css, /var\(--os-border\)/, 'Calendário deve consumir bordas oficiais');
assert.match(css, /var\(--os-text-muted\)/, 'Calendário deve consumir textos oficiais');
assert.match(css, /var\(--os-success-soft\)/, 'Estados semânticos devem usar tokens');
assert.match(css, /\.pmh-campaign-annual-card\.past/, 'Campanhas passadas devem manter tratamento visual');
assert.match(css, /@media \(max-width:760px\)/, 'Responsividade mobile deve permanecer explícita');
assert.doesNotMatch(css, /MutationObserver/, 'CSS não deve depender de observação do DOM');
assert.ok(mobileIndex >= 0, 'A compatibilidade de densidade mobile deve permanecer identificada e isolada');

const baseCss = css.slice(0, mobileIndex);
const mobileCss = css.slice(mobileIndex + mobileMarker.length);
assert.doesNotMatch(baseCss, /!important/, 'Base/desktop de Campanhas não pode criar guerra de especificidade');
assert.match(mobileCss, /html\.aos-mobile \.pmh-campaign-metrics/, 'Overrides tardios devem continuar explicitamente limitados ao André OS mobile');

for (const line of mobileCss.split('\n').filter((item) => item.includes('!important'))) {
  assert.match(line, /^html\.aos-mobile /, `!important fora do escopo mobile: ${line.trim()}`);
}

assert.doesNotMatch(css, /background:\s*#fff(?:fff)?\b/i, 'Superfícies brancas fixas não devem voltar');

console.log('visual-system-calendar-v1: ok');
