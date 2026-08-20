import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const {
  LEADS_STORAGE_KEY,
  LEAD_STORAGE_PREFIX,
  readLeadDocument,
  writeLead,
} = await import('../functions/_lib/planet-leads.js');

class MemoryKv {
  constructor() { this.data = new Map(); }
  async get(key, options = {}) {
    const value = this.data.get(key);
    if (value == null) return null;
    return options.type === 'json' ? JSON.parse(value) : value;
  }
  async put(key, value) { this.data.set(key, String(value)); }
  async list({ prefix = '', cursor = undefined, limit = 1000 } = {}) {
    const keys = [...this.data.keys()]
      .filter((key) => key.startsWith(prefix))
      .slice(0, limit)
      .map((name) => ({ name }));
    return { keys, list_complete: true, cursor };
  }
}

const store = new MemoryKv();
store.data.set(LEADS_STORAGE_KEY, JSON.stringify({
  revision: 'legacy-r1',
  updatedAt: '2026-08-10T12:00:00.000Z',
  data: [{
    id: 'lead-legado',
    source: 'rd_station',
    status: 'new',
    name: 'Lead Legado',
    email: 'legado@planet.test',
    createdAt: '2026-08-10T12:00:00.000Z',
    updatedAt: '2026-08-10T12:00:00.000Z',
  }],
}));

await writeLead(store, {
  id: 'lead-v2',
  source: 'rd_station',
  status: 'new',
  name: 'Lead Novo',
  email: 'novo@planet.test',
  createdAt: '2026-08-11T12:00:00.000Z',
  updatedAt: '2026-08-11T12:00:00.000Z',
});

const document = await readLeadDocument(store);
assert.equal(document.data.length, 2);
assert.deepEqual(new Set(document.data.map((item) => item.id)), new Set(['lead-legado', 'lead-v2']));
assert.ok([...store.data.keys()].some((key) => key.startsWith(LEAD_STORAGE_PREFIX)));
assert.ok(store.data.has(LEADS_STORAGE_KEY), 'documento legado deve permanecer intacto durante a migração gradual');

await writeLead(store, {
  ...document.data.find((item) => item.id === 'lead-legado'),
  status: 'contacted',
  updatedAt: '2026-08-11T13:00:00.000Z',
});

const afterMigration = await readLeadDocument(store);
const migrated = afterMigration.data.find((item) => item.id === 'lead-legado');
assert.equal(migrated.status, 'contacted', 'a versão v2 mais recente deve vencer o registro legado do mesmo ID');
assert.ok(store.data.has(`${LEAD_STORAGE_PREFIX}lead-legado`));

console.log('Planet leads storage v2: compatibilidade com legado preservada');
