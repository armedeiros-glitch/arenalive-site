import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const moduleSource = read('planet-hub/assets/planet-expansion-v1.js');
const hunterSource = read('planet-hub/assets/planet-lead-hunter-v1.js');
const accessSource = read('planet-hub/assets/hub-access-v1.js');
const apiSource = read('functions/api/hub/planet/leads.js');
const leadCore = read('functions/_lib/planet-leads.js');

assert.match(accessSource, /planet-expansion-v1\.js\?v=20260806-1/);
assert.match(accessSource, /planet-lead-hunter-v1\.js\?v=20260806-2/);
assert.match(accessSource, /value\.includes\('expans'\)/);
assert.match(moduleSource, /const VIEW = 'expansao'/);
assert.match(moduleSource, /const API = '\/api\/hub\/planet\/leads'/);
assert.match(moduleSource, /data-expansion-nav/);
assert.match(moduleSource, /data-expansion-section="leads"/);
assert.match(moduleSource, /data-expansion-section="caca-lead"/);
assert.match(moduleSource, /data-lead-hunter-root/);
assert.match(moduleSource, /planet:expansion-section-rendered/);
assert.match(moduleSource, /Expansão e Leads/);
assert.match(moduleSource, /NÃO VISUALIZADOS/);
assert.doesNotMatch(hunterSource, /pmh-expansion-shell|insertAdjacentElement|setInterval|MutationObserver/);
assert.match(apiSource, /PLANET_HUB_DATA/);
assert.match(apiSource, /upsertLead/);
assert.match(leadCore, /tenantId: 'planet'/);
assert.match(leadCore, /rd_station/);
assert.match(leadCore, /reactivated/);
assert.match(leadCore, /caca_lead/);
assert.match(leadCore, /duplicate: true/);
assert.match(leadCore, /O lead precisa ter telefone ou e-mail/);

console.log('Planet expansion e Caça Lead nativos: tests passed');
