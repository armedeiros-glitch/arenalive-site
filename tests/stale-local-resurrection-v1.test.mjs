import assert from 'node:assert/strict';

import {
  onRequestGet as getContents,
  onRequestPut as putContents,
} from '../functions/api/hub/conteudos.js';
import {
  onRequestGet as getDemands,
  onRequestPut as putDemands,
} from '../functions/api/hub/demandas-internas.js';
import {
  onRequestGet as getInaugurations,
  onRequestPut as putInaugurations,
} from '../functions/api/hub/inauguracoes.js';

class MemoryKV {
  constructor() {
    this.map = new Map();
    this.puts = [];
  }

  async get(key, options = {}) {
    const value = this.map.get(key);
    if (value == null) return null;
    return options?.type === 'json' ? JSON.parse(value) : value;
  }

  async put(key, value) {
    this.puts.push({ key, value: String(value) });
    this.map.set(key, String(value));
  }

  async list({ prefix = '', cursor = undefined, limit = 1000 } = {}) {
    const keys = [...this.map.keys()]
      .filter((key) => key.startsWith(prefix))
      .sort()
      .slice(0, limit)
      .map((name) => ({ name }));
    return { keys, list_complete: true, cursor };
  }

  resetPuts() {
    this.puts = [];
  }
}

const cases = [
  {
    name: 'Central Planet',
    get: getContents,
    put: putContents,
    prefix: 'planet-hub:content:v2:',
    item: {
      id: 'ghost-content',
      title: 'Conteúdo fantasma',
      updatedAt: '2026-08-28T18:40:00.000Z',
    },
  },
  {
    name: 'Demandas internas',
    get: getDemands,
    put: putDemands,
    prefix: 'planet-hub:internal-demand:v2:',
    item: {
      id: 'ghost-demand',
      title: 'Demanda fantasma',
      updatedAt: '2026-08-28T18:40:00.000Z',
    },
  },
  {
    name: 'Inaugurações',
    get: getInaugurations,
    put: putInaugurations,
    prefix: 'planet-hub:inauguration:v2:',
    item: {
      id: 'ghost-inauguration',
      unit: 'Unidade fantasma',
      updatedAt: '2026-08-28T18:40:00.000Z',
    },
  },
];

const getDocument = async (handler, env, path) => {
  const response = await handler({ env, request: new Request(`https://andre-os.test${path}`) });
  return { response, payload: await response.json() };
};

const putDocument = async (handler, env, path, data, baseRevision) => {
  const request = new Request(`https://andre-os.test${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, baseRevision }),
  });
  const response = await handler({ env, request });
  return { response, payload: await response.json() };
};

for (const testCase of cases) {
  const store = new MemoryKV();
  const env = { PLANET_HUB_DATA: store };
  const path = `/api/hub/${testCase.item.id}`;
  const key = `${testCase.prefix}${testCase.item.id}`;

  const initial = await getDocument(testCase.get, env, path);
  assert.equal(initial.response.status, 200, `${testCase.name}: GET inicial deve funcionar`);
  assert.deepEqual(initial.payload.data, []);
  assert.equal('tombstonedIds' in initial.payload, false,
    `${testCase.name}: detalhe interno de tombstone não pode vazar no contrato público`);

  const created = await putDocument(testCase.put, env, path, [testCase.item], initial.payload.revision);
  assert.equal(created.response.status, 200, `${testCase.name}: criação deve funcionar`);
  assert.ok(created.payload.data.some((item) => item.id === testCase.item.id),
    `${testCase.name}: item criado deve ficar visível`);

  const deleted = await putDocument(testCase.put, env, path, [], created.payload.revision);
  assert.equal(deleted.response.status, 200, `${testCase.name}: exclusão deve funcionar`);
  assert.equal(deleted.payload.data.some((item) => item.id === testCase.item.id), false);
  const tombstone = JSON.parse(store.map.get(key));
  assert.equal(tombstone.deleted, true, `${testCase.name}: exclusão deve persistir tombstone`);

  const afterDelete = await getDocument(testCase.get, env, path);
  assert.equal(afterDelete.response.status, 200);
  assert.equal(afterDelete.payload.data.some((item) => item.id === testCase.item.id), false);
  assert.equal('tombstonedIds' in afterDelete.payload, false);

  store.resetPuts();
  const staleBrowser = await putDocument(
    testCase.put,
    env,
    path,
    [testCase.item],
    afterDelete.payload.revision,
  );

  assert.equal(staleBrowser.response.status, 200,
    `${testCase.name}: cliente stale deve ser curado sem entrar em loop de conflito`);
  assert.equal(staleBrowser.payload.data.some((item) => item.id === testCase.item.id), false,
    `${testCase.name}: cliente stale não pode ressuscitar item excluído`);
  assert.deepEqual(store.puts, [],
    `${testCase.name}: tentativa stale não pode regravar nem substituir o tombstone`);
  assert.equal(JSON.parse(store.map.get(key)).deleted, true,
    `${testCase.name}: tombstone deve permanecer autoritativo após tentativa stale`);
}

console.log('Persistência compartilhada: clientes stale não ressuscitam conteúdos, demandas ou inaugurações excluídas.');
