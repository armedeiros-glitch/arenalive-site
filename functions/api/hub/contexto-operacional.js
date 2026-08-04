const STORAGE_KEY = 'andre-os:contexto-operacional:v1';
const MAX_ITEMS = 1500;
const MAX_BODY_BYTES = 48_000;

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const cleanText = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const cleanDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';

const STATES = new Set([
  'ready',
  'waiting_external',
  'waiting_internal',
  'waiting_approval',
  'blocked',
  'unknown',
]);

const BLOCKER_TYPES = new Set([
  '',
  'franchisee',
  'supplier',
  'shopping',
  'finance',
  'marketing',
  'internal',
  'other',
]);

const normalizeContext = (itemId, value = {}) => ({
  itemId: cleanText(itemId || value.itemId, 180),
  state: STATES.has(value.state) ? value.state : 'unknown',
  blockerType: BLOCKER_TYPES.has(value.blockerType) ? value.blockerType : '',
  blockerName: cleanText(value.blockerName, 180),
  blockerReason: cleanText(value.blockerReason, 1200),
  nextAction: cleanText(value.nextAction, 700),
  nextActor: cleanText(value.nextActor, 180),
  followUpDate: cleanDate(value.followUpDate),
  notes: cleanText(value.notes, 1200),
  updatedAt: cleanText(value.updatedAt, 40) || new Date().toISOString(),
});

const readDocument = async (store) => {
  const stored = await store.get(STORAGE_KEY, { type: 'json' });
  const source = stored?.data && typeof stored.data === 'object' ? stored.data : {};
  const data = {};
  Object.entries(source).slice(0, MAX_ITEMS).forEach(([itemId, value]) => {
    const normalized = normalizeContext(itemId, value);
    if (normalized.itemId) data[normalized.itemId] = normalized;
  });
  return {
    revision: stored?.revision || null,
    updatedAt: stored?.updatedAt || null,
    data,
  };
};

export async function onRequestGet({ env }) {
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ error: 'PLANET_HUB_DATA não configurado.', data: {} }, 503);

  try {
    return json({ ...(await readDocument(store)), storage: 'shared' });
  } catch (error) {
    return json({
      error: 'Falha ao carregar o contexto operacional.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export async function onRequestPut({ env, request }) {
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ error: 'PLANET_HUB_DATA não configurado.' }, 503);

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) return json({ error: 'Payload acima do limite permitido.' }, 413);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }

  const itemId = cleanText(payload?.itemId, 180);
  if (!itemId) return json({ error: 'Informe o itemId da demanda.' }, 400);

  try {
    const current = await readDocument(store);
    const data = { ...current.data };

    if (payload.clear === true) {
      delete data[itemId];
    } else {
      data[itemId] = normalizeContext(itemId, payload?.context || {});
    }

    const entries = Object.entries(data);
    if (entries.length > MAX_ITEMS) {
      entries.sort(([, a], [, b]) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0));
      Object.keys(data).forEach((key) => delete data[key]);
      entries.slice(0, MAX_ITEMS).forEach(([key, value]) => { data[key] = value; });
    }

    const document = {
      revision: crypto.randomUUID(),
      updatedAt: new Date().toISOString(),
      data,
    };
    await store.put(STORAGE_KEY, JSON.stringify(document));

    return json({
      ok: true,
      revision: document.revision,
      updatedAt: document.updatedAt,
      context: data[itemId] || null,
    });
  } catch (error) {
    return json({
      error: 'Falha ao salvar o contexto operacional.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
