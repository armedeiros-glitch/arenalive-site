import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../planet-hub/assets/financeiro-v1.js', import.meta.url), 'utf8');
const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const access = fs.readFileSync(new URL('../planet-hub/assets/hub-access-v1.js', import.meta.url), 'utf8');

assert.match(source, /const active = payments\.filter\(\(item\) => item\.status !== 'rejected'\)/);
assert.match(source, /const committedAmount = \(payments, actualValue = 0\) => Math\.max\(/);
assert.match(source, /const committedValue = committedAmount\(payments, actualValue\)/);
assert.match(source, /const balanceLabel = money\(balanceValue\)/);
assert.doesNotMatch(source, /const balanceLabel = context\.balance \|\| money\(balanceValue\)/);
assert.match(source, /committedAmount\(\s*panelPayments\(\),\s*Number\(state\.panelContext\.actualValue \|\| 0\),\s*\)/);

const budget = 4100;
const actualValue = 450;
const payments = [
  { amount: 450, status: 'awaiting_approval' },
  { amount: 1300, status: 'awaiting_approval' },
];
const activeTotal = payments
  .filter((item) => item.status !== 'rejected')
  .reduce((sum, item) => sum + item.amount, 0);
assert.equal(budget - Math.max(actualValue, activeTotal), 2350);

const withRejected = [...payments, { amount: 900, status: 'rejected' }];
const totalWithoutRejected = withRejected
  .filter((item) => item.status !== 'rejected')
  .reduce((sum, item) => sum + item.amount, 0);
assert.equal(budget - Math.max(actualValue, totalWithoutRejected), 2350);

assert.match(access, /financeiro-v1\.js\?v=20260805-5/);
assert.match(indexHtml, /hub-access-v1\.js\?v=/);

console.log('AndreOS finance available balance: tests passed');
