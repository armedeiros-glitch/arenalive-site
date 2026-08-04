const STORAGE_KEY = 'planet-hub:chamados-ignorados:v1';
const MAX_ITEMS = 1000;

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const cleanText = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const cleanId = (value) => cleanText(value, 80).replace(/[^0-9A-Za-z_-]/g, '');

const normalizeEntry = (item = {}) => ({
  id: cleanId(item.id),
  title: cleanText(item.title, 240) || 'Chamado sem título',
  unit: cleanText(item.unit, 180),
  ignoredAt: cleanText(item.ignoredAt, 40) || new Date().toISOString(),
  source: 'hub',
});

const readLog = async (store) => {
  const stored = await store.get(STORAGE_KEY, { type: 'json' });
  return {
    revision: stored?.revision || null,
    updatedAt: stored?.updatedAt || null,
    data: Array.isArray(stored?.data)
      ? stored.data.map(normalizeEntry).filter((item) => item.id).slice(0, MAX_ITEMS)
      : [],
  };
};

const writeLog = async (store, data) => {
  const document = {
    revision: crypto.randomUUID(),
    updatedAt: new Date().toISOString(),
    data: data.slice(0, MAX_ITEMS).map(normalizeEntry),
  };
  await store.put(STORAGE_KEY, JSON.stringify(document));
  return document;
};

export async function onRequestGet({ env }) {
  if (!env.PLANET_HUB_DATA) return json({ error: 'PLANET_HUB_DATA não configurado.', data: [] }, 503);
  try {
    return json({ ...(await readLog(env.PLANET_HUB_DATA)), storage: 'shared' });
  } catch (error) {
    return json({ error: 'Falha ao carregar chamados ignorados.', details: String(error) }, 500);
  }
}

export async function onRequestPost({ env, request }) {
  if (!env.PLANET_HUB_DATA) return json({ error: 'PLANET_HUB_DATA não configurado.' }, 503);

  let payload;
  try { payload = await request.json(); } catch { return json({ error: 'JSON inválido.' }, 400); }

  const entry = normalizeEntry({ ...payload, ignoredAt: new Date().toISOString() });
  if (!entry.id) return json({ error: 'ID do chamado não informado.' }, 400);

  try {
    const current = await readLog(env.PLANET_HUB_DATA);
    const next = [entry, ...current.data.filter((item) => item.id !== entry.id)];
    return json({ ...(await writeLog(env.PLANET_HUB_DATA, next)), ignored: entry, storage: 'shared' });
  } catch (error) {
    return json({ error: 'Falha ao ignorar chamado.', details: String(error) }, 500);
  }
}

export async function onRequestDelete({ env, request }) {
  if (!env.PLANET_HUB_DATA) return json({ error: 'PLANET_HUB_DATA não configurado.' }, 503);

  let payload;
  try { payload = await request.json(); } catch { return json({ error: 'JSON inválido.' }, 400); }

  const id = cleanId(payload?.id);
  if (!id) return json({ error: 'ID do chamado não informado.' }, 400);

  try {
    const current = await readLog(env.PLANET_HUB_DATA);
    const next = current.data.filter((item) => item.id !== id);
    return json({ ...(await writeLog(env.PLANET_HUB_DATA, next)), restoredId: id, storage: 'shared' });
  } catch (error) {
    return json({ error: 'Falha ao restaurar chamado.', details: String(error) }, 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
