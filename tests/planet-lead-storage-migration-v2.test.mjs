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

let document = await readLeadDocument(store);
assert.equal(document.data.length, 2);
assert.deepEqual(new Set(document.data.map((item) => item.id)), new Set(['lead-legado', 'lead-v2']));
assert.ok([...store.data.keys()].some((key) => key.startsWith(LEAD_STORAGE_PREFIX)));
assert.ok(store.data.has(LEADS_STORAGE_KEY), 'documento legado deve permanecer intacto durante a migração gradual');

await writeLead(store, {
  ...document.data.find((item) => item.id === 'lead-legado'),
  status: 'contacted',
  updatedAt: '2026-08-11T13:00:00.000Z',
});

let afterMigration = await readLeadDocument(store);
const migrated = afterMigration.data.find((item) => item.id === 'lead-legado');
assert.equal(migrated.status, 'contacted', 'a versão v2 mais recente deve vencer o registro legado do mesmo ID');
assert.ok(store.data.has(`${LEAD_STORAGE_PREFIX}lead-legado`));

const cloneExternalId = 'rd-clone-historico-1';
await writeLead(store, {
  id: 'lead-clone-trabalhado',
  source: 'rd_station',
  externalId: cloneExternalId,
  status: 'contacted',
  name: 'Clone Histórico',
  email: 'clone@planet.test',
  notes: 'Contato já realizado pelo comercial.',
  history: [{
    id: 'history-human',
    type: 'updated',
    title: 'Lead atualizado no André OS',
    changes: ['status'],
    createdAt: '2026-08-12T10:00:00.000Z',
  }],
  createdAt: '2026-08-12T09:00:00.000Z',
  updatedAt: '2026-08-12T10:00:00.000Z',
});
await writeLead(store, {
  id: 'lead-clone-rd-mais-novo',
  source: 'rd_station',
  externalId: cloneExternalId,
  status: 'new',
  name: 'Clone Histórico Atualizado',
  email: 'clone@planet.test',
  city: 'Joinville',
  history: [{
    id: 'history-rd',
    type: 'created',
    title: 'Lead recebido do RD Station',
    changes: [],
    createdAt: '2026-08-12T10:01:00.000Z',
  }],
  createdAt: '2026-08-12T09:00:00.000Z',
  updatedAt: '2026-08-12T10:01:00.000Z',
});

const rawCloneKeys = [...store.data.keys()].filter((key) => (
  key === `${LEAD_STORAGE_PREFIX}lead-clone-trabalhado`
  || key === `${LEAD_STORAGE_PREFIX}lead-clone-rd-mais-novo`
));
assert.equal(rawCloneKeys.length, 2, 'os dois registros brutos continuam presentes para auditoria');

document = await readLeadDocument(store);
const logicalClones = document.data.filter((item) => item.externalId === cloneExternalId);
assert.equal(logicalClones.length, 1, 'a leitura deve colapsar clones históricos do mesmo source + externalId');
assert.equal(logicalClones[0].id, 'lead-clone-trabalhado',
  'registro que já recebeu ação humana deve permanecer como canônico');
assert.equal(logicalClones[0].status, 'contacted');
assert.equal(logicalClones[0].notes, 'Contato já realizado pelo comercial.');
assert.equal(logicalClones[0].name, 'Clone Histórico Atualizado',
  'campos externos mais recentes do RD devem continuar chegando ao canônico');
assert.equal(logicalClones[0].history.length, 2, 'históricos dos clones devem ser reunidos na leitura');

console.log('Planet leads storage v2: legado e clones históricos compatíveis sem perda de estado humano');
