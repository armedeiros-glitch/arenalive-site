import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [index, script, styles] = await Promise.all([
  read('index.html'),
  read('planet-hub/assets/planet-overview-desktop-v1.js'),
  read('planet-hub/assets/planet-overview-desktop-v1.css'),
]);

assert.ok(index.includes('planet-overview-desktop-v1.css?v=20260813-1'));
assert.ok(index.includes('planet-overview-desktop-v1.js?v=20260813-1'));

assert.match(script, /PMHRadarData\.collect/);
assert.match(script, /\/api\/hub\/planet\/acquisition\/lp-franquias\?period=7d/);
assert.match(script, /\/api\/hub\/planet\/leads/);
assert.match(script, /\/api\/hub\/planet\/five-stars\/evaluations/);
assert.match(script, /\/api\/hub\/campanhas/);
assert.match(script, /planet-hub-campaign-operations-v1/);
assert.match(script, /BASE_CAMPAIGNS_2026/);
assert.match(script, /Mês dos Pais Planet/);
assert.match(script, /Primavera Planet/);
assert.match(script, /Black Planet/);
assert.match(script, /mergedCampaignItems/);
assert.match(script, /nextMilestone/);
assert.match(script, /milestoneDate/);
assert.match(script, /Campanha · Marco/);
assert.match(script, /upcomingOperationalCampaigns/);
assert.match(script, /nextCampaign = upcomingOperationalCampaigns\[0\] \|\| upcomingCampaigns\[0\]/);
assert.match(script, /nextCampaign\.operational \? nextCampaign\.context : nextCampaign\.title/);
assert.match(script, /contentDeliveries = items\.filter\(\(item\) => item\.action === 'conteudos'\)/);
assert.doesNotMatch(script, /milestones = \[\.\.\.campaigns, \.\.\.inaugurations, \.\.\.marketing\]/,
  'Agenda não pode voltar a misturar demandas internas genéricas.');
assert.match(script, /isUpcoming\(item, 30\)/);
assert.match(script, /AGENDA DA OPERAÇÃO · 30 DIAS/);
assert.match(script, /MARKETING/);
assert.match(script, /CAMPANHAS/);
assert.match(script, /INAUGURAÇÕES/);
assert.match(script, /CHAMADOS/);
assert.match(script, /AQUISIÇÃO · 7D/);
assert.match(script, /EXPANSÃO/);
assert.match(script, /5 ESTRELAS/);
assert.match(script, /data-source-health/);
assert.match(script, /Agenda parcial/);

assert.match(styles, /@media \(min-width:\s*821px\)/);
assert.doesNotMatch(styles, /max-width:\s*820px/);
assert.match(styles, /\.aos-planet-desktop-cockpit/);
assert.match(styles, /\.aos-planet-overview-status[\s\S]*display:\s*none\s*!important/);
assert.match(styles, /grid-template-columns:\s*repeat\(7/);
assert.match(styles, /\.aos-planet-drawers[\s\S]*display:\s*none/);
assert.match(styles, /\.aos-planet-attention-list[\s\S]*repeat\(3/);

console.log('Cockpit, marcos de campanhas, agenda e confiabilidade da Visão Geral Planet validados.');
