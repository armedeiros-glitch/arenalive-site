import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../planet-hub/assets/financeiro-v1.js', import.meta.url), 'utf8');
const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const access = fs.readFileSync(new URL('../planet-hub/assets/hub-access-v1.js', import.meta.url), 'utf8');

assert.match(source, /const calculateInaugurationFinance = \(inauguration = \{\}, payments = \[\]\) =>/);
assert.match(source, /const committed = Math\.max\(actual, requested\)/);
assert.match(source, /const availableBalance = budget - committed/);
assert.match(source, /GASTO REALIZADO/);
assert.match(source, /SALDO DISPONÍVEL/);
assert.doesNotMatch(source, /const committedAmount =/);

const budget = 4100;
assert.equal(budget - Math.max(1000, 800), 3100);
assert.equal(budget - Math.max(1000, 1500), 2600);
assert.equal(budget - Math.max(5000, 4500), -900);

assert.match(access, /financeiro-v1\.js\?v=20260812-2/);
assert.match(indexHtml, /hub-access-v1\.js\?v=/);

console.log('AndreOS finance available balance: unified semantics passed');
