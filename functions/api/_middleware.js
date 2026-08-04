import { getAuthState } from '../_lib/hub-auth.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store' },
});

export async function onRequest({ request, env, next }) {
  const url = new URL(request.url);
  if (url.pathname === '/api/hub/session') return next();
  const auth = await getAuthState(request, env);
  if (!auth.configured || auth.authenticated) return next();
  return json({ error: 'Sessão expirada ou acesso não autorizado.', authenticationRequired: true }, 401);
}
