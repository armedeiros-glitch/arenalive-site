import assert from 'node:assert/strict';
import { onRequestGet, onRequestPut } from '../functions/api/hub/conteudos.js';

const LEGACY_KEY = 'planet-hub:conteudos:v1';
const PREFIX = 'planet-hub:content:v2:';

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

const makeContent = (overrides = {}) => ({
  id: 'content-a',
  title: 'Campanha institucional',
  description: 'Material principal da campanha institucional.',
  category: 'Campanha',
  format: 'Carrossel',
  status: 'producao',
  campaign: 'Institucional Agosto',
  unit: 'Todas as unidades',
  responsible: 'Marketing',
  url: 'https://example.com/material-a',
  tags: ['institucional', 'agosto'],
  notes: 'Manter identidade visual oficial.',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
  ...overrides,
});

const legacyA = makeContent();
const legacyB = makeContent({
  id: 'content-b',
  title: 'Treinamento operacional',
  description: 'Material da Universidade Planet.',
  category: 'Treinamento',
  format: 'Vídeo',
  status: 'aprovacao',
  campaign: 'Universidade Planet',
  unit: 'Franqueados',
  responsible: 'Conteúdo',
  url: 'https://example.com/material-b',
  tags: ['universidade', 'treinamento'],
  notes: 'Aguardando aprovação final.',
  createdAt: '2026-08-02T10:00:00.000Z',
  updatedAt: '2026-08-02T10:00:00.000Z',
});
const legacyDelete = makeContent({
  id: 'content-legacy-delete',
  title: 'Material legado removível',
  description: 'Existe somente no documento v1.',
  category: 'Arquivo',
  format: 'PDF',
  status: 'arquivado',
  campaign: 'Legado',
  unit: 'Interno',
  responsible: 'Marketing',
  url: 'https://example.com/legacy',
  tags: ['legado'],
  notes: 'Validar tombstone sem alterar v1.',
  createdAt: '2026-08-03T10:00:00.000Z',
  updatedAt: '2026-08-03T10:00:00.000Z',
});

