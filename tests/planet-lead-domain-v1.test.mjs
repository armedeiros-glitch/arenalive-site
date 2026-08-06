import assert from 'node:assert/strict';
import {
  PLANET_LEADS_KEY,
  PLANET_LEAD_SOURCES,
  findPlanetLeadDuplicate,
  normalizePlanetLead,
  readPlanetLeadsDocument,
  writePlanetLeadsDocument,
} from '../functions/_lib/planet-leads.js';

assert.equal(PLANET_LEADS_KEY, 'planet-hub:planet-expansion-leads:v1');
assert.ok(PLANET_LEAD_SOURCES.has('rd_station'));
assert.ok(PLANET_LEAD_SOURCES.has('caca_lead'));
assert.ok(PLANET_LEAD_SOURCES.has('manual'));

const cacaLead = normalizePlanetLead({
  id: 'lead-caca-1',
  source: 'caca_lead',
  externalId: 'candidate-1',
  name: 'Candidato aprovado',
  phone: '(47) 99999-0000',
  status: 'new',
  createdAt: '2026-08-06T12:00:00.000Z',
  updatedAt: '2026-08-06T12:00:00.000Z',
});

assert.equal(cacaLead.source, 'caca_lead');
assert.equal(cacaLead.phone, '47999990000');
assert.equal(cacaLead.tenantId, 'planet');

const rdLead = normalizePlanetLead({
  id: 'lead-rd-1',
  source: 'rd_station',
  externalId: 'rd-1',
  name: 'Contato RD',
  email: 'CONTATO@EXEMPLO.COM',
  status: 'new',
});

assert.equal(rdLead.email, 'contato@exemplo.com');
assert.equal(findPlanetLeadDuplicate([cacaLead], {
  source: 'rd_station',
  externalId: 'outro-id',
  phone: cacaLead.phone,
  email: '',
}, { source: 'rd_station' })?.id, cacaLead.id, 'Telefone deve impedir duplicidade entre portas de entrada.');

const memory = new Map();
const store = {
  async get(key, options) {
    const value = memory.get(key);
    if (value == null) return null;
    return options?.type === 'json' ? JSON.parse(value) : value;
  },
  async put(key, value) {
    memory.set(key, value);
  },
};

await writePlanetLeadsDocument(store, [cacaLead, rdLead]);
const document = await readPlanetLeadsDocument(store);

assert.equal(document.data.length, 2);
assert.equal(document.data[0].source, 'caca_lead', 'Leitura e escrita devem preservar a origem do Caça Lead.');
assert.equal(document.data[1].source, 'rd_station');
assert.ok(document.revision);
assert.ok(document.updatedAt);

const forcedRd = normalizePlanetLead(cacaLead, { forceSource: 'rd_station', suggestWhatsappMessage: true });
assert.equal(forcedRd.source, 'rd_station');
assert.match(forcedRd.whatsappMessage, /Planet Chocolate/);

console.log('Domínio compartilhado de leads validado.');
