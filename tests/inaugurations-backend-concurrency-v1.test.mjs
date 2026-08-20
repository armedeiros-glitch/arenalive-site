import assert from 'node:assert/strict';
import { onRequestGet, onRequestPut } from '../functions/api/hub/inauguracoes.js';

class MemoryKV {
  constructor() { this.map = new Map(); }
  async get(key, options = {}) {
    const value = this.map.get(key);
    if (value == null) return null;
    return options?.type === 'json' ? JSON.parse(value) : value;
  }
  async put(key, value) { this.map.set(key, String(value)); }
  async list({ prefix = '', cursor = undefined, limit = 1000 } = {}) {
    const names = [...this.map.keys()].filter((key) => key.startsWith(prefix)).sort().slice(0, limit);
    return { keys: names.map((name) => ({ name })), list_complete: true, cursor };
  }
}

const legacyKey = 'planet-hub:inauguracoes:v1';
const v2Key = (id) => `planet-hub:inauguration:v2:${id}`;

const makeInauguration = (id, overrides = {}) => ({
  id,
  sourceProjectId: `sults-${id}`,
  unit: `Planet ${id}`,
  openingDate: '2026-08-20',
  responsible: 'Equipe Marketing',
  location: 'Joinville/SC',
  createdAt: '2026-08-01T12:00:00.000Z',
  updatedAt: '2026-08-01T12:00:00.000Z',
  packageBudget: 5000,
  actionsVersion: 2,
  checklist: [
    { action: 'Enviar materiais', owner: 'Marketing', daysBefore: 10, done: false },
    { action: 'Aprovar arte', owner: 'Marketing', daysBefore: 7, done: false },
  ],
  inauguralActions: [
    {
      id: 'influenciadores',
      name: 'Influenciadores locais',
      description: 'Criadores regionais',
      owner: 'Franqueadora + unidade',
      timing: 'D-10 a D0',
      plannedAmount: 2000,
      actualAmount: 0,
      costType: 'package',
      included: true,
      done: false,
      quantity: 2,
      notes: '',
    },
  ],
  ...overrides,
});

const store = new MemoryKV();
const env = { PLANET_HUB_DATA: store };
const legacyA = makeInauguration('inauguration-a');
const legacyB = makeInauguration('inauguration-b', { packageBudget: 4700 });
const legacyDelete = makeInauguration('inauguration-legado');

const legacyDocument = {
  revision: 'legacy-revision-must-stay',
  updatedAt: '2026-08-01T12:00:00.000Z',
  data: [legacyA, legacyB, legacyDelete],
};
store.map.set(legacyKey, JSON.stringify(legacyDocument));
const originalLegacyRaw = store.map.get(legacyKey);

const get = async () => {
  const response = await onRequestGet({ env });
  return { response, payload: await response.json() };
};

