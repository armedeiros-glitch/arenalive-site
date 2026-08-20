import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const radarSource = await readFile(new URL('../planet-hub/assets/radar-data-v1.js', import.meta.url), 'utf8');
const readingsSource = await readFile(new URL('../planet-hub/assets/ticket-readings-v1.js', import.meta.url), 'utf8');
const marketingSource = await readFile(new URL('../planet-hub/assets/andre-os-home-pages-v1.js', import.meta.url), 'utf8');

assert.equal(readingsSource.includes('window.PMHRadarData ='), false, 'ticket-readings não pode substituir PMHRadarData');
assert.equal(readingsSource.includes('wrapRadar'), false, 'wrapper global deve ter sido removido');
assert.equal(readingsSource.includes('baseRadar'), false, 'ticket-readings não deve guardar facade/base para substituir RadarData');
assert.equal(readingsSource.includes('getSnapshot: () =>'), false, 'ticket-readings não redefine getSnapshot');
assert.equal(readingsSource.includes('collect: async'), false, 'ticket-readings não redefine collect');
assert.equal(readingsSource.includes('invalidate: () =>'), false, 'ticket-readings não redefine invalidate');
assert.ok(readingsSource.includes("CustomEvent('pmh:ticket-readings'"), 'readings deve usar evento complementar próprio');
assert.equal(readingsSource.includes("CustomEvent('pmh:radar-data'"), false, 'readings não deve se apresentar como snapshot bruto do RadarData');
assert.ok(readingsSource.includes("addEventListener('pmh:radar-data-partial'"), 'readings deve reconhecer snapshots parciais');
assert.ok(readingsSource.includes("hasOwnProperty.call(snapshot.sources, 'tickets')"), 'readings deve exigir a fonte tickets');
assert.ok(readingsSource.includes("sessionStorage.getItem(cacheKey(item))"), 'cache em sessionStorage deve permanecer');
assert.ok(readingsSource.includes("sessionStorage.setItem(cacheKey(item)"), 'gravação do cache deve permanecer');
assert.ok(readingsSource.includes('const CACHE_TTL_MS = 15 * 60 * 1000'), 'TTL de 15 minutos deve permanecer');
assert.ok(readingsSource.includes('const MAX_TICKETS = 5'), 'limite de cinco tickets deve permanecer');
assert.ok(readingsSource.includes("fetch(`/api/sults/chamados/${encodeURIComponent(item.sourceId)}`"), 'busca de detalhe SULTS deve permanecer');
assert.ok(readingsSource.includes("document.querySelector('.pmh-ticket-drawer-panel:not(.loading)')"), 'leitura sob demanda do drawer deve permanecer');
assert.ok(readingsSource.includes('requestDrawerReading(panel, snapshot, item)'), 'drawer deve continuar pedindo reading quando necessário');
assert.ok(marketingSource.includes("sources: ['demands', 'contents']"), 'Marketing deve continuar coletando somente demands + contents');

const listeners = new Map();
const dispatched = [];
const fetchCalls = [];
const sessionValues = new Map();

const addListener = (type, handler) => {
  if (!listeners.has(type)) listeners.set(type, []);
  listeners.get(type).push(handler);
};
const emit = (event) => {
  dispatched.push(event);
  (listeners.get(event.type) || []).forEach((handler) => handler(event));
  return true;
};

class CustomEventMock {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
}

class DOMParserMock {
  parseFromString(value) {
    return { body: { textContent: String(value || '').replace(/<[^>]+>/g, ' ') } };
  }
}

class MutationObserverMock {
  constructor(callback) { this.callback = callback; }
  observe() {}
  disconnect() {}
}

const elementStub = {
  querySelector() { return null; },
  querySelectorAll() { return []; },
  classList: { toggle() {}, remove() {}, add() {} },
};

const documentMock = {
  visibilityState: 'visible',
  documentElement: elementStub,
  addEventListener() {},
  querySelector() { return null; },
  querySelectorAll() { return []; },
  createElement() {
    return {
      dataset: {},
      innerHTML: '',
      querySelector() { return null; },
      insertAdjacentElement() {},
    };
  },
};

const data = {
  tickets: [{
    id: 't1',
    title: 'Chamado ativo',
    situation: { id: 1, name: 'Aberta' },
    responsible: 'Ágata',
    requester: 'Franqueado',
    plannedResolutionAt: '2026-08-12',
    lastChangeAt: '2026-08-12T10:00:00Z',
  }],
  inaugurations: [],
  demands: [{ id: 'd1', title: 'Demanda MKT', origin: 'direction', responsible: 'André', status: 'in_progress', priority: 'high', dueDate: '2026-08-13' }],
  contents: [{ id: 'c1', title: 'Reels', status: 'producao', responsible: 'Ágata', dueDate: '2026-08-14', tags: [] }],
  campaigns: [],
  contexts: [],
};

const routeKey = (url) => {
  if (url.includes('/api/sults/chamados?')) return 'tickets';
  if (url.includes('/api/hub/inauguracoes')) return 'inaugurations';
  if (url.includes('/api/hub/demandas-internas')) return 'demands';
  if (url.includes('/api/hub/conteudos')) return 'contents';
  if (url.includes('/api/hub/campanhas')) return 'campaigns';
  if (url.includes('/api/hub/radar-contextos')) return 'contexts';
  return '';
};

