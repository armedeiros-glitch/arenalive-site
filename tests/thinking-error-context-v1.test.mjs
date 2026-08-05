import assert from 'node:assert/strict';
import fs from 'node:fs';

const loadModule = async (relativePath) => {
  const fileUrl = new URL(relativePath, import.meta.url);
  const source = fs.readFileSync(fileUrl, 'utf8');
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
  return import(moduleUrl);
};

const { buildThinkingErrorPayload, buildThinkingResponseMetadata } = await loadModule(
  '../functions/_shared/ai/thinking-response.js',
);
const { buildThinkingFallback } = await loadModule(
  '../functions/_shared/ai/thinking-fallback.js',
);

const context = {
  page_id: 'planet_marketing.chamados',
  selected_item: {
    title: 'promover o produto fruta in box - teste no mueller',
    responsible: 'André Roberto Medeiros',
    blocker_reason: 'O prazo está atrasado há 26 dias',
    next_action: 'Abrir o chamado e definir o próximo passo',
  },
  ticket_lookup: {
    requested_id: 908,
    status: 'resolved',
  },
  ticket_reference: {
    id: 908,
    title: 'promover o produto fruta in box - teste no mueller',
    responsible: 'André Roberto Medeiros',
    interactions: [
      {
        created_at: '2026-06-30T15:00:00Z',
        author: 'Ivan',
        text: 'Ok, vou alimentando aqui com os resultados.',
      },
      {
        created_at: '2026-06-30T14:00:00Z',
        author: 'André Roberto Medeiros',
        text: 'Podemos fazer na próxima semana, na quinta-feira dia 8, quando a Laise retornar.',
      },
      {
        created_at: '2026-06-23T12:00:00Z',
        author: 'Laise',
        text: 'Quando devemos iniciar e finalizar a ação para validação?',
      },
    ],
  },
};

const payload = {
  request_id: 'req-error-908',
  context: {
    page_id: context.page_id,
    selected_item: context.selected_item,
  },
};
const planetBrain = {
  brain: 'planet-brain',
  version: '1.0.0',
  selected_sections: ['chamados-sults'],
};

const metadata = buildThinkingResponseMetadata({ context, payload, planetBrain });
assert.equal(metadata.page_id, 'planet_marketing.chamados');
assert.equal(metadata.request_id, 'req-error-908');
assert.equal(metadata.resolved_ticket_id, 908);
assert.equal(metadata.ticket_reference?.interactions?.length, 3);

const errorPayload = buildThinkingErrorPayload({
  error: new Error('Modelo indisponível'),
  context,
  payload,
  planetBrain,
});
assert.equal(errorPayload.code, 'THINKING_MODEL_FAILED');
assert.equal(errorPayload.resolved_ticket_id, 908);
assert.equal(errorPayload.ticket_reference?.id, 908);
assert.equal(errorPayload.ticket_reference?.interactions?.[0]?.author, 'Ivan');

const fallbackAnswer = buildThinkingFallback({
  ...payload,
  ticket_reference: errorPayload.ticket_reference,
  context: {
    ...payload.context,
    ticket_reference: errorPayload.ticket_reference,
  },
});
assert.match(fallbackAnswer, /quinta-feira dia 8/i);
assert.match(fallbackAnswer, /Ivan/i);
assert.match(fallbackAnswer, /Laise/i);
assert.doesNotMatch(fallbackAnswer, /confirmar com André Roberto Medeiros o que foi executado/i);
assert.doesNotMatch(fallbackAnswer, /HTTP 502|JSON/i);

console.log('AndreOS thinking error context: tests passed');
