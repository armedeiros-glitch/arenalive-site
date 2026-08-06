import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [html, access, expansion, styles] = await Promise.all([
  read('index.html'),
  read('planet-hub/assets/hub-access-v1.js'),
  read('planet-hub/assets/planet-expansion-v1.js'),
  read('planet-hub/assets/planet-expansion-v1.css'),
]);

assert.match(html, /planet-expansion-v1\.css\?v=20260806-1/);
assert.match(access, /planet-expansion-v1\.js\?v=20260806-2/);
assert.doesNotMatch(html, /planet-expansion-exclusive-sections-v1/);
assert.match(styles, /\.pmh-expansion-shell\s*>\s*\.pmh-expansion-panel\[hidden\]/);
assert.match(styles, /data-lead-hunter-root\]\[hidden\]/);
assert.match(styles, /display:\s*none/);
assert.doesNotMatch(styles, /!important/);
assert.doesNotMatch(expansion, /injectStyles|createElement\('style'\)|insertAdjacentElement|setTimeout\(activate/);
assert.match(expansion, /scheduleActivate/);

console.log('Contrato estático e exclusivo entre Leads e Caça Leads validado.');
