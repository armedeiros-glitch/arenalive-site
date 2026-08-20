import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [index, script, styles] = await Promise.all([
  read('index.html'),
  read('planet-hub/assets/planet-next-step-v1.js'),
  read('planet-hub/assets/planet-next-step-v1.css'),
]);

assert.ok(index.includes('planet-next-step-v1.css?v=20260810-1'));
assert.ok(index.includes('planet-next-step-v1.js?v=20260810-4'));
assert.match(styles, /@media \(min-width: 821px\)/);
assert.doesNotMatch(styles, /max-width:\s*820px/);

for (const route of ['marketing', 'calendario', 'inauguracoes', 'chamados', 'aquisicao', 'expansao', '5-estrelas', 'conteudos']) {
  assert.match(script, new RegExp(`['\"]${route}['\"]`));
}

assert.match(script, /marketing: new Set\(\['demand'\]\)/);
assert.match(script, /marketingStep/);
assert.match(script, /Definir o próximo passo de \$\{item\.title \|\| 'demanda sem título'\}/);
assert.doesNotMatch(script, /marketing: new Set\(\['demand', 'conteudos'\]\)/,
  'Marketing não pode voltar a misturar demandas e Central Planet na mesma regra.');

assert.match(script, /item\.nextAction/);
assert.match(script, /contextSuggestion\?\.nextAction/);
assert.match(script, /campaignStep/);
assert.match(script, /pmh-campaign-focus-card\[data-edit-campaign\]/);
assert.match(script, /Definir responsável para/);
assert.match(script, /Definir o próximo marco de/);
assert.match(script, /inaugurationStep/);
assert.match(script, /\/api\/hub\/inauguracoes/);
assert.doesNotMatch(script, /pmh-checklist label/);
assert.doesNotMatch(script, /\.pmh-inauguration-card/);
assert.doesNotMatch(script, /\.pmh-inauguration-project-row-main/);
assert.match(script, /PRÓXIMO PASSO · ETAPA ATRASADA/);
assert.match(script, /Abrir \$\{item\.title\} e concluir a próxima etapa pendente/);
assert.match(script, /\/api\/hub\/planet\/five-stars\/action-plans/);
assert.match(script, /\/api\/hub\/planet\/leads/);
assert.match(script, /\/api\/hub\/planet\/acquisition\/lp-franquias\?period=7d/);
assert.match(script, /Sem ação operacional pendente/);
assert.doesNotMatch(script, /conversion\s*[<>]=?\s*\d/, 'Aquisição não pode inventar ação a partir de um limiar de conversão.');

assert.match(script, /Date\.parse\(a\.createdAt \|\| 0\) - Date\.parse\(b\.createdAt \|\| 0\)/);
assert.match(script, /PRÓXIMO PASSO · EXPANSÃO/);
assert.match(script, /Revisar \$\{lead\.name \|\| 'lead sem nome'\}/);
assert.match(script, /P5_AREA_LABELS/);
assert.match(script, /PRÓXIMO PASSO · PLANO ATRASADO/);
assert.match(script, /dueA\.weight !== dueB\.weight/);

assert.match(script, /contents: '\/api\/hub\/conteudos'/);
assert.match(script, /contentStep/);
assert.match(script, /Cadastrar o primeiro material da Central Planet/);
assert.match(script, /PRÓXIMO PASSO · CENTRAL PLANET/);
assert.match(script, /if \(area === 'conteudos'\) return contentStep\(\)/);

console.log('Próximos passos operacionais desktop da Planet validados.');
