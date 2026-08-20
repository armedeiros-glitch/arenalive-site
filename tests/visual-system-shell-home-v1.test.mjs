import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../planet-hub/assets/andre-os-shell-home-v1.css', import.meta.url), 'utf8');

const systemPosition = index.indexOf('andre-os-visual-system-v1.css');
const shellHomePosition = index.indexOf('andre-os-shell-home-v1.css');
const mobilePosition = index.indexOf('andre-os-mobile-v1.css');
const darkPosition = index.indexOf('andre-os-dark-theme-v1.css');

assert.ok(systemPosition >= 0, 'o sistema visual oficial precisa estar carregado');
assert.ok(shellHomePosition > systemPosition, 'Shell + Home deve carregar depois dos tokens');
assert.ok(shellHomePosition < mobilePosition, 'o mobile aprovado deve continuar podendo especializar Shell + Home');
assert.ok(shellHomePosition < darkPosition, 'o dark mobile deve continuar carregando por último');

for (const token of [
  '--os-page',
  '--os-surface',
  '--os-text',
  '--os-border',
  '--os-accent',
  '--os-radius-lg',
  '--os-shadow-sm'
]) {
  assert.ok(css.includes(`var(${token})`), `Shell + Home deve consumir ${token}`);
}

assert.ok(css.includes('html:not(.aos-mobile) .pmh-topbar'), 'o shell desktop deve estar explicitamente isolado');
assert.ok(css.includes('.pmh-hero'), 'a Home deve migrar o hero');
assert.ok(css.includes('.pmh-metric'), 'a Home deve migrar métricas');
assert.ok(css.includes('.pmh-shortcuts'), 'a Home deve migrar atalhos');

for (const forbidden of [
  '.pmh-active-row',
  '.pmh-command-',
  '.pmh-campaign-',
  '.pmh-expansion-',
  '.pmh-inauguration-'
]) {
  assert.equal(css.includes(forbidden), false, `este PR não deve alcançar ${forbidden}`);
}

assert.equal(css.includes('MutationObserver'), false, 'migração visual não deve observar o DOM');
assert.equal(css.includes('!important'), false, 'o módulo oficial não deve depender de !important');

console.log('visual-system-shell-home-v1: ok');
