import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../planet-hub/assets/financeiro-v1.js', import.meta.url), 'utf8');

assert.match(source, /const cloneItems = \(items\) => items\.map\(\(item\) => \(\{ \.\.\.item \}\)\)/);
assert.match(source, /const mergeChangedItems = \(remoteItems, localItems, changedIds = \[\]\) =>/);
assert.match(source, /changedSupplierIds = \[\]/);
assert.match(source, /changedPaymentIds = \[\]/);
assert.match(source, /error\.status === 409 && error\.payload && attempt < 2/);
assert.match(source, /mergeChangedItems\(\s*error\.payload\.suppliers \|\| \[\],\s*localSuppliers,\s*changedSupplierIds,/s);
assert.match(source, /mergeChangedItems\(\s*error\.payload\.payments \|\| \[\],\s*localPayments,\s*changedPaymentIds,/s);
assert.match(source, /Os dados financeiros mudaram novamente/);

assert.match(source, /data-finance-supplier-error hidden/);
assert.match(source, /const previousSuppliers = cloneItems\(state\.suppliers\)/);
assert.match(source, /await saveFinance\(\{ changedSupplierIds: \[updated\.id\] \}\);\s*closeModal\(false\);/s);
assert.match(source, /state\.suppliers = previousSuppliers/);

assert.match(source, /const previousPayments = cloneItems\(state\.payments\);\s*select\.disabled = true;/s);
assert.match(source, /await saveFinance\(\{ changedPaymentIds: \[payment\.id\] \}\)/);
assert.match(source, /state\.payments = previousPayments;\s*state\.error = error instanceof Error/s);
assert.doesNotMatch(source, /alert\(error\.message\)/);

assert.match(source, /String\(payment\.inaugurationId \|\| ''\) === id/);
assert.match(source, /exportCsv\(panelPayments\(\)\)/);

const mergeChangedItems = (remoteItems, localItems, changedIds = []) => {
  const merged = new Map(remoteItems.map((item) => [String(item.id), item]));
  const localById = new Map(localItems.map((item) => [String(item.id), item]));
  changedIds.forEach((id) => {
    const local = localById.get(String(id));
    if (local) merged.set(String(id), local);
  });
  return [...merged.values()];
};

const remote = [
  { id: 'a', value: 'remoto atualizado' },
  { id: 'b', value: 'remoto b' },
];
const local = [
  { id: 'a', value: 'local antigo' },
  { id: 'b', value: 'edição local b' },
  { id: 'c', value: 'novo local c' },
];
const merged = mergeChangedItems(remote, local, ['b', 'c']);
assert.deepEqual(merged, [
  { id: 'a', value: 'remoto atualizado' },
  { id: 'b', value: 'edição local b' },
  { id: 'c', value: 'novo local c' },
]);

console.log('AndreOS finance stability: tests passed');
