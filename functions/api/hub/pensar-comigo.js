import { inspectModelOutput } from '../../_shared/ai/model-output.js';
import { selectPlanetKnowledge } from '../../_shared/knowledge/planet-brain.js';

const MODEL = '@cf/zai-org/glm-4.7-flash';
const SULTS_TICKET_ENDPOINT = 'https://api.sults.com.br/api/v1/chamado/ticket';
const SULTS_PORTAL_BASE = 'https://planetchocolate.sults.com.br/chamados/interacoes';

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const json = (body, status = 200, extraHeaders = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { ...headers, ...extraHeaders },
});
const clean = (value, max = 1200) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const cleanDate = (value) => clean(value, 40);

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

const sanitizeTicketReference = (reference = {}) => ({
  id: Number(reference.id) || null,
  title: clean(reference.title, 280),
  status: clean(reference.status, 160),
  requester: clean(reference.requester, 180),
  responsible: clean(reference.responsible, 180),
  unit: clean(reference.unit, 180),
  department: clean(reference.department, 180),
  subject: clean(reference.subject, 180),
  opened_at: cleanDate(reference.opened_at),
  planned_resolution_at: cleanDate(reference.planned_resolution_at),
  stipulated_resolution_at: cleanDate(reference.stipulated_resolution_at),
  last_change_at: cleanDate(reference.last_change_at),
  sults_url: clean(reference.sults_url, 360),
  interactions: Array.isArray(reference.interactions)
    ? reference.interactions.slice(0, 8).map((entry) => ({
      created_at: cleanDate(entry?.created_at),
      author: clean(entry?.author, 180),
      internal: Boolean(entry?.internal),
      text: clean(entry?.text, 1200),
    })).filter((entry) => entry.text)
    : [],
  warning: clean(reference.warning, 400),
  source: clean(reference.source, 80) || 'sults-live',
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
  ticket_reference: context.ticket_reference ? sanitizeTicketReference(context.ticket_reference) : null,
  ticket_lookup: context.ticket_lookup ? {
    requested_id: Number(context.ticket_lookup.requested_id) || null,
    status: clean(context.ticket_lookup.status, 40),
    error: clean(context.ticket_lookup.error, 500),
  } : null,
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
    content: clean(entry?.content, 1600),
  }))
  .filter((entry) => entry.content);

const parsePayload = async (response) => {
  const raw = await response.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return { raw };
  }
};

const fetchSults = async (url, token) => {
  const response = await fetch(url, {
    headers: {
      Authorization: token,
      'Content-Type': 'application/json;charset=UTF-8',
      Accept: 'application/json',
    },
  });
  return { response, payload: await parsePayload(response) };
};

const nameOf = (value) => clean(value?.nome ?? value?.name, 180);
const labelOf = (value) => clean(value?.nome ?? value?.name ?? value?.assunto, 180);

