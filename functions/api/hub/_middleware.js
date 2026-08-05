import { getAuthState } from '../../_lib/hub-auth.js';
import { FINAL_ANSWER_MODEL_OPTIONS, inspectModelOutput } from '../../_shared/ai/model-output.js';
import { buildThinkingFallback } from '../../_shared/ai/thinking-fallback.js';

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const THINKING_PATH = '/api/hub/pensar-comigo';
const THINKING_MODEL = '@cf/zai-org/glm-4.7-flash';
const AI_PATHS = new Set([
  '/api/hub/analisar-radar',
  '/api/hub/organizar-demanda',
  THINKING_PATH,
]);
const MAX_BODY_BYTES = 128 * 1024;
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX_CALLS = 12;
const rateBuckets = new Map();

const json = (body, status = 200, extraHeaders = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { ...headers, ...extraHeaders },
});

const isSessionRoute = (pathname) => pathname === '/api/hub/session';
const clientKey = (request) => request.headers.get('CF-Connecting-IP')
  || request.headers.get('X-Forwarded-For')
  || 'local';

const rateLimitAi = (request, pathname) => {
  if (!AI_PATHS.has(pathname)) return null;

  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json({
      error: 'A solicitação é grande demais para processamento por IA.',
      code: 'AI_PAYLOAD_TOO_LARGE',
    }, 413);
  }

  const now = Date.now();
  const key = `${clientKey(request)}:${pathname}`;
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(key, { startedAt: now, count: 1 });
    return null;
  }

  bucket.count += 1;
  if (bucket.count <= RATE_MAX_CALLS) return null;

  const retryAfter = Math.max(1, Math.ceil((RATE_WINDOW_MS - (now - bucket.startedAt)) / 1000));
  return json({
    error: 'Muitas análises em pouco tempo. Aguarde alguns segundos e tente novamente.',
    code: 'AI_RATE_LIMITED',
    retryAfter,
  }, 429, { 'Retry-After': String(retryAfter) });
};

const finalAnswerDirective = `INSTRUÇÃO DE SAÍDA OBRIGATÓRIA: responda somente em português brasileiro e entregue diretamente a resposta que será mostrada ao usuário, com no máximo 220 palavras. Não mostre planejamento, tradução, análise, rascunho, etapas internas ou títulos como Goal, Blocker, Last Action, Current State, Draft, Refinement, Internal Monologue, Formulate the Response ou Final Answer. Não explique como você chegou à resposta. Comece pela conclusão útil e termine com um próximo movimento concreto quando houver base nos dados.`;

const prepareThinkingRequest = async (request, pathname) => {
  if (pathname !== THINKING_PATH || request.method !== 'POST') {
    return { request, payload: null };
  }

  try {
    const payload = await request.clone().json();
    const originalPrompt = String(payload?.prompt || '').trim();
    if (!originalPrompt) return { request, payload };

    const guardedPayload = {
      ...payload,
      prompt: `${originalPrompt}\n\n${finalAnswerDirective}`,
    };

    return {
      payload,
      request: new Request(request, {
        body: JSON.stringify(guardedPayload),
        headers: new Headers(request.headers),
      }),
    };
  } catch {
    return { request, payload: null };
  }
};

const finalizeLeakedAnswer = async (env, rawAnswer, originalPrompt) => {
  if (!env.AI) return inspectModelOutput('');

  const result = await env.AI.run(THINKING_MODEL, {
    ...FINAL_ANSWER_MODEL_OPTIONS,
    messages: [
      {
        role: 'system',
        content: 'Você é um editor de resposta final. Transforme o rascunho recebido em uma resposta direta, natural, exclusivamente em português brasileiro e com no máximo 220 palavras. Preserve somente fatos presentes no rascunho. Não invente nada. Não mostre análise, passos internos, tradução, rascunho, títulos em inglês ou comentários sobre o processo. Entregue a conclusão e, quando os dados permitirem, um próximo movimento concreto.',
      },
      {
        role: 'user',
        content: `Pergunta original:\n${String(originalPrompt || '').slice(0, 2000)}\n\nRascunho que não pode ser exibido:\n${String(rawAnswer || '').slice(0, 6000)}`,
      },
    ],
    temperature: 0.05,
    max_completion_tokens: 500,
  });

  return inspectModelOutput(result);
};

