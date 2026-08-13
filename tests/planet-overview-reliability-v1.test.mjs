import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [script, radarData, ticketsBackend, index] = await Promise.all([
  read('planet-hub/assets/planet-overview-desktop-v1.js'),
  read('planet-hub/assets/radar-data-v1.js'),
  read('functions/api/sults/chamados.js'),
  read('index.html'),
]);

const window = {
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  addEventListener() {},
  PMHRadarData: {},
};
const document = { readyState: 'loading', addEventListener() {} };
const sandbox = { window, document, location: { hash: '' }, localStorage: { getItem: () => null }, console };
vm.runInNewContext(script, sandbox);
const health = window.PlanetOverviewReliability;
assert.ok(health, 'Overview deve expor helpers derivados de confiabilidade');

assert.equal(health.radarSourceHealth({ sources: { tickets: { reliability: 'fresh', error: '' } } }, 'tickets'), 'fresh');
assert.equal(health.radarSourceHealth({ sources: { tickets: { reliability: 'error', error: 'offline' } } }, 'tickets'), 'unavailable');
assert.equal(health.radarSourceHealth({ sources: { tickets: { reliability: 'stale', error: '' } } }, 'tickets'), 'partial');
assert.equal(health.healthFromPayload({ reliability: { stale: true } }), 'partial');
assert.equal(health.healthFromPayload({ reliability: { complete: false } }), 'partial');
assert.equal(health.healthFromPayload({}), 'fresh');
assert.equal(health.combineHealth('fresh', 'fresh'), 'fresh');
assert.equal(health.combineHealth('unavailable', 'unavailable'), 'unavailable');
assert.equal(health.combineHealth('fresh', 'unavailable'), 'partial');
assert.equal(health.healthLabel('unavailable'), 'Indisponível');
assert.equal(health.healthLabel('partial'), 'Dados parciais');

assert.match(script, /health === 'fresh'[\s\S]*\{ \.\.\.metric, health \}[\s\S]*value: '—'/,
  'Fresh preserva o valor real; partial/unavailable não podem fabricar zero.');
assert.match(script, /campaigns\.status === 'fulfilled'[\s\S]*localCampaigns\.length \? 'partial' : 'unavailable'/,
  'Fallback local de campanhas deve ser explicitamente parcial.');
assert.match(script, /if \(sourceHealth\.campaigns !== 'unavailable'\) agendaParts\.push/);
assert.match(script, /if \(sourceHealth\.inaugurations !== 'unavailable'\) agendaParts\.push/);
assert.match(script, /if \(sourceHealth\.contents !== 'unavailable'\) agendaParts\.push/);
assert.match(script, /const agendaHealth = combineHealth/);
assert.match(script, /Leitura parcial da operação/);
assert.match(script, /fonte\$\{unavailable\.length === 1/);
assert.match(script, /Resposta inválida da fonte/);

assert.match(ticketsBackend, /const ACTIVE_SITUATIONS = \[1, 4, 5, 6\]/);
assert.match(radarData, /\[2, 3\]\.includes\(Number\(item\.situation\?\.id \|\| item\.situationId\)\)/,
  'Chamados concluídos/resolvidos continuam fora do RadarData.');
assert.match(script, /const RADAR_SOURCES = \['tickets', 'inaugurations', 'demands', 'contents', 'campaigns'\]/,
  'Nenhuma fonte nova deve ser adicionada ao RadarData seletivo do Overview.');
assert.doesNotMatch(script, /localStorage\.setItem|sessionStorage|\/api\/hub\/radar-contextos/,
  'Health do Overview não pode criar persistência nem adicionar contexts.');
assert.match(index, /planet-overview-desktop-v1\.js\?v=20260813-1/);

console.log('Visão Geral Planet: confiabilidade fresh/partial/unavailable validada sem alterar fontes.');