const textFromHtml = (value) => String(value || '')
  .replace(/<br\s*\/?\s*>/gi, '\n')
  .replace(/<\/p\s*>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;|&#34;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\s+/g, ' ')
  .trim();

const usefulTimelineEntry = (entry) => {
  const text = textFromHtml(entry?.interacao?.mensagemHtml ?? entry?.interaction?.messageHtml);
  if (text.length < 5) return false;
  return !/^(ok|certo|obrigad[oa]|valeu|perfeito|bom dia|boa tarde|boa noite)[.! ]*$/i.test(text);
};

const ticketIdFromText = (value) => {
  const text = String(value || '');
  const named = text.match(/\b(?:chamado|ticket)\s*(?:n[º°o.]?\s*)?#?\s*(\d{2,})\b/i);
  if (named) return Number(named[1]);
  const hash = text.match(/(?:^|\s)#\s*(\d{2,})\b/);
  return hash ? Number(hash[1]) : null;
};

const ticketIdFromContext = (context) => {
  const item = context?.selected_item;
  const ticketLike = /chamado|ticket|sults/i.test([
    context?.page_id,
    context?.page_label,
    item?.type,
    item?.origin,
  ].filter(Boolean).join(' '));
  if (!ticketLike) return null;
  const match = String(item?.source_id || item?.id || '').match(/(\d{2,})/);
  return match ? Number(match[1]) : null;
};

const resolveTicketId = (prompt, history, context) => {
  const direct = ticketIdFromText(prompt);
  if (direct) return direct;
  for (const entry of [...history].reverse()) {
    if (entry.role !== 'user') continue;
    const historical = ticketIdFromText(entry.content);
    if (historical) return historical;
  }
  return ticketIdFromContext(context);
};

const loadTicketReference = async (env, id) => {
  if (!env.SULTS_API_TOKEN) throw new Error('SULTS_API_TOKEN não configurado.');

  const ticketUrl = new URL(SULTS_TICKET_ENDPOINT);
  ticketUrl.searchParams.set('start', '0');
  ticketUrl.searchParams.set('limit', '1');
  ticketUrl.searchParams.set('id', String(id));
  const timelineUrl = `${SULTS_TICKET_ENDPOINT}/${id}/timeline`;

  const [ticketResult, timelineResult] = await Promise.all([
    fetchSults(ticketUrl.toString(), env.SULTS_API_TOKEN),
    fetchSults(timelineUrl, env.SULTS_API_TOKEN),
  ]);

  if (!ticketResult.response.ok) {
    throw new Error(`O SULTS recusou a consulta do chamado ${id} (HTTP ${ticketResult.response.status}).`);
  }

  const rawTicket = Array.isArray(ticketResult.payload?.data)
    ? ticketResult.payload.data.find((item) => Number(item?.id) === id) || ticketResult.payload.data[0]
    : null;
  if (!rawTicket) throw new Error(`Chamado ${id} não encontrado no SULTS.`);

  const rawTimeline = timelineResult.response.ok && Array.isArray(timelineResult.payload?.data)
    ? timelineResult.payload.data
    : [];

  const interactions = rawTimeline
    .filter(usefulTimelineEntry)
    .sort((left, right) => Date.parse(right?.criado || 0) - Date.parse(left?.criado || 0))
    .slice(0, 8)
    .map((entry) => ({
      created_at: entry?.criado ?? null,
      author: nameOf(entry?.pessoa) || 'Pessoa não identificada',
      internal: Boolean(entry?.interacao?.interno),
      text: textFromHtml(entry?.interacao?.mensagemHtml),
    }));

  return sanitizeTicketReference({
    id: rawTicket.id,
    title: rawTicket.titulo ?? 'Chamado sem título',
    status: labelOf(rawTicket.situacao) || String(rawTicket.situacao ?? ''),
    requester: nameOf(rawTicket.solicitante),
    responsible: nameOf(rawTicket.responsavel),
    unit: labelOf(rawTicket.unidade),
    department: labelOf(rawTicket.departamento),
    subject: labelOf(rawTicket.assunto),
    opened_at: rawTicket.aberto,
    planned_resolution_at: rawTicket.resolverPlanejado,
    stipulated_resolution_at: rawTicket.resolverEstipulado,
    last_change_at: rawTicket.ultimaAlteracao,
    sults_url: `${SULTS_PORTAL_BASE}/${id}`,
    interactions,
    warning: timelineResult.response.ok ? '' : 'A timeline não pôde ser consultada.',
    source: 'sults-live',
  });
};

const enrichContext = async (env, prompt, history, context) => {
  const ticketId = resolveTicketId(prompt, history, context);
  if (!ticketId) return context;
  if (Number(context?.ticket_reference?.id) === ticketId) return context;

  try {
    return {
      ...context,
      ticket_reference: await loadTicketReference(env, ticketId),
      ticket_lookup: { requested_id: ticketId, status: 'resolved', error: '' },
    };
  } catch (error) {
    return {
      ...context,
      ticket_reference: null,
      ticket_lookup: {
        requested_id: ticketId,
        status: 'unavailable',
        error: error instanceof Error ? error.message : String(error),
      },
    };
  }
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

  const history = sanitizeHistory(payload?.history);
  const baseContext = sanitizeContext(payload?.context || {});
  const context = sanitizeContext(await enrichContext(env, prompt, history, baseContext));
  const planetBrain = selectPlanetKnowledge({ prompt, history, context, maxSections: 4 });
  const contextText = JSON.stringify(context, null, 2).slice(0, 18000);
  const brainText = JSON.stringify(planetBrain, null, 2).slice(0, 12000);

  const system = `Você é o cérebro contextual do André OS para a operação da Planet Chocolate. Responda em português brasileiro, com clareza e foco operacional, usando no máximo 220 palavras. Você não é um chat genérico. Use esta ordem de confiança: 1) dados atuais do SULTS, Radar, página e item aberto; 2) contexto confirmado pelo usuário; 3) Planet Brain como referência permanente. Quando existir ticket_reference, ele contém dados reais do chamado citado e deve ser sua fonte principal. Nunca transforme conhecimento histórico do Brain em fato atual sem confirmação. Nunca invente tarefa, prazo, responsável, status, dependência, documento ou interação. Quando faltar informação, diga exatamente o que falta. Diferencie execução de cobrança: um item bloqueado não deve ser tratado como trabalho executável. Quando a pergunta pedir direção, entregue uma recomendação principal e o próximo movimento concreto. Não registre, conclua, altere nem crie tarefas. Retorne somente a resposta final para o usuário. É proibido exibir rascunhos, Draft, Refinement, Internal Monologue, raciocínio privado, cadeia de pensamento ou comentários sobre como você produziu a resposta.`;

  const messages = [
    { role: 'system', content: system },
    { role: 'system', content: `Planet Brain selecionado para esta pergunta:\n${brainText}` },
    { role: 'system', content: `Contexto atual do André OS:\n${contextText}` },
    ...history,
    { role: 'user', content: prompt },
  ];

  try {
    const result = await env.AI.run(MODEL, {
      messages,
      temperature: 0.15,
      max_completion_tokens: 900,
    });
    const inspected = inspectModelOutput(result);
    if (!inspected.text) throw new Error('A IA não retornou uma resposta utilizável.');

    return json({
      answer: inspected.text.slice(0, 7000),
      model: MODEL,
      page_id: context.page_id,
      request_id: clean(payload?.request_id, 160),
      resolved_ticket_id: context.ticket_reference?.id || context.ticket_lookup?.requested_id || null,
      ticket_reference: context.ticket_reference || null,
      knowledge: {
        brain: planetBrain.brain,
        version: planetBrain.version,
        selected_sections: planetBrain.selected_sections,
      },
    }, 200, {
      'X-AndreOS-AI-Finish-Reason': inspected.finishReason || 'unknown',
      'X-AndreOS-AI-Unsafe': inspected.unsafe ? '1' : '0',
    });
  } catch (error) {
    return json({
      error: 'Não foi possível concluir o pensamento agora.',
      details: error instanceof Error ? error.message : String(error),
    }, 502);
  }
}
