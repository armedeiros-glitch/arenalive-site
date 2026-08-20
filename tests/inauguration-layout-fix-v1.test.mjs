import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const css = read('planet-hub/assets/inauguration-layout-fix-v1.css');
const index = read('index.html');

assert.match(css, /\.pmh-inauguration-project-grid\s*\{/);
assert.match(css, /min\(620px, 100%\)/,
  'cards desktop devem reservar largura suficiente para a grade interna');
assert.match(css, /\.pmh-inauguration-project-row\s*\{/);
assert.match(css, /grid-template-columns:\s*minmax\(0, 1\.35fr\) minmax\(150px, \.7fr\) 126px auto/);
assert.match(css, /max-width:\s*1320px/);
assert.match(css, /grid-template-columns:\s*1fr/,
  'desktop estreito deve cair para uma coluna sem colisão');
assert.match(index, /inauguration-layout-fix-v1\.css\?v=20260820-1/);

console.log('Inaugurações: largura dos cards e fallback responsivo validados.');
