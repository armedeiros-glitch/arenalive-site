import {
  MAX_CANDIDATE_BODY_BYTES,
  updateCandidate,
} from '../../../../../_lib/planet-lead-candidates.js';

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

export async function onRequestPut({ env, request, params }) {
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
  try {
    return json(await updateCandidate(
      env.PLANET_HUB_DATA,
      Array.isArray(params?.id) ? params.id[0] : params?.id,
      payload?.changes || payload,
    ));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Falha ao atualizar candidato.' }, Number(error?.status) || 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
