const STORAGE_KEY = 'planet-hub:campanhas:v1';
const MAX_ITEMS = 120;
const MAX_BODY_BYTES = 180_000;

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const cleanText = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
const validStatus = (value) => ['planejamento', 'producao', 'aprovacao', 'ativa', 'concluida'].includes(value)
  ? value
  : 'planejamento';

const normalizeItem = (item = {}) => ({
  id: cleanText(item.id, 160),
  status: validStatus(item.status),
  responsible: cleanText(item.responsible, 160),
  nextMilestone: cleanText(item.nextMilestone, 280),
  milestoneDate: validDate(item.milestoneDate),
  materials: cleanText(item.materials, 900),
  notes: cleanText(item.notes, 1200),
  updatedAt: cleanText(item.updatedAt, 40) || new Date().toISOString(),
});

const readDocument = async (store) => {
  const stored = await store.get(STORAGE_KEY, { type: 'json' });
  return {
    revision: stored?.revision || null,
    updatedAt: stored?.updatedAt || null,
    data: Array.isArray(stored?.data)
      ? stored.data.slice(0, MAX_ITEMS).map(normalizeItem).filter((item) => item.id)
      : [],
  };
};

export async function onRequestGet({ env }) {
  if (!env.PLANET_HUB_DATA) {
    return json({ error: 'PLANET_HUB_DATA não configurado.', data: [], storage: 'local' }, 503);
  }

  try {
    return json({ ...(await readDocument(env.PLANET_HUB_DATA)), storage: 'shared' });
  } catch (error) {
    return json({
      error: 'Falha ao carregar os dados operacionais das campanhas.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export async function onRequestPut({ env, request }) {
  if (!env.PLANET_HUB_DATA) {
    return json({ error: 'PLANET_HUB_DATA não configurado.', storage: 'local' }, 503);
  }

  const contentLength = Number.parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_BODY_BYTES) return json({ error: 'Payload acima do limite permitido.' }, 413);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }

  if (!Array.isArray(payload?.data)) return json({ error: 'O campo data precisa ser uma lista.' }, 400);
  if (payload.data.length > MAX_ITEMS) return json({ error: `Limite de ${MAX_ITEMS} campanhas excedido.` }, 400);

  try {
    const current = await readDocument(env.PLANET_HUB_DATA);
    const baseRevision = payload.baseRevision || null;
    if (baseRevision && current.revision && baseRevision !== current.revision) {
      return json({ error: 'As campanhas foram alteradas em outro navegador.', conflict: true, ...current }, 409);
    }

    const updatedAt = new Date().toISOString();
    const document = {
      revision: crypto.randomUUID(),
      updatedAt,
      data: payload.data.map((item) => normalizeItem({ ...item, updatedAt: item.updatedAt || updatedAt })),
    };

    const serialized = JSON.stringify(document);
    if (new TextEncoder().encode(serialized).byteLength > MAX_BODY_BYTES) {
      return json({ error: 'Os dados ultrapassam o limite permitido.' }, 413);
    }

    await env.PLANET_HUB_DATA.put(STORAGE_KEY, serialized);
    return json({ ...document, storage: 'shared' });
  } catch (error) {
    return json({
      error: 'Falha ao salvar os dados operacionais das campanhas.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