const fetchMock = async (input) => {
  const url = String(input);
  fetchCalls.push(url);
  if (/\/api\/sults\/chamados\/t1$/.test(url)) {
    return new Response(JSON.stringify({
      ticket: { id: 't1', requester: { name: 'Franqueado' }, responsible: { name: 'Ágata' } },
      timeline: [{
        createdAt: '2026-08-12T10:05:00Z',
        person: { name: 'Ágata' },
        interaction: { messageHtml: '<p>Vou enviar o material para aprovação hoje.</p>', internal: false },
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  const key = routeKey(url);
  if (!key) throw new Error(`Rota inesperada: ${url}`);
  return new Response(JSON.stringify({ data: data[key] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const windowMock = {
  addEventListener: addListener,
  dispatchEvent: emit,
};

const context = {
  window: windowMock,
  document: documentMock,
  navigator: { onLine: true },
  sessionStorage: {
    getItem(key) { return sessionValues.get(key) ?? null; },
    setItem(key, value) { sessionValues.set(key, value); },
  },
  fetch: fetchMock,
  Response,
  CustomEvent: CustomEventMock,
  DOMParser: DOMParserMock,
  MutationObserver: MutationObserverMock,
  setTimeout,
  clearTimeout,
  encodeURIComponent,
  Intl,
  Date,
  Map,
  Set,
  Promise,
  Object,
  Array,
  String,
  Number,
  Boolean,
  RegExp,
  Error,
  Math,
  console,
};

vm.runInNewContext(radarSource, context, { filename: 'radar-data-v1.js' });
const radarIdentity = windowMock.PMHRadarData;
const collectIdentity = radarIdentity.collect;
const snapshotIdentity = radarIdentity.getSnapshot;
const invalidateIdentity = radarIdentity.invalidate;

vm.runInNewContext(readingsSource, context, { filename: 'ticket-readings-v1.js' });
assert.equal(windowMock.PMHRadarData, radarIdentity, 'referência global de PMHRadarData deve permanecer idêntica');
assert.equal(windowMock.PMHRadarData.collect, collectIdentity, 'collect deve continuar sendo a função original do RadarData');
assert.equal(windowMock.PMHRadarData.getSnapshot, snapshotIdentity, 'getSnapshot deve continuar sendo a função original do RadarData');
assert.equal(windowMock.PMHRadarData.invalidate, invalidateIdentity, 'invalidate deve continuar sendo a função original do RadarData');

fetchCalls.length = 0;
dispatched.length = 0;
const marketingSnapshotBeforeReadings = await radarIdentity.collect({ sources: ['demands', 'contents'], force: true });
await new Promise((resolve) => setTimeout(resolve, 0));
assert.deepEqual(
  Array.from(marketingSnapshotBeforeReadings.items, (item) => String(item.id)).sort(),
  ['content-c1', 'demand-d1'],
);
assert.equal(fetchCalls.some((url) => url.includes('/api/sults/chamados')), false, 'snapshot sem tickets não pode chamar SULTS');
assert.equal(dispatched.some((event) => event.type === 'pmh:ticket-readings'), false, 'snapshot sem tickets não deve emitir readings');

fetchCalls.length = 0;
dispatched.length = 0;
const fullSnapshot = await radarIdentity.collect({ force: true });
await new Promise((resolve) => setTimeout(resolve, 5));
assert.ok(fullSnapshot.items.some((item) => item.id === 'ticket-t1'), 'coleta completa deve manter tickets');
assert.ok(fetchCalls.some((url) => /\/api\/sults\/chamados\/t1$/.test(url)), 'snapshot com tickets deve buscar detalhe para reading');
const readingEvent = dispatched.find((event) => event.type === 'pmh:ticket-readings');
assert.ok(readingEvent, 'reading deve ser publicada em evento complementar próprio');
assert.ok(readingEvent.detail.snapshot.items.find((item) => item.id === 'ticket-t1')?.ticketReading, 'evento complementar deve carregar snapshot derivado enriquecido');
assert.ok(readingEvent.detail.readings.some((item) => item.ticketId === 'ticket-t1'), 'evento deve expor reading por ticket');
assert.equal(dispatched.filter((event) => event.type === 'pmh:radar-data').length, 1, 'ticket-readings não deve redisparar pmh:radar-data e criar loop');
assert.ok([...sessionValues.keys()].some((key) => key.startsWith('pmh:ticket-reading:v1:t1:')), 'reading deve continuar sendo persistida em sessionStorage');

const officialFullSnapshot = radarIdentity.getSnapshot();
assert.equal(officialFullSnapshot, fullSnapshot, 'getSnapshot oficial não deve ser substituído pelo snapshot enriquecido');
assert.equal(officialFullSnapshot.items.find((item) => item.id === 'ticket-t1')?.ticketReading, undefined, 'snapshot oficial deve permanecer bruto quanto a readings');

fetchCalls.length = 0;
dispatched.length = 0;
const selectiveAfterReadings = await radarIdentity.collect({ sources: ['demands', 'contents'], force: true });
await new Promise((resolve) => setTimeout(resolve, 0));
assert.deepEqual(
  Array.from(selectiveAfterReadings.items, (item) => String(item.id)).sort(),
  ['content-c1', 'demand-d1'],
);
assert.deepEqual(Object.keys(selectiveAfterReadings.sources).sort(), ['contents', 'demands']);
assert.equal(fetchCalls.some((url) => url.includes('/api/sults/chamados')), false, 'readings anteriores não podem contaminar coleta seletiva posterior');
assert.equal(radarIdentity.getSnapshot(), officialFullSnapshot, 'coleta parcial continua sem substituir o último snapshot completo');

radarIdentity.invalidate();
fetchCalls.length = 0;
const legacyAgain = await radarIdentity.collect();
assert.deepEqual(Object.keys(legacyAgain.sources).sort(), ['campaigns', 'contents', 'contexts', 'demands', 'inaugurations', 'tickets']);
assert.ok(fetchCalls.some((url) => url.includes('/api/sults/chamados?')), 'collect() legado completo deve continuar consultando tickets');

console.log('Ticket readings desacoplado: RadarData preservado, seletividade respeitada, readings e cache mantidos.');
