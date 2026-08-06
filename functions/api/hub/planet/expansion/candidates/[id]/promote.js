import { promoteCandidate } from '../../../../../../_lib/planet-lead-candidates.js';

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

export async function onRequestPost({ env, params }) {
  if (!env.PLANET_HUB_DATA) return json({ error: 'PLANET_HUB_DATA não configurado.' }, 503);
  try {
    const result = await promoteCandidate(
      env.PLANET_HUB_DATA,
      Array.isArray(params?.id) ? params.id[0] : params?.id,
    );
    return json(result, result.idempotent || result.duplicate ? 200 : 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Falha ao promover candidato.' }, Number(error?.status) || 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
