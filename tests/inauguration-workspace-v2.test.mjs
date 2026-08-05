import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (relativePath) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const rootEntry = read('index.html');
const hubEntry = read('planet-hub/index.html');
const unifiedHub = read('planet-hub/assets/unified-hub-v1.js');
const workspace = read('planet-hub/assets/inauguration-workspace-v2.js');
const workspaceCss = read('planet-hub/assets/inauguration-workspace-v2.css');
const finance = read('planet-hub/assets/financeiro-v1.js');
const access = read('planet-hub/assets/hub-access-v1.js');

for (const entry of [rootEntry, hubEntry]) {
  assert.match(entry, /inauguration-workspace-v2\.css\?v=/);
  assert.match(entry, /inauguration-workspace-v2\.js\?v=/);
  assert.doesNotMatch(entry, /finance-placement-v1\.js/);
  assert.match(entry, /andre-os-mobile-shell-v2\.js\?v=/);
}

assert.match(unifiedHub, /\['Separar brindes\/cupons', 'Franqueado', 5\]/);
assert.doesNotMatch(unifiedHub, /50 potes P para degustação/);
assert.match(workspace, /const OLD_CHECKLIST_LABEL = 'Separar brindes\/cupons'/);
assert.match(workspace, /const NEW_CHECKLIST_LABEL = '50 potes P para degustação'/);
assert.match(workspace, /label\.textContent = NEW_CHECKLIST_LABEL/);
assert.doesNotMatch(workspace, /entry\.action\s*=/);
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

assert.match(access, /financeiro-v1\.js\?v=/);

console.log('AndreOS inauguration workspace v2: tests passed');
