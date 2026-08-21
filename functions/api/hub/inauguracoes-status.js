const STORAGE_PREFIX = 'planet-hub:inauguracao-status:v1:';
const MAX_ITEMS = 1000;

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const cleanText = (value, max = 120) => String(value ?? '').trim().slice(0, max);
const cleanId = (value) => cleanText(value, 100).replace(/[^0-9A-Za-z_-]/g, '');
const itemKey = (id) => `${STORAGE_PREFIX}${cleanId(id)}`;

const listKeys = async (store) => {
  const keys = [];
  let cursor;
  do {
    const page = await store.list({ prefix: STORAGE_PREFIX, cursor, limit: 1000 });
    keys.push(...(page.keys || []).map((item) => item.name).filter(Boolean));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && keys.length < MAX_ITEMS * 2);
  return keys.slice(0, MAX_ITEMS * 2);
};

const readRecords = async (store) => {
  const keys = await listKeys(store);
  const records = [];
  for (let index = 0; index < keys.length; index += 100) {
    const batch = keys.slice(index, index + 100);
    const values = await Promise.all(batch.map((key) => store.get(key, { type: 'json' })));
    values.forEach((record) => {
      const id = cleanId(record?.id);
      const state = record?.state === 'closed' ? 'closed' : record?.state === 'open' ? 'open' : '';
      if (!id || !state) return;
      records.push({
        id,
        state,
        reason: cleanText(record.reason, 40),
        updatedAt: cleanText(record.updatedAt, 40),
      });
    });
  }
  return records
    .sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0))
    .slice(0, MAX_ITEMS);
};

const writeState = async (store, id, state, reason = '') => {
  const record = {
    id: cleanId(id),
    state,
    reason: cleanText(reason, 40),
    updatedAt: new Date().toISOString(),
  };
  await store.put(itemKey(record.id), JSON.stringify(record));
  return record;
};

export async function onRequestGet({ env }) {
  if (!env.PLANET_HUB_DATA) return json({ error: 'PLANET_HUB_DATA não configurado.', data: [] }, 503);
  try {
    return json({ data: await readRecords(env.PLANET_HUB_DATA), storage: 'shared' });
  } catch (error) {
    return json({ error: 'Falha ao carregar status das inaugurações.', details: String(error), data: [] }, 500);
  }
}

export async function onRequestPost({ env, request }) {
  if (!env.PLANET_HUB_DATA) return json({ error: 'PLANET_HUB_DATA não configurado.' }, 503);
  let payload;
  try { payload = await request.json(); } catch { return json({ error: 'JSON inválido.' }, 400); }
  const id = cleanId(payload?.id);
  const state = payload?.state === 'closed' ? 'closed' : payload?.state === 'open' ? 'open' : '';
  if (!id) return json({ error: 'ID da inauguração não informado.' }, 400);
  if (!state) return json({ error: 'Estado inválido.' }, 400);
  try {
    await writeState(env.PLANET_HUB_DATA, id, state, payload?.reason || '');
    return json({ data: await readRecords(env.PLANET_HUB_DATA), updatedId: id, state, storage: 'shared' });
  } catch (error) {
    return json({ error: 'Falha ao atualizar status da inauguração.', details: String(error) }, 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
