import assert from 'node:assert/strict';
import fs from 'node:fs';

const finance = fs.readFileSync(new URL('../planet-hub/assets/financeiro-v1.js', import.meta.url), 'utf8');
const backend = fs.readFileSync(new URL('../functions/api/hub/financeiro.js', import.meta.url), 'utf8');

assert.match(finance, /const calculateInaugurationFinance = \(inauguration = \{\}, payments = \[\]\) =>/);
assert.match(finance, /planned = packageActions\.reduce/);
assert.match(finance, /actual = packageActions\.reduce/);
assert.match(finance, /activePayments = scopedPayments\.filter\(\(payment\) => payment\?\.status !== 'rejected'\)/);
assert.match(finance, /requested = activePayments\.reduce/);
assert.match(finance, /const committed = Math\.max\(actual, requested\)/);
assert.match(finance, /const availableBalance = budget - committed/);
assert.match(finance, /GASTO REALIZADO/);
assert.match(finance, /VALOR COMPROMETIDO/);
assert.match(finance, /SALDO DISPONÍVEL/);
assert.match(finance, /syncInaugurationFinancialSurfaces/);
assert.match(finance, /data-inauguration-list-balance/);
assert.match(finance, /pmh-inauguration-summary-grid/);
assert.match(finance, /calculateInaugurationFinance\(inauguration, state\.payments\)/);
assert.match(finance, /publishFinanceSnapshot\(\);\s*scheduleFinancialSurfaceSync\(\);/s);
assert.match(finance, /window\.addEventListener\('pmh:view-rendered', scheduleFinancialSurfaceSync\)/);
assert.match(finance, /loadFinance\(\)\.catch\(\(\) => \{\}\)/);
assert.doesNotMatch(finance, /const metrics = \(payments\)/);
assert.doesNotMatch(finance, /const committedAmount =/);

const calculate = (inauguration = {}, payments = []) => {
  const actions = (inauguration.inauguralActions || []).filter((action) => action.included !== false);
  const packageActions = actions.filter((action) => action.costType === 'package');
  const active = payments.filter((payment) => String(payment.inaugurationId) === String(inauguration.id) && payment.status !== 'rejected');
  const budget = Number(inauguration.packageBudget || 0);
  const planned = packageActions.reduce((sum, action) => sum + Number(action.plannedAmount || 0), 0);
  const actual = packageActions.reduce((sum, action) => sum + Number(action.actualAmount || 0), 0);
  const requested = active.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const sent = active.filter((payment) => ['sent_finance', 'paid'].includes(payment.status)).reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const paid = active.filter((payment) => payment.status === 'paid').reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const pending = active.filter((payment) => payment.status !== 'paid').length;
  const committed = Math.max(actual, requested);
  return { budget, planned, actual, requested, sent, paid, pending, committed, availableBalance: budget - committed };
};

const inauguration = {
  id: 'i-1',
  packageBudget: 4100,
  inauguralActions: [
    { costType: 'package', included: true, plannedAmount: 1200, actualAmount: 1000 },
    { costType: 'unit', included: true, plannedAmount: 500, actualAmount: 300 },
  ],
};

let result = calculate(inauguration, [{ inaugurationId: 'i-1', amount: 800, status: 'awaiting_approval' }]);
assert.equal(result.actual, 1000, 'GASTO REALIZADO usa actualAmount das ações do pacote');
assert.equal(result.requested, 800);
assert.equal(result.committed, 1000);
assert.equal(result.availableBalance, 3100);

result = calculate(inauguration, [{ inaugurationId: 'i-1', amount: 1500, status: 'sent_finance' }]);
assert.equal(result.requested, 1500);
assert.equal(result.sent, 1500);
assert.equal(result.committed, 1500);
assert.equal(result.availableBalance, 2600);

result = calculate({ ...inauguration, inauguralActions: [{ costType: 'package', included: true, plannedAmount: 5000, actualAmount: 5000 }] }, [
  { inaugurationId: 'i-1', amount: 4500, status: 'paid' },
]);
assert.equal(result.actual, 5000);
assert.equal(result.paid, 4500);
assert.equal(result.committed, 5000);
assert.equal(result.availableBalance, -900, 'saldo disponível pode ser negativo');

result = calculate(inauguration, [
  { inaugurationId: 'i-1', amount: 1500, status: 'rejected' },
  { inaugurationId: 'outra', amount: 9999, status: 'paid' },
]);
assert.equal(result.requested, 0, 'rejected e outra inauguração não comprometem esta verba');
assert.equal(result.committed, 1000);
assert.equal(result.availableBalance, 3100);

const afterCreate = calculate(inauguration, [{ inaugurationId: 'i-1', amount: 1300, status: 'draft' }]);
assert.equal(afterCreate.committed, 1300);
assert.equal(afterCreate.availableBalance, 2800);
const afterEdit = calculate(inauguration, [{ inaugurationId: 'i-1', amount: 1700, status: 'draft' }]);
assert.equal(afterEdit.availableBalance, 2400);
const afterReject = calculate(inauguration, [{ inaugurationId: 'i-1', amount: 1700, status: 'rejected' }]);
assert.equal(afterReject.availableBalance, 3100);
const afterDelete = calculate(inauguration, []);
assert.equal(afterDelete.availableBalance, 3100);
const afterActual = calculate({ ...inauguration, inauguralActions: [{ costType: 'package', included: true, plannedAmount: 1200, actualAmount: 2200 }] }, []);
assert.equal(afterActual.committed, 2200);
assert.equal(afterActual.availableBalance, 1900);
const afterBudget = calculate({ ...inauguration, packageBudget: 5000 }, [{ inaugurationId: 'i-1', amount: 1500, status: 'draft' }]);
assert.equal(afterBudget.availableBalance, 3500);

assert.match(finance, /deletePaymentById/);
assert.match(finance, /error\.status === 409 && attempt < 2/);
assert.match(finance, /mergeChangedItems/);
assert.match(backend, /export async function onRequestPut/);
assert.doesNotMatch(backend, /onRequestDelete/);
assert.doesNotMatch(finance, /localStorage\.setItem\([^)]*finance/i, 'não deve surgir persistência financeira nova no cliente');

console.log('Inaugurações: semântica única de planejado, realizado, solicitado, comprometido e saldo validada.');
