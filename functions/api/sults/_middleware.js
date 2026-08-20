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

export async function onRequest({ request, env, next }) {
  if (request.method === 'OPTIONS') return next();

  const auth = await getAuthState(request, env);
  if (!auth.authenticated) {
    return json({
      error: 'Sessão expirada ou acesso não autorizado.',
      code: 'HUB_UNAUTHORIZED',
    }, 401);
  }

  // A tela "Chamados do Marketing" deve espelhar a caixa Recebido do SULTS.
  // Chamados em fila podem não possuir `responsavel`, então scope=mine por pessoa
  // perde itens que aparecem normalmente no Recebido. Para esta rota, traduzimos
  // o escopo pessoal para o escopo do departamento de Marketing, mantendo a API
  // geral e os demais endpoints sem alteração.
  if (request.method === 'GET') {
    const url = new URL(request.url);
    if (url.pathname === '/api/sults/chamados' && url.searchParams.get('scope') === 'mine') {
      url.searchParams.set('scope', 'marketing');
      url.searchParams.set('includeIgnored', '1');
      return next(new Request(url.toString(), request));
    }
  }

  return next();
}
