import assert from 'node:assert/strict';
import { onRequestGet, onRequestPut } from '../functions/api/hub/financeiro.js';

class MemoryKV {
  constructor() { this.map = new Map(); }
  async get(key, options = {}) {
    const value = this.map.get(key);
    if (value == null) return null;
    return options?.type === 'json' ? JSON.parse(value) : value;
  }
  async put(key, value) { this.map.set(key, String(value)); }
}

const store = new MemoryKV();
const env = {
  PLANET_HUB_DATA: store,
  PLANET_HUB_ACCESS_PASSWORD: 'senha-de-acesso-do-teste',
  PLANET_HUB_ENCRYPTION_KEY: 'chave-de-criptografia-segura-para-testes-2026',
};

const supplier = {
  id: 'supplier-1',
  legalName: 'Fornecedor Teste LTDA',
  tradeName: 'Fornecedor Teste',
  document: '12345678000199',
  pixKey: 'financeiro@fornecedor.test',
  bankDetails: 'Banco 001 / Ag 1234 / Conta 56789-0',
  serviceType: 'Influenciador',
};

const payment = {
  id: 'payment-1',
  inaugurationId: 'inauguration-1',
  actionId: 'action-1',
  unit: 'Planet Teste',
  actionName: 'Ação inaugural',
  supplierId: 'supplier-1',
  amount: 1250.50,
  status: 'draft',
};

const put = async (body) => {
  const request = new Request('https://andre-os.test/api/hub/financeiro', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const response = await onRequestPut({ env, request });
  return { response, payload: await response.json() };
};

const first = await put({ suppliers: [supplier], payments: [payment], baseRevision: null });
assert.equal(first.response.status, 200);
assert.ok(first.payload.revision);
assert.equal(first.payload.suppliers[0].document, supplier.document);
assert.equal(first.payload.suppliers[0].pixKey, supplier.pixKey);

const rawAfterFirst = store.map.get('planet-hub:financeiro:v1');
assert.ok(rawAfterFirst);
assert.doesNotMatch(rawAfterFirst, /12345678000199/);
assert.doesNotMatch(rawAfterFirst, /financeiro@fornecedor\.test/);
assert.doesNotMatch(rawAfterFirst, /Banco 001/);
assert.match(rawAfterFirst, /documentEnc/);
assert.match(rawAfterFirst, /pixKeyEnc/);
assert.match(rawAfterFirst, /bankDetailsEnc/);

const second = await put({
  suppliers: [{ ...supplier, notes: 'Atualização vencedora' }],
  payments: [{ ...payment, amount: 1400 }],
  baseRevision: first.payload.revision,
});
assert.equal(second.response.status, 200);
assert.notEqual(second.payload.revision, first.payload.revision);

const rawWinner = store.map.get('planet-hub:financeiro:v1');
const stale = await put({
  suppliers: [{ ...supplier, notes: 'Atualização atrasada' }],
  payments: [{ ...payment, amount: 999 }],
  baseRevision: first.payload.revision,
});
assert.equal(stale.response.status, 409);
assert.equal(stale.payload.conflict, true);
assert.equal(stale.payload.revision, second.payload.revision);
assert.equal(stale.payload.payments[0].amount, 1400);
assert.equal(store.map.get('planet-hub:financeiro:v1'), rawWinner, 'Conflito não pode sobrescrever o documento vencedor.');

const invalid = await put({
  suppliers: [supplier],
  payments: [{ ...payment, supplierId: 'supplier-inexistente' }],
  baseRevision: second.payload.revision,
});
assert.equal(invalid.response.status, 400);
assert.equal(store.map.get('planet-hub:financeiro:v1'), rawWinner, 'Payload inválido não pode alterar o KV.');

const getResponse = await onRequestGet({ env });
assert.equal(getResponse.status, 200);
const document = await getResponse.json();
assert.equal(document.revision, second.payload.revision);
assert.equal(document.suppliers[0].document, supplier.document);
assert.equal(document.suppliers[0].pixKey, supplier.pixKey);
assert.equal(document.suppliers[0].bankDetails, supplier.bankDetails);
assert.equal(document.payments[0].amount, 1400);

console.log('Financeiro backend: concorrência, validação e criptografia validadas.');
