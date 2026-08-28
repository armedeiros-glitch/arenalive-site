import assert from 'node:assert/strict';
import fs from 'node:fs';
import { onRequestGet } from '../functions/api/sults/implantacoes.js';

const originalFetch = globalThis.fetch;
const SNAPSHOT_KEY = 'planet-hub:sults-implantacoes-completas:v1';
const STATUS_KEY = 'planet-hub:sults-implantacoes-status:v1';
const requestFor = (query = '?start=0&limit=10') => new Request(`https://andre-os.test/api/sults/implantacoes${query}`);

const makeKv = ({ snapshot = null, status = null } = {}) => {
  const writes = [];
  const values = new Map();
  if (snapshot) values.set(SNAPSHOT_KEY, snapshot);
  if (status) values.set(STATUS_KEY, status);
  return {
    writes,
    async get(key) { return values.get(key) || null; },
    async put(key, value) {
      const parsed = JSON.parse(value);
      writes.push({ key, value: parsed });
      values.set(key, parsed);
    },
  };
};

const rawProject = (id, overrides = {}) => ({
  id,
  nome: `Projeto ${id}`,
  unidade: { id, nomeFantasia: `Planet ${id}`, cnpj: String(id).padStart(14, '0') },
  modelo: { nome: 'Quiosque' },
  categoria: { nome: 'Implantação' },
  responsavel: { nome: 'Responsável Teste' },
  ativo: true,
  pausado: false,
  concluido: false,
  dtCriacao: '2026-08-01',
  dtInicio: '2026-08-02',
  dtFim: '2026-09-30',
  etiqueta: [],
  ...overrides,
});

const mappedProject = (id, overrides = {}) => ({
  source: 'sults',
  sultsProjectId: id,
  unit: `Planet ${id}`,
  active: true,
  paused: false,
  completed: false,
  status: 'ativo',
  startDate: '2026-08-02',
  endDate: '2026-09-30',
  ...overrides,
});

