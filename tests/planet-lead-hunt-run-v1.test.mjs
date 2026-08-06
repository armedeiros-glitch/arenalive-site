import assert from 'node:assert/strict';
import { readCandidateDocument } from '../functions/_lib/planet-lead-candidates.js';
import {
  getLeadHuntStatus,
  runLeadHunt,
} from '../functions/_lib/planet-lead-hunt.js';

class MemoryKV {
  constructor() { this.values = new Map(); }
  async get(key, options = {}) {
    const value = this.values.get(key);
    if (value == null) return null;
    return options?.type === 'json' ? JSON.parse(value) : value;
  }
  async put(key, value) { this.values.set(key, String(value)); }
}

const store = new MemoryKV();
let requests = 0;
const fetchImpl = async (_url, options) => {
  requests += 1;
  const body = new URLSearchParams(options.body);
  assert.match(body.get('data'), /around:24000,-26\.304500,-48\.848700/);
  return new Response(JSON.stringify({
    elements: [{
      type: 'node',
      id: 987654,
      tags: {
        name: 'Operação Exemplo',
        amenity: 'cafe',
        phone: '(47) 99999-0000',
        website: 'https://operacao.example/',
        'addr:city': 'Joinville',
        'addr:state': 'SC',
      },
    }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const env = {
  PLANET_LEAD_HUNT_LOCATIONS: 'Joinville|SC|-26.3045|-48.8487|24000',
  PLANET_LEAD_HUNT_SEGMENTS: 'cafeteria,sorveteria',
  PLANET_LEAD_HUNT_MAX_RESULTS: '40',
};

const first = await runLeadHunt({
  store,
  env,
  options: { trigger: 'test' },
  fetchImpl,
});

assert.equal(requests, 1);
assert.equal(first.run.provider, 'openstreetmap_overpass');
assert.equal(first.run.status, 'completed');
assert.equal(first.run.queriesPlanned, 1);
assert.equal(first.run.queriesCompleted, 1);
assert.equal(first.run.placesFound, 1);
assert.equal(first.run.uniqueCandidatesFound, 1);
assert.equal(first.report.candidatesCreated, 1);
assert.equal(first.report.duplicates, 0);

const candidatesAfterFirstRun = await readCandidateDocument(store);
assert.equal(candidatesAfterFirstRun.data.length, 1);
assert.equal(candidatesAfterFirstRun.data[0].source, 'openstreetmap');
assert.equal(candidatesAfterFirstRun.data[0].sourceRecordId, 'node/987654');
assert.equal(candidatesAfterFirstRun.data[0].reviewStatus, 'pending');
assert.equal(candidatesAfterFirstRun.data[0].promotedLeadId, '');
assert.ok(candidatesAfterFirstRun.data[0].planetFitScore > 25);
assert.ok(candidatesAfterFirstRun.data[0].scoreReasons.some((item) => /cafeteria/i.test(item)));

const second = await runLeadHunt({
  store,
  env,
  options: { trigger: 'test-repeat' },
  fetchImpl,
});
assert.equal(requests, 2);
assert.equal(second.report.candidatesCreated, 0);
assert.equal(second.report.duplicates, 1);

const candidatesAfterSecondRun = await readCandidateDocument(store);
assert.equal(candidatesAfterSecondRun.data.length, 1);

const status = await getLeadHuntStatus({ store, env });
assert.equal(status.providerConfigured, true);
assert.equal(status.provider, 'openstreetmap_overpass');
assert.equal(status.locations[0].city, 'Joinville');
assert.equal(status.locations[0].lat, -26.3045);
assert.equal(status.lastRun.trigger, 'test-repeat');
assert.equal(status.history.length, 2);

console.log('Execução automática, histórico e deduplicação do Caça Leads validados.');
