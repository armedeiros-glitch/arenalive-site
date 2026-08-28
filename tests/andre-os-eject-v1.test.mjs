import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const source = read('planet-hub/assets/andre-os-eject-v1.js');
const index = read('index.html');

assert.match(index, /andre-os-eject-v1\.js\?v=20260828-3/,
  'index deve carregar o EJECT com versão de cache explícita');
assert.match(source, /const VERSION = '20260828-3'/);
assert.match(source, /data-andre-os-eject/,
  'EJECT deve ter owner visual único');
assert.match(source, /Copiar EJECT/,
  'fluxo deve permitir copiar o snapshot');
assert.match(source, /ANDRÉ OS · EJECT OPERACIONAL/,
  'texto copiado deve se identificar para uso no ChatGPT');
assert.match(source, /Não crie tarefas automaticamente/,
  'EJECT deve preservar a regra de não criar tarefas por conta própria');
assert.match(source, /Radar pessoal · hoje/,
  'fonte pessoal deve ser identificada sem ambiguidade');
assert.match(source, /Contextos operacionais do Radar/,
  'contextos operacionais não podem parecer a fila pessoal');
assert.match(source, /Campanhas · catálogo e operação/,
  'Campanhas deve explicitar catálogo e camada operacional');
assert.match(source, /catalog contém o calendário oficial completo de 2026/,
  'EJECT deve declarar o catálogo anual completo');
assert.match(source, /data contém somente overrides operacionais persistidos/,
  'EJECT deve separar referência anual de estado operacional');
assert.match(source, /campaigns combina catálogo e overrides/,
  'EJECT deve explicar a visão combinada usada para auditoria');
assert.match(source, /presente apenas no catálogo não deve ser tratada automaticamente como tarefa ou pendência operacional/,
  'catálogo não pode virar fila operacional');
assert.match(source, /sourceSemantics:/,
  'snapshot deve carregar significado explícito das fontes');
assert.match(source, /Respeite sourceSemantics/,
  'prompt copiado deve instruir a análise a respeitar a semântica das fontes');
assert.match(source, /\/api\/radar\/today/,
  'Radar deve entrar no snapshot');
assert.match(source, /\/api\/sults\/chamados\?start=0&limit=100/,
  'Chamados devem entrar no snapshot');
assert.match(source, /\/api\/sults\/implantacoes\?start=0&limit=100&scope=all/,
  'EJECT deve pedir explicitamente o histórico completo das implantações SULTS');
assert.match(source, /incluindo histórico fora do escopo operacional/,
  'semântica do EJECT deve explicar por que usa scope=all');
assert.match(source, /\/api\/hub\/inauguracoes/,
  'Inaugurações devem entrar no snapshot');
assert.match(source, /\/api\/hub\/demandas-internas/,
  'Demandas internas devem entrar no snapshot');
assert.match(source, /\/api\/hub\/campanhas/,
  'Campanhas deve entrar no snapshot');
assert.match(source, /\/api\/hub\/planet\/five-stars\/action-plans/,
  'Planos do 5 Estrelas devem entrar no snapshot');
assert.match(source, /SENSITIVE_KEY/,
  'credenciais devem ser filtradas antes da cópia');
assert.match(source, /navigator\.clipboard\.writeText/,
  'clipboard moderno deve ser usado');
assert.match(source, /document\.execCommand\('copy'\)/,
  'deve haver fallback de cópia');
assert.doesNotMatch(source, /localStorage\.setItem|sessionStorage\.setItem/,
  'EJECT é somente leitura e não deve criar persistência');
assert.doesNotMatch(source, /MutationObserver/,
  'EJECT não deve observar o DOM continuamente');

console.log('André OS EJECT: catálogo, operação, histórico SULTS, segurança, cópia e somente-leitura validados.');