try {
  {
    const response = await onRequestGet({ env: {}, request: requestFor() });
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.match(body.error, /SULTS_API_TOKEN/);
  }

  {
    const kv = makeKv();
    let calls = 0;
    globalThis.fetch = async (url, options = {}) => {
      calls += 1;
      const parsed = new URL(url);
      assert.equal(parsed.pathname, '/api/v1/implantacao/projeto');
      assert.equal(parsed.searchParams.get('start'), '0');
      assert.equal(parsed.searchParams.get('limit'), '10');
      assert.equal(options.headers.Authorization, 'token-sults');
      return new Response(JSON.stringify({
        start: 0,
        limit: 10,
        totalPage: 1,
        size: 1,
        data: [rawProject(123, { unidade: { id: 55, nomeFantasia: 'Planet Centro', cnpj: '00000000000100' } })],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const response = await onRequestGet({
      env: { SULTS_API_TOKEN: 'token-sults', PLANET_HUB_DATA: kv },
      request: requestFor(),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(calls, 1);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].unit, 'Planet Centro');
    assert.equal(body.data[0].status, 'ativo');
    assert.equal(body.filters.scope, 'operational', 'a API usada pela tela deve ser operacional por padrão');
    assert.equal(body.reliability.source, 'sults-live');
    assert.equal(body.reliability.stale, false);
    assert.equal(body.warning, null);
    const snapshotWrite = kv.writes.find((item) => item.key === SNAPSHOT_KEY);
    assert.ok(snapshotWrite, 'leitura ao vivo deve atualizar o snapshot');
    assert.equal(snapshotWrite.value.complete, true);
    assert.equal(snapshotWrite.value.version, 2);
  }

  {
    const kv = makeKv();
    const starts = [];
    globalThis.fetch = async (url) => {
      const parsed = new URL(url);
      const start = Number(parsed.searchParams.get('start'));
      starts.push(start);
      const data = start === 0 ? [rawProject(1), rawProject(2)] : [rawProject(3)];
      return new Response(JSON.stringify({ start, limit: 2, totalPage: 2, size: 3, data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
    const response = await onRequestGet({
      env: { SULTS_API_TOKEN: 'token-sults', PLANET_HUB_DATA: kv },
      request: requestFor('?start=0&limit=2'),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(starts, [0, 2], 'snapshot completo deve percorrer todas as páginas reportadas');
    assert.equal(body.data.length, 2, 'resposta continua respeitando limit solicitado');
    assert.equal(body.pagination.size, 3, 'paginação deve conhecer o dataset operacional completo');
    assert.equal(body.pagination.rawSize, 3);
    const snapshotWrite = kv.writes.find((item) => item.key === SNAPSHOT_KEY);
    assert.equal(snapshotWrite.value.data.length, 3, 'snapshot deve guardar as duas páginas antes de se declarar completo');
  }

  {
    const snapshot = {
      version: 2,
      complete: true,
      fetchedAt: new Date(Date.now() - 60_000).toISOString(),
      data: [
        mappedProject(1),
        mappedProject(2, { active: false, paused: true, status: 'pausado' }),
        mappedProject(3, { active: true, completed: true, status: 'concluido' }),
        mappedProject(4, { active: false, completed: false, status: 'inativo' }),
      ],
      pagination: { pages: [{ page: 1, start: 0, received: 4 }], reportedTotalPage: 1 },
    };
    const kv = makeKv({ snapshot });
    let calls = 0;
    globalThis.fetch = async () => { calls += 1; throw new Error('não deveria chamar'); };
    const response = await onRequestGet({
      env: { SULTS_API_TOKEN: 'token-sults', PLANET_HUB_DATA: kv },
      request: requestFor('?start=0&limit=100'),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(calls, 0, 'snapshot com menos de 15 minutos deve evitar nova chamada ao SULTS');
    assert.deepEqual(body.data.map((item) => item.sultsProjectId), [1, 2],
      'default operacional deve manter ativos e pausados, excluindo concluídos e inativos');
    assert.equal(body.pagination.rawSize, 4);
    assert.equal(body.pagination.size, 2);
    assert.equal(body.filters.scope, 'operational');
    assert.equal(body.reliability.source, 'shared-cache');
    assert.equal(body.reliability.stale, false, 'cache recente é confiável, não um fallback velho');

    const historicalResponse = await onRequestGet({
      env: { SULTS_API_TOKEN: 'token-sults', PLANET_HUB_DATA: kv },
      request: requestFor('?start=0&limit=100&scope=all'),
    });
    const historical = await historicalResponse.json();
    assert.equal(historicalResponse.status, 200);
    assert.equal(calls, 0, 'scope histórico deve reaproveitar o mesmo snapshot completo');
    assert.deepEqual(historical.data.map((item) => item.sultsProjectId), [1, 2, 3, 4],
      'scope=all deve preservar o histórico bruto para auditoria');
    assert.equal(historical.pagination.size, 4);
    assert.equal(historical.pagination.rawSize, 4);
    assert.equal(historical.filters.scope, 'all');
  }

  {
    const snapshot = {
      version: 2,
      complete: true,
      fetchedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      data: [mappedProject(987, { unit: 'Planet Cache' })],
      pagination: { pages: [], reportedTotalPage: 1 },
    };
    const status = {
      failedAt: new Date(Date.now() - 60_000).toISOString(),
      failure: { status: 429, details: { raw: 'Too Many Requests' } },
    };
    const kv = makeKv({ snapshot, status });
    let calls = 0;
    globalThis.fetch = async () => { calls += 1; throw new Error('não deveria chamar no cooldown'); };
    const response = await onRequestGet({
      env: { SULTS_API_TOKEN: 'token-sults', PLANET_HUB_DATA: kv },
      request: requestFor(),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(calls, 0, 'falha recente deve criar cooldown e evitar martelar o SULTS');
    assert.equal(body.data[0].unit, 'Planet Cache');
    assert.equal(body.filters.scope, 'operational');
    assert.equal(body.reliability.stale, true);
    assert.equal(body.reliability.throttled, true);
    assert.equal(body.reliability.liveFailure.status, 429);
  }

  {
    const snapshot = {
      version: 2,
      complete: true,
      fetchedAt: new Date(Date.now() - 120 * 60_000).toISOString(),
      data: [mappedProject(654, { unit: 'Planet Fallback' })],
      pagination: { pages: [], reportedTotalPage: 1 },
    };
    const kv = makeKv({ snapshot });
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'temporariamente indisponível' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
    const response = await onRequestGet({
      env: { SULTS_API_TOKEN: 'token-sults', PLANET_HUB_DATA: kv },
      request: requestFor(),
    });
    const body = await response.json();
    assert.equal(response.status, 200, 'snapshot completo deve manter o módulo disponível');
    assert.equal(body.data[0].unit, 'Planet Fallback');
    assert.equal(body.filters.scope, 'operational');
    assert.equal(body.reliability.complete, true);
    assert.equal(body.reliability.stale, true);
    assert.equal(body.reliability.source, 'shared-cache');
    assert.equal(body.reliability.liveFailure.status, 503);
    assert.match(body.warning, /última leitura completa/i);
    const statusWrite = kv.writes.find((item) => item.key === STATUS_KEY && item.value.failedAt);
    assert.equal(statusWrite.value.failure.status, 503, 'falha deve ficar registrada para o cooldown seguinte');
  }

  {
    const kv = makeKv();
    globalThis.fetch = async () => { throw new Error('network down'); };
    const response = await onRequestGet({
      env: { SULTS_API_TOKEN: 'token-sults', PLANET_HUB_DATA: kv },
      request: requestFor(),
    });
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.filters.scope, 'operational');
    assert.equal(body.reliability.complete, false);
    assert.equal(body.reliability.source, 'unavailable');
  }

  const unifiedHub = fs.readFileSync(new URL('../planet-hub/assets/unified-hub-v1.js', import.meta.url), 'utf8');
  const hubAccess = fs.readFileSync(new URL('../planet-hub/assets/hub-access-v1.js', import.meta.url), 'utf8');
  const eject = fs.readFileSync(new URL('../planet-hub/assets/andre-os-eject-v1.js', import.meta.url), 'utf8');

  assert.match(unifiedHub, /projects: '\/api\/sults\/implantacoes\?start=0&limit=100'/,
    'owner vivo de Inaugurações deve consumir o default operacional da API');
  assert.match(hubAccess, /unified-hub-v1\.js/,
    'bootstrap deve continuar carregando o owner vivo');
  assert.doesNotMatch(hubAccess, /implantations-v1\.js/,
    'teste não pode voltar a proteger um frontend órfão como se fosse a tela viva');
  assert.match(eject, /\/api\/sults\/implantacoes\?start=0&limit=100&scope=all/,
    'EJECT deve pedir explicitamente o dataset histórico completo');
  assert.doesNotMatch(unifiedHub, /NÃO USAR ESSE MODELO|NAO USAR ESSE MODELO/,
    'owner vivo não deve depender de nome/modelo arbitrário para esconder projeto');

  console.log('SULTS implantações: owner vivo, default operacional, histórico explícito, cache e fallback validados.');
} finally {
  globalThis.fetch = originalFetch;
}
