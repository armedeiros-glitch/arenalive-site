import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
import { importCandidates, readCandidateDocument } from '../functions/_lib/planet-lead-candidates.js';

class MemoryKV {
  constructor() { this.values = new Map(); }
  async get(key, options) {
    const value = this.values.get(key);
    return options?.type === 'json' && value ? JSON.parse(value) : value ?? null;
  }
  async put(key, value) { this.values.set(key, value); }
}

const store = new MemoryKV();
const result = await importCandidates(store, [
  { name: 'Válido', phone: '47999990003', source: 'csv', sourceRecordId: '1', extraField: 'ignorar' },
  { name: 'Duplicado', phone: '47999990003', source: 'csv', sourceRecordId: '2' },
  { company: 'Sem contato', city: 'Joinville', source: 'csv', sourceRecordId: '3' },
  { source: 'csv', sourceRecordId: '4' },
]);

assert.equal(result.report.linesRead, 4);
assert.equal(result.report.candidatesCreated, 2);
assert.equal(result.report.duplicates, 1);
assert.equal(result.report.invalid, 1);
assert.equal(result.report.withoutContact, 1);
const document = await readCandidateDocument(store);
assert.equal(document.data.length, 2);
assert.equal('extraField' in document.data.find((item) => item.name === 'Válido'), false);
console.log('Importação parcial e relatório validados.');
