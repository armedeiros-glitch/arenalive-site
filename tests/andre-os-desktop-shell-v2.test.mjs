import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [indexHtml, access, shell, styles, fiveStars, fiveStarsStyles] = await Promise.all([
  read('index.html'),
  read('planet-hub/assets/hub-access-v1.js'),
  read('planet-hub/assets/andre-os-desktop-shell-v2.js'),
  read('planet-hub/assets/andre-os-desktop-shell-v2.css'),
  read('planet-hub/assets/planet-five-stars-v1.js'),
  read('planet-hub/assets/planet-five-stars-v1.css'),
]);

assert.match(indexHtml, /andre-os-desktop-shell-v2\.css\?v=/);
assert.match(indexHtml, /andre-os-home-refine-v3\.css\?v=/);
assert.match(indexHtml, /planet-five-stars-v1\.css\?v=/);
assert.match(indexHtml, /hub-access-v1\.js\?v=/);

const sequence = access.match(/const SCRIPT_SEQUENCE = \[([\s\S]*?)\n  \];/)?.[1] || '';
const pagesIndex = sequence.indexOf('andre-os-home-pages-v1.js');
const fiveStarsIndex = sequence.indexOf('planet-five-stars-v1.js');
const shellIndex = sequence.indexOf('andre-os-desktop-shell-v2.js');
const notificationsIndex = sequence.indexOf('planet-notifications-v1.js');
assert.ok(pagesIndex >= 0, 'As páginas existentes devem continuar carregadas.');
assert.ok(fiveStarsIndex > pagesIndex, 'Planet 5 Estrelas deve carregar depois das páginas base.');
assert.doesNotMatch(sequence, /planet-acquisition-v1\.js/, 'Aquisição deve sair da sequência global.');
assert.ok(shellIndex > fiveStarsIndex, 'O shell desktop deve continuar depois dos módulos Planet globais.');
assert.ok(notificationsIndex > shellIndex, 'Notificações devem continuar carregando depois do shell.');
assert.match(access, /andre-os-home-pages-v1\.js\?v=/);
assert.match(access, /planet-five-stars-v1\.js\?v=/);
assert.match(access, /ACQUISITION_SCRIPT = '\/planet-hub\/assets\/planet-acquisition-v1\.js\?v=/);
assert.match(access, /loadAcquisitionForCurrentView/);
assert.match(access, /andre-os-desktop-shell-v2\.js\?v=/);
assert.match(access, /5-estrelas/);
assert.match(access, /aquisicao/);

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
assert.match(shell, /key: 'marketing', label: 'Marketing', hash: '#marketing'/);
assert.doesNotMatch(shell, /key: 'demandas', label: 'Demandas'/);
assert.doesNotMatch(shell, /key: 'radar', label: 'Radar'/);
assert.match(shell, /hash === 'marketing' \|\| hash\.includes\('demanda'\) \|\| hash\.includes\('radar'\)/);
assert.match(shell, /key: 'campanhas', label: 'Campanhas', hash: '#calendario'/);
assert.match(shell, /key: 'inauguracoes', label: 'Inaugurações', hash: '#inauguracoes'/);
assert.match(shell, /key: 'chamados', label: 'Chamados', hash: '#chamados'/);
assert.match(shell, /key: 'aquisicao', label: 'Aquisição', hash: '#aquisicao'/);
assert.match(shell, /hash\.includes\('aquis'\)/);
assert.match(shell, /key: 'expansao', label: 'Expansão', hash: '#expansao'/);
assert.match(shell, /key: 'cinco-estrelas', label: '5 Estrelas', hash: '#5-estrelas'/);
assert.match(shell, /key: 'central', label: 'Central', hash: '#conteudos'/);
assert.match(shell, /hash\.includes\('5-estrelas'\)/);
assert.match(shell, /TRABALHO \/ PLANET CHOCOLATE/);
assert.match(shell, /ANDRÉ OS \/ INÍCIO/);
assert.match(shell, /planet:expansion-section-rendered/);
assert.doesNotMatch(shell, /MutationObserver/);
assert.doesNotMatch(shell, /fetch\(/);
assert.doesNotMatch(shell, /localStorage|sessionStorage/);

assert.match(fiveStars, /Planet 5 Estrelas/);
assert.match(fiveStars, /data-p5-tab="overview"/);
assert.match(fiveStars, /data-p5-tab="units"/);
assert.match(fiveStars, /data-p5-tab="evaluations"/);
assert.match(fiveStars, /data-p5-tab="criteria"/);
assert.match(fiveStars, /data-p5-tab="actions"/);
assert.match(fiveStars, /Regulamento v4 em validação/);
assert.match(fiveStars, /Resultado Comercial/);
assert.match(fiveStars, /points: 35/);
assert.match(fiveStars, /Experiência do Cliente/);
assert.match(fiveStars, /points: 25/);
assert.match(fiveStars, /Marketing e Participação/);
assert.match(fiveStars, /Gestão da Franquia/);
assert.match(fiveStars, /min: 90, max: 100/);
assert.match(fiveStars, /Nota geral a partir de 90 pontos/);
assert.match(fiveStars, /Manutenção da pontuação por 2 ciclos consecutivos/);
assert.match(fiveStars, /Pin Bronze/);
assert.match(fiveStars, /Pin Diamante/);
assert.match(fiveStars, /Consolidação semestral/);
assert.match(fiveStars, /Lançamento oficial/);
assert.match(fiveStars, /dataset\.shellHash = '#5-estrelas'/);
assert.doesNotMatch(fiveStars, /fetch\(/);
assert.doesNotMatch(fiveStars, /localStorage|sessionStorage|MutationObserver/);
assert.match(fiveStarsStyles, /\.p5-page/);
assert.match(fiveStarsStyles, /\.p5-kpis/);
assert.match(fiveStarsStyles, /\.p5-pillar-grid/);
assert.match(fiveStarsStyles, /\.p5-classification-strip/);
assert.match(fiveStarsStyles, /@media\(max-width:820px\)/);

assert.match(styles, /@media \(min-width: 821px\)/);
assert.match(styles, /html\.aos-desktop-shell-v2-ready \.pmh-sidebar nav > :not\(\.aos-shell-v2-root\)/);
assert.match(styles, /\.aos-planet-context-nav/);
assert.match(styles, /html\.aos-shell-home-active \.pmh-decision-cockpit/);
assert.match(styles, /grid-template-columns:\s*minmax\(0, 1\.6fr\)/);
assert.match(styles, /html\.aos-shell-home-active \.pmh-attention-queue/);
assert.match(styles, /html\.aos-shell-home-active \.aos-home-page-today/);
assert.match(styles, /@media \(max-width: 820px\)/);
assert.match(styles, /\.aos-shell-v2-root,[\s\S]*\.aos-planet-context-nav[\s\S]*display:\s*none !important/);

console.log('Contrato do André OS Desktop Shell v2, Planet 5 Estrelas e Aquisição lazy validado.');