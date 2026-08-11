import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../planet-hub/assets/radar-data-v1.js', import.meta.url), 'utf8');

const calls = [];
const events = [];
const responses = new Map();
const deferreds = new Map();

const data = {
  tickets: [{ id: 't1', title: 'Chamado ativo', situation: { id: 1, name: 'Aberta' }, responsible: 'Ágata', plannedResolutionAt: '2026-08-12' }],
  inaugurations: [{ id: 'i1', unit: 'Unidade Centro', responsible: 'André', openingDate: '2026-08-20', checklist: [{ done: false }] }],
  demands: [{ id: 'd1', title: 'Criar campanha interna', origin: 'direction', responsible: 'André', status: 'in_progress', priority: 'high', dueDate: '2026-08-13', category: 'Marketing', updatedAt: '2026-08-11T12:00:00Z' }],
  contents: [{ id: 'c1', title: 'Reels da semana', status: 'producao', responsible: 'Ágata', dueDate: '2026-08-14', category: 'Social', format: 'Reels', tags: [], updatedAt: '2026-08-11T13:00:00Z' }],
  campaigns: [{ id: '2026-08-01__campanha-teste', status: 'planejamento', responsible: 'André', milestoneDate: '2026-08-18', nextMilestone: 'Briefing' }],
  contexts: [{ itemId: 'demand-d1', state: 'waiting_approval', reason: 'Aguardando diretoria', dependsOn: 'Diretoria', nextAction: 'Cobrar aprovação', followUpDate: '2026-08-12' }],
};

const routeKey = (url) => {
  if (url.includes('/api/sults/chamados')) return 'tickets';
  if (url.includes('/api/hub/inauguracoes')) return 'inaugurations';
  if (url.includes('/api/hub/demandas-internas')) return 'demands';
  if (url.includes('/api/hub/conteudos')) return 'contents';
  if (url.includes('/api/hub/campanhas')) return 'campaigns';
  if (url.includes('/api/hub/radar-contextos')) return 'contexts';
  return '';
};

