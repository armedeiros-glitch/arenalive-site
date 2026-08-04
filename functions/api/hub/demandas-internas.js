const STORAGE_KEY = 'planet-hub:demandas-internas:v1';
const MAX_ITEMS = 500;
const MAX_BODY_BYTES = 450_000;

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const cleanText = (value, max = 300) => String(value ?? '').trim().slice(0, max);
const cleanDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';

const STATUS = new Set(['new', 'in_progress', 'waiting', 'completed', 'cancelled']);
const PRIORITY = new Set(['urgent', 'high', 'normal', 'low']);
const ORIGIN = new Set(['direction', 'meeting', 'whatsapp', 'internal', 'other']);

const normalizeDemand = (item = {}) => {
  const status = STATUS.has(item.status) ? item.status : 'new';
  const completedAt = status === 'completed'
    ? cleanText(item.completedAt, 40) || new Date().toISOString()
    : '';

  return {
    id: cleanText(item.id, 120) || `demand-${crypto.randomUUID()}`,
    title: cleanText(item.title, 220) || 'Demanda sem título',
    description: cleanText(item.description, 1600),
    origin: ORIGIN.has(item.origin) ? item.origin : 'direction',
    requestedBy: cleanText(item.requestedBy, 160),
    responsible: cleanText(item.responsible, 160),
    priority: PRIORITY.has(item.priority) ? item.priority : 'normal',
    status,
    dueDate: cleanDate(item.dueDate),
    category: cleanText(item.category, 120),
    notes: cleanText(item.notes, 1800),
    createdAt: cleanText(item.createdAt, 40) || new Date().toISOString(),
    updatedAt: cleanText(item.updatedAt, 40) || new Date().toISOString(),
    completedAt,
  };
};

const readDocument = async (store) => {
  const stored = await store.get(STORAGE_KEY, { type: 'json' });
  if (!stored || !Array.isArray(stored.data)) {
    return { revision: null, updatedAt: null, data: [] };
  }

  return {
    revision: stored.revision || null,
    updatedAt: stored.updatedAt || null,
    data: stored.data.slice(0, MAX_ITEMS).map(normalizeDemand),
  };
};

export async function onRequestGet({ env }) {
  const store = env.PLANET_HUB_DATA;
  if (!store) {
    return json({
      error: 'PLANET_HUB_DATA não configurado.',
      storage: 'local',
      data: [],
    }, 503);
  }

  try {
    return json({ ...(await readDocument(store)), storage: 'shared' });
  } catch (error) {
    return json({
      error: 'Falha ao carregar as demandas internas.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export async function onRequestPut({ env, request }) {
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ error: 'PLANET_HUB_DATA não configurado.', storage: 'local' }, 503);

  const contentLength = Number.parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_BODY_BYTES) return json({ error: 'Payload acima do limite permitido.' }, 413);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }

  if (!Array.isArray(payload?.data)) return json({ error: 'O campo data precisa ser uma lista.' }, 400);
  if (payload.data.length > MAX_ITEMS) return json({ error: `Limite de ${MAX_ITEMS} demandas excedido.` }, 400);

  try {
    const current = await readDocument(store);
    const baseRevision = payload.baseRevision || null;
    if (baseRevision && current.revision && baseRevision !== current.revision) {
      return json({
        error: 'As demandas foram alteradas em outro navegador.',
        conflict: true,
        ...current,
      }, 409);
    }

    const updatedAt = new Date().toISOString();
    const document = {
      revision: crypto.randomUUID(),
      updatedAt,
      data: payload.data.map((item) => normalizeDemand({ ...item, updatedAt: item.updatedAt || updatedAt })),
    };

    const serialized = JSON.stringify(document);
    if (new TextEncoder().encode(serialized).byteLength > MAX_BODY_BYTES) {
      return json({ error: 'Os dados normalizados ultrapassam o limite permitido.' }, 413);
    }

    await store.put(STORAGE_KEY, serialized);
    return json({ ...document, storage: 'shared' });
  } catch (error) {
    return json({
      error: 'Falha ao salvar as demandas internas.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
