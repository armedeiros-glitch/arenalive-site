import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [hunter, endpoint] = await Promise.all([
  readFile(new URL('../planet-hub/assets/planet-lead-hunter-v1.js', import.meta.url), 'utf8'),
  readFile(new URL('../functions/api/hub/planet/expansion/hunt.js', import.meta.url), 'utf8'),
]);

assert.match(hunter, /const HUNT_API = '\/api\/hub\/planet\/expansion\/hunt'/);
assert.match(hunter, /data-hunter-hunt/);
assert.match(hunter, /Buscar agora/);
assert.match(hunter, /runHunt/);
assert.match(hunter, /requestJson\(HUNT_API, \{ method: 'POST'/);
assert.match(hunter, /Última execução/);
assert.match(hunter, /candidatesCreated/);
assert.match(hunter, /duplicates/);
assert.match(hunter, /withoutContact/);
assert.match(hunter, /© OpenStreetMap contributors/);
assert.match(hunter, /openstreetmap\.org\/copyright/);
assert.doesNotMatch(hunter, /data-hunter-hunt[^\n]+promote|runHunt[^]*promoteCandidate\(/);

assert.match(endpoint, /runLeadHunt/);
assert.match(endpoint, /trigger:\s*'manual'/);
assert.doesNotMatch(endpoint, /promoteCandidate|upsertLead/);

console.log('Interface do Caça Leads automático validada.');