const deterministicThinkingResponse = (payload, originalPayload) => {
  const original = originalPayload && typeof originalPayload === 'object' ? originalPayload : {};
  const enrichedTicket = payload?.ticket_reference
    || original?.ticket_reference
    || original?.context?.ticket_reference
    || null;
  const fallbackPayload = {
    ...original,
    ticket_reference: enrichedTicket,
    context: {
      ...(original?.context || {}),
      ticket_reference: enrichedTicket,
    },
  };
  const answer = buildThinkingFallback(fallbackPayload);
  if (!answer) return null;

  const safePayload = payload && typeof payload === 'object' ? { ...payload } : {};
  delete safePayload.error;
  delete safePayload.code;
  delete safePayload.details;

  return json({
    ...safePayload,
    answer,
    model: safePayload.model || 'andre-os-context-fallback',
    page_id: safePayload.page_id || String(original?.context?.page_id || ''),
    request_id: safePayload.request_id || String(original?.request_id || ''),
    output_guard: 'deterministic-fallback',
    degraded: true,
  });
};

const secureThinkingResponse = async (response, env, originalPayload) => {
  if (!response.headers.get('Content-Type')?.includes('application/json')) return response;

  let payload;
  try {
    payload = await response.clone().json();
  } catch {
    return response;
  }

  const rawAnswer = String(payload?.answer || '').trim();
  if (!rawAnswer) {
    if (response.ok) return response;
    return deterministicThinkingResponse(payload, originalPayload) || response;
  }

  const inspected = inspectModelOutput(rawAnswer, {
    finishReason: response.headers.get('X-AndreOS-AI-Finish-Reason') || '',
    forceUnsafe: response.headers.get('X-AndreOS-AI-Unsafe') === '1',
  });

  if (!inspected.unsafe) {
    if (inspected.text === rawAnswer) return response;
    return json({
      ...payload,
      answer: inspected.text.slice(0, 7000),
      output_guard: 'normalized',
    }, response.status);
  }

  try {
    const finalized = await finalizeLeakedAnswer(
      env,
      inspected.text || rawAnswer,
      originalPayload?.prompt,
    );
    if (finalized.text && !finalized.unsafe) {
      return json({
        ...payload,
        answer: finalized.text.slice(0, 7000),
        output_guard: 'rewritten',
      }, response.status);
    }
  } catch {
    // Usa o contexto determinístico abaixo.
  }

  return deterministicThinkingResponse(payload, originalPayload) || json({
    error: 'A IA organizou os dados, mas a resposta final não ficou utilizável. Envie novamente para eu responder de forma direta.',
    code: 'THINKING_INTERNAL_DRAFT_BLOCKED',
  }, 502);
};

export async function onRequest({ request, env, next }) {
  const pathname = new URL(request.url).pathname;
  if (request.method === 'OPTIONS' || isSessionRoute(pathname)) return next();

  const auth = await getAuthState(request, env);
  if (!auth.authenticated) {
    return json({
      error: 'Sessão expirada ou acesso não autorizado.',
      code: 'HUB_UNAUTHORIZED',
    }, 401);
  }

  const limited = rateLimitAi(request, pathname);
  if (limited) return limited;

  const prepared = await prepareThinkingRequest(request, pathname);
  let response = await next(prepared.request);

  if (pathname === THINKING_PATH) {
    response = await secureThinkingResponse(response, env, prepared.payload);
  }

  const securedHeaders = new Headers(response.headers);
  securedHeaders.delete('X-AndreOS-AI-Finish-Reason');
  securedHeaders.delete('X-AndreOS-AI-Unsafe');
  securedHeaders.set('X-Content-Type-Options', 'nosniff');
  securedHeaders.set('Referrer-Policy', 'same-origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: securedHeaders,
  });
}
