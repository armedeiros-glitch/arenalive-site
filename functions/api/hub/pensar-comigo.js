const MODEL = '@cf/zai-org/glm-4.7-flash';
const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const clean = (value, max = 1200) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

const sanitizeItem = (item = {}) => ({
  id: clean(item.id, 140),
  source_id: clean(item.source_id, 140),
  type: clean(item.type, 80),
  title: clean(item.title, 240),
  origin: clean(item.origin, 100),
  status: clean(item.status, 120),
  responsible: clean(item.responsible, 180),
  due_date: clean(item.due_date, 20),
  operational_state: clean(item.operational_state, 40),
  depends_on: clean(item.depends_on, 220),
  blocker_reason: clean(item.blocker_reason, 900),
  next_action: clean(item.next_action, 700),
  follow_up_date: clean(item.follow_up_date, 20),
  last_reading: item.last_reading ? {
    author: clean(item.last_reading.author, 180),
    created_at: clean(item.last_reading.created_at, 40),
    excerpt: clean(item.last_reading.excerpt, 900),
  } : null,
});

const sanitizeContext = (context = {}) => ({
  page_id: clean(context.page_id, 120),
  module_id: clean(context.module_id, 120),
  page_label: clean(context.page_label, 180),
  module_label: clean(context.module_label, 180),
  context_path: Array.isArray(context.context_path)
    ? context.context_path.slice(0, 8).map((item) => clean(item, 180)).filter(Boolean)
    : [],
  route: clean(context.route, 240),
  screen_title: clean(context.screen_title, 180),
  selected_item: context.selected_item ? sanitizeItem(context.selected_item) : null,
  radar: context.radar ? {
    active_items: Math.max(0, Math.min(10000, Number(context.radar.active_items) || 0)),
    source_errors: Array.isArray(context.radar.source_errors)
      ? context.radar.source_errors.slice(0, 10).map((item) => clean(item, 120)).filter(Boolean)
      : [],
    loaded_at: clean(context.radar.loaded_at, 40),
  } : null,
});

const sanitizeHistory = (history) => (Array.isArray(history) ? history : [])
  .slice(-8)
  .map((entry) => ({
    role: entry?.role === 'assistant' ? 'assistant' : 'user',
    content: clean(entry?.content, 1400),
  }))
  .filter((entry) => entry.content);

const extractText = (result) => {
  const value = result?.response
    ?? result?.result?.response
    ?? result?.choices?.[0]?.message?.content
    ?? result?.output_text
    ?? result;

  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value.map((part) => typeof part === 'string' ? part : part?.text || part?.content || '').join('\n').trim();
  }
  if (value && typeof value === 'object') {
    return clean(value.text || value.content || JSON.stringify(value), 6000);
  }
  return '';
};

export async function onRequestPost({ env, request }) {
  if (!env.AI) return json({ error: 'Workers AI não está configurado neste ambiente.' }, 503);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }

  const prompt = clean(payload?.prompt, 4000);
  if (!prompt) return json({ error: 'Escreva uma pergunta antes de enviar.' }, 400);

  const context = sanitizeContext(payload?.context || {});
  const history = sanitizeHistory(payload?.history);
  const contextText = JSON.stringify(context, null, 2).slice(0, 12000);

  const system = `Você é o cérebro contextual do André OS. Responda em português brasileiro, com clareza e foco operacional. Você não é um chat genérico: deve pensar a partir da página atual, do item selecionado e dos dados fornecidos. Nunca invente tarefa, prazo, responsável, status, dependência, documento ou interação. Quando faltar informação, diga exatamente o que falta. Diferencie execução de cobrança: um item bloqueado não deve ser tratado como trabalho executável. Quando a pergunta pedir direção, entregue uma recomendação principal e o próximo movimento concreto. Seja direto, mas explique o raciocínio útil sem revelar cadeia de pensamento privada. Não registre, conclua, altere nem crie tarefas. Apenas analise e responda.`;

  const messages = [
    { role: 'system', content: system },
    { role: 'system', content: `Contexto atual do André OS:\n${contextText}` },
    ...history,
    { role: 'user', content: prompt },
  ];

  try {
    const result = await env.AI.run(MODEL, {
      messages,
      temperature: 0.2,
      max_completion_tokens: 1000,
    });
    const answer = extractText(result);
    if (!answer) throw new Error('A IA não retornou uma resposta utilizável.');

    return json({
      answer: answer.slice(0, 7000),
      model: MODEL,
      page_id: context.page_id,
      request_id: clean(payload?.request_id, 160),
    });
  } catch (error) {
    return json({
      error: 'Não foi possível concluir o pensamento agora.',
      details: error instanceof Error ? error.message : String(error),
    }, 502);
  }
}
