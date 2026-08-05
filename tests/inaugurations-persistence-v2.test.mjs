import assert from 'node:assert/strict';
import fs from 'node:fs';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const source = fs.readFileSync(new URL('../functions/api/hub/inauguracoes.js', import.meta.url), 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const { onRequestGet, onRequestPut } = await import(moduleUrl);

class MemoryKv {
  constructor() {
    this.data = new Map();
  }

  async get(key, options = {}) {
    const value = this.data.get(key);
    if (value == null) return null;
    return options.type === 'json' ? JSON.parse(value) : value;
  }

  async put(key, value) {
    this.data.set(key, String(value));
  }
}

const store = new MemoryKv();
const env = { PLANET_HUB_DATA: store };
const checklist = [
  { action: 'Primeiro item', owner: 'Franqueado', daysBefore: 30, done: false },
  { action: 'Separar brindes/cupons', owner: 'Franqueado', daysBefore: 5, done: true },
  { action: 'Último item', owner: 'Franqueadora', daysBefore: 3, done: false },
];

const put = (data, baseRevision = null) => onRequestPut({
  env,
  request: new Request('https://andre-os.local/api/hub/inauguracoes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, baseRevision }),
  }),
});

const initialItem = {
  id: 'inauguration-rio',
  sourceProjectId: 'sults-123',
  unit: 'Rio de Janeiro/RJ',
  openingDate: '2026-08-20',
  responsible: 'André',
  location: 'Shopping teste',
  packageBudget: 4100,
  checklist,
  inauguralActions: [],
};

const firstResponse = await put([initialItem]);
assert.equal(firstResponse.status, 200);
const first = await firstResponse.json();
assert.ok(first.revision);
assert.equal(first.data.length, 1);
assert.deepEqual(first.data[0].checklist.map((item) => item.action), checklist.map((item) => item.action));
assert.equal(first.data[0].checklist[1].done, true);
assert.equal(first.data[0].packageBudget, 4100);

const getResponse = await onRequestGet({ env });
assert.equal(getResponse.status, 200);
const loaded = await getResponse.json();
assert.equal(loaded.storage, 'shared');
assert.deepEqual(loaded.data[0].checklist, first.data[0].checklist);

const secondResponse = await put([
  { ...initialItem, unit: 'Rio de Janeiro/RJ atualizado', checklist: first.data[0].checklist },
], first.revision);
assert.equal(secondResponse.status, 200);
const second = await secondResponse.json();
assert.notEqual(second.revision, first.revision);

const staleResponse = await put([
  { ...initialItem, unit: 'Edição antiga', checklist: first.data[0].checklist },
], first.revision);
assert.equal(staleResponse.status, 409);
const stale = await staleResponse.json();
assert.equal(stale.conflict, true);
assert.equal(stale.revision, second.revision);
assert.equal(stale.data[0].unit, 'Rio de Janeiro/RJ atualizado');
assert.equal(stale.data[0].checklist[1].done, true);

console.log('AndreOS inauguration persistence: tests passed');
