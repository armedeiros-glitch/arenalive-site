const STORAGE_KEY = 'planet-hub:radar-contextos:v1';
const MAX_ITEMS = 1000;
const MAX_BODY_BYTES = 220_000;

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const STATES = new Set([
  'actionable',
  'blocked',
  'waiting_info',
  'waiting_approval',
  'scheduled',
]);

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const cleanText = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const cleanDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';

const normalizeContext = (item = {}) => ({
  itemId: cleanText(item.itemId, 180),
  state: STATES.has(item.state) ? item.state : 'actionable',
  reason: cleanText(item.reason, 1200),
  dependsOn: cleanText(item.dependsOn, 240),
  nextAction: cleanText(item.nextAction, 700),
  followUpDate: cleanDate(item.followUpDate),
  updatedAt: cleanText(item.updatedAt, 40) || new Date().toISOString(),
});

const readDocument = async (store) => {
  const stored = await store.get(STORAGE_KEY, { type: 'json' });
  const data = Array.isArray(stored?.data)
    ? stored.data.map(normalizeContext).filter((item) => item.itemId).slice(0, MAX_ITEMS)
    : [];
  return {
    revision: stored?.revision || null,
    updatedAt: stored?.updatedAt || null,
    data,
  };
};

const writeDocument = async (store, data) => {
  const updatedAt = new Date().toISOString();
  const document = {
    revision: crypto.randomUUID(),
    updatedAt,
    data: data.slice(0, MAX_ITEMS).map((item) => normalizeContext({ ...item, updatedAt: item.updatedAt || updatedAt })),
  };
  const serialized = JSON.stringify(document);
  if (new TextEncoder().encode(serialized).byteLength > MAX_BODY_BYTES) {
    throw new Error('Os contextos ultrapassam o limite permitido.');
  }
  await store.put(STORAGE_KEY, serialized);
  return document;
};

export async function onRequestGet({ env }) {
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ error: 'PLANET_HUB_DATA não configurado.', data: [] }, 503);

  try {
    return json({ ...(await readDocument(store)), storage: 'shared' });
  } catch (error) {
    return json({
      error: 'Falha ao carregar os contextos operacionais.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export async function onRequestPut({ env, request }) {
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ error: 'PLANET_HUB_DATA não configurado.' }, 503);

  const contentLength = Number.parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > 30_000) return json({ error: 'Payload acima do limite permitido.' }, 413);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }

  const context = normalizeContext(payload);
  if (!context.itemId) return json({ error: 'itemId é obrigatório.' }, 400);

  try {
    const current = await readDocument(store);
    const next = current.data.filter((item) => item.itemId !== context.itemId);
    next.unshift({ ...context, updatedAt: new Date().toISOString() });
    const document = await writeDocument(store, next);
    return json({ ...document, context: document.data.find((item) => item.itemId === context.itemId) });
  } catch (error) {
    return json({
      error: 'Falha ao salvar o contexto operacional.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export async function onRequestDelete({ env, request }) {
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ error: 'PLANET_HUB_DATA não configurado.' }, 503);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }

  const itemId = cleanText(payload?.itemId, 180);
  if (!itemId) return json({ error: 'itemId é obrigatório.' }, 400);

  try {
    const current = await readDocument(store);
    const document = await writeDocument(store, current.data.filter((item) => item.itemId !== itemId));
    return json({ ...document, removed: itemId });
  } catch (error) {
    return json({
      error: 'Falha ao remover o contexto operacional.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
