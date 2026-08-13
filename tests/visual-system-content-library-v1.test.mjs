import fs from 'node:fs';
import assert from 'node:assert/strict';

const css = fs.readFileSync('planet-hub/assets/content-library-v1.css', 'utf8');
const source = fs.readFileSync('planet-hub/assets/content-library-v1.js', 'utf8');
const libraryBlock = css.split('.pmh-inauguration-finance-access')[0];

assert.match(libraryBlock, /var\(--os-surface\)/);
assert.match(libraryBlock, /var\(--os-text\)/);
assert.match(libraryBlock, /var\(--os-border\)/);
assert.match(libraryBlock, /var\(--os-accent\)/);
assert.match(libraryBlock, /var\(--os-success\)/);
assert.match(libraryBlock, /var\(--os-warning\)/);
assert.match(libraryBlock, /var\(--os-danger\)/);
assert.doesNotMatch(libraryBlock, /background:\s*#fff(?:fff)?\b/i);
assert.doesNotMatch(libraryBlock, /!important/);
assert.doesNotMatch(libraryBlock, /MutationObserver/);

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();
const canonicalValues = (items) => {
  const values = new Map();
  items.forEach((item) => {
    const display = String(item || '').trim();
    const key = normalize(display);
    if (display && key && !values.has(key)) values.set(key, display);
  });
  return [...values.values()].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }));
};
const resolveCanonicalValue = (value, suggestions) => {
  const clean = String(value || '').trim();
  if (!clean) return '';
  const key = normalize(clean);
  return suggestions.find((suggestion) => normalize(suggestion) === key) || clean;
};

assert.deepEqual(canonicalValues(['Páscoa Planet', 'pascoa planet', ' Páscoa Planet ', 'Natal']), ['Natal', 'Páscoa Planet']);
assert.deepEqual(canonicalValues(['Mueller', ' mueller ', 'Müller']), ['Mueller']);
assert.equal(resolveCanonicalValue('PASCOA PLANET', ['Páscoa Planet']), 'Páscoa Planet');
assert.equal(resolveCanonicalValue('  Campanha Nova  ', ['Páscoa Planet']), 'Campanha Nova');
assert.equal(resolveCanonicalValue('Unidade Nova', []), 'Unidade Nova');
assert.equal(resolveCanonicalValue('', []), '');

assert.match(source, /const canonicalValues =/);
assert.match(source, /const resolveCanonicalValue =/);
assert.match(source, /name="campaign" list="pmh-content-campaigns"/);
assert.match(source, /name="unit" list="pmh-content-units"/);
assert.match(source, /canonicalValues\(\(state\.data \|\| \[\]\)\.map\(\(content\) => content\.campaign\)\)/);
assert.match(source, /canonicalValues\(\(state\.data \|\| \[\]\)\.map\(\(content\) => content\.unit\)\)/);
assert.match(source, /normalize\(item\.campaign\) !== normalize\(state\.filters\.campaign\)/);
assert.match(source, /normalize\(item\.unit\) !== normalize\(state\.filters\.unit\)/);
assert.match(source, /const haystack = normalize\(/);
assert.match(source, /campaign:\s*existing .* resolveCanonicalValue/s);
assert.match(source, /unit:\s*existing .* resolveCanonicalValue/s);
assert.doesNotMatch(source, /campaignId|unitId|relationId/);

console.log('visual system content library + autocomplete: ok');
