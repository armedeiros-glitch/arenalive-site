import {
  createCandidate,
  MAX_CANDIDATE_BODY_BYTES,
  readCandidateDocument,
} from '../../../../_lib/planet-lead-candidates.js';

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

const readPayload = async (request) => {
  if (Number(request.headers.get('content-length') || 0) > MAX_CANDIDATE_BODY_BYTES) {
    return { error: json({ error: 'Payload acima do limite permitido.' }, 413) };
  }
  try {
    return { payload: await request.json() };
  } catch {
    return { error: json({ error: 'JSON inválido.' }, 400) };
  }
};

export async function onRequestGet({ env }) {
  if (!env.PLANET_HUB_DATA) {
    return json({ error: 'PLANET_HUB_DATA não configurado.', data: [], storage: 'local' }, 503);
  }
  try {
    return json({ ...(await readCandidateDocument(env.PLANET_HUB_DATA)), storage: 'shared' });
  } catch (error) {
    return json({
      error: 'Falha ao carregar candidatos.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export async function onRequestPost({ env, request }) {
  if (!env.PLANET_HUB_DATA) return json({ error: 'PLANET_HUB_DATA não configurado.' }, 503);
  const parsed = await readPayload(request);
  if (parsed.error) return parsed.error;
  try {
    const result = await createCandidate(
      env.PLANET_HUB_DATA,
      parsed.payload?.candidate || parsed.payload,
    );
    return json(result, result.duplicate ? 200 : 201);
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : 'Falha ao salvar candidato.',
    }, Number(error?.status) || 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
