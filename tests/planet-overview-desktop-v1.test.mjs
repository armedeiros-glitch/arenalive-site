import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [index, script, styles] = await Promise.all([
  read('index.html'),
  read('planet-hub/assets/planet-overview-desktop-v1.js'),
  read('planet-hub/assets/planet-overview-desktop-v1.css'),
]);

assert.ok(index.includes('planet-overview-desktop-v1.css?v=20260810-1'));
assert.ok(index.includes('planet-overview-desktop-v1.js?v=20260810-1'));

assert.match(script, /PMHRadarData\.collect/);
assert.match(script, /\/api\/hub\/planet\/acquisition\/lp-franquias\?period=7d/);
assert.match(script, /\/api\/hub\/planet\/leads/);
assert.match(script, /\/api\/hub\/planet\/five-stars\/evaluations/);
assert.match(script, /PRÓXIMOS MARCOS/);
assert.match(script, /item\.context/);
assert.match(script, /MARKETING/);
assert.match(script, /CAMPANHAS/);
assert.match(script, /INAUGURAÇÕES/);
assert.match(script, /CHAMADOS/);
assert.match(script, /AQUISIÇÃO · 7D/);
assert.match(script, /EXPANSÃO/);
assert.match(script, /5 ESTRELAS/);

assert.match(styles, /@media \(min-width: 821px\)/);
assert.doesNotMatch(styles, /max-width:\s*820px/);
assert.match(styles, /\.aos-planet-desktop-cockpit/);
assert.match(styles, /\.aos-op-metrics/);
assert.match(styles, /\.aos-op-milestones/);

console.log('Cockpit desktop da Visão Geral Planet validado.');
