import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [html, styles] = await Promise.all([
  read('index.html'),
  read('planet-hub/assets/planet-expansion-exclusive-sections-v1.css'),
]);

assert.match(
  html,
  /planet-expansion-exclusive-sections-v1\.css\?v=20260806-1/,
  'O contrato de seção exclusiva precisa ser publicado.',
);
assert.match(styles, /\.pmh-expansion-shell\s*>\s*\[hidden\]/);
assert.match(styles, /display:\s*none\s*!important/);

console.log('Contrato de exclusividade entre Leads e Caça Leads validado.');
