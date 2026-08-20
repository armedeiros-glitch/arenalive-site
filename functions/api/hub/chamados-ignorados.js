const STORAGE_KEY = 'planet-hub:chamados-ignorados:v1';
const STORAGE_PREFIX = 'planet-hub:chamado-ignorado:v2:';
const MAX_ITEMS = 1000;

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const cleanText = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const cleanId = (value) => cleanText(value, 80).replace(/[^0-9A-Za-z_-]/g, '');
const itemKey = (id) => `${STORAGE_PREFIX}${cleanId(id)}`;

const normalizeEntry = (item = {}) => ({
  id: cleanId(item.id),
  title: cleanText(item.title, 240) || 'Chamado sem título',
  unit: cleanText(item.unit, 180),
  ignoredAt: cleanText(item.ignoredAt, 40) || new Date().toISOString(),
  source: 'hub',
});

const readLegacyLog = async (store) => {
  const stored = await store.get(STORAGE_KEY, { type: 'json' });
  return {
    revision: stored?.revision || null,
    updatedAt: stored?.updatedAt || null,
    data: Array.isArray(stored?.data)
      ? stored.data.map(normalizeEntry).filter((item) => item.id).slice(0, MAX_ITEMS)
      : [],
  };
};

const listItemKeys = async (store) => {
  const keys = [];
  let cursor;
  do {
    const page = await store.list({ prefix: STORAGE_PREFIX, cursor, limit: 1000 });
    keys.push(...(page.keys || []).map((item) => item.name).filter(Boolean));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && keys.length < MAX_ITEMS * 2);
  return keys.slice(0, MAX_ITEMS * 2);
};

const readItemRecords = async (store, keys) => {
  const records = [];
  for (let index = 0; index < keys.length; index += 100) {
    const batch = keys.slice(index, index + 100);
    const values = await Promise.all(batch.map((key) => store.get(key, { type: 'json' })));
    values.forEach((record) => {
      if (record?.id) records.push(record);
    });
  }
  return records;
};

const readLog = async (store) => {
  const [legacy, keys] = await Promise.all([readLegacyLog(store), listItemKeys(store)]);
  const records = await readItemRecords(store, keys);
  const merged = new Map(legacy.data.map((item) => [item.id, item]));
  let updatedAt = legacy.updatedAt || null;

  records
    .sort((a, b) => Date.parse(a.updatedAt || a.ignoredAt || 0) - Date.parse(b.updatedAt || b.ignoredAt || 0))
    .forEach((record) => {
      const id = cleanId(record.id);
      if (!id) return;
      const recordUpdatedAt = cleanText(record.updatedAt || record.ignoredAt, 40);
      if (recordUpdatedAt && Date.parse(recordUpdatedAt) > Date.parse(updatedAt || 0)) updatedAt = recordUpdatedAt;
      if (record.state === 'restored') {
        merged.delete(id);
        return;
      }
      merged.set(id, normalizeEntry(record));
    });

  const data = [...merged.values()]
    .sort((a, b) => Date.parse(b.ignoredAt || 0) - Date.parse(a.ignoredAt || 0))
    .slice(0, MAX_ITEMS);

  return {
    revision: 'per-ticket-v2',
    updatedAt: updatedAt || data[0]?.ignoredAt || null,
    data,
  };
};

const writeIgnored = async (store, entry) => {
  const record = {
    ...normalizeEntry(entry),
    state: 'ignored',
    updatedAt: new Date().toISOString(),
  };
  await store.put(itemKey(record.id), JSON.stringify(record));
  return record;
};

const writeRestored = async (store, id) => {
  const record = {
    id: cleanId(id),
    state: 'restored',
    updatedAt: new Date().toISOString(),
  };
  await store.put(itemKey(record.id), JSON.stringify(record));
  return record;
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
    await writeIgnored(env.PLANET_HUB_DATA, entry);
    return json({ ...(await readLog(env.PLANET_HUB_DATA)), ignored: entry, storage: 'shared' });
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
    await writeRestored(env.PLANET_HUB_DATA, id);
    return json({ ...(await readLog(env.PLANET_HUB_DATA)), restoredId: id, storage: 'shared' });
  } catch (error) {
    return json({ error: 'Falha ao restaurar chamado.', details: String(error) }, 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
