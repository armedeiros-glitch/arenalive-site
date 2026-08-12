import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (relativePath) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const rootEntry = read('index.html');
const workspace = read('planet-hub/assets/inauguration-workspace-v2.js');
const workspaceCss = read('planet-hub/assets/inauguration-workspace-v2.css');
const finance = read('planet-hub/assets/financeiro-v1.js');
const access = read('planet-hub/assets/hub-access-v1.js');

assert.match(rootEntry, /inauguration-workspace-v2\.css\?v=20260808-2/);
assert.match(rootEntry, /inauguration-workspace-v2\.js\?v=20260812-1/);
assert.doesNotMatch(rootEntry, /finance-placement-v1\.js/);
assert.match(rootEntry, /andre-os-mobile-shell-v2\.js\?v=20260807-11/);

assert.match(workspace, /Separar brindes\/cupons/);
assert.match(workspace, /50 potes P para degustação/);
assert.match(workspace, /aos-thinking-floating-trigger pmh-inauguration-finance-access/);
assert.match(workspace, /actions\?\.remove\(\)/);
assert.match(workspace, /pmh:view-rendered/);
assert.doesNotMatch(workspace, /MutationObserver/);

assert.match(workspaceCss, /\.pmh-inauguration-finance-access\.aos-thinking-floating-trigger/);
assert.match(workspaceCss, /\.pmh-inauguration-finance-grid/);
assert.match(workspaceCss, /@media \(max-width: 820px\)/);

assert.match(finance, /finance: '\/api\/hub\/financeiro'/);
assert.match(finance, /inaugurations: '\/api\/hub\/inauguracoes'/);
assert.match(finance, /String\(payment\.inaugurationId \|\| ''\) === id/);
assert.match(finance, /data-inauguration-panel-budget/);
assert.match(finance, /data-inauguration-finance-new-payment/);
assert.match(finance, /data-inauguration-finance-new-supplier/);
assert.match(finance, /data-finance-edit-payment/);
assert.match(finance, /data-finance-edit-supplier/);
assert.doesNotMatch(finance, /MutationObserver|injectNav|openFinance|state\.active/);

assert.match(access, /financeiro-v1\.js\?v=20260805-5/);

console.log('AndreOS inauguration workspace v2: tests passed');
