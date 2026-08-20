import assert from 'node:assert/strict';
import { onRequestGet, onRequestPut } from '../functions/api/hub/demandas-internas.js';

const LEGACY_KEY = 'planet-hub:demandas-internas:v1';
const PREFIX = 'planet-hub:internal-demand:v2:';

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
    this.puts.push(key);
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

const makeDemand = (overrides = {}) => ({
  id: 'demand-a',
  title: 'Campanha institucional',
  description: 'Preparar campanha solicitada pela direção.',
  origin: 'direction',
  requestedBy: 'Diretoria',
  responsible: 'Marketing',
  priority: 'high',
  status: 'in_progress',
  dueDate: '2026-08-25',
  category: 'Campanha',
  notes: 'Preservar identidade visual.',
  steps: [
    { id: 'step-a1', text: 'Preparar briefing', done: false },
    { id: 'step-a2', text: 'Validar peças', done: false },
  ],
  originalText: 'Precisamos preparar a campanha institucional até o dia 25.',
  aiMode: 'ai',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
  completedAt: '',
  ...overrides,
});

const legacyA = makeDemand();
const legacyB = makeDemand({
  id: 'demand-b',
  title: 'Materiais de treinamento',
  description: 'Organizar materiais da universidade.',
  origin: 'meeting',
  requestedBy: 'Operações',
  responsible: 'Conteúdo',
  priority: 'normal',
  status: 'waiting',
  dueDate: '2026-08-28',
  category: 'Treinamento',
  notes: 'Aguardar conteúdo final.',
  steps: [{ id: 'step-b1', text: 'Receber arquivos', done: false }],
  originalText: 'Organizar materiais após a reunião.',
  aiMode: 'rules',
  createdAt: '2026-08-02T10:00:00.000Z',
  updatedAt: '2026-08-02T10:00:00.000Z',
});
const legacyDelete = makeDemand({
  id: 'demand-legacy-delete',
  title: 'Demanda legada removível',
  description: 'Existe apenas no documento v1.',
  origin: 'internal',
  requestedBy: 'Operação',
  responsible: 'Marketing',
  priority: 'low',
  status: 'new',
  dueDate: '2026-09-01',
  category: 'Operação',
  notes: 'Usada para validar tombstone.',
  steps: [{ id: 'step-c1', text: 'Etapa legada', done: false }],
  originalText: 'Excluir sem apagar fisicamente do legado.',
  aiMode: 'manual',
  createdAt: '2026-08-03T10:00:00.000Z',
  updatedAt: '2026-08-03T10:00:00.000Z',
});

const store = new MemoryKV();
const env = { PLANET_HUB_DATA: store };
const legacyDocument = {
  revision: 'legacy-revision-1',
  updatedAt: '2026-08-03T10:00:00.000Z',
  data: [legacyA, legacyB, legacyDelete],
};
const legacyRaw = JSON.stringify(legacyDocument);
store.map.set(LEGACY_KEY, legacyRaw);

const get = async () => {
  const response = await onRequestGet({ env });
  return { response, payload: await response.json() };
};

const put = async (data, baseRevision) => {
  const request = new Request('https://andre-os.test/api/hub/demandas-internas', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data, baseRevision }),
  });
  const response = await onRequestPut({ env, request });
  return { response, payload: await response.json() };
};

const initial = await get();
assert.equal(initial.response.status, 200);
assert.equal(initial.payload.storage, 'shared');
assert.ok(initial.payload.revision.startsWith('v2:'), 'GET deve expor revisão opaca compatível com o contrato atual.');
assert.equal(initial.payload.data.length, 3);
assert.ok(initial.payload.data.some((item) => item.id === legacyDelete.id), 'Item apenas no v1 deve continuar aparecendo.');
assert.equal(store.map.get(LEGACY_KEY), legacyRaw, 'Leitura não pode migrar nem reescrever o v1.');

const baseData = initial.payload.data;
const clientA = baseData.map((item) => item.id === legacyA.id
  ? {
      ...item,
      title: 'Campanha institucional atualizada',
      responsible: 'André',
      notes: 'Preservar identidade visual e aprovar com a diretoria.',
      steps: item.steps.map((step, index) => index === 0 ? { ...step, done: true } : step),
      updatedAt: '2026-08-11T20:20:00.000Z',
    }
  : item);
const clientB = baseData.map((item) => item.id === legacyB.id
  ? {
      ...item,
      status: 'completed',
      completedAt: '2026-08-11T20:21:00.000Z',
      steps: item.steps.map((step) => ({ ...step, done: true })),
      updatedAt: '2026-08-11T20:21:00.000Z',
    }
  : item);

store.resetPuts();
const [saveA, saveB] = await Promise.all([
  put(clientA, initial.payload.revision),
  put(clientB, initial.payload.revision),
]);
assert.equal(saveA.response.status, 200);
assert.equal(saveB.response.status, 200);
assert.deepEqual(
  [...store.puts].sort(),
  [`${PREFIX}${legacyA.id}`, `${PREFIX}${legacyB.id}`].sort(),
  'Duas alterações independentes devem escrever somente suas duas chaves v2.',
);
assert.equal(store.map.get(LEGACY_KEY), legacyRaw, 'Atualizações v2 não podem tocar no documento legado.');

