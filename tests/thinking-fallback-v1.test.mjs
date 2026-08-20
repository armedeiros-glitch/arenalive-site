import assert from 'node:assert/strict';
import fs from 'node:fs';

const helperPath = new URL('../functions/_shared/ai/thinking-fallback.js', import.meta.url);
const source = fs.readFileSync(helperPath, 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const { buildThinkingFallback } = await import(moduleUrl);

const enrichedPayload = {
  request_id: 'req-fruta-in-box',
  context: {
    page_id: 'planet_marketing.chamados',
    selected_item: {
      title: 'promover o produto fruta in box - teste no mueller',
      responsible: 'André Roberto Medeiros',
      blocker_reason: 'O prazo está atrasado há 26 dia(s)',
      next_action: 'Abrir o chamado e definir o próximo passo',
    },
    ticket_reference: {
      id: 908,
      title: 'promover o produto fruta in box - teste no mueller',
      responsible: 'André Roberto Medeiros',
      interactions: [
        {
          created_at: '2026-06-30T15:00:00Z',
          author: 'Ivan',
          text: 'ok, vou alimentando aqui com os resultados',
        },
        {
          created_at: '2026-06-30T14:00:00Z',
          author: 'André Roberto Medeiros',
          text: 'podemos fazer na próxima semana, na quinta-feira dia 8',
        },
        {
          created_at: '2026-06-16T10:00:00Z',
          author: 'Laise Oliveira Jerônimo',
          text: 'não consigo chegar no valor de 19,90 no iFood',
        },
      ],
    },
  },
};

const enrichedAnswer = buildThinkingFallback(enrichedPayload);
assert.match(enrichedAnswer, /promover o produto fruta in box/i);
assert.match(enrichedAnswer, /O atraso é consequência, não o bloqueio real/i);
assert.match(enrichedAnswer, /na quinta-feira dia 8/i);
assert.match(enrichedAnswer, /não há registro posterior confirmando o resultado/i);
assert.match(enrichedAnswer, /confirmar com Ivan e Laise Oliveira Jerônimo/i);
assert.match(enrichedAnswer, /Se aconteceu, registrar o resultado e concluir o chamado/i);
assert.equal(enrichedAnswer.includes('Abrir o chamado e definir o próximo passo'), false);
assert.equal(enrichedAnswer.includes('para na quinta-feira'), false);

const specificPayload = {
  context: {
    selected_item: {
      title: 'Pedido de arte',
      responsible: 'André Roberto Medeiros',
      blocker_reason: 'A unidade ainda não enviou as medidas finais',
      next_action: 'Cobrar as medidas finais da unidade',
    },
  },
};
const specificAnswer = buildThinkingFallback(specificPayload);
assert.match(specificAnswer, /O bloqueio real é:/);
assert.match(specificAnswer, /medidas finais/i);
assert.match(specificAnswer, /Cobrar as medidas finais da unidade/i);

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
assert.match(dependsAnswer, /confirmar retorno da unidade/i);

const completedPayload = {
  context: {
    selected_item: {
      title: 'Ação de inauguração',
      responsible: 'André Roberto Medeiros',
      blocker_reason: 'O prazo está atrasado há 2 dias',
    },
    ticket_reference: {
      interactions: [
        {
          author: 'Ivan',
          text: 'A ação foi realizada e o resultado registrado',
        },
        {
          author: 'André Roberto Medeiros',
          text: 'podemos fazer na quinta-feira dia 8',
        },
      ],
    },
  },
};
const completedAnswer = buildThinkingFallback(completedPayload);
assert.equal(completedAnswer.includes('não há registro posterior confirmando o resultado'), false);

assert.equal(buildThinkingFallback({ context: {} }), '');

console.log('AndreOS thinking fallback: tests passed');