const store = new MemoryKV();
const env = { PLANET_HUB_DATA: store };
const legacyDocument = {
  revision: 'legacy-content-revision-1',
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
  const request = new Request('https://andre-os.test/api/hub/conteudos', {
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
assert.ok(initial.payload.revision.startsWith('v2:'), 'GET deve manter revision no contrato externo.');
assert.equal(initial.payload.data.length, 3);
assert.ok(initial.payload.data.some((item) => item.id === legacyDelete.id), 'Conteúdo somente no v1 deve continuar visível.');
assert.equal(store.map.get(LEGACY_KEY), legacyRaw, 'GET não pode migrar nem reescrever o legado.');
assert.deepEqual(store.puts, [], 'GET não pode provocar escrita automática.');

const baseData = initial.payload.data;
const clientA = baseData.map((item) => item.id === legacyA.id
  ? {
      ...item,
      title: 'Campanha institucional atualizada',
      description: 'Material principal revisado pela diretoria.',
      status: 'aprovacao',
      responsible: 'André',
      url: 'https://example.com/material-a-v2',
      tags: ['institucional', 'agosto', 'diretoria'],
      notes: 'Aprovado para rodada final.',
      updatedAt: '2026-08-11T20:30:00.000Z',
    }
  : item);
const clientB = baseData.map((item) => item.id === legacyB.id
  ? {
      ...item,
      status: 'publicado',
      campaign: 'Universidade Planet 2026',
      unit: 'Franqueados e colaboradores',
      notes: 'Publicado na universidade.',
      updatedAt: '2026-08-11T20:31:00.000Z',
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
  'Duas alterações independentes devem escrever somente suas próprias chaves v2.',
);
assert.equal(store.map.get(LEGACY_KEY), legacyRaw, 'Edição não pode tocar no documento legado.');

const afterConcurrent = await get();
const savedA = afterConcurrent.payload.data.find((item) => item.id === legacyA.id);
const savedB = afterConcurrent.payload.data.find((item) => item.id === legacyB.id);
assert.equal(savedA.id, legacyA.id);
assert.equal(savedA.title, 'Campanha institucional atualizada');
assert.equal(savedA.description, 'Material principal revisado pela diretoria.');
assert.equal(savedA.category, legacyA.category);
assert.equal(savedA.format, legacyA.format);
assert.equal(savedA.status, 'aprovacao');
assert.equal(savedA.campaign, legacyA.campaign);
assert.equal(savedA.unit, legacyA.unit);
assert.equal(savedA.responsible, 'André');
assert.equal(savedA.url, 'https://example.com/material-a-v2');
assert.deepEqual(savedA.tags, ['institucional', 'agosto', 'diretoria']);
assert.equal(savedA.notes, 'Aprovado para rodada final.');
assert.equal(savedA.createdAt, legacyA.createdAt);
assert.equal(savedA.updatedAt, '2026-08-11T20:30:00.000Z');
assert.equal(savedB.status, 'publicado');
assert.equal(savedB.campaign, 'Universidade Planet 2026');
assert.equal(savedB.unit, 'Franqueados e colaboradores');
assert.equal(store.map.get(LEGACY_KEY), legacyRaw);

const newContent = makeContent({
  id: 'content-new',
  title: 'Novo material independente',
  description: 'Criado diretamente no armazenamento v2.',
  category: 'Social',
  format: 'Stories',
  status: 'status-invalido',
  campaign: 'Lançamento',
  unit: 'Mueller',
  responsible: 'Marketing',
  url: 'javascript:alert(1)',
  tags: [' lançamento ', 'social', 'social', '', ...Array.from({ length: 25 }, (_, index) => `tag-${index}`)],
  notes: 'Validar sanitização na criação.',
  createdAt: '2026-08-11T20:32:00.000Z',
  updatedAt: '2026-08-11T20:32:00.000Z',
});
store.resetPuts();
const created = await put([...afterConcurrent.payload.data, newContent], afterConcurrent.payload.revision);
assert.equal(created.response.status, 200);
assert.deepEqual(store.puts, [`${PREFIX}${newContent.id}`], 'Criação deve escrever somente a nova chave v2.');
assert.equal(store.map.get(LEGACY_KEY), legacyRaw);
const createdItem = created.payload.data.find((item) => item.id === newContent.id);
assert.equal(createdItem.status, 'planejamento', 'Status inválido deve manter fallback atual.');
assert.equal(createdItem.url, '', 'URL fora de http/https deve continuar sendo removida.');
assert.equal(createdItem.tags[0], 'lançamento');
assert.equal(new Set(createdItem.tags).size, createdItem.tags.length, 'Tags devem continuar deduplicadas.');
assert.equal(createdItem.tags.length, 20, 'Tags devem continuar limitadas a 20 itens.');

const beforeConflict = await get();
const conflictBase = beforeConflict.payload.data;
const conflictWinner = conflictBase.map((item) => item.id === legacyA.id
  ? { ...item, status: 'publicado', updatedAt: '2026-08-11T20:33:00.000Z' }
  : item);
const conflictStale = conflictBase.map((item) => item.id === legacyA.id
  ? { ...item, responsible: 'Outra pessoa', updatedAt: '2026-08-11T20:34:00.000Z' }
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
assert.equal(store.puts.length, writesBeforeConflict, 'Conflito do mesmo conteúdo não pode escrever no KV.');
assert.equal(store.map.get(LEGACY_KEY), legacyRaw);

const beforeDelete = await get();
assert.ok(!store.map.has(`${PREFIX}${legacyDelete.id}`), 'Item removido deve existir somente no legado antes do tombstone.');
store.resetPuts();
const deletionData = beforeDelete.payload.data.filter((item) => item.id !== legacyDelete.id);
const deleted = await put(deletionData, beforeDelete.payload.revision);
assert.equal(deleted.response.status, 200);
assert.deepEqual(store.puts, [`${PREFIX}${legacyDelete.id}`], 'Exclusão deve escrever somente o tombstone do item removido.');
assert.equal(store.map.get(LEGACY_KEY), legacyRaw, 'Exclusão não pode apagar nem reescrever o documento v1.');
const tombstone = JSON.parse(store.map.get(`${PREFIX}${legacyDelete.id}`));
assert.equal(tombstone.id, legacyDelete.id);
assert.equal(tombstone.deleted, true);

const afterDelete = await get();
assert.ok(!afterDelete.payload.data.some((item) => item.id === legacyDelete.id), 'Tombstone v2 deve impedir ressurreição do conteúdo legado.');
assert.equal(store.map.get(LEGACY_KEY), legacyRaw, 'Legado deve permanecer byte a byte intacto após todo o ciclo.');

console.log('Central Planet conteúdos v2: concorrência por item, criação, conflito, sanitização, legado e tombstones validados.');
