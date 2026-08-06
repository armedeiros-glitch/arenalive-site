import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const middleware = await readFile(new URL('../functions/api/_middleware.js', import.meta.url), 'utf8');
const routeFiles = [
  '../functions/api/hub/planet/expansion/candidates.js',
  '../functions/api/hub/planet/expansion/candidates/[id].js',
  '../functions/api/hub/planet/expansion/candidates/[id]/promote.js',
  '../functions/api/hub/planet/expansion/candidates/import.js',
];
assert.match(middleware, /getAuthState/);
assert.match(middleware, /RD_WEBHOOK_PATH/);
assert.doesNotMatch(middleware, /expansion\/candidates/);
for (const route of routeFiles) {
  const source = await readFile(new URL(route, import.meta.url), 'utf8');
  assert.match(source, /PLANET_HUB_DATA/);
  assert.doesNotMatch(source, /password|pmh_session|Authorization:\s*Bearer/i, `${route} não deve criar autenticação paralela`);
}
console.log('Proteção pelo middleware existente validada.');
