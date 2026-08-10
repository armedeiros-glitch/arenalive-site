import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [index, script, styles] = await Promise.all([
  read('index.html'),
  read('planet-hub/assets/planet-next-step-v1.js'),
  read('planet-hub/assets/planet-next-step-v1.css'),
]);

assert.ok(index.includes('planet-next-step-v1.css?v=20260810-1'));
assert.ok(index.includes('planet-next-step-v1.js?v=20260810-1'));
assert.match(styles, /@media \(min-width: 821px\)/);
assert.doesNotMatch(styles, /max-width:\s*820px/);

for (const route of ['marketing', 'calendario', 'inauguracoes', 'chamados', 'aquisicao', 'expansao', '5-estrelas']) {
  assert.match(script, new RegExp(`['\"]${route}['\"]`));
}

assert.match(script, /item\.nextAction/);
assert.match(script, /contextSuggestion\?\.nextAction/);
assert.match(script, /\/api\/hub\/planet\/five-stars\/action-plans/);
assert.match(script, /\/api\/hub\/planet\/leads/);
assert.match(script, /\/api\/hub\/planet\/acquisition\/lp-franquias\?period=7d/);
assert.match(script, /Nenhuma ação operacional registrada para Aquisição/);
assert.doesNotMatch(script, /conversion\s*[<>]=?\s*\d/, 'Aquisição não pode inventar ação a partir de um limiar de conversão.');

console.log('Próximo passo operacional desktop da Planet validado.');
