import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [core, provider, endpoint, worker, workerConfig, docs] = await Promise.all([
  read('functions/_lib/planet-lead-hunt.js'),
  read('functions/_lib/planet-lead-hunt-openstreetmap.js'),
  read('functions/api/hub/planet/expansion/hunt.js'),
  read('workers/planet-caca-leads/index.js'),
  read('workers/planet-caca-leads/wrangler.toml'),
  read('docs/caca-leads-automatic-v1.md'),
]);

assert.match(core, /importCandidates/);
assert.match(core, /LEAD_HUNT_STORAGE_KEY/);
assert.match(core, /DEFAULT_HUNT_LOCATIONS/);
assert.match(core, /Joinville/);
assert.match(core, /openstreetmap_overpass/);
assert.match(core, /searchOpenStreetMap/);
assert.doesNotMatch(core, /promoteCandidate|promotedLeadId\s*:/);
assert.doesNotMatch(core, /upsertLead|caca_lead/);
assert.doesNotMatch(core, /GOOGLE_PLACES_API_KEY|google_places/i);

assert.match(provider, /overpass-api\.de\/api\/interpreter/);
assert.match(provider, /application\/x-www-form-urlencoded/);
assert.match(provider, /OSM_ATTRIBUTION/);
assert.match(provider, /ODbL 1\.0/);
assert.match(provider, /source:\s*'openstreetmap'/);
assert.match(provider, /reviewStatus:\s*'pending'/);
assert.match(provider, /não representa interesse explícito/i);
assert.doesNotMatch(provider, /places\.googleapis|X-Goog/i);

assert.match(endpoint, /onRequestGet/);
assert.match(endpoint, /onRequestPost/);
assert.match(endpoint, /trigger:\s*'manual'/);
assert.doesNotMatch(endpoint, /GOOGLE_PLACES_API_KEY|Authorization|password|pmh_session/i);

assert.match(worker, /async scheduled/);
assert.match(worker, /ctx\.waitUntil/);
assert.match(worker, /CACA_LEADS_RUN_TOKEN/);
assert.doesNotMatch(worker, /GOOGLE_PLACES_API_KEY/);
assert.match(workerConfig, /crons\s*=\s*\["0 11 \* \* \*"\]/);
assert.match(workerConfig, /PLANET_HUNT|PLANET_LEAD_HUNT_LOCATIONS/);
assert.match(workerConfig, /-26\.3045\|-48\.8487/);
assert.match(workerConfig, /OVERPASS_API_URL/);
assert.match(docs, /© OpenStreetMap contributors/);
assert.match(docs, /ODbL/);
assert.doesNotMatch(docs, /Google Places|GOOGLE_PLACES_API_KEY/);

console.log('Contrato do Caça Leads automático validado sem promoção automática.');
