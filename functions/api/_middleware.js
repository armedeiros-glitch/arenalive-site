import { getAuthState } from '../_lib/hub-auth.js';

const RD_WEBHOOK_PATH = /^\/api\/integrations\/planet\/rd\/webhook\/[^/]+\/?$/;
const PUBLIC_METHODS = new Set(['POST', 'OPTIONS']);

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store' },
});

const isPublicIntegrationRequest = (request, url) => (
  PUBLIC_METHODS.has(request.method)
  && RD_WEBHOOK_PATH.test(url.pathname)
);

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (url.pathname === '/api/hub/session' || isPublicIntegrationRequest(request, url)) return next();
  const auth = await getAuthState(request, env);
  if (!auth.configured || auth.authenticated) return next();
  return json({ error: 'Sessão expirada ou acesso não autorizado.', authenticationRequired: true }, 401);
}
