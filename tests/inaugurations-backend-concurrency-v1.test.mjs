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
}

const store = new MemoryKV();
const env = { PLANET_HUB_DATA: store };

const inauguration = {
  id: 'inauguration-1',
  sourceProjectId: 'sults-project-10',
  unit: 'Planet Teste',
  openingDate: '2026-08-20',
  responsible: 'Equipe Marketing',
  location: 'Joinville/SC',
  packageBudget: 5000,
  actionsVersion: 1,
  checklist: [
    { action: 'Enviar materiais', owner: 'Marketing', daysBefore: 10, done: false },
  ],
  inauguralActions: [
    {
      id: 'action-1',
      name: 'Influenciador',
      owner: 'Marketing',
      plannedAmount: 1000,
      actualAmount: 0,
      costType: 'package',
      included: true,
      done: false,
      quantity: 1,
    },
  ],
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

const first = await put({ data: [inauguration], baseRevision: null });
assert.equal(first.response.status, 200);
assert.ok(first.payload.revision);
assert.equal(first.payload.data[0].packageBudget, 5000);

const secondDocument = {
  ...inauguration,
  packageBudget: 5500,
  checklist: [{ ...inauguration.checklist[0], done: true }],
  inauguralActions: [{ ...inauguration.inauguralActions[0], actualAmount: 900, done: true }],
};
const second = await put({ data: [secondDocument], baseRevision: first.payload.revision });
assert.equal(second.response.status, 200);
assert.notEqual(second.payload.revision, first.payload.revision);

const rawWinner = store.map.get('planet-hub:inauguracoes:v1');
const stale = await put({
  data: [{ ...inauguration, packageBudget: 4100 }],
  baseRevision: first.payload.revision,
});
assert.equal(stale.response.status, 409);
assert.equal(stale.payload.conflict, true);
assert.equal(stale.payload.revision, second.payload.revision);
assert.equal(stale.payload.data[0].packageBudget, 5500);
assert.equal(stale.payload.data[0].checklist[0].done, true);
assert.equal(stale.payload.data[0].inauguralActions[0].actualAmount, 900);
assert.equal(store.map.get('planet-hub:inauguracoes:v1'), rawWinner, 'Conflito não pode sobrescrever a inauguração vencedora.');

const invalid = await put({ data: 'não-é-lista', baseRevision: second.payload.revision });
assert.equal(invalid.response.status, 400);
assert.equal(store.map.get('planet-hub:inauguracoes:v1'), rawWinner, 'Payload inválido não pode alterar o KV.');

const getResponse = await onRequestGet({ env });
assert.equal(getResponse.status, 200);
const document = await getResponse.json();
assert.equal(document.storage, 'shared');
assert.equal(document.revision, second.payload.revision);
assert.equal(document.data[0].packageBudget, 5500);
assert.equal(document.data[0].checklist[0].done, true);
assert.equal(document.data[0].inauguralActions[0].done, true);

console.log('Inaugurações backend: concorrência e persistência validadas.');
