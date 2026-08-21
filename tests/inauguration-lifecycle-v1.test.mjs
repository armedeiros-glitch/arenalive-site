import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const lifecycle = read('planet-hub/assets/inauguration-lifecycle-v1.js');
const backend = read('functions/api/hub/inauguracoes-status.js');
const closeControl = read('planet-hub/assets/inauguration-project-close-v1.js');
const index = read('index.html');

assert.match(lifecycle, /const API_URL = '\/api\/hub\/inauguracoes-status'/);
assert.match(lifecycle, /opening\.getTime\(\) < today\(\)\.getTime\(\)/,
  'inauguração só deve sair da fila depois que o dia passou');
assert.match(lifecycle, /Encerrar inauguração/);
assert.match(lifecycle, /Histórico de inaugurações/);
assert.match(lifecycle, /Reabrir acompanhamento/);
assert.match(lifecycle, /state === 'closed'/);
assert.match(lifecycle, /state === 'open'/,
  'reabertura explícita deve conseguir manter uma inauguração antiga ativa');
assert.doesNotMatch(lifecycle, /MutationObserver/,
  'ciclo de vida não deve reintroduzir observador de DOM que possa travar a tela');
assert.match(lifecycle, /setMetric\('Em acompanhamento', active\.length/);
assert.match(lifecycle, /data-badge="inaugurations"/);

assert.match(backend, /planet-hub:inauguracao-status:v1:/);
assert.match(backend, /PLANET_HUB_DATA/);
assert.match(backend, /itemKey\(record\.id\)/,
  'estado deve ser persistido por inauguração, não em um blob global');
assert.match(backend, /state === 'closed'/);
assert.match(backend, /state === 'open'/);

assert.match(closeControl, /Voltar à lista/);
assert.doesNotMatch(closeControl, /<span>Fechar projeto<\/span>/,
  'voltar ao browser não pode parecer encerramento operacional');
assert.match(index, /inauguration-lifecycle-v1\.js\?v=20260821-1/);
assert.match(index, /inauguration-project-close-v1\.js\?v=20260821-2/);

console.log('Inaugurações: encerramento manual, arquivo automático pós-data, histórico e reabertura validados.');
