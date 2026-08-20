import { clearSessionCookie, createSessionCookie, getAuthState, isAccessConfigured, safeEqual } from '../../_lib/hub-auth.js';

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;
const loginAttempts = new Map();

const json = (body, status = 200, extraHeaders = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { ...headers, ...extraHeaders },
});

const clientKey = (request) => request.headers.get('CF-Connecting-IP')
  || request.headers.get('X-Forwarded-For')
  || 'local';

const readLoginBucket = (request) => {
  const key = clientKey(request);
  const now = Date.now();
  const current = loginAttempts.get(key);
  if (!current || now - current.startedAt >= LOGIN_WINDOW_MS) {
    const fresh = { key, startedAt: now, count: 0 };
    loginAttempts.set(key, fresh);
    return fresh;
  }
  return current;
};

export async function onRequestGet({ request, env }) {
  const state = await getAuthState(request, env);
  return json({ configured: state.configured, authenticated: state.authenticated, expiresAt: state.expiresAt || null });
}

export async function onRequestPost({ request, env }) {
  if (!isAccessConfigured(env)) return json({ error: 'PLANET_HUB_ACCESS_PASSWORD não configurado.' }, 503);

  const bucket = readLoginBucket(request);
  if (bucket.count >= LOGIN_MAX_ATTEMPTS) {
    const retryAfter = Math.max(1, Math.ceil((LOGIN_WINDOW_MS - (Date.now() - bucket.startedAt)) / 1000));
    return json({
      error: 'Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente.',
      code: 'LOGIN_RATE_LIMITED',
      retryAfter,
    }, 429, { 'Retry-After': String(retryAfter) });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }

  if (!safeEqual(String(payload?.password || ''), String(env.PLANET_HUB_ACCESS_PASSWORD || ''))) {
    bucket.count += 1;
    return json({ error: 'Senha incorreta.' }, 401);
  }

  loginAttempts.delete(bucket.key);
  return json({ authenticated: true }, 200, { 'Set-Cookie': await createSessionCookie(env) });
}

export function onRequestDelete() {
  return json({ authenticated: false }, 200, { 'Set-Cookie': clearSessionCookie() });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
