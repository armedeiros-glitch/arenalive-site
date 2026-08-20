import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/sults/chamados.js';

const originalFetch = globalThis.fetch;

const requestFor = (query = '') => new Request(`https://andre-os.test/api/sults/chamados${query}`);

const makeKv = ({ snapshot = null, ignored = [] } = {}) => {
  const writes = [];
  return {
    writes,
    async get(key) {
      if (key === 'planet-hub:chamados-ignorados:v1') return { data: ignored };
      if (key.startsWith('planet-hub:sults-chamados-completos:v2:')) return snapshot;
      return null;
    },
    async put(key, value) {
      writes.push({ key, value: JSON.parse(value) });
    },
  };
};

const ticket = (id, situation = 1) => ({
  id,
  titulo: `Chamado ${id}`,
  situacao: situation,
  unidade: { id: 10, nome: 'Planet Chocolate · Unidade Teste' },
  departamento: { id: 10, nome: 'Marketing' },
  responsavel: { id: 77, nome: 'André Roberto Medeiros' },
  solicitante: { id: 88, nome: 'Franqueado Teste' },
  apoio: [],
  etiqueta: [],
  aberto: '2026-08-10T12:00:00.000Z',
  ultimaAlteracao: '2026-08-11T12:00:00.000Z',
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
    globalThis.fetch = async (url) => {
      calls += 1;
      const parsed = new URL(url);
      const situation = Number(parsed.searchParams.get('situacao') || 1);
      return new Response(JSON.stringify({ data: [ticket(`live-${situation}`, situation)] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const response = await onRequestGet({
      env: { SULTS_API_TOKEN: 'test-token', PLANET_HUB_DATA: kv },
      request: requestFor(),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(calls, 4, 'deve consultar as quatro situações ativas');
    assert.equal(body.data.length, 4);
    assert.equal(body.reliability.complete, true);
    assert.equal(body.reliability.stale, false);
    assert.equal(body.reliability.source, 'sults-live');
    assert.equal(body.warning, null);
    assert.equal(kv.writes.length, 1, 'leitura completa deve atualizar o snapshot compartilhado');
    assert.equal(kv.writes[0].value.complete, true);
  }

  {
    const cachedTicket = {
      source: 'sults',
      id: 'cached-1',
      sultsTicketId: 'cached-1',
      title: 'Chamado em cache',
      unit: 'Planet Chocolate · Unidade Cache',
      departmentId: 10,
      responsible: 'André Roberto Medeiros',
      responsibleId: 77,
      support: [],
      labels: [],
      openedAt: '2026-08-10T12:00:00.000Z',
      lastUpdatedAt: '2026-08-11T12:00:00.000Z',
    };
    const kv = makeKv({
      snapshot: {
        version: 2,
        complete: true,
        fetchedAt: new Date(Date.now() - 60_000).toISOString(),
        tickets: [cachedTicket],
        queryStats: [],
      },
    });

    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'upstream unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await onRequestGet({
      env: { SULTS_API_TOKEN: 'test-token', PLANET_HUB_DATA: kv },
      request: requestFor(),
    });
    const body = await response.json();

    assert.equal(response.status, 200, 'snapshot completo deve manter o módulo disponível');
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].id, 'cached-1');
    assert.equal(body.reliability.complete, true);
    assert.equal(body.reliability.stale, true);
    assert.equal(body.reliability.source, 'shared-cache');
    assert.match(body.warning, /última leitura completa/i);
    assert.equal(body.reliability.liveFailure.status, 503);
  }

  
  {
    const kv = makeKv();
    globalThis.fetch = async (url) => {
      const parsed = new URL(url);
      const situation = Number(parsed.searchParams.get('situacao') || 1);
      const inQueue = ticket(`queue-${situation}`, situation);
      inQueue.responsavel = null;
      return new Response(JSON.stringify({ data: [inQueue] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    const response = await onRequestGet({
      env: { SULTS_API_TOKEN: 'test-token', PLANET_HUB_DATA: kv },
      request: requestFor('?scope=mine&includeIgnored=1'),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.length, 4, 'scope mine deve incluir chamados em fila do Marketing mesmo sem responsavel');
    assert.deepEqual(body.filters.membership, ['marketing-inbox', 'responsible', 'support']);
  }

console.log('SULTS chamados: contrato de token, leitura ao vivo e fallback por snapshot validado.');
} finally {
  globalThis.fetch = originalFetch;
}
