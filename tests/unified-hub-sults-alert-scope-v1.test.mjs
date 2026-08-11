import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync('planet-hub/assets/unified-hub-v1.js', 'utf8');
const SULTS_ERROR_FIXTURE = 'Parte dos dados do SULTS não carregou. Use o botão atualizar para tentar novamente.';
const SULTS_VIEWS = ['inicio', 'chamados', 'inauguracoes'];

assert.match(
  source,
  /const SULTS_LOAD_ERROR = 'Parte dos dados do SULTS não carregou\. Use o botão atualizar para tentar novamente\.';/,
  'o erro de carregamento do SULTS deve ter identidade própria para não contaminar outros erros do Hub',
);

assert.match(
  source,
  /const visibleError = state\.error === SULTS_LOAD_ERROR && !\['inicio', 'chamados', 'inauguracoes'\]\.includes\(state\.view\) \? '' : state\.error;/,
  'o alerta SULTS deve ficar restrito às views que realmente dependem do SULTS',
);

assert.match(
  source,
  /content\.innerHTML = `\$\{visibleError \? `<div class="pmh-alert">\$\{esc\(visibleError\)\}<\/div>` : ''\}\$\{html\}`;/,
  'o render deve usar o erro já filtrado por escopo',
);

const visibleErrorFor = (view, error) => error === SULTS_ERROR_FIXTURE && !SULTS_VIEWS.includes(view) ? '' : error;

for (const view of SULTS_VIEWS) {
  assert.equal(
    visibleErrorFor(view, SULTS_ERROR_FIXTURE),
    SULTS_ERROR_FIXTURE,
    `${view} deve continuar avisando quando o SULTS falhar`,
  );
}

for (const view of ['calendario', 'conteudos']) {
  assert.equal(
    visibleErrorFor(view, SULTS_ERROR_FIXTURE),
    '',
    `${view} não deve exibir um erro de fonte que não utiliza`,
  );
}

const unrelatedError = 'Alteração salva neste navegador, mas a sincronização compartilhada falhou.';
for (const view of [...SULTS_VIEWS, 'calendario', 'conteudos']) {
  assert.equal(
    visibleErrorFor(view, unrelatedError),
    unrelatedError,
    'erros que não são do carregamento SULTS não podem ser silenciados',
  );
}

console.log('Unified Hub: escopo do alerta SULTS validado.');
