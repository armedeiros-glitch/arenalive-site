import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const index = read('index.html');
const access = read('planet-hub/assets/hub-access-v1.js');
const reportSource = read('planet-hub/assets/inauguration-finance-report-v1.js');
const financeSource = read('planet-hub/assets/financeiro-v1.js');

assert.match(index, /hub-access-v1\.js\?v=20260812-2/, 'bootstrap real precisa invalidar o cache do loader atualizado');
assert.match(access, /inauguration-finance-report-v1\.js\?v=20260812-1/, 'loader atualizado precisa carregar o módulo do relatório');
assert.equal((access.match(/inauguration-finance-report-v1\.js/g) || []).length, 1, 'não pode existir segundo módulo de relatório');
assert.match(financeSource, /data-inauguration-finance-export>Exportar esta implantação/, 'CSV precisa continuar disponível');
assert.match(reportSource, /const ensureReportButton = \(\) =>/);
assert.match(reportSource, /toolbar\.querySelector\('\[data-inauguration-finance-report\]'\)/, 'injeção precisa impedir duplicação');
assert.match(reportSource, /openReport\(\)\.catch/, 'clique do botão deve continuar usando o fluxo A4 existente');
assert.match(reportSource, /pmh:inauguration-finance-updated/, 'salvamentos do Financeiro precisam disparar reinserção');

const documentListeners = new Map();
const windowListeners = new Map();
let reportButton = null;
let mounted = true;
const timers = [];

const exportButton = {
  before(button) { reportButton = button; },
};
const toolbar = {
  querySelector(selector) {
    if (selector === '[data-inauguration-finance-export]') return exportButton;
    if (selector === '[data-inauguration-finance-report]') return reportButton;
    return null;
  },
};

const document = {
  addEventListener(name, handler) {
    const handlers = documentListeners.get(name) || [];
    handlers.push(handler);
    documentListeners.set(name, handlers);
  },
  querySelector(selector) {
    if (selector === '.pmh-inauguration-finance-toolbar') return mounted ? toolbar : null;
    if (selector === '[data-inauguration-panel-budget]') return null;
    return null;
  },
  createElement(tag) {
    assert.equal(tag, 'button');
    return { type: '', dataset: {}, textContent: '' };
  },
};

const window = {
  localStorage: { getItem() { return '[]'; } },
  PlanetInaugurationFinance: { payments: [], calculate() { return {}; } },
  addEventListener(name, handler) {
    const handlers = windowListeners.get(name) || [];
    handlers.push(handler);
    windowListeners.set(name, handlers);
  },
  setTimeout(handler) { timers.push(handler); return timers.length; },
  open() { return null; },
  alert() {},
};

vm.runInNewContext(reportSource, {
  window,
  document,
  fetch: async () => ({ ok: true, json: async () => ({}) }),
  Intl,
  Date,
  Map,
  Set,
  String,
  Number,
  Error,
  console,
});

const flushTimers = () => {
  while (timers.length) timers.shift()();
};
const emitWindow = (name) => {
  for (const handler of windowListeners.get(name) || []) handler({ type: name });
};
const emitDocument = (name, token) => {
  const target = {
    closest(selector) { return selector.includes(token) ? this : null; },
  };
  for (const handler of documentListeners.get(name) || []) handler({ target, preventDefault() {} });
};
const expectSingleButtonAfter = (label, trigger) => {
  reportButton = null;
  mounted = true;
  trigger();
  flushTimers();
  assert.ok(reportButton, `${label}: botão deve existir após re-render`);
  const same = reportButton;
  trigger();
  flushTimers();
  assert.equal(reportButton, same, `${label}: botão não pode duplicar`);
};

flushTimers();
assert.ok(reportButton, 'abrir Financeiro com toolbar montada deve mostrar o botão');
assert.equal(reportButton.textContent, 'Gerar relatório para o Financeiro');

mounted = false;
reportButton = null;
emitDocument('click', '[data-inauguration-finance-open]');
flushTimers();
assert.equal(reportButton, null, 'enquanto o painel ainda não existe, não deve inventar botão fora da toolbar');
mounted = true;
emitWindow('pmh:inauguration-finance-updated');
flushTimers();
assert.ok(reportButton, 'quando o carregamento financeiro termina, botão deve ser inserido');

expectSingleButtonAfter('re-render financeiro', () => emitWindow('pmh:inauguration-finance-updated'));
expectSingleButtonAfter('novo pagamento', () => emitDocument('click', '[data-inauguration-finance-new-payment]'));
expectSingleButtonAfter('editar pagamento', () => emitDocument('click', '[data-finance-edit-payment]'));
expectSingleButtonAfter('excluir pagamento', () => emitDocument('click', '[data-finance-delete-payment]'));
expectSingleButtonAfter('voltar de submodal', () => emitDocument('click', '[data-finance-close]'));
expectSingleButtonAfter('alterar status', () => emitDocument('change', '[data-payment-status]'));

assert.equal((reportSource.match(/Gerar relatório para o Financeiro/g) || []).length, 1, 'módulo deve manter uma única definição do botão');

console.log('Inaugurações: bootstrap e reinserção confiável do botão de relatório financeiro validados.');
