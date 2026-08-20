import assert from 'node:assert/strict';
import fs from 'node:fs';

const helperPath = new URL('../functions/_shared/ai/model-output.js', import.meta.url);
const source = fs.readFileSync(helperPath, 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const {
  FINAL_ANSWER_MODEL_OPTIONS,
  extractModelText,
  extractFinishReason,
  inspectModelOutput,
} = await import(moduleUrl);

assert.deepEqual(FINAL_ANSWER_MODEL_OPTIONS, {
  chat_template_kwargs: { thinking: false },
});

const productionShape = {
  response: {
    choices: [{
      message: {
        content: 'Role: Contextual Brain\nInteractions Analysis: o chamado está parado.\nI must decide the next step.',
      },
      finish_reason: 'length',
      logprobs: null,
    }],
    usage: {
      prompt_tokens: 2610,
      completion_tokens: 900,
    },
  },
};

assert.equal(
  extractModelText(productionShape),
  'Role: Contextual Brain\nInteractions Analysis: o chamado está parado.\nI must decide the next step.',
);
assert.equal(extractFinishReason(productionShape), 'length');
const contaminated = inspectModelOutput(productionShape);
assert.equal(contaminated.unsafe, true);
assert.deepEqual([...contaminated.reasons], ['truncated', 'internal-draft']);
assert.equal(contaminated.text.includes('prompt_tokens'), false);

const serializedEnvelope = JSON.stringify(productionShape.response);
const serializedInspection = inspectModelOutput(serializedEnvelope);
assert.equal(serializedInspection.text.startsWith('Role: Contextual Brain'), true);
assert.equal(serializedInspection.finishReason, 'length');
assert.equal(serializedInspection.unsafe, true);

const safeShape = {
  response: {
    choices: [{
      message: {
        content: 'O chamado está parado porque a data combinada passou sem registro de execução. Próximo passo: confirmar com a responsável se a ação ocorreu e atualizar o chamado.',
      },
      finish_reason: 'stop',
    }],
  },
};
const safe = inspectModelOutput(safeShape);
assert.equal(safe.unsafe, false);
assert.equal(safe.finishReason, 'stop');
assert.match(safe.text, /^O chamado está parado/);

const rawProviderEnvelope = '{"choices":[],"logprobs":null,"finish_reason":"length","usage":{"prompt_tokens":10}}';
const raw = inspectModelOutput(rawProviderEnvelope);
assert.equal(raw.unsafe, true);
assert.equal(raw.text, '');
assert.ok(raw.reasons.includes('empty'));
assert.ok(raw.reasons.includes('truncated'));

assert.equal(extractModelText({ response: { unexpected: true } }), '');

console.log('AndreOS model output guard: tests passed');
