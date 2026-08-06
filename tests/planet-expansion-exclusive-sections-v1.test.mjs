import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [html, styles] = await Promise.all([
  read('index.html'),
  read('planet-hub/assets/planet-expansion-exclusive-sections-v1.css'),
]);

assert.match(
  html,
  /planet-expansion-exclusive-sections-v1\.css\?v=20260806-2/,
  'O contrato de seção exclusiva precisa ser publicado.',
);
assert.match(styles, /\.pmh-expansion-shell\s*>\s*\.pmh-expansion-panel\[hidden\]/);
assert.match(styles, /data-lead-hunter-root\]\[hidden\]/);
assert.match(styles, /display:\s*none/);
assert.doesNotMatch(styles, /!important/);

console.log('Contrato de exclusividade entre Leads e Caça Leads validado.');
