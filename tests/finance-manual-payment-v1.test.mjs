import assert from 'node:assert/strict';
import fs from 'node:fs';

const finance = fs.readFileSync(new URL('../planet-hub/assets/financeiro-v1.js', import.meta.url), 'utf8');
const access = fs.readFileSync(new URL('../planet-hub/assets/hub-access-v1.js', import.meta.url), 'utf8');
const rootEntry = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

assert.match(finance, /const manualActionId = \(paymentId\) => `manual-\$\{paymentId\}`;/);
assert.match(finance, /actionId: context\.actionId \|\| existing\?\.actionId \|\| manualActionId\(paymentId\)/);
assert.match(finance, /name="actionId" value="\$\{esc\(payment\.actionId\)\}"/);
assert.match(finance, /const previousPayments = state\.payments\.map/);
assert.match(finance, /await saveFinance\(\);\s*closeModal\(false\);\s*renderPanel\(\);/s);
assert.match(finance, /catch \(error\) \{\s*state\.payments = previousPayments;/s);
assert.match(finance, /data-finance-payment-error hidden/);
assert.match(finance, /submitButton\.textContent = 'Salvando…'/);

const saveIndex = finance.indexOf('await saveFinance();\n        closeModal(false);');
assert.ok(saveIndex >= 0, 'o modal deve fechar somente depois da confirmação da API');

assert.match(access, /financeiro-v1\.js\?v=20260805-4/);
assert.match(rootEntry, /hub-access-v1\.js\?v=20260805-7/);

console.log('AndreOS manual finance payment: tests passed');
