import {
  importCandidates,
  MAX_CANDIDATE_BODY_BYTES,
} from '../../../../../_lib/planet-lead-candidates.js';

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

export async function onRequestPost({ env, request }) {
  if (!env.PLANET_HUB_DATA) return json({ error: 'PLANET_HUB_DATA não configurado.' }, 503);
  if (Number(request.headers.get('content-length') || 0) > MAX_CANDIDATE_BODY_BYTES) {
    return json({ error: 'Payload acima do limite permitido.' }, 413);
  }
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }
  const items = payload?.candidates || payload?.data || payload;
  if (!Array.isArray(items)) return json({ error: 'Envie uma lista de candidatos.' }, 400);
  try {
    return json(await importCandidates(env.PLANET_HUB_DATA, items));
  } catch (error) {
    return json({
      error: 'Falha ao importar candidatos.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
