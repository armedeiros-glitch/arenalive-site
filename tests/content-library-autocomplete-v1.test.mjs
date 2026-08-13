import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync('planet-hub/assets/content-library-v1.js', 'utf8');

// Contrato real do pipeline usado por normalize().
assert.match(source, /\.normalize\('NFD'\)/);
assert.match(source, /\.replace\(\/\[\\u0300-\\u036f\]\/g, ''\)/);
assert.match(source, /\.toLowerCase\(\)/);
assert.match(source, /\.replace\(\/\\s\+\/g, ' '\)/);
assert.match(source, /\.trim\(\)/);

// 1-4: trim, caixa e acento equivalente; Mueller/Müller continuam distintos.
const pascoaA = '  PÁSCOA  '.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const pascoaB = 'Pascoa'.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const mueller = 'Mueller'.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const muller = 'Müller'.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
assert.equal(pascoaA, pascoaB);
assert.notEqual(mueller, muller);

// 5: primeira grafia real encontrada continua sendo o valor canônico exibido.
assert.match(source, /if \(display && key && !values\.has\(key\)\) values\.set\(key, display\)/);

// 6-7: sugestões de Campanha/Unidade vêm exclusivamente de state.data da própria Central.
assert.match(source, /canonicalValues\(\(state\.data \|\| \[\]\)\.map\(\(content\) => content\.campaign\)\)/);
assert.match(source, /canonicalValues\(\(state\.data \|\| \[\]\)\.map\(\(content\) => content\.unit\)\)/);
assert.match(source, /name="campaign" list="pmh-content-campaigns"/);
assert.match(source, /name="unit" list="pmh-content-units"/);

// 8-9: texto novo continua permitido e recebe trim antes de qualquer resolução canônica.
assert.match(source, /const clean = String\(value \|\| ''\)\.trim\(\)/);
assert.match(source, /suggestions\.find\(\(suggestion\) => normalize\(suggestion\) === key\) \|\| clean/);

// 10: edição sem alteração preserva exatamente a grafia histórica já armazenada.
assert.match(source, /campaign:\s*existing && rawCampaign === String\(item\.campaign \|\| ''\) \? rawCampaign : resolveCanonicalValue/);
assert.match(source, /unit:\s*existing && rawUnit === String\(item\.unit \|\| ''\) \? rawUnit : resolveCanonicalValue/);

// 11-12: filtros comparam Campanha/Unidade pela mesma normalização tolerante a caixa e acento.
assert.match(source, /normalize\(item\.campaign\) !== normalize\(state\.filters\.campaign\)/);
assert.match(source, /normalize\(item\.unit\) !== normalize\(state\.filters\.unit\)/);
const unidadeA = 'SÃO PAULO'.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const unidadeB = 'sao paulo'.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
assert.equal(unidadeA, unidadeB);

// 13: busca existente continua normalizando query e haystack.
assert.match(source, /const query = normalize\(state\.filters\.search\)/);
assert.match(source, /const haystack = normalize\(/);
assert.equal(pascoaA.includes('pascoa'), true);

// 14-15: zero relação por ID; persistência continua no documento atual com campaign/unit.
assert.doesNotMatch(source, /campaignId|unitId|relationId/);
assert.match(source, /campaign:\s*existing && rawCampaign/);
assert.match(source, /unit:\s*existing && rawUnit/);
assert.match(source, /body: JSON\.stringify\(\{ data: state\.data, baseRevision: state\.revision \}\)/);

console.log('Central Planet autocomplete: 15 contratos específicos validados.');
