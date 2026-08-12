import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [readings, command, details, ignored] = await Promise.all([
  read('planet-hub/assets/ticket-readings-v1.js'),
  read('planet-hub/assets/ticket-command-v1.js'),
  read('planet-hub/assets/ticket-details-v1.js'),
  read('planet-hub/assets/ignored-tickets-v1.js'),
]);

assert.match(readings, /const MAX_TICKETS = 5;/, 'limite atual de readings deve permanecer');
assert.match(readings, /const CACHE_TTL_MS = 15 \* 60 \* 1000;/, 'TTL atual deve permanecer');

assert.match(readings, /const usefulListSuggestion = \(item\) => \{[\s\S]*item\?\.ticketReading\?\.suggestion/, 'lista deve consumir somente a suggestion produzida pelo reading');
assert.match(readings, /\['high', 'medium'\]\.includes\(suggestion\.confidence\)/, 'lista deve omitir reading sem confiança útil');
assert.match(readings, /<small>Bola com<\/small><strong>\$\{esc\(suggestion\.dependsOn\)\}/, 'card com reading deve mostrar quem está com a bola');
assert.match(readings, /<small>Próximo<\/small><strong>\$\{esc\(suggestion\.nextAction\)\}/, 'card com reading deve mostrar próximo movimento');
assert.match(readings, /cleanExcerpt\(suggestion\.nextAction, 110\)/, 'próximo movimento deve ser curto na lista');

assert.match(readings, /document\.querySelectorAll\('\.pmh-command-ticket\[data-ticket-id\]'\)/, 'owner deve decorar os cards existentes sem reconstruir a lista');
assert.match(readings, /candidate\.id === `ticket-\$\{card\.dataset\.ticketId\}`/, 'reading deve ser associado ao chamado correspondente');
assert.match(readings, /if \(!suggestion\) \{\s*existing\?\.remove\(\);\s*return;/, 'card sem reading útil deve continuar sem complemento visual');
assert.match(readings, /facts\.insertAdjacentHTML\('beforebegin', listReadingMarkup\(item\)\)/, 'reading deve ser secundária aos fatos oficiais do chamado');
assert.doesNotMatch(command, /ticketReading|inferReading|pmh:ticket-readings/, 'ticket-command não pode virar owner da interpretação');

assert.match(readings, /window\.addEventListener\('pmh:ticket-readings', \(event\) => \{[\s\S]*enrichedSnapshot = event\.detail\.snapshot;[\s\S]*scheduleDecorate\(\)/, 'evento complementar deve atualizar a lista quando readings chegam');
assert.match(readings, /window\.dispatchEvent\(new CustomEvent\('pmh:ticket-readings'/, 'contrato existente de readings deve ser preservado');

const inferCount = (readings.match(/const inferReading =/g) || []).length;
assert.equal(inferCount, 1, 'ticket-readings deve continuar sendo o único ponto de inferência neste módulo');
const detailFetches = readings.match(/fetch\(`\/api\/sults\/chamados\/\$\{encodeURIComponent\(item\.sourceId\)\}`/g) || [];
assert.equal(detailFetches.length, 1, 'não deve existir nova chamada de interpretação/leitura além da já existente');

assert.match(readings, /const decorateDrawer = \(snapshot\) =>/, 'drawer deve continuar decorado pelo owner');
assert.match(readings, /\.pmh-ticket-drawer-panel:not\(\.loading\)/, 'integração do drawer deve permanecer');
assert.match(details, /pmh-ticket-drawer/, 'drawer principal deve continuar existente');

assert.match(command, /data-command-filter="unit"/, 'filtros atuais devem permanecer');
assert.match(command, /const groupKey = \(ticket\) =>/, 'agrupamentos atuais devem permanecer');
assert.match(command, /class="status status-\$\{esc\(ticket\.situation/, 'status SULTS continua sendo renderizado pela lista oficial');
assert.doesNotMatch(readings, /class="status status-|ticket\.situation\s*=/, 'reading não pode substituir ou escrever status SULTS');

assert.match(ignored, /Excluir do Hub/, 'ignore existente deve permanecer');
assert.match(ignored, /Restaurar no Hub/, 'restauração existente deve permanecer');

assert.doesNotMatch(readings, /\/api\/hub\//, 'reading da lista não deve criar backend novo');
assert.doesNotMatch(readings, /localStorage/, 'reading da lista não deve criar nova persistência');

console.log('Chamados: leitura operacional complementar na lista validada com ownership, evento, limites e fluxos existentes preservados.');
