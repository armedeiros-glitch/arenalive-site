import {
  MAX_LEAD_BODY_BYTES,
  readLeadDocument,
  upsertLead,
  updateLeadById,
} from '../../../_lib/planet-leads.js';

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

const readPayload = async (request) => {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_LEAD_BODY_BYTES) {
    return { error: json({ error: 'Payload acima do limite permitido.' }, 413) };
  }
  try {
    return { payload: await request.json() };
  } catch {
    return { error: json({ error: 'JSON inválido.' }, 400) };
  }
};

const errorResponse = (error, fallback) => json({
  error: error instanceof Error && error.message ? error.message : fallback,
  ...(error instanceof Error && error.status ? {} : {
    details: error instanceof Error ? error.message : String(error),
  }),
}, Number(error?.status) || 500);

export async function onRequestGet({ env }) {
  const store = env.PLANET_HUB_DATA;
  if (!store) {
    return json({ error: 'PLANET_HUB_DATA não configurado.', data: [], storage: 'local' }, 503);
  }
  try {
    return json({ ...(await readLeadDocument(store)), storage: 'shared' });
  } catch (error) {
    return json({
      error: 'Falha ao carregar os leads da Planet.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export async function onRequestPost({ env, request }) {
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ error: 'PLANET_HUB_DATA não configurado.' }, 503);

  const parsed = await readPayload(request);
  if (parsed.error) return parsed.error;

  try {
    const result = await upsertLead(store, parsed.payload?.lead || parsed.payload, {
      createdTitle: 'Lead cadastrado manualmente',
    });
    return json({
      lead: result.lead,
      duplicate: result.duplicate,
      revision: result.revision,
    }, result.duplicate ? 200 : 201);
  } catch (error) {
    return errorResponse(error, 'Falha ao salvar o lead da Planet.');
  }
}

export async function onRequestPut({ env, request }) {
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ error: 'PLANET_HUB_DATA não configurado.' }, 503);

  const parsed = await readPayload(request);
  if (parsed.error) return parsed.error;

  try {
    const result = await updateLeadById(store, parsed.payload?.id, parsed.payload?.changes);
    return json({ lead: result.lead, revision: result.revision });
  } catch (error) {
    return errorResponse(error, 'Falha ao atualizar o lead da Planet.');
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
