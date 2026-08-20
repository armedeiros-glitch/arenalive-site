import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [script, radarData, calendarBundle, styles] = await Promise.all([
  read('planet-hub/assets/planet-next-step-v1.js'),
  read('planet-hub/assets/radar-data-v1.js'),
  read('planet-hub/assets/index-calendar-2026-v1.js'),
  read('planet-hub/assets/planet-next-step-v1.css'),
]);

const expectedSources = {
  marketing: ['demands', 'contexts'],
  calendario: ['campaigns', 'contexts'],
  inauguracoes: ['inaugurations', 'contexts'],
  chamados: ['tickets', 'contexts'],
};

for (const [area, sources] of Object.entries(expectedSources)) {
  const list = sources.map((source) => `'${source}'`).join(', ');
  assert.match(
    script,
    new RegExp(`${area}: \\[${list.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\]`),
    `${area} deve declarar somente ${sources.join(' + ')}`,
  );
}

assert.match(
  script,
  /PMHRadarData\.collect\(\{ sources, maxAgeMs: 15000 \}\)/,
  'Next Step deve preservar maxAgeMs=15000 e enviar sources ao RadarData',
);
assert.doesNotMatch(
  script,
  /PMHRadarData\.collect\(\{ maxAgeMs: 15000 \}\)/,
  'os quatro caminhos Radar não podem manter coleta completa',
);
assert.doesNotMatch(
  script,
  /PMHRadarData\.collect\(\)/,
  'Next Step não deve introduzir collect() legado completo',
);

// Compatibilidade do comportamento e fallbacks que continuam válidos.
assert.match(script, /marketingStep/);
assert.match(script, /campaignStep/);
assert.match(script, /inaugurationStep/);
assert.match(script, /radarStep/);
assert.match(script, /actionModelForItem/);
assert.match(script, /pmh-campaign-focus-card\[data-edit-campaign\]/, 'fallback DOM de Campanhas deve permanecer');
assert.doesNotMatch(script, /pmh-checklist label/, 'fallback DOM de Inaugurações deve permanecer removido');
assert.doesNotMatch(script, /\.pmh-inauguration-card/, 'Next Step não deve depender dos cards renderizados de Inaugurações');
assert.doesNotMatch(script, /\.pmh-inauguration-project-row-main/, 'unidade de Inaugurações não deve vir do DOM');
assert.match(script, /\/api\/hub\/inauguracoes/, 'fallback API de Inaugurações deve permanecer');
assert.match(script, /\/api\/hub\/planet\/acquisition\/lp-franquias\?period=7d/);
assert.match(script, /\/api\/hub\/planet\/leads/);
assert.match(script, /\/api\/hub\/planet\/five-stars\/action-plans/);
assert.match(script, /\/api\/hub\/conteudos/);

// Este corte não move interpretação para o RadarData nem toca o bundle legado do calendário.
assert.match(radarData, /window\.PMHRadarData\s*=/, 'RadarData continua owner do contrato global');
assert.ok(calendarBundle.length > 200000, 'bundle legado do calendário continua presente e compilado');
assert.match(styles, /aos-planet-next-step/, 'CSS existente continua presente sem depender deste corte');

console.log('Planet Next Step: Radar seletivo preservado, Inaugurações sem DOM e demais fallbacks mantidos.');