const put = async (body) => {
  const request = new Request('https://andre-os.test/api/hub/inauguracoes', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const response = await onRequestPut({ env, request });
  return { response, payload: await response.json() };
};

const initial = await get();
assert.equal(initial.response.status, 200);
assert.equal(initial.payload.storage, 'shared');
assert.match(initial.payload.revision, /^v2:/);
assert.deepEqual(initial.payload.data.map((item) => item.id).sort(), [
  'inauguration-a', 'inauguration-b', 'inauguration-legado',
]);
assert.equal(store.map.get(legacyKey), originalLegacyRaw, 'GET não pode migrar nem regravar o documento v1.');

const byId = new Map(initial.payload.data.map((item) => [item.id, item]));
const updateA = {
  ...byId.get('inauguration-a'),
  packageBudget: 5500,
  updatedAt: '2026-08-11T20:10:00.000Z',
  checklist: byId.get('inauguration-a').checklist.map((item, index) => index === 0 ? { ...item, done: true } : item),
  inauguralActions: byId.get('inauguration-a').inauguralActions.map((item) => ({
    ...item,
    actualAmount: 900,
    done: true,
    notes: 'Fornecedor A',
  })),
};
const updateB = {
  ...byId.get('inauguration-b'),
  packageBudget: 5100,
  updatedAt: '2026-08-11T20:10:01.000Z',
  inauguralActions: byId.get('inauguration-b').inauguralActions.map((item) => ({
    ...item,
    plannedAmount: 1800,
    quantity: 3,
  })),
};

const payloadA = initial.payload.data.map((item) => item.id === updateA.id ? updateA : item);
const payloadB = initial.payload.data.map((item) => item.id === updateB.id ? updateB : item);

const [writeA, writeB] = await Promise.all([
  put({ data: payloadA, baseRevision: initial.payload.revision }),
  put({ data: payloadB, baseRevision: initial.payload.revision }),
]);
assert.equal(writeA.response.status, 200);
assert.equal(writeB.response.status, 200);
assert.ok(store.map.has(v2Key('inauguration-a')), 'edição de A deve gravar somente a chave v2 de A');
assert.ok(store.map.has(v2Key('inauguration-b')), 'edição de B deve gravar somente a chave v2 de B');
assert.equal(store.map.has(v2Key('inauguration-legado')), false, 'item legado inalterado não deve ser migrado automaticamente');
assert.equal(store.map.get(legacyKey), originalLegacyRaw, 'atualizações v2 não podem alterar o documento v1.');

const afterConcurrent = await get();
assert.equal(afterConcurrent.response.status, 200);
const concurrentById = new Map(afterConcurrent.payload.data.map((item) => [item.id, item]));
assert.equal(concurrentById.get('inauguration-a').packageBudget, 5500);
assert.equal(concurrentById.get('inauguration-a').checklist[0].done, true);
assert.equal(concurrentById.get('inauguration-a').inauguralActions[0].actualAmount, 900);
assert.equal(concurrentById.get('inauguration-a').inauguralActions[0].done, true);
assert.equal(concurrentById.get('inauguration-a').inauguralActions[0].notes, 'Fornecedor A');
assert.equal(concurrentById.get('inauguration-b').packageBudget, 5100);
assert.equal(concurrentById.get('inauguration-b').inauguralActions[0].plannedAmount, 1800);
assert.equal(concurrentById.get('inauguration-b').inauguralActions[0].quantity, 3);

const beforeCreateKeys = new Set(store.map.keys());
const created = makeInauguration('inauguration-nova', {
  unit: 'Planet Nova',
  createdAt: '2026-08-11T20:11:00.000Z',
  updatedAt: '2026-08-11T20:11:00.000Z',
  packageBudget: 6200,
});
const createResult = await put({
  data: [...afterConcurrent.payload.data, created],
  baseRevision: afterConcurrent.payload.revision,
});
assert.equal(createResult.response.status, 200);
assert.ok(store.map.has(v2Key(created.id)), 'criação deve gravar a chave do novo projeto');
const changedKeysOnCreate = [...store.map.keys()].filter((key) => !beforeCreateKeys.has(key));
assert.deepEqual(changedKeysOnCreate, [v2Key(created.id)], 'criação não deve regravar outras inaugurações');

const beforeDelete = await get();
const withoutLegacy = beforeDelete.payload.data.filter((item) => item.id !== legacyDelete.id);
const deleteResult = await put({ data: withoutLegacy, baseRevision: beforeDelete.payload.revision });
assert.equal(deleteResult.response.status, 200);
const tombstone = JSON.parse(store.map.get(v2Key(legacyDelete.id)));
assert.equal(tombstone.id, legacyDelete.id);
assert.equal(tombstone.deleted, true, 'exclusão de item legado deve criar tombstone v2');
assert.equal(store.map.get(legacyKey), originalLegacyRaw, 'exclusão não pode remover nem reescrever o legado v1');

const afterDelete = await get();
assert.equal(afterDelete.payload.data.some((item) => item.id === legacyDelete.id), false, 'tombstone deve impedir ressurreição pelo v1');

const rawLegacyAfterEverything = JSON.parse(store.map.get(legacyKey));
assert.equal(rawLegacyAfterEverything.data.some((item) => item.id === legacyDelete.id), true, 'o legado permanece fisicamente intacto');

const invalid = await put({ data: 'não-é-lista', baseRevision: afterDelete.payload.revision });
assert.equal(invalid.response.status, 400);
assert.equal(store.map.get(legacyKey), originalLegacyRaw);

console.log('Inaugurações backend v2: concorrência por projeto, criação, legado e tombstones validados.');
