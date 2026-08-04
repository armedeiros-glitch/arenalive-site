import { clearSessionCookie, createSessionCookie, getAuthState, isAccessConfigured, safeEqual } from '../../_lib/hub-auth.js';

const headers = { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store' };
const json = (body, status = 200, extraHeaders = {}) => new Response(JSON.stringify(body), { status, headers: { ...headers, ...extraHeaders } });

export async function onRequestGet({ request, env }) {
  const state = await getAuthState(request, env);
  return json({ configured: state.configured, authenticated: state.authenticated, expiresAt: state.expiresAt || null });
}

export async function onRequestPost({ request, env }) {
  if (!isAccessConfigured(env)) return json({ error: 'PLANET_HUB_ACCESS_PASSWORD não configurado.' }, 503);
  let payload;
  try { payload = await request.json(); } catch { return json({ error: 'JSON inválido.' }, 400); }
  if (!safeEqual(String(payload?.password || ''), String(env.PLANET_HUB_ACCESS_PASSWORD || ''))) return json({ error: 'Senha incorreta.' }, 401);
  return json({ authenticated: true }, 200, { 'Set-Cookie': await createSessionCookie(env) });
}

export function onRequestDelete() {
  return json({ authenticated: false }, 200, { 'Set-Cookie': clearSessionCookie() });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
