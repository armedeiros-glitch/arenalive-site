import assert from 'node:assert/strict';
import {
  onRequestDelete,
  onRequestGet,
  onRequestPost,
} from '../functions/api/hub/chamados-ignorados.js';

const LEGACY_KEY = 'planet-hub:chamados-ignorados:v1';
const V2_PREFIX = 'planet-hub:chamado-ignorado:v2:';

class FakeKV {
  constructor(seed = {}) {
    this.values = new Map(Object.entries(seed));
  }

  async get(key, options = {}) {
    await new Promise((resolve) => setTimeout(resolve, 1));
    const raw = this.values.get(key);
    if (raw == null) return null;
    return options?.type === 'json' ? JSON.parse(raw) : raw;
  }

  async put(key, value) {
    await new Promise((resolve) => setTimeout(resolve, key.endsWith('101') ? 6 : 2));
    this.values.set(key, value);
  }

  async list({ prefix = '', cursor } = {}) {
    const keys = [...this.values.keys()]
      .filter((key) => key.startsWith(prefix))
      .sort()
      .map((name) => ({ name }));
    return { keys, list_complete: true, cursor };
  }
}

const legacy = {
  revision: 'legacy-r1',
  updatedAt: '2026-08-10T12:00:00.000Z',
  data: [{
    id: '90',
    title: 'Chamado legado',
    unit: 'Unidade antiga',
    ignoredAt: '2026-08-10T12:00:00.000Z',
  }],
};

const store = new FakeKV({ [LEGACY_KEY]: JSON.stringify(legacy) });
const env = { PLANET_HUB_DATA: store };

const post = (body) => onRequestPost({
  env,
  request: new Request('https://example.test/api/hub/chamados-ignorados', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }),
});

const remove = (id) => onRequestDelete({
  env,
  request: new Request('https://example.test/api/hub/chamados-ignorados', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  }),
});

const [first, second] = await Promise.all([
  post({ id: '101', title: 'Primeiro chamado', unit: 'A' }),
  post({ id: '102', title: 'Segundo chamado', unit: 'B' }),
]);

assert.equal(first.status, 200);
assert.equal(second.status, 200);
assert.ok(store.values.has(`${V2_PREFIX}101`), 'o primeiro ignore deve ter chave própria');
assert.ok(store.values.has(`${V2_PREFIX}102`), 'o segundo ignore deve ter chave própria');
assert.equal(
  store.values.get(LEGACY_KEY),
  JSON.stringify(legacy),
  'a migração v2 não deve regravar destrutivamente o documento legado',
);

const afterConcurrent = await onRequestGet({ env });
assert.equal(afterConcurrent.status, 200);
const concurrentPayload = await afterConcurrent.json();
assert.equal(concurrentPayload.revision, 'per-ticket-v2');
assert.deepEqual(
  new Set(concurrentPayload.data.map((item) => item.id)),
  new Set(['90', '101', '102']),
  'dois ignores simultâneos e o item legado devem sobreviver juntos',
);

const restored = await remove('90');
assert.equal(restored.status, 200);
assert.ok(store.values.has(`${V2_PREFIX}90`), 'restaurar item legado deve gravar tombstone v2');

const afterRestore = await onRequestGet({ env });
const restoredPayload = await afterRestore.json();
assert.equal(
  restoredPayload.data.some((item) => item.id === '90'),
  false,
  'tombstone v2 deve impedir que chamado restaurado reapareça pelo documento legado',
);
assert.deepEqual(
  new Set(restoredPayload.data.map((item) => item.id)),
  new Set(['101', '102']),
);

console.log('Chamados ignorados v2: concorrência e compatibilidade legada validadas.');
