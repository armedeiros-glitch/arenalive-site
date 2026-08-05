import { getAuthState } from '../../_lib/hub-auth.js';

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

const finalAnswerDirective = `INSTRUÇÃO DE SAÍDA OBRIGATÓRIA: responda somente em português brasileiro e entregue diretamente a resposta que será mostrada ao usuário. Não mostre planejamento, tradução, análise, rascunho, etapas internas ou títulos como Goal, Blocker, Last Action, Current State, Draft, Refinement, Internal Monologue, Formulate the Response ou Final Answer. Não explique como você chegou à resposta. Comece pela conclusão útil e termine com um próximo movimento concreto quando houver base nos dados.`;

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

const internalDraftPattern = /(?:response\s+internal\s+monologue|internal\s+monologue|\bdraft\s*\d*\b|\brefinement\b|\bformulate\s+the\s+response\b|^\s*[-*•]?\s*(?:goal|blocker|last\s+action|current\s+state)\s*:)/im;

const looksLikeInternalDraft = (value) => internalDraftPattern.test(String(value || ''));

const extractModelText = (result) => {
  const value = result?.response
    ?? result?.result?.response
    ?? result?.choices?.[0]?.message?.content
    ?? result?.output_text
    ?? result;
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value.map((part) => typeof part === 'string' ? part : part?.text || part?.content || '').join('\n').trim();
  }
  if (value && typeof value === 'object') return String(value.text || value.content || '').trim();
  return '';
};

const finalizeLeakedAnswer = async (env, rawAnswer, originalPrompt) => {
  if (!env.AI) return '';

  const result = await env.AI.run(THINKING_MODEL, {
    messages: [
      {
        role: 'system',
        content: 'Você é um editor de resposta final. Transforme o rascunho recebido em uma resposta direta, natural e exclusivamente em português brasileiro. Preserve somente fatos presentes no rascunho. Não invente nada. Não mostre análise, passos internos, tradução, rascunho, títulos em inglês ou comentários sobre o processo. Entregue a conclusão e, quando os dados permitirem, um próximo movimento concreto.',
      },
      {
        role: 'user',
        content: `Pergunta original:\n${String(originalPrompt || '').slice(0, 2000)}\n\nRascunho que não pode ser exibido:\n${String(rawAnswer || '').slice(0, 6000)}`,
      },
    ],
    temperature: 0.05,
    max_completion_tokens: 500,
  });

  return extractModelText(result);
};

const secureThinkingResponse = async (response, env, originalPayload) => {
  if (!response.ok || !response.headers.get('Content-Type')?.includes('application/json')) return response;

  let payload;
  try {
    payload = await response.clone().json();
  } catch {
    return response;
  }

  const answer = String(payload?.answer || '').trim();
  if (!answer || !looksLikeInternalDraft(answer)) return response;

  try {
    const finalized = await finalizeLeakedAnswer(env, answer, originalPayload?.prompt);
    if (finalized && !looksLikeInternalDraft(finalized)) {
      return json({
        ...payload,
        answer: finalized.slice(0, 7000),
        output_guard: 'rewritten',
      }, response.status);
    }
  } catch {
    // Cai no bloqueio seguro abaixo.
  }

  return json({
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
  securedHeaders.set('X-Content-Type-Options', 'nosniff');
  securedHeaders.set('Referrer-Policy', 'same-origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: securedHeaders,
  });
}
