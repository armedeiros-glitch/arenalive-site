import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rules = await readFile(new URL('../planet-hub/assets/inauguration-owner-rules-v1.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

assert.match(rules, /criacao\/ajuste do instagram'\) return 'Franqueadora'/);
assert.match(rules, /criacao\/ajuste do facebook'\) return 'Franqueadora'/);
assert.match(rules, /google meu negocio'\) return 'Franqueadora'/);
assert.match(rules, /video de inauguracao'\) return 'Franqueado'/);
assert.match(rules, /contratar influenciadores'\) return 'Franqueadora'/);
assert.match(rules, /contratar social media para inauguracao'\) return 'Franqueadora'/);
assert.match(rules, /contratar ornamentacao \/ arco de bolas'\) return 'Franqueadora'/);
assert.match(rules, /Enviar nomes\/@ e contatos dos influenciadores locais/);
assert.match(rules, /Enviar contato\/indicação de Social Media local/);
assert.match(rules, /Enviar contato\/empresa de ornamentação \/ arco de bolas/);
assert.match(rules, /daysBefore: 20/);
assert.match(rules, /pmh-checklist-owner-legend/);
assert.match(rules, /data-owner-scope/);
assert.doesNotMatch(rules, /MutationObserver/);
assert.match(html, /inauguration-owner-rules-v1\.js\?v=20260820-2/);

console.log('Inaugurações: responsáveis, contatos D-20, migração e leitura por cores validados.');
