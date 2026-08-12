import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [overview, pages, calendarBundle] = await Promise.all([
  read('planet-hub/assets/planet-overview-desktop-v1.js'),
  read('planet-hub/assets/andre-os-home-pages-v1.js'),
  read('planet-hub/assets/index-calendar-2026-v1.js'),
]);

const sources = ['tickets', 'inaugurations', 'demands', 'contents', 'campaigns'];
const sourceLiteral = sources.map((source) => `'${source}'`).join(', ');

assert.match(
  overview,
  new RegExp(`RADAR_SOURCES = \\[${sourceLiteral.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\]`),
  'Overview desktop deve declarar somente as cinco fontes operacionais',
);
assert.match(
  pages,
  new RegExp(`PLANET_RADAR_SOURCES = \\[${sourceLiteral.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\]`),
  'hidratação Planet deve declarar as mesmas cinco fontes',
);

assert.match(
  overview,
  /PMHRadarData\.collect\(\{ sources: RADAR_SOURCES, maxAgeMs: 15000 \}\)/,
  'Overview deve preservar maxAgeMs e usar leitura seletiva',
);
assert.match(
  pages,
  /\{ maxAgeMs: 15000, sources: PLANET_RADAR_SOURCES \}/,
  'hidratação Planet deve preservar maxAgeMs e usar leitura seletiva',
);
assert.doesNotMatch(overview, /PMHRadarData\.collect\(\{ maxAgeMs: 15000 \}\)/, 'Overview não pode manter coleta completa');
assert.doesNotMatch(pages, /:\s*\{ maxAgeMs: 15000 \};/, 'caminho Planet não pode manter coleta completa');
assert.doesNotMatch(overview, /RADAR_SOURCES\s*=\s*\[[^\]]*contexts[^\]]*\]/, 'Overview não deve solicitar contexts');
assert.doesNotMatch(pages, /PLANET_RADAR_SOURCES\s*=\s*\[[^\]]*contexts[^\]]*\]/, 'hidratação Planet não deve solicitar contexts');

for (const action of ['chamados', 'inauguracoes', 'demand', 'conteudos', 'calendario']) {
  assert.match(overview, new RegExp(`item\\.action === '${action}'|\\['demand', 'conteudos'\\]\\.includes\\(item\\.action\\)`), `Overview deve continuar consumindo ${action}`);
}

for (const api of [
  '/api/hub/planet/acquisition/lp-franquias?period=7d',
  '/api/hub/planet/leads',
  '/api/hub/planet/five-stars/evaluations',
]) {
  assert.ok(overview.includes(api), `API direta deve permanecer intacta: ${api}`);
}

assert.match(overview, /BASE_CAMPAIGNS_2026/);
assert.match(overview, /planet-hub-campaign-operations-v1/);
assert.ok(calendarBundle.length > 200000, 'bundle legado de Campanhas deve permanecer presente e compilado');

console.log('Visão Geral Planet: RadarData seletivo em Overview e hidratação, sem contexts e com métricas/APIs preservadas.');
