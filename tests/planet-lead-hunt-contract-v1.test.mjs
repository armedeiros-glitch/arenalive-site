import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [core, provider, endpoint, worker, workerConfig] = await Promise.all([
  read('functions/_lib/planet-lead-hunt.js'),
  read('functions/_lib/planet-lead-hunt-google-places.js'),
  read('functions/api/hub/planet/expansion/hunt.js'),
  read('workers/planet-caca-leads/index.js'),
  read('workers/planet-caca-leads/wrangler.toml'),
]);

assert.match(core, /importCandidates/);
assert.match(core, /LEAD_HUNT_STORAGE_KEY/);
assert.match(core, /DEFAULT_HUNT_LOCATIONS/);
assert.match(core, /Joinville/);
assert.match(core, /reviewStatus:\s*'pending'/);
assert.doesNotMatch(core, /promoteCandidate|promotedLeadId\s*:/);
assert.doesNotMatch(core, /upsertLead|caca_lead/);

assert.match(provider, /places:searchText/);
assert.match(provider, /X-Goog-FieldMask/);
assert.match(provider, /nationalPhoneNumber/);
assert.match(provider, /websiteUri/);
assert.match(provider, /source:\s*'google_places'/);
assert.match(provider, /não representa interesse explícito/i);

assert.match(endpoint, /onRequestGet/);
assert.match(endpoint, /onRequestPost/);
assert.match(endpoint, /GOOGLE_PLACES_API_KEY/);
assert.match(endpoint, /trigger:\s*'manual'/);
assert.doesNotMatch(endpoint, /Authorization|password|pmh_session/i);

assert.match(worker, /async scheduled/);
assert.match(worker, /ctx\.waitUntil/);
assert.match(worker, /CACA_LEADS_RUN_TOKEN/);
assert.match(workerConfig, /crons\s*=\s*\["0 11 \* \* \*"\]/);
assert.match(workerConfig, /PLANET_HUB_DATA/);
assert.match(workerConfig, /GOOGLE_PLACES_API_KEY/);

console.log('Contrato do Caça Leads automático validado sem promoção automática.');