const afterConcurrent = await get();
const savedA = afterConcurrent.payload.data.find((item) => item.id === legacyA.id);
const savedB = afterConcurrent.payload.data.find((item) => item.id === legacyB.id);
assert.equal(savedA.title, 'Campanha institucional atualizada');
assert.equal(savedA.description, legacyA.description);
assert.equal(savedA.origin, legacyA.origin);
assert.equal(savedA.requestedBy, legacyA.requestedBy);
assert.equal(savedA.responsible, 'André');
assert.equal(savedA.priority, legacyA.priority);
assert.equal(savedA.status, legacyA.status);
assert.equal(savedA.dueDate, legacyA.dueDate);
assert.equal(savedA.category, legacyA.category);
assert.equal(savedA.notes, 'Preservar identidade visual e aprovar com a diretoria.');
assert.equal(savedA.steps[0].done, true);
assert.equal(savedA.steps[1].done, false);
assert.equal(savedA.originalText, legacyA.originalText);
assert.equal(savedA.aiMode, legacyA.aiMode);
assert.equal(savedA.createdAt, legacyA.createdAt);
assert.equal(savedA.updatedAt, '2026-08-11T20:20:00.000Z');
assert.equal(savedA.completedAt, '');
assert.equal(savedB.status, 'completed');
assert.equal(savedB.completedAt, '2026-08-11T20:21:00.000Z');
assert.equal(savedB.steps[0].done, true);

const newDemand = makeDemand({
  id: 'demand-new',
  title: 'Nova demanda independente',
  description: 'Criada já no modelo v2.',
  origin: 'whatsapp',
  requestedBy: 'Franqueado',
  responsible: 'Marketing',
  priority: 'urgent',
  status: 'new',
  dueDate: '2026-08-18',
  category: 'Suporte',
  notes: 'Criar somente uma chave.',
  steps: [{ id: 'step-new', text: 'Responder solicitação', done: false }],
  originalText: 'Pedido recebido por WhatsApp.',
  aiMode: 'manual',
  createdAt: '2026-08-11T20:22:00.000Z',
  updatedAt: '2026-08-11T20:22:00.000Z',
});
store.resetPuts();
const created = await put([...afterConcurrent.payload.data, newDemand], afterConcurrent.payload.revision);
assert.equal(created.response.status, 200);
assert.deepEqual(store.puts, [`${PREFIX}${newDemand.id}`], 'Criação deve escrever somente a nova demanda.');
assert.equal(store.map.get(LEGACY_KEY), legacyRaw);

const beforeConflict = await get();
const conflictBase = beforeConflict.payload.data;
const conflictWinner = conflictBase.map((item) => item.id === legacyA.id
  ? { ...item, priority: 'urgent', updatedAt: '2026-08-11T20:23:00.000Z' }
  : item);
const conflictStale = conflictBase.map((item) => item.id === legacyA.id
  ? { ...item, responsible: 'Outra pessoa', updatedAt: '2026-08-11T20:24:00.000Z' }
  : item);
store.resetPuts();
const winner = await put(conflictWinner, beforeConflict.payload.revision);
assert.equal(winner.response.status, 200);
assert.deepEqual(store.puts, [`${PREFIX}${legacyA.id}`]);
const writesBeforeConflict = store.puts.length;
const stale = await put(conflictStale, beforeConflict.payload.revision);
assert.equal(stale.response.status, 409);
assert.equal(stale.payload.conflict, true);
assert.deepEqual(stale.payload.conflictIds, [legacyA.id]);
assert.equal(store.puts.length, writesBeforeConflict, 'Conflito sobre a mesma demanda não pode gerar escrita adicional.');

const beforeDelete = await get();
assert.ok(!store.map.has(`${PREFIX}${legacyDelete.id}`), 'Item a excluir deve existir somente no legado antes do tombstone.');
store.resetPuts();
const deletionData = beforeDelete.payload.data.filter((item) => item.id !== legacyDelete.id);
const deleted = await put(deletionData, beforeDelete.payload.revision);
assert.equal(deleted.response.status, 200);
assert.deepEqual(store.puts, [`${PREFIX}${legacyDelete.id}`]);
assert.equal(store.map.get(LEGACY_KEY), legacyRaw, 'Exclusão não pode remover fisicamente o item do v1.');
const tombstone = JSON.parse(store.map.get(`${PREFIX}${legacyDelete.id}`));
assert.equal(tombstone.id, legacyDelete.id);
assert.equal(tombstone.deleted, true);

const afterDelete = await get();
assert.ok(!afterDelete.payload.data.some((item) => item.id === legacyDelete.id), 'Tombstone v2 deve impedir ressurreição do item legado.');
assert.equal(store.map.get(LEGACY_KEY), legacyRaw);

console.log('Demandas internas backend v2: concorrência por item, criação, conflito, legado e tombstones validados.');
