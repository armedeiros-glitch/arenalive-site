import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/api/sults/implantacoes.js';

const originalFetch = globalThis.fetch;
const request = new Request('https://andre-os.test/api/sults/implantacoes?start=0&limit=10');

const makeKv = (snapshot = null) => {
  const writes = [];
  return {
    writes,
    async get() { return snapshot; },
    async put(key, value) { writes.push({ key, value: JSON.parse(value) }); },
  };
};

try {
  {
    const response = await onRequestGet({ env: {}, request });
    const body = await response.json();
    assert.equal(response.status, 500);
    assert.match(body.error, /SULTS_API_TOKEN/);
  }

  {
    const kv = makeKv();
    globalThis.fetch = async (url, options = {}) => {
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
        data: [{
          id: 123,
          nome: 'Projeto Unidade Centro',
          unidade: { id: 55, nomeFantasia: 'Planet Centro', cnpj: '00000000000100' },
          modelo: { nome: 'Quiosque' },
          categoria: { nome: 'Implantação' },
          responsavel: { nome: 'Responsável Teste' },
          ativo: true,
          pausado: false,
          concluido: false,
          dtCriacao: '2026-08-01',
          dtInicio: '2026-08-02',
          etiqueta: [],
        }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const response = await onRequestGet({
      env: { SULTS_API_TOKEN: 'token-sults', PLANET_HUB_DATA: kv },
      request,
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.length, 1);
    assert.equal(body.data[0].unit, 'Planet Centro');
    assert.equal(body.data[0].status, 'ativo');
    assert.equal(body.reliability.source, 'sults-live');
    assert.equal(body.reliability.stale, false);
    assert.equal(body.warning, null);
    assert.equal(kv.writes.length, 1);
    assert.equal(kv.writes[0].value.complete, true);
  }

  {
    const snapshot = {
      version: 1,
      complete: true,
      fetchedAt: new Date(Date.now() - 120_000).toISOString(),
      data: [{ source: 'sults', sultsProjectId: 987, unit: 'Planet Cache', status: 'ativo' }],
      pagination: { start: 0, limit: 10, totalPage: 1, size: 1 },
    };
    const kv = makeKv(snapshot);
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'temporariamente indisponível' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });

    const response = await onRequestGet({
      env: { SULTS_API_TOKEN: 'token-sults', PLANET_HUB_DATA: kv },
      request,
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data[0].unit, 'Planet Cache');
    assert.equal(body.reliability.complete, true);
    assert.equal(body.reliability.stale, true);
    assert.equal(body.reliability.source, 'shared-cache');
    assert.equal(body.reliability.liveFailure.status, 503);
    assert.match(body.warning, /última leitura completa/i);
  }

  {
    const kv = makeKv(null);
    globalThis.fetch = async () => { throw new Error('network down'); };
    const response = await onRequestGet({
      env: { SULTS_API_TOKEN: 'token-sults', PLANET_HUB_DATA: kv },
      request,
    });
    const body = await response.json();
    assert.equal(response.status, 502);
    assert.equal(body.reliability.complete, false);
    assert.equal(body.reliability.source, 'unavailable');
  }

  console.log('SULTS implantações: leitura ao vivo, snapshot e indisponibilidade validados.');
} finally {
  globalThis.fetch = originalFetch;
}
