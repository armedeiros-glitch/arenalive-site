import { getAuthState } from '../../_lib/hub-auth.js';

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers,
});

const isSessionRoute = (request) => new URL(request.url).pathname === '/api/hub/session';

export async function onRequest({ request, env, next }) {
  if (request.method === 'OPTIONS' || isSessionRoute(request)) return next();

  const auth = await getAuthState(request, env);
  if (!auth.authenticated) {
    return json({
      error: 'Sessão expirada ou acesso não autorizado.',
      code: 'HUB_UNAUTHORIZED',
    }, 401);
  }

  return next();
}
