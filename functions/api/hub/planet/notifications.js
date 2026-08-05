const STORAGE_KEY = 'planet-hub:planet-notifications:v1';
const MAX_ITEMS = 1000;
const MAX_BODY_BYTES = 32_000;

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const cleanText = (value, max = 300) => String(value ?? '').trim().slice(0, max);
const nowIso = () => new Date().toISOString();

const TYPES = new Set(['lead.new', 'lead.updated', 'lead.alert']);
const PRIORITIES = new Set(['high', 'medium', 'low']);

const normalizeNotification = (item = {}) => {
  const createdAt = cleanText(item.createdAt, 40) || nowIso();
  return {
    id: cleanText(item.id, 120) || `notification-${crypto.randomUUID()}`,
    tenantId: 'planet',
    area: 'expansion',
    type: TYPES.has(item.type) ? item.type : 'lead.updated',
    priority: PRIORITIES.has(item.priority) ? item.priority : 'medium',
    title: cleanText(item.title, 180) || 'Atualização da expansão',
    summary: cleanText(item.summary, 500),
    leadId: cleanText(item.leadId, 120),
    leadName: cleanText(item.leadName, 180),
    count: Math.max(1, Math.min(99, Number(item.count) || 1)),
    changes: Array.isArray(item.changes)
      ? item.changes.map((value) => cleanText(value, 80)).filter(Boolean).slice(0, 20)
      : [],
    readAt: cleanText(item.readAt, 40),
    resolvedAt: cleanText(item.resolvedAt, 40),
    createdAt,
    updatedAt: cleanText(item.updatedAt, 40) || createdAt,
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
    data: stored.data.slice(0, MAX_ITEMS).map(normalizeNotification),
  };
};

const writeDocument = async (store, data) => {
  const updatedAt = nowIso();
  const document = {
    revision: crypto.randomUUID(),
    updatedAt,
    data: data.slice(0, MAX_ITEMS).map(normalizeNotification),
  };
  await store.put(STORAGE_KEY, JSON.stringify(document));
  return document;
};

const summary = (document) => ({
  ...document,
  unread: document.data.filter((item) => !item.readAt && !item.resolvedAt).length,
});

export async function onRequestGet({ env }) {
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ error: 'PLANET_HUB_DATA não configurado.', data: [], unread: 0 }, 503);
  try {
    return json({ ...summary(await readDocument(store)), storage: 'shared' });
  } catch (error) {
    return json({ error: 'Falha ao carregar as notificações da Planet.', details: error instanceof Error ? error.message : String(error) }, 500);
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

  const action = cleanText(payload?.action, 40);
  const ids = new Set([
    cleanText(payload?.id, 120),
    ...(Array.isArray(payload?.ids) ? payload.ids.map((value) => cleanText(value, 120)) : []),
  ].filter(Boolean));

  if (!['read', 'read_all', 'resolve'].includes(action)) {
    return json({ error: 'Ação de notificação inválida.' }, 400);
  }
  if (action !== 'read_all' && !ids.size) return json({ error: 'Informe a notificação.' }, 400);

  try {
    const current = await readDocument(store);
    const timestamp = nowIso();
    const data = current.data.map((item) => {
      const selected = action === 'read_all' ? !item.resolvedAt : ids.has(item.id);
      if (!selected) return item;
      if (action === 'resolve') return { ...item, readAt: item.readAt || timestamp, resolvedAt: timestamp, updatedAt: timestamp };
      return { ...item, readAt: item.readAt || timestamp, updatedAt: timestamp };
    });
    const document = await writeDocument(store, data);
    return json(summary(document));
  } catch (error) {
    return json({ error: 'Falha ao atualizar as notificações da Planet.', details: error instanceof Error ? error.message : String(error) }, 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
