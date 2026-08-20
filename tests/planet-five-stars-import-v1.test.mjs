import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const js = await readFile(new URL('../planet-hub/assets/planet-five-stars-import-v1.js', import.meta.url), 'utf8');
const css = await readFile(new URL('../planet-hub/assets/planet-five-stars-import-v1.css', import.meta.url), 'utf8');
const access = await readFile(new URL('../planet-hub/assets/hub-access-v1.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

assert.match(js, /accept=\"\.xlsx,\.xls,\.csv\"/);
assert.match(js, /Importar planilha/);
assert.match(js, /Baixar modelo Excel/);
assert.match(js, /Atualizar existente/);
assert.match(js, /Ignorar duplicada/);
assert.match(js, /Resultado Comercial \/35/);
assert.match(js, /Experiência do Cliente \/25/);
assert.match(js, /Marketing e Participação \/20/);
assert.match(js, /Gestão da Franquia \/20/);
assert.match(js, /nota .*fora do limite/);
assert.match(js, /cdn\.jsdelivr\.net\/npm\/xlsx@0\.18\.5/);
assert.match(js, /Nenhum dado será salvo antes da sua confirmação/);
assert.doesNotMatch(js, /localStorage|sessionStorage|MutationObserver|setInterval/);
assert.doesNotMatch(css, /!important/);
assert.match(css, /@media\(max-width:820px\)/);
assert.match(access, /planet-five-stars-import-v1\.js\?v=20260807-1/);
assert.match(html, /planet-five-stars-import-v1\.css\?v=20260807-1/);
console.log('Contrato de importação do Planet 5 Estrelas validado.');
