const clean = (value, max = 160) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

export const buildThinkingResponseMetadata = ({ context = {}, payload = {}, planetBrain = {} } = {}) => ({
  page_id: clean(context.page_id, 120),
  request_id: clean(payload.request_id, 160),
  resolved_ticket_id: Number(context.ticket_reference?.id || context.ticket_lookup?.requested_id) || null,
  ticket_reference: context.ticket_reference || null,
  knowledge: {
    brain: clean(planetBrain.brain, 120),
    version: clean(planetBrain.version, 80),
    selected_sections: Array.isArray(planetBrain.selected_sections)
      ? planetBrain.selected_sections.slice(0, 12)
      : [],
  },
});

export const buildThinkingErrorPayload = ({ error, context, payload, planetBrain } = {}) => ({
  error: 'Não foi possível concluir o pensamento agora.',
  code: 'THINKING_MODEL_FAILED',
  details: error instanceof Error ? error.message : String(error || 'Falha desconhecida.'),
  ...buildThinkingResponseMetadata({ context, payload, planetBrain }),
});
