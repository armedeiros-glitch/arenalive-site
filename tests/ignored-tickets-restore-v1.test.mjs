import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  onRequestGet as listIgnored,
  onRequestPost as ignoreTicket,
  onRequestDelete as restoreTicket,
} from '../functions/api/hub/chamados-ignorados.js';
import { onRequestGet as getTickets } from '../functions/api/sults/chamados.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const [ownerSource, removalSource] = await Promise.all([
  read('planet-hub/assets/ignored-tickets-v1.js'),
  read('planet-hub/assets/ticket-removal-v1.js'),
]);

assert.match(ownerSource, /data-open-ignored-tickets/, 'Chamados deve expor acesso aos ignorados');
assert.match(ownerSource, /Chamados ignorados/, 'o painel deve identificar a lista de ignorados');
assert.match(ownerSource, /Nenhum chamado ignorado\./, 'o estado vazio deve existir');
assert.match(ownerSource, /Carregando chamados ignorados/, 'o estado loading deve existir');
assert.match(ownerSource, /Não foi possível carregar os chamados ignorados/, 'o erro de carregamento deve existir');
assert.match(ownerSource, /data-ignored-retry/, 'o erro de carregamento deve permitir nova tentativa');
assert.match(ownerSource, /#\$\{esc\(item\.id\)\}/, 'a lista deve mostrar o ID');
assert.match(ownerSource, /item\.title/, 'a lista deve mostrar o título disponível');
assert.match(ownerSource, /item\.unit/, 'a lista deve mostrar a unidade disponível');
assert.match(ownerSource, /fmtDateTime\(item\.ignoredAt\)/, 'a lista deve mostrar quando foi ignorado');
assert.doesNotMatch(ownerSource, /item\.status|item\.responsible/, 'não deve inventar status ou responsável ausentes no contrato de ignorados');

assert.match(ownerSource, /data-restore-ticket/, 'cada item deve expor Restaurar no Hub');
assert.match(ownerSource, /method:\s*'DELETE'/, 'restauração deve usar DELETE no endpoint existente');
assert.match(ownerSource, /body:\s*JSON\.stringify\(\{ id \}\)/, 'restauração deve enviar somente o ID local');
assert.match(ownerSource, /ignoredState\.items\s*=\s*ignoredState\.items\.filter/, 'item restaurado deve sair da lista após sucesso');
assert.match(ownerSource, /button\.disabled = false[\s\S]*button\.textContent = originalText/, 'erro ao restaurar deve manter o item e reabilitar a ação');
assert.match(ownerSource, /Chamado #\$\{id\} restaurado no Hub\./, 'sucesso deve gerar feedback');
assert.match(ownerSource, /document\.querySelector\('\[data-refresh\]'\)\?\.click\(\)/, 'após restaurar deve acionar o refresh existente da lista normal');
assert.match(ownerSource, /window\.confirm\([\s\S]*Excluir o chamado/, 'Excluir do Hub deve preservar confirmação');
assert.match(ownerSource, /method:\s*'POST'/, 'Excluir do Hub deve continuar usando POST');
assert.doesNotMatch(ownerSource, /ticket-removal-v1/, 'owner não pode reutilizar mecanismo histórico');
assert.match(removalSource, /ticket|chamado/i, 'arquivo histórico permanece apenas físico');
assert.doesNotMatch(ownerSource, /situation\s*=|status\s*=|responsible\s*=|PUT[^\n]*sults/i, 'restauração não pode alterar dado oficial do SULTS');

class FakeKV {
  constructor() { this.values = new Map(); }
  async get(key, options = {}) {
    const raw = this.values.get(key);
    return raw == null ? null : options.type === 'json' ? JSON.parse(raw) : raw;
  }
  async put(key, value) { this.values.set(key, value); }
  async list({ prefix = '' } = {}) {
    return {
      keys: [...this.values.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })),
      list_complete: true,
    };
  }
}

const kv = new FakeKV();
const env = { PLANET_HUB_DATA: kv };
const endpoint = 'https://andre-os.test/api/hub/chamados-ignorados';

const ignoredResponse = await ignoreTicket({
  env,
  request: new Request(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: '321', title: 'Chamado teste', unit: 'Planet Teste' }),
  }),
});
assert.equal(ignoredResponse.status, 200, 'ignore existente deve continuar funcionando');

const listResponse = await listIgnored({ env });
assert.equal(listResponse.status, 200, 'lista de ignorados deve carregar');
const ignoredPayload = await listResponse.json();
assert.equal(ignoredPayload.data.length, 1, 'chamado ignorado deve aparecer na lista');
assert.equal(ignoredPayload.data[0].id, '321');
assert.equal(ignoredPayload.data[0].title, 'Chamado teste');
assert.equal(ignoredPayload.data[0].unit, 'Planet Teste');
assert.ok(ignoredPayload.data[0].ignoredAt, 'data do ignore deve existir');

const restoreResponse = await restoreTicket({
  env,
  request: new Request(endpoint, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: '321' }),
  }),
});
assert.equal(restoreResponse.status, 200, 'restauração existente deve funcionar');
const restoredPayload = await restoreResponse.json();
assert.equal(restoredPayload.restoredId, '321');
assert.equal(restoredPayload.data.length, 0, 'após restaurar o item deve sair da lista de ignorados');

const emptyResponse = await listIgnored({ env });
const emptyPayload = await emptyResponse.json();
assert.deepEqual(emptyPayload.data, [], 'estado vazio do backend deve ser uma lista vazia');

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async () => new Response(JSON.stringify({
    data: [{
      id: 321,
      titulo: 'Chamado teste',
      unidade: { nome: 'Planet Teste' },
      situacao: 4,
      responsavel: { nome: 'André Roberto Medeiros' },
      departamento: { id: 10, nome: 'Marketing' },
      apoio: [],
      etiqueta: [],
      ultimaAlteracao: '2026-08-12T10:00:00.000Z',
    }],
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const ticketsResponse = await getTickets({
    env: { ...env, SULTS_API_TOKEN: 'token' },
    request: new Request('https://andre-os.test/api/sults/chamados?start=0&limit=100'),
  });
  const ticketsPayload = await ticketsResponse.json();
  assert.equal(
    ticketsPayload.data.some((item) => String(item.id) === '321'),
    true,
    'depois do DELETE o chamado deve voltar a ser elegível na lista normal',
  );
  assert.equal(ticketsPayload.data.find((item) => String(item.id) === '321')?.situation, 4, 'status SULTS deve permanecer intacto');
} finally {
  globalThis.fetch = originalFetch;
}

assert.match(ownerSource, /if \(!response\.ok\) throw new Error/, 'erros HTTP de lista/restauração devem ser tratados');

console.log('Chamados ignorados: lista, vazio, erros, restauração e retorno à lista normal validados sem alterar SULTS.');
