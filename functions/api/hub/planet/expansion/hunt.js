import {
  getLeadHuntStatus,
  runLeadHunt,
} from '../../../../_lib/planet-lead-hunt.js';

const MAX_BODY_BYTES = 32_000;
const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

const readPayload = async (request) => {
  if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES) {
    return { error: json({ error: 'Payload acima do limite permitido.' }, 413) };
  }
  if (!request.body) return { payload: {} };
  try {
    return { payload: await request.json() };
  } catch {
    return { error: json({ error: 'JSON inválido.' }, 400) };
  }
};

export async function onRequestGet({ env }) {
  if (!env.PLANET_HUB_DATA) {
    return json({ error: 'PLANET_HUB_DATA não configurado.' }, 503);
  }
  try {
    return json(await getLeadHuntStatus({ store: env.PLANET_HUB_DATA, env }));
  } catch (error) {
    return json({
      error: 'Falha ao carregar o estado do Caça Leads automático.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export async function onRequestPost({ env, request }) {
  if (!env.PLANET_HUB_DATA) {
    return json({ error: 'PLANET_HUB_DATA não configurado.' }, 503);
  }
  const parsed = await readPayload(request);
  if (parsed.error) return parsed.error;
  const payload = parsed.payload || {};
  try {
    const result = await runLeadHunt({
      store: env.PLANET_HUB_DATA,
      apiKey: env.GOOGLE_PLACES_API_KEY,
      env,
      options: {
        trigger: 'manual',
        force: payload.force === true,
        locations: payload.locations || payload.cities,
        segments: payload.segments,
        maxResultsPerQuery: payload.maxResultsPerQuery,
      },
    });
    return json(result);
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : 'Falha ao executar o Caça Leads automático.',
      run: error?.run || null,
    }, Number(error?.status) || 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
