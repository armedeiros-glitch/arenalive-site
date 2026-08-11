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
assert.ok(index.includes('payment-request-print-v1.js?v=20260808-3'));
assert.ok(index.includes('payment-quick-flow-v1.js?v=20260808-2'));
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

assert.match(quickFlow, /const deletePayment = async \(paymentId\)/,
  'O fluxo da unidade deve permitir excluir um pagamento já salvo.');
assert.match(quickFlow, /data-delete-payment=/,
  'O botão de exclusão deve existir somente no modal de pagamento existente.');
assert.match(quickFlow, /const suppliers = \[\.\.\.\(document\.suppliers \|\| \[\]\)\]/,
  'Excluir pagamento deve preservar o cadastro de fornecedores.');
assert.match(quickFlow, /filter\(\(item\) => String\(item\.id\) !== String\(paymentId\)\)/,
  'A exclusão deve remover somente o pagamento selecionado.');
assert.match(quickFlow, /O lançamento será removido, mas o fornecedor continuará cadastrado/,
  'A confirmação deve deixar claro que o fornecedor não será apagado.');
assert.match(quickFlow, /error\.status === 409 && allowRetry/,
  'A exclusão deve respeitar o controle de revisão do financeiro.');

console.log('Contrato de limpeza e exclusão segura do fluxo financeiro validado.');
