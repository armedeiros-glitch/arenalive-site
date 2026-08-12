import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sourcePath = new URL('../planet-hub/assets/planet-next-step-v1.js', import.meta.url);
const source = fs.readFileSync(sourcePath, 'utf8');

assert.doesNotMatch(source, /domChecklistStep/, 'fallback DOM de Inaugurações deve ser removido');
assert.doesNotMatch(source, /\.pmh-inauguration-card/, 'Next Step não deve ler cards renderizados de Inaugurações');
assert.doesNotMatch(source, /\.pmh-checklist/, 'Next Step não deve reconstruir checklist pelo DOM');
assert.doesNotMatch(source, /\.pmh-inauguration-project-row-main/, 'unidade não deve vir do DOM de Inaugurações');
assert.match(source, /inauguracoes: \['inaugurations', 'contexts'\]/, 'coleta seletiva de Inaugurações deve permanecer');
assert.match(source, /PMHRadarData\.collect\(\{ sources, maxAgeMs: 15000 \}\)/, 'maxAge e coleta seletiva devem permanecer');
assert.match(source, /fetchJson\(API\.inaugurations\)/, 'fallback persistido deve continuar usando API de Inaugurações');
assert.match(source, /checklist\.find\(stepIsLate\) \|\| checklist\[0\]/, 'etapa atrasada deve preceder a primeira pendente');

for (const campaignToken of [
  "document.querySelectorAll('.pmh-campaign-focus-card[data-edit-campaign]')",
  "document.querySelectorAll('[data-edit-campaign]')",
  'Definir responsável para',
  'Definir o próximo marco de',
]) {
  assert.ok(source.includes(campaignToken), `fallback de Campanhas deve permanecer: ${campaignToken}`);
}

const runScenario = async ({ radarItem, projects }) => {
  const calls = { collect: [], fetch: [] };
  const listeners = new Map();
  let placeholder = null;

  const target = {
    querySelector(selector) {
      if (selector === '[data-planet-next-step]') return placeholder;
      throw new Error(`consulta DOM inesperada em Inaugurações: ${selector}`);
    },
    prepend(node) {
      placeholder = node;
      node.isConnected = true;
    },
  };

  const document = {
    readyState: 'complete',
    querySelector(selector) {
      if (selector === '[data-content]') return target;
      throw new Error(`consulta DOM inesperada: ${selector}`);
    },
    querySelectorAll(selector) {
      throw new Error(`querySelectorAll inesperado no fluxo de Inaugurações: ${selector}`);
    },
    createElement() {
      return {
        dataset: {},
        className: '',
        innerHTML: '',
        isConnected: false,
        remove() { this.isConnected = false; },
      };
    },
    addEventListener() {},
  };

  const window = {
    matchMedia() {
      return { matches: true, addEventListener() {} };
    },
    PMHRadarData: {
      dueMeta(value) {
        const key = String(value || '').slice(0, 10);
        return { label: key || 'Sem prazo', bucket: key && key < '2026-08-12' ? 'late' : 'future', weight: 0 };
      },
      async collect(options) {
        calls.collect.push(options);
        return { items: radarItem ? [radarItem] : [] };
      },
    },
    addEventListener(name, handler) {
      const handlers = listeners.get(name) || [];
      handlers.push(handler);
      listeners.set(name, handlers);
    },
  };

  const fetch = async (url) => {
    calls.fetch.push(url);
    return {
      ok: true,
      async json() { return { ok: true, data: projects }; },
    };
  };

  const context = vm.createContext({
    window,
    document,
    location: { hash: '#inauguracoes' },
    fetch,
    Intl,
    Date,
    String,
    Array,
    Number,
    Boolean,
    Set,
    Map,
    Promise,
    console,
    cancelAnimationFrame() {},
    requestAnimationFrame(callback) { callback(); return 1; },
  });

  vm.runInContext(source, context, { filename: 'planet-next-step-v1.js' });
  for (let i = 0; i < 8; i += 1) await Promise.resolve();

  return { calls, placeholder };
};

{
  const app = await runScenario({
    radarItem: {
      id: 'inauguration-1', action: 'inauguracoes', title: 'Unidade Centro',
      nextAction: 'Confirmar treinamento da equipe', dueDate: '2026-08-20',
    },
    projects: [{ unit: 'Unidade Centro', checklist: [{ title: 'Etapa API', dueDate: '2026-08-01' }] }],
  });
  assert.deepEqual(Array.from(app.calls.collect[0].sources), ['inaugurations', 'contexts']);
  assert.equal(app.calls.collect[0].maxAgeMs, 15000);
  assert.equal(app.calls.fetch.length, 0, 'próximo passo explícito do Radar deve ter prioridade sobre a API');
  assert.match(app.placeholder.innerHTML, /Confirmar treinamento da equipe/);
}

{
  const app = await runScenario({
    radarItem: { id: 'inauguration-2', action: 'inauguracoes', title: 'Unidade Norte', dueDate: '2026-08-25' },
    projects: [{
      unit: 'Unidade Norte',
      checklist: [
        { title: 'Primeira pendente', dueDate: '2026-08-20' },
        { title: 'Etapa atrasada', dueDate: '2026-08-01' },
      ],
    }],
  });
  assert.deepEqual(app.calls.fetch, ['/api/hub/inauguracoes']);
  assert.match(app.placeholder.innerHTML, /Concluir Etapa atrasada/);
  assert.match(app.placeholder.innerHTML, /ETAPA ATRASADA/);
}

{
  const app = await runScenario({
    radarItem: null,
    projects: [{
      unit: 'Unidade Sul',
      checklist: [
        { title: 'Etapa concluída', done: true, dueDate: '2026-08-01' },
        { title: 'Primeira pendente', dueDate: '2026-08-20' },
        { title: 'Segunda pendente', dueDate: '2026-08-25' },
      ],
    }],
  });
  assert.deepEqual(app.calls.fetch, ['/api/hub/inauguracoes']);
  assert.match(app.placeholder.innerHTML, /Concluir Primeira pendente/);
  assert.match(app.placeholder.innerHTML, /Unidade Sul/);
}

console.log('Planet Next Step: Inaugurações sem fallback DOM, com Radar explícito e checklist persistido preservados.');
