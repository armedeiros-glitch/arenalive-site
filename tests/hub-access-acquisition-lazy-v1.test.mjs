import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const hubSource = read('planet-hub/assets/hub-access-v1.js');
const acquisitionSource = read('planet-hub/assets/planet-acquisition-v1.js');
const shellSource = read('planet-hub/assets/andre-os-desktop-shell-v2.js');

const ACQUISITION = '/planet-hub/assets/planet-acquisition-v1.js?v=20260807-1';
const expectedGlobalScripts = [
  '/planet-hub/assets/unified-hub-v1.js?v=20260812-1',
  '/planet-hub/assets/financeiro-v1.js?v=20260812-2',
  '/planet-hub/assets/inauguration-finance-report-v1.js?v=20260812-1',
  '/planet-hub/assets/planet-expansion-v1.js?v=20260828-2',
  '/planet-hub/assets/planet-expansion-contact-trail-v1.js?v=20260828-1',
  '/planet-hub/assets/andre-os-navigation-drawers-v1.js?v=20260811-1',
  '/planet-hub/assets/andre-os-home-pages-v1.js?v=20260807-3',
  '/planet-hub/assets/inauguration-timing-core-v1.js?v=20260828-1',
  '/planet-hub/assets/andre-os-operational-reconciliation-v1.js?v=20260828-2',
  '/planet-hub/assets/andre-os-radar-home-v1.js?v=20260828-1',
  '/planet-hub/assets/planet-five-stars-v1.js?v=20260807-2',
  '/planet-hub/assets/planet-five-stars-data-v1.js?v=20260807-1',
  '/planet-hub/assets/planet-five-stars-import-v1.js?v=20260807-1',
  '/planet-hub/assets/planet-five-stars-actions-v1.js?v=20260813-1',
  '/planet-hub/assets/andre-os-desktop-shell-v2.js?v=20260807-4',
  '/planet-hub/assets/planet-notifications-v1.js?v=20260828-2',
];

const sequenceBlock = hubSource.match(/const SCRIPT_SEQUENCE = \[([\s\S]*?)\n  \];/)?.[1] || '';
assert.ok(sequenceBlock, 'SCRIPT_SEQUENCE deve continuar declarada no bootstrap');
assert.ok(!sequenceBlock.includes('planet-acquisition-v1.js'), 'Aquisição não pode permanecer na sequência global');
for (const src of expectedGlobalScripts) assert.ok(sequenceBlock.includes(src), `entrada global deve permanecer: ${src}`);
assert.equal((sequenceBlock.match(/\/planet-hub\/assets\//g) || []).length, expectedGlobalScripts.length, 'nenhuma outra entrada global deve ser removida ou adicionada');
assert.ok(
  sequenceBlock.indexOf('planet-expansion-v1.js') < sequenceBlock.indexOf('planet-expansion-contact-trail-v1.js'),
  'trilha de contato deve carregar depois do owner principal da Expansão',
);
assert.ok(
  sequenceBlock.indexOf('inauguration-timing-core-v1.js') < sequenceBlock.indexOf('andre-os-operational-reconciliation-v1.js'),
  'timing de inaugurações deve carregar antes da reconciliação operacional',
);
assert.match(hubSource, /const ACQUISITION_SCRIPT = '\/planet-hub\/assets\/planet-acquisition-v1\.js\?v=20260807-1'/);
assert.match(hubSource, /currentView\(\) !== 'aquisicao'/, 'lazy load deve depender exclusivamente da rota Aquisição');
assert.match(hubSource, /if \(acquisitionLoading\) return acquisitionLoading/, 'bootstrap deve compartilhar load já em andamento');
assert.match(hubSource, /acquisitionLoaded = true/, 'bootstrap deve guardar load concluído');
assert.match(shellSource, /hash: '#aquisicao'/, 'navegação para Aquisição deve continuar fora do módulo lazy');
assert.match(acquisitionSource, /const API = '\/api\/hub\/planet\/acquisition\/lp-franquias'/, 'API interna de Aquisição deve permanecer');
assert.match(acquisitionSource, /ensureStyles\(\)/, 'CSS continua sob responsabilidade do próprio módulo');
assert.match(acquisitionSource, /const render = \(\) =>/, 'renderização de Aquisição deve permanecer intacta');
assert.match(acquisitionSource, /window\.addEventListener\('hashchange'/, 'lifecycle atual do módulo deve permanecer');

const flush = async (rounds = 80) => {
  for (let i = 0; i < rounds; i += 1) await Promise.resolve();
};

const bootAt = async (initialHash) => {
  const appended = [];
  const listeners = new Map();
  const content = {};
  const location = { hash: initialHash, reload() {} };

  const window = {
    PMH_ACCESS: null,
    addEventListener(name, handler) {
      const handlers = listeners.get(name) || [];
      handlers.push(handler);
      listeners.set(name, handlers);
    },
    dispatchEvent(event) {
      for (const handler of listeners.get(event.type) || []) handler(event);
    },
  };

  const document = {
    readyState: 'complete',
    documentElement: { classList: { remove() {} } },
    body: { innerHTML: '' },
    head: {
      appendChild(node) {
        appended.push(node.src);
        queueMicrotask(() => node.onload?.());
        return node;
      },
    },
    createElement(tag) {
      if (tag !== 'script') throw new Error(`elemento inesperado no bootstrap: ${tag}`);
      return { src: '', defer: false, onload: null, onerror: null };
    },
    querySelector(selector) {
      if (selector === '[data-content]') return content;
      return null;
    },
    addEventListener() {},
  };

  const fetch = async (url) => {
    assert.equal(url, '/api/hub/session', 'bootstrap lazy não deve chamar API de Aquisição');
    return {
      ok: true,
      async json() { return { configured: false, authenticated: true }; },
    };
  };

  class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  }

  const context = vm.createContext({
    window,
    document,
    location,
    fetch,
    CustomEvent,
    FormData: class {},
    Error,
    String,
    Promise,
    console,
    queueMicrotask,
    requestAnimationFrame(callback) { callback(); return 1; },
  });

  vm.runInContext(hubSource, context, { filename: 'hub-access-v1.js' });
  await flush();

  const navigate = async (hash) => {
    location.hash = hash;
    for (const handler of listeners.get('hashchange') || []) handler({ type: 'hashchange' });
    await flush(20);
  };

  return { appended, navigate };
};

for (const route of ['#marketing', '#chamados']) {
  const app = await bootAt(route);
  assert.deepEqual(app.appended, expectedGlobalScripts, `${route} não deve carregar Aquisição`);
  assert.equal(app.appended.filter((src) => src === ACQUISITION).length, 0);
}

{
  const app = await bootAt('#aquisicao');
  assert.deepEqual(app.appended.slice(0, expectedGlobalScripts.length), expectedGlobalScripts, 'bootstrap global deve preservar sua ordem');
  assert.equal(app.appended.at(-1), ACQUISITION, 'entrada direta em Aquisição deve carregar o módulo após o bootstrap global');
  assert.equal(app.appended.filter((src) => src === ACQUISITION).length, 1);
}

{
  const app = await bootAt('#marketing');
  await app.navigate('#lp-franquias');
  assert.equal(app.appended.filter((src) => src === ACQUISITION).length, 1, 'navegação posterior deve carregar Aquisição');
  await app.navigate('#chamados');
  await app.navigate('#aquisicao');
  assert.equal(app.appended.filter((src) => src === ACQUISITION).length, 1, 'retorno a Aquisição não pode duplicar o asset');
}

console.log('Hub Access: Aquisição lazy, trilha da Expansão e timing operacional de inaugurações validados.');
