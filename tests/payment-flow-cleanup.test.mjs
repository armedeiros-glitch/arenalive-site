import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [index, workspaceCss, requestPrint, quickFlow] = await Promise.all([
  read('index.html'),
  read('planet-hub/assets/inauguration-workspace-v2.css'),
  read('planet-hub/assets/payment-request-print-v1.js'),
  read('planet-hub/assets/payment-quick-flow-v1.js'),
]);

assert.ok(index.includes('inauguration-workspace-v2.css?v=20260808-2'));
assert.ok(index.includes('payment-request-print-v1.js?v=20260808-1'));
assert.ok(index.includes('payment-quick-flow-v1.js?v=20260808-1'));
assert.doesNotMatch(index, /payment-print-compact-v1\.js|payment-print-clean-v1\.js/);

assert.match(workspaceCss, /Payment document actions and quick flow/);
assert.match(workspaceCss, /\.pmh-payment-request-button/);
assert.match(workspaceCss, /\.pmh-quick-payment-dialog/);
assert.match(workspaceCss, /\.pmh-quick-section/);

for (const source of [requestPrint, quickFlow]) {
  assert.doesNotMatch(source, /createElement\(['"]style['"]\)|style\.textContent|appendChild\(style\)/,
    'Fluxos financeiros não podem voltar a injetar CSS em runtime.');
  assert.doesNotMatch(source, /MutationObserver/,
    'Fluxos financeiros devem reagir ao ciclo oficial de renderização, não observar o DOM inteiro.');
  assert.match(source, /pmh:view-rendered/,
    'Fluxos financeiros devem usar o evento oficial pmh:view-rendered.');
}

console.log('Contrato de limpeza do fluxo financeiro validado.');