const makeResponse = (key) => {
  const configured = responses.get(key);
  if (configured instanceof Error) {
    return new Response(JSON.stringify({ error: configured.message }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ data: configured ?? data[key] ?? [] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};

const fetchMock = async (url) => {
  const key = routeKey(String(url));
  calls.push(key);
  if (!key) throw new Error(`Rota inesperada: ${url}`);
  const deferred = deferreds.get(key);
  if (deferred) return deferred.promise;
  return makeResponse(key);
};

class CustomEventMock {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
}

const windowMock = {
  dispatchEvent(event) {
    events.push(event);
    return true;
  },
};

const context = {
  window: windowMock,
  fetch: fetchMock,
  Response,
  CustomEvent: CustomEventMock,
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

vm.runInNewContext(source, context, { filename: 'radar-data-v1.js' });
const radar = windowMock.PMHRadarData;
assert.ok(radar, 'RadarData deve continuar publicado em window.PMHRadarData.');

// 1, 2, 3 e 5: leitura seletiva, apenas loader pedido, Demandas sem SULTS e erro isolado.
calls.length = 0;
let snapshot = await radar.collect({ sources: ['demands'] });
assert.deepEqual(calls, ['demands'], 'Demandas não deve disparar outras fontes.');
assert.equal(snapshot.items.length, 1);
assert.equal(snapshot.items[0].id, 'demand-d1');
assert.equal(snapshot.items[0].status, 'Em andamento');
assert.deepEqual(Object.keys(snapshot.sources), ['demands']);
assert.equal(snapshot.sources.demands.reliability, 'fresh');
assert.deepEqual(snapshot.errors, []);

calls.length = 0;
snapshot = await radar.collect({ sources: ['contents'] });
assert.deepEqual(calls, ['contents'], 'Conteúdos não deve disparar SULTS nem outras fontes.');
assert.equal(snapshot.items[0].id, 'content-c1');
assert.equal(snapshot.items[0].status, 'Em produção');

responses.set('tickets', new Error('SULTS indisponível'));
radar.invalidate(['tickets']);
calls.length = 0;
const ticketsFailure = await radar.collect({ sources: ['tickets'] });
assert.deepEqual(calls, ['tickets']);
assert.deepEqual(ticketsFailure.errors, ['SULTS']);
assert.equal(ticketsFailure.sources.tickets.reliability, 'error');
assert.match(ticketsFailure.sources.tickets.error, /SULTS indisponível/);

calls.length = 0;
const demandsAfterTicketFailure = await radar.collect({ sources: ['demands'] });
assert.deepEqual(calls, [], 'Cache de Demandas deve permanecer válido após erro de tickets.');
assert.deepEqual(demandsAfterTicketFailure.errors, [], 'Erro de tickets não pode contaminar Demandas.');
assert.equal(demandsAfterTicketFailure.sources.demands.reliability, 'fresh');

// 6: caches independentes não se atropelam.
radar.invalidate(['demands']);
calls.length = 0;
await radar.collect({ sources: ['demands'] });
assert.deepEqual(calls, ['demands']);
calls.length = 0;
await radar.collect({ sources: ['contents'] });
assert.deepEqual(calls, [], 'Invalidar Demandas não deve invalidar Conteúdos.');

// 7: chamadas simultâneas da mesma fonte compartilham pending.
radar.invalidate(['demands']);
let resolveDemand;
deferreds.set('demands', {
  promise: new Promise((resolve) => { resolveDemand = resolve; }),
});
calls.length = 0;
const demandA = radar.collect({ sources: ['demands'] });
const demandB = radar.collect({ sources: ['demands'] });
await Promise.resolve();
assert.equal(calls.filter((key) => key === 'demands').length, 1, 'Pending da mesma fonte deve ser compartilhado.');
resolveDemand(makeResponse('demands'));
await Promise.all([demandA, demandB]);
deferreds.delete('demands');

// 8: fontes diferentes mantêm pendings independentes.
radar.invalidate(['demands', 'contents']);
let resolveDemandsIndependent;
let resolveContentsIndependent;
deferreds.set('demands', {
  promise: new Promise((resolve) => { resolveDemandsIndependent = resolve; }),
});
deferreds.set('contents', {
  promise: new Promise((resolve) => { resolveContentsIndependent = resolve; }),
});
calls.length = 0;
const independentDemands = radar.collect({ sources: ['demands'] });
const independentContents = radar.collect({ sources: ['contents'] });
await Promise.resolve();
assert.equal(calls.filter((key) => key === 'demands').length, 1);
assert.equal(calls.filter((key) => key === 'contents').length, 1);
resolveDemandsIndependent(makeResponse('demands'));
resolveContentsIndependent(makeResponse('contents'));
await Promise.all([independentDemands, independentContents]);
deferreds.delete('demands');
deferreds.delete('contents');

// 1 e 9: collect() legado continua completo e mantém normalização/contexto esperado.
responses.delete('tickets');
radar.invalidate();
calls.length = 0;
events.length = 0;
const legacy = await radar.collect();
assert.equal(new Set(calls).size, 6, 'collect() legado deve consultar as seis fontes.');
assert.equal(calls.length, 6);
assert.deepEqual(Object.keys(legacy.sources).sort(), ['campaigns', 'contents', 'contexts', 'demands', 'inaugurations', 'tickets']);
assert.deepEqual(legacy.errors, []);
const legacyDemand = legacy.items.find((item) => item.id === 'demand-d1');
assert.ok(legacyDemand);
assert.equal(legacyDemand.origin, 'Direção');
assert.equal(legacyDemand.status, 'Em andamento');
assert.equal(legacyDemand.operationalState, 'waiting_approval');
assert.equal(legacyDemand.dependsOn, 'Diretoria');
assert.ok(legacy.items.some((item) => item.id === 'content-c1' && item.action === 'conteudos'));
assert.ok(events.some((event) => event.type === 'pmh:radar-data'), 'Snapshot completo deve manter evento legado.');

// Snapshot parcial não pode substituir semanticamente o snapshot completo.
const fullSnapshot = radar.getSnapshot();
await radar.collect({ sources: ['demands'] });
assert.equal(radar.getSnapshot(), fullSnapshot, 'Coleta parcial não deve substituir o último snapshot completo.');
assert.ok(events.some((event) => event.type === 'pmh:radar-data-partial'), 'Coleta parcial deve possuir evento próprio.');

console.log('RadarData seletivo: compatibilidade, isolamento por fonte, cache e pending validados.');