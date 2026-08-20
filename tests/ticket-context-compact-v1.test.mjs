import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [command, shim, bridge, css, html] = await Promise.all([
  readFile(new URL('../planet-hub/assets/ticket-command-v1.js', import.meta.url), 'utf8'),
  readFile(new URL('../planet-hub/assets/ticket-command-v2.js', import.meta.url), 'utf8'),
  readFile(new URL('../planet-hub/assets/ticket-context-compact-v1.js', import.meta.url), 'utf8'),
  readFile(new URL('../planet-hub/assets/ticket-context-compact-v1.css', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
]);

assert.match(command, /\/api\/hub\/radar-contextos/);
assert.match(command, /data-ticket-context/);
assert.match(command, /contextDefers/);
assert.match(command, /Aguardando \/ contextualizados/);
assert.match(command, /responsável ou apoio/);
assert.match(shim, /ticket-command-v1\.js\?v=20260820-restore-1/);
assert.match(bridge, /PMHRadarContext/);
assert.match(bridge, /PMHRadarData/);
assert.match(bridge, /CONTEXTO ANDRÉ OS/);
assert.match(bridge, /\+ Adicionar contexto/);
assert.doesNotMatch(bridge, /localStorage|sessionStorage|MutationObserver|setInterval/);
assert.match(css, /pmh-ticket-drawer-header h2/);
assert.match(css, /pmh-command-metric\{min-height:88px/);
assert.match(css, /pmh-ticket-saved-context/);

const mobileMarker = '@media(max-width:820px){';
const mobileIndex = css.indexOf(mobileMarker);
assert.ok(mobileIndex >= 0);
assert.doesNotMatch(css.slice(0, mobileIndex), /!important/);
assert.match(css.slice(mobileIndex), /\.pmh-ticket-compact-active \.pmh-ticket-drawer-panel/);

assert.match(html, /ticket-context-compact-v1\.css\?v=20260808-1/);
assert.match(html, /ticket-context-compact-v1\.js\?v=20260807-1/);
assert.match(html, /ticket-command-v2\.js\?v=20260820-1/);

console.log('Contexto rápido preservado com owner estável de Chamados.');
