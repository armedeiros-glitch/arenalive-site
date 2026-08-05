import assert from 'node:assert/strict';
import fs from 'node:fs';

const helperPath = new URL('../functions/_shared/ai/thinking-fallback.js', import.meta.url);
const source = fs.readFileSync(helperPath, 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const { buildThinkingFallback } = await import(moduleUrl);

const payload = {
  request_id: 'req-1',
  context: {
    page_id: 'planet_marketing.chamados',
    selected_item: {
      title: 'promover o produto fruta in box - teste no mueller',
      responsible: 'André Roberto Medeiros',
      blocker_reason: 'A data combinada passou sem confirmação de execução',
      next_action: 'Confirmar com a responsável se a ação ocorreu e atualizar o chamado',
      last_reading: {
        excerpt: 'Foi combinado realizar a ação na semana seguinte',
      },
    },
  },
};

const answer = buildThinkingFallback(payload);
assert.match(answer, /promover o produto fruta in box/i);
assert.match(answer, /O bloqueio identificado é:/);
assert.match(answer, /Próximo passo:/);
assert.match(answer, /Confirmar com a responsável/i);
assert.equal(answer.includes('JSON'), false);
assert.equal(answer.includes('HTTP 502'), false);

const dependsPayload = {
  context: {
    selected_item: {
      title: 'Pedido de arte',
      depends_on: 'retorno da unidade',
    },
  },
};
const dependsAnswer = buildThinkingFallback(dependsPayload);
assert.match(dependsAnswer, /depende de retorno da unidade/i);
assert.match(dependsAnswer, /confirmar com retorno da unidade/i);

assert.equal(buildThinkingFallback({ context: {} }), '');

console.log('AndreOS thinking fallback: tests passed');
