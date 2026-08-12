import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const finance = read('planet-hub/assets/financeiro-v1.js');
const quickFlow = read('planet-hub/assets/payment-quick-flow-v1.js');
const backend = read('functions/api/hub/financeiro.js');

assert.match(finance, /data-finance-delete-payment=/, 'painel principal deve mostrar Excluir');
assert.match(finance, /Excluir este pagamento\?/, 'exclusão deve pedir confirmação clara');
assert.match(finance, /Ação: \$\{payment\.actionName/, 'confirmação deve identificar a ação');
assert.match(finance, /Fornecedor: \$\{supplier\?\.legalName/, 'confirmação deve identificar fornecedor');
assert.match(finance, /Valor: \$\{money\(payment\.amount\)\}/, 'confirmação deve identificar valor');
assert.match(finance, /if \(!confirmed\) return;/, 'cancelar confirmação não pode alterar estado');

assert.match(finance, /const deletePaymentById = async \(paymentId, document = null, attempt = 0\) =>/);
assert.match(finance, /filter\(\(item\) => String\(item\.id \|\| ''\) !== targetId\)/,
  'deleção deve ocorrer exclusivamente por payment.id');
assert.match(finance, /method: 'PUT'/);
assert.match(finance, /baseRevision: current\.revision \|\| null/);
assert.match(finance, /error\.status === 409 && attempt < 2/);
assert.match(finance, /error\.payload\?\.suppliers && error\.payload\?\.payments/,
  'retry deve partir do documento remoto do conflito quando disponível');
assert.match(finance, /return deletePaymentById\(targetId, remote, attempt \+ 1\)/,
  'retry deve reaplicar explicitamente a mesma exclusão no remoto');

const deleteBlock = finance.slice(
  finance.indexOf('const deletePaymentById ='),
  finance.indexOf('const panelPayments ='),
);
assert.ok(deleteBlock.length > 0);
assert.doesNotMatch(deleteBlock, /mergeChangedItems\(/,
  'deleção não pode usar mergeChangedItems');
assert.match(deleteBlock, /state\.payments = payload\.payments \|\| payments/,
  'sucesso deve adotar a resposta persistida');

assert.match(finance, /await deletePaymentById\(payment\.id\);\s*renderPanel\(\);/s,
  'sucesso deve rerenderizar lista, quantidade, KPIs e saldo');
assert.match(finance, /catch \(error\) \{\s*state\.error =/s,
  'erro deve renderizar feedback sem remover pagamento localmente');

assert.match(finance, /await saveFinance\(\{ changedPaymentIds: \[updated\.id\] \}\)/,
  'criação/edição devem continuar usando saveFinance');
assert.match(finance, /await saveFinance\(\{ changedPaymentIds: \[payment\.id\] \}\)/,
  'alteração de status deve continuar usando saveFinance');
assert.match(quickFlow, /const deletePayment = async \(paymentId\)/,
  'fluxo rápido existente deve permanecer intacto');
assert.doesNotMatch(backend, /onRequestDelete|export async function onRequestDelete/,
  'não deve surgir backend DELETE novo');
assert.match(finance, /const calculateInaugurationFinance = \(inauguration = \{\}, payments = \[\]\) =>/,
  'exclusão deve continuar integrada à regra financeira única');
assert.match(finance, /const committed = Math\.max\(actual, requested\)/,
  'comprometido deve usar a semântica financeira oficial');
assert.match(finance, /const availableBalance = budget - committed/,
  'saldo disponível deve usar a semântica financeira oficial');
assert.match(finance, /GASTO REALIZADO/,
  'painel deve manter o gasto realizado explícito');

const removeById = (document, paymentId) => ({
  suppliers: [...document.suppliers],
  payments: document.payments.filter((item) => String(item.id) !== String(paymentId)),
  revision: document.revision,
});

const initial = {
  revision: 'r1',
  suppliers: [{ id: 's1' }],
  payments: [
    { id: 'A', amount: 100, status: 'draft' },
    { id: 'B', amount: 200, status: 'draft' },
  ],
};

const remoteEditedB = {
  revision: 'r2',
  suppliers: [{ id: 's1' }],
  payments: [
    { id: 'A', amount: 100, status: 'draft' },
    { id: 'B', amount: 250, status: 'paid' },
  ],
};
const retryAfterEdit = removeById(remoteEditedB, 'A');
assert.deepEqual(retryAfterEdit.payments, [{ id: 'B', amount: 250, status: 'paid' }],
  '409 com edição remota deve preservar B editado e manter A excluído');

const remoteCreatedC = {
  revision: 'r3',
  suppliers: [{ id: 's1' }],
  payments: [
    ...initial.payments,
    { id: 'C', amount: 300, status: 'awaiting_approval' },
  ],
};
const retryAfterCreate = removeById(remoteCreatedC, 'A');
assert.deepEqual(retryAfterCreate.payments, [
  { id: 'B', amount: 200, status: 'draft' },
  { id: 'C', amount: 300, status: 'awaiting_approval' },
], '409 com criação remota deve preservar C e os demais pagamentos, mantendo A excluído');

const metrics = (payments) => {
  const active = payments.filter((item) => item.status !== 'rejected');
  return {
    total: active.reduce((sum, item) => sum + Number(item.amount || 0), 0),
    sent: active.filter((item) => ['sent_finance', 'paid'].includes(item.status))
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    paid: active.filter((item) => item.status === 'paid')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    pending: active.filter((item) => item.status !== 'paid').length,
  };
};
assert.deepEqual(metrics(retryAfterEdit.payments), { total: 250, sent: 250, paid: 250, pending: 0 },
  'KPIs devem refletir imediatamente o conjunto persistido após exclusão');

console.log('Financeiro: exclusão por payment.id, confirmação, retry 409 e preservação concorrente validados.');
