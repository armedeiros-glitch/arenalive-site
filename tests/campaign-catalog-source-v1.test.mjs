import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

import {
  CAMPAIGN_CATALOG_2026,
  campaignId,
} from '../functions/_lib/planet-campaign-catalog.js';
import {
  defaultCampaignStatus,
  isOperationalOverride,
  mergeCampaignCatalog,
} from '../functions/api/hub/campanhas.js';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const unifiedHub = read('planet-hub/assets/unified-hub-v1.js');
const radar = read('planet-hub/assets/radar-data-v1.js');

assert.equal(CAMPAIGN_CATALOG_2026.length, 36, 'catálogo oficial deve conter as 36 campanhas de 2026');
assert.equal(new Set(CAMPAIGN_CATALOG_2026.map((campaign) => campaign.id)).size, 36, 'IDs do catálogo devem ser únicos');
assert.equal(campaignId({ start: '2026-10-31', name: 'Halloween Planet' }), '2026-10-31__halloween-planet');

const sourceBlock = unifiedHub.match(/const campaigns = \[([\s\S]*?)\n  \]\.map\(\(\[start, end, name, type, note\]\)/)?.[1];
assert.ok(sourceBlock, 'teste deve localizar o catálogo legado que monta o calendário visual');
const legacyRows = vm.runInNewContext(`[${sourceBlock}]`);
const legacyCatalog = legacyRows.map(([start, end, name, type, note]) => ({ start, end, name, type, note }));
const canonicalWithoutIds = CAMPAIGN_CATALOG_2026.map(({ id, ...campaign }) => campaign);
assert.deepEqual(canonicalWithoutIds, legacyCatalog,
  'catálogo canônico da API deve permanecer idêntico ao calendário visual; divergência precisa quebrar o CI');

const reference = new Date('2026-08-28T12:00:00-03:00');
const agostoLilas = CAMPAIGN_CATALOG_2026.find((campaign) => campaign.name === 'Agosto Lilás');
const mesPais = CAMPAIGN_CATALOG_2026.find((campaign) => campaign.name === 'Mês dos Pais Planet');
const setembroAmarelo = CAMPAIGN_CATALOG_2026.find((campaign) => campaign.name === 'Setembro Amarelo');
const primavera = CAMPAIGN_CATALOG_2026.find((campaign) => campaign.name === 'Primavera Planet');

assert.equal(defaultCampaignStatus(agostoLilas, reference), 'ativa');
assert.equal(defaultCampaignStatus(mesPais, reference), 'concluida');
assert.equal(defaultCampaignStatus(setembroAmarelo, reference), 'planejamento');

assert.equal(isOperationalOverride({ id: setembroAmarelo.id, status: 'planejamento' }, reference), false,
  'campanha futura sem edição não deve virar override operacional');
assert.equal(isOperationalOverride({ id: primavera.id, status: 'producao' }, reference), true,
  'status diferente do padrão deve ser persistido como override');
assert.equal(isOperationalOverride({ id: primavera.id, status: 'planejamento', responsible: 'André' }, reference), true,
  'responsável explícito deve tornar a campanha operacional');

const merged = mergeCampaignCatalog([{
  id: primavera.id,
  status: 'producao',
  responsible: 'André',
  nextMilestone: 'Aprovar kit',
  milestoneDate: '2026-09-02',
  materials: '',
  notes: '',
  updatedAt: '2026-08-28T12:00:00.000Z',
}], reference);
assert.equal(merged.length, 36);
assert.equal(merged.find((campaign) => campaign.id === agostoLilas.id).status, 'ativa');
assert.equal(merged.find((campaign) => campaign.id === mesPais.id).status, 'concluida');
assert.deepEqual(
  Object.fromEntries(['status', 'responsible', 'nextMilestone', 'milestoneDate', 'hasOperationalOverride']
    .map((key) => [key, merged.find((campaign) => campaign.id === primavera.id)[key]])),
  {
    status: 'producao',
    responsible: 'André',
    nextMilestone: 'Aprovar kit',
    milestoneDate: '2026-09-02',
    hasOperationalOverride: true,
  },
);

assert.match(radar, /return Array\.isArray\(payload\.data\) \? payload\.data : \[\];/,
  'Radar deve continuar consumindo somente data, a camada operacional, e não as 36 referências do catálogo');
assert.doesNotMatch(radar, /payload\.(?:catalog|campaigns)/,
  'Radar não deve transformar catálogo anual em fila operacional');

console.log('Campanhas: catálogo 2026, overrides e isolamento do Radar validados.');
