import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../planet-hub/assets/inauguration-schedule-print-v1.js', import.meta.url), 'utf8');

assert.match(source, /print-color-adjust: exact/);
assert.match(source, /owner-legend/);
assert.match(source, /owner-franqueadora/);
assert.match(source, /owner-franqueado/);
assert.match(source, /border-left: 4px solid #f47c20/);
assert.match(source, /border-left: 4px solid #6f7f95/);

const sandbox = {
  console,
  Intl,
  Date,
  window: {
    localStorage: { getItem: () => '[]' },
    addEventListener: () => {},
    alert: () => {},
  },
  document: {
    addEventListener: () => {},
    querySelector: () => null,
  },
  requestAnimationFrame: () => {},
};
sandbox.globalThis = sandbox;
vm.runInNewContext(source, sandbox, { filename: 'inauguration-schedule-print-v1.js' });
const api = sandbox.window.PlanetInaugurationSchedulePrint;

const html = api.buildPrintHtml({
  unit: 'Guarulhos',
  openingDate: '2026-09-24',
  checklist: [
    { action: 'Contratar influenciadores', owner: 'Franqueadora', daysBefore: 15 },
    { action: 'Enviar contatos', owner: 'Franqueado', daysBefore: 20 },
  ],
});

assert.match(html, /<tr class="owner-franqueadora">[\s\S]*Contratar influenciadores/);
assert.match(html, /<tr class="owner-franqueado">[\s\S]*Enviar contatos/);
assert.match(html, /Franqueadora<\/span>/);
assert.match(html, /Franqueado<\/span>/);
assert.equal(api.ownerScope({ owner: 'Franqueadora' }), 'franqueadora');
assert.equal(api.ownerScope({ owner: 'Franqueado' }), 'franqueado');

console.log('Inaugurações: cronograma A4 preserva cores e legenda por responsável.');
