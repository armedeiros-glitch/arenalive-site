import assert from 'node:assert/strict';
import { onRequestGet as today } from '../functions/api/radar/today.js';
import { onRequestGet as next } from '../functions/api/radar/next.js';

const originalFetch = globalThis.fetch;
const request = new Request('https://andre-os.test/api/radar');

try {
  for (const handler of [today, next]) {
    const response = await handler({ request, env: {} });
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.code, 'RADAR_NOT_CONFIGURED');
  }

  {
    const calls = [];
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify({
        date: '2026-08-11',
        recommended_task_id: 'task-2',
        tasks: [
          { id: 'task-1', content: 'Primeira tarefa' },
          { id: 'task-2', content: 'Foco recomendado pelo Radar' },
        ],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const response = await today({
      request,
      env: { RADAR_ANDRE_API_KEY: 'radar-secret', RADAR_ANDRE_BASE_URL: 'https://radar.test/' },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.date, '2026-08-11');
    assert.equal(body.recommended_task_id, 'task-2', 'today deve respeitar o foco escolhido pelo Radar');
    assert.equal(body.tasks.length, 2, 'today deve repassar as tarefas do Radar sem inventar itens');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://radar.test/api/v1/today');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer radar-secret');
    assert.equal(calls[0].options.method, undefined, 'consulta ao Radar deve permanecer GET e não destrutiva');
  }

  {
    const calls = [];
    globalThis.fetch = async (url, options = {}) => {
      calls.push({ url: String(url), options });
      return new Response(JSON.stringify({
        tasks: [{ id: 'next-1', content: 'Próximo foco' }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };

    const response = await next({
      request,
      env: { RADAR_API_KEY: 'fallback-key', RADAR_ANDRE_BASE_URL: 'https://radar.test' },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.recommended_task_id, 'next-1');
    assert.deepEqual(body.tasks, [{ id: 'next-1', content: 'Próximo foco' }]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://radar.test/api/v1/next');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer fallback-key');
    assert.equal(calls[0].options.method, undefined, 'next deve permanecer uma consulta GET');
  }

  {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'token rejeitado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });

    for (const handler of [today, next]) {
      const response = await handler({ request, env: { RADAR_ANDRE_API_KEY: 'bad-token' } });
      const body = await response.json();
      assert.equal(response.status, 502, '401 do Radar não deve vazar como autenticação do usuário do André OS');
      assert.equal(body.code, 'RADAR_UPSTREAM_ERROR');
    }
  }

  console.log('Radar André: leitura, foco, autenticação upstream e ausência de escrita validados.');
} finally {
  globalThis.fetch = originalFetch;
}
