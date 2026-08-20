import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const rules = await readFile(new URL('../planet-hub/assets/inauguration-owner-rules-v1.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
assert.match(rules, /criacao\/ajuste do instagram'\) return 'Franqueadora'/);
assert.match(rules, /criacao\/ajuste do facebook'\) return 'Franqueadora'/);
assert.match(rules, /google meu negocio'\) return 'Franqueadora'/);
assert.match(rules, /video de inauguracao'\) return 'Franqueado'/);
assert.match(html, /inauguration-owner-rules-v1\.js\?v=20260820-1/);
console.log('Inaugurações: responsáveis sociais e vídeo corrigidos.');
