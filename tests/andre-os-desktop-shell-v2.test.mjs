import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [indexHtml, access, shell, styles] = await Promise.all([
  read('index.html'),
  read('planet-hub/assets/hub-access-v1.js'),
  read('planet-hub/assets/andre-os-desktop-shell-v2.js'),
  read('planet-hub/assets/andre-os-desktop-shell-v2.css'),
]);

assert.match(indexHtml, /andre-os-desktop-shell-v2\.css\?v=20260806-1/);
assert.match(indexHtml, /hub-access-v1\.js\?v=20260806-4/);

const pagesIndex = access.indexOf('andre-os-home-pages-v1.js');
const shellIndex = access.indexOf('andre-os-desktop-shell-v2.js');
const notificationsIndex = access.indexOf('planet-notifications-v1.js');
assert.ok(pagesIndex >= 0, 'As páginas existentes devem continuar carregadas.');
assert.ok(shellIndex > pagesIndex, 'O shell desktop deve montar depois das páginas existentes.');
assert.ok(notificationsIndex > shellIndex, 'Notificações devem continuar carregando depois do shell.');

assert.match(shell, /data-shell-hash="#inicio"/);
assert.match(shell, /data-shell-environment="trabalho"/);
assert.match(shell, /data-shell-workspace="planet"/);
assert.match(shell, />Planet Chocolate</);
assert.doesNotMatch(shell, /próxima etapa/);
assert.doesNotMatch(shell, />Pessoal </);
assert.doesNotMatch(shell, />Laboratório </);
assert.match(shell, /OPERATING SYSTEM/);
assert.match(shell, /André OS · ambiente principal/);
assert.match(shell, /Ambiente Planet Chocolate/);
assert.match(shell, /aos-shell-home-active/);
assert.match(shell, /aos-shell-planet-active/);

assert.match(shell, /key: 'planet', label: 'Visão geral', hash: '#planet'/);
assert.match(shell, /key: 'demandas', label: 'Demandas', hash: '#demandas'/);
assert.match(shell, /key: 'radar', label: 'Radar', hash: '#radar'/);
assert.match(shell, /key: 'campanhas', label: 'Campanhas', hash: '#calendario'/);
assert.match(shell, /key: 'inauguracoes', label: 'Inaugurações', hash: '#inauguracoes'/);
assert.match(shell, /key: 'chamados', label: 'Chamados', hash: '#chamados'/);
assert.match(shell, /key: 'expansao', label: 'Expansão', hash: '#expansao'/);
assert.match(shell, /key: 'central', label: 'Central', hash: '#conteudos'/);
assert.match(shell, /TRABALHO \/ PLANET CHOCOLATE/);
assert.match(shell, /ANDRÉ OS \/ INÍCIO/);
assert.match(shell, /planet:expansion-section-rendered/);
assert.doesNotMatch(shell, /MutationObserver/);
assert.doesNotMatch(shell, /fetch\(/);
assert.doesNotMatch(shell, /localStorage|sessionStorage/);

assert.match(styles, /@media \(min-width: 821px\)/);
assert.match(styles, /html\.aos-desktop-shell-v2-ready \.pmh-sidebar nav > :not\(\.aos-shell-v2-root\)/);
assert.match(styles, /\.aos-planet-context-nav/);
assert.match(styles, /html\.aos-shell-home-active \.pmh-decision-cockpit/);
assert.match(styles, /grid-template-columns:\s*minmax\(0, 1\.6fr\)/);
assert.match(styles, /html\.aos-shell-home-active \.pmh-attention-queue/);
assert.match(styles, /html\.aos-shell-home-active \.aos-home-page-today/);
assert.match(styles, /@media \(max-width: 820px\)/);
assert.match(styles, /\.aos-shell-v2-root,[\s\S]*\.aos-planet-context-nav[\s\S]*display:\s*none !important/);

console.log('Contrato do André OS Desktop Shell v2 validado.');
