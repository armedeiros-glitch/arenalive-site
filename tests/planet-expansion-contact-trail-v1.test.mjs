import assert from 'node:assert/strict';
import fs from 'node:fs';

import { onRequestPut } from '../functions/api/hub/planet/leads.js';
import { leadStorageKey, normalizeLead } from '../functions/_lib/planet-leads.js';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const trailSource = read('planet-hub/assets/planet-expansion-contact-trail-v1.js');
const hubAccess = read('planet-hub/assets/hub-access-v1.js');

const makeStore = (leads) => {
  const values = new Map(leads.map((lead) => [leadStorageKey(lead.id), JSON.stringify(normalizeLead(lead))]));
  return {
    async get(key, options = {}) {
      const value = values.get(key);
      if (value == null) return null;
      return options?.type === 'json' ? JSON.parse(value) : value;
    },
    async put(key, value) {
      values.set(key, String(value));
    },
    async list({ prefix = '' } = {}) {
      return {
        keys: [...values.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })),
        list_complete: true,
      };
    },
  };
};

const update = async (store, id, changes) => {
  const response = await onRequestPut({
    env: { PLANET_HUB_DATA: store },
    request: new Request('https://andre-os.test/api/hub/planet/leads', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, changes }),
    }),
  });
  assert.equal(response.status, 200);
  return response.json();
};

const store = makeStore([
  { id: 'lead-new', name: 'Novo', email: 'novo@example.com', status: 'new', source: 'manual', createdAt: '2026-08-28T12:00:00.000Z' },
  { id: 'lead-qualified', name: 'Qualificado', email: 'q@example.com', status: 'qualified', source: 'manual', createdAt: '2026-08-28T11:00:00.000Z' },
  { id: 'lead-discarded', name: 'Descartado', email: 'd@example.com', status: 'discarded', source: 'manual', createdAt: '2026-08-28T10:00:00.000Z' },
]);

const contactAt = '2026-08-28T16:30:00.000Z';
const fresh = await update(store, 'lead-new', { status: 'contacted', lastActionAt: contactAt });
assert.equal(fresh.lead.status, 'contacted', 'lead novo deve avançar para contatado');
assert.equal(fresh.lead.lastActionAt, contactAt, 'contato deve registrar a última ação');

const qualified = await update(store, 'lead-qualified', { status: 'contacted', lastActionAt: contactAt });
assert.equal(qualified.lead.status, 'qualified', 'contato não pode rebaixar lead qualificado');
assert.equal(qualified.lead.lastActionAt, contactAt, 'novo contato em lead qualificado ainda deve atualizar a última ação');

const discarded = await update(store, 'lead-discarded', { status: 'contacted', lastActionAt: contactAt });
assert.equal(discarded.lead.status, 'discarded', 'contato não pode reabrir lead descartado silenciosamente');
assert.equal(discarded.lead.lastActionAt, contactAt, 'tentativa de contato deve permanecer auditável sem reabrir o lead');

assert.match(trailSource, /\[data-lead-email\]/, 'clique no e-mail deve ser observado');
assert.match(trailSource, /status: 'contacted', lastActionAt/, 'e-mail deve registrar contato e timestamp');
assert.match(trailSource, /keepalive: true/, 'registro não deve depender da permanência na página ao abrir o cliente de e-mail');
assert.doesNotMatch(trailSource, /preventDefault\(/, 'a trilha não pode bloquear o mailto');
assert.match(trailSource, /notifications\.updated/, 'após registrar, a Expansão deve recarregar a base pelo barramento existente');
assert.match(hubAccess, /planet-expansion-v1\.js\?v=20260828-2[\s\S]*planet-expansion-contact-trail-v1\.js\?v=20260828-1/,
  'trilha deve carregar logo após o owner principal da Expansão');

console.log('Expansão: contato por e-mail, lastActionAt e proteção contra regressão de status validados.');
