import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (relativePath) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const access = read('planet-hub/assets/hub-access-v1.js');
const rootEntry = read('index.html');
const hubEntry = read('planet-hub/index.html');

assert.match(access, /financeiro-v1\.js\?v=20260805-5/);
assert.match(rootEntry, /hub-access-v1\.js\?v=20260805-7/);
assert.match(hubEntry, /hub-access-v1\.js\?v=20260805-7/);
assert.equal(rootEntry, hubEntry, 'as duas entradas devem carregar exatamente o mesmo sistema');

console.log('AndreOS inauguration cache contract: tests passed');
