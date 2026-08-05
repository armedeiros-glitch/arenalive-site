import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const moduleSource = read('planet-hub/assets/planet-expansion-v1.js');
const accessSource = read('planet-hub/assets/hub-access-v1.js');
const apiSource = read('functions/api/hub/planet/leads.js');

assert.match(accessSource, /planet-expansion-v1\.js\?v=20260805-1/);
assert.match(accessSource, /value\.includes\('expans'\)/);
assert.match(moduleSource, /const VIEW = 'expansao'/);
assert.match(moduleSource, /const API = '\/api\/hub\/planet\/leads'/);
assert.match(moduleSource, /data-expansion-nav/);
assert.match(moduleSource, /Expansão e Leads/);
assert.match(moduleSource, /RD Station, reativação e futuro Caça Lead/);
assert.match(moduleSource, /NÃO VISUALIZADOS/);
assert.match(apiSource, /tenantId: 'planet'/);
assert.match(apiSource, /rd_station/);
assert.match(apiSource, /reactivated/);
assert.match(apiSource, /caca_lead/);
assert.match(apiSource, /PLANET_HUB_DATA/);
assert.match(apiSource, /duplicate: true/);
assert.match(apiSource, /O lead precisa ter telefone ou e-mail/);

console.log('Planet expansion MVP: tests passed');
