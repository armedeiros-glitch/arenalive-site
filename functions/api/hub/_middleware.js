import { getAuthState } from '../../_lib/hub-auth.js';

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const AI_PATHS = new Set([
  '/api/hub/analisar-radar',
  '/api/hub/organizar-demanda',
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

  const response = await next();
  const securedHeaders = new Headers(response.headers);
  securedHeaders.set('X-Content-Type-Options', 'nosniff');
  securedHeaders.set('Referrer-Policy', 'same-origin');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: securedHeaders,
  });
}
