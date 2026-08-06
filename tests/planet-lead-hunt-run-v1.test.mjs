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
  const body = JSON.parse(options.body);
  return new Response(JSON.stringify({
    places: [{
      id: 'shared-place-id',
      displayName: { text: 'Operação Exemplo' },
      formattedAddress: 'Rua Central, 10 - Joinville - SC',
      addressComponents: [
        { longText: 'Joinville', shortText: 'Joinville', types: ['locality'] },
        { longText: 'Santa Catarina', shortText: 'SC', types: ['administrative_area_level_1'] },
      ],
      googleMapsUri: `https://maps.google.com/?q=${encodeURIComponent(body.textQuery)}`,
      nationalPhoneNumber: '(47) 99999-0000',
      primaryType: 'cafe',
      types: ['cafe', 'food'],
      rating: 4.6,
      userRatingCount: 120,
      businessStatus: 'OPERATIONAL',
    }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const env = {
  GOOGLE_PLACES_API_KEY: 'test-key',
  PLANET_LEAD_HUNT_CITIES: 'Joinville|SC',
  PLANET_LEAD_HUNT_SEGMENTS: 'cafeteria,sorveteria',
  PLANET_LEAD_HUNT_MAX_RESULTS: '5',
};

const first = await runLeadHunt({
  store,
  apiKey: env.GOOGLE_PLACES_API_KEY,
  env,
  options: { trigger: 'test' },
  fetchImpl,
});

assert.equal(requests, 2);
assert.equal(first.run.status, 'completed');
assert.equal(first.run.queriesPlanned, 2);
assert.equal(first.run.queriesCompleted, 2);
assert.equal(first.run.placesFound, 2);
assert.equal(first.run.uniqueCandidatesFound, 1);
assert.equal(first.report.candidatesCreated, 1);
assert.equal(first.report.duplicates, 0);

const candidatesAfterFirstRun = await readCandidateDocument(store);
assert.equal(candidatesAfterFirstRun.data.length, 1);
assert.equal(candidatesAfterFirstRun.data[0].source, 'google_places');
assert.equal(candidatesAfterFirstRun.data[0].reviewStatus, 'pending');
assert.equal(candidatesAfterFirstRun.data[0].promotedLeadId, '');

const second = await runLeadHunt({
  store,
  apiKey: env.GOOGLE_PLACES_API_KEY,
  env,
  options: { trigger: 'test-repeat' },
  fetchImpl,
});
assert.equal(second.report.candidatesCreated, 0);
assert.equal(second.report.duplicates, 1);

const candidatesAfterSecondRun = await readCandidateDocument(store);
assert.equal(candidatesAfterSecondRun.data.length, 1);

const status = await getLeadHuntStatus({ store, env });
assert.equal(status.providerConfigured, true);
assert.equal(status.locations[0].city, 'Joinville');
assert.equal(status.lastRun.trigger, 'test-repeat');
assert.equal(status.history.length, 2);

console.log('Execução automática, histórico e deduplicação do Caça Leads validados.');
