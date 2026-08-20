const LEGACY_STORAGE_KEY = 'planet-hub:demandas-internas:v1';
const ITEM_STORAGE_PREFIX = 'planet-hub:internal-demand:v2:';
const MAX_ITEMS = 500;
const MAX_BODY_BYTES = 550_000;

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const cleanText = (value, max = 300) => String(value ?? '').trim().slice(0, max);
const cleanDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
const itemStorageKey = (id) => `${ITEM_STORAGE_PREFIX}${cleanText(id, 120)}`;

const STATUS = new Set(['new', 'in_progress', 'waiting', 'completed', 'cancelled']);
const PRIORITY = new Set(['urgent', 'high', 'normal', 'low']);
const ORIGIN = new Set(['direction', 'meeting', 'whatsapp', 'internal', 'other']);
const AI_MODE = new Set(['ai', 'rules', 'manual']);

const normalizeSteps = (items) => (Array.isArray(items) ? items : [])
  .slice(0, 12)
  .map((item) => ({
    id: cleanText(item?.id, 100) || `step-${crypto.randomUUID()}`,
    text: cleanText(typeof item === 'string' ? item : item?.text, 260),
    done: Boolean(item?.done),
  }))
  .filter((item) => item.text);

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
    steps: normalizeSteps(item.steps),
    originalText: cleanText(item.originalText, 4000),
    aiMode: AI_MODE.has(item.aiMode) ? item.aiMode : 'manual',
    createdAt: cleanText(item.createdAt, 40) || new Date().toISOString(),
    updatedAt: cleanText(item.updatedAt, 40) || new Date().toISOString(),
    completedAt,
  };
};

const normalizeV2Record = (item = {}) => {
  const id = cleanText(item.id, 120);
  if (!id) return null;
  if (item.deleted === true) {
    return {
      id,
      deleted: true,
      updatedAt: cleanText(item.updatedAt, 40) || new Date().toISOString(),
    };
  }
  return { ...normalizeDemand(item), deleted: false };
};

const readLegacyDocument = async (store) => {
  const stored = await store.get(LEGACY_STORAGE_KEY, { type: 'json' });
  if (!stored || !Array.isArray(stored.data)) {
    return { revision: null, updatedAt: null, data: [] };
  }

  return {
    revision: stored.revision || null,
    updatedAt: stored.updatedAt || null,
    data: stored.data.slice(0, MAX_ITEMS).map(normalizeDemand),
  };
};

const listV2Keys = async (store) => {
  const keys = [];
  let cursor;
  do {
    const page = await store.list({ prefix: ITEM_STORAGE_PREFIX, cursor, limit: 1000 });
    keys.push(...(page.keys || []).map((item) => item.name).filter(Boolean));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && keys.length < MAX_ITEMS * 2);
  return keys.slice(0, MAX_ITEMS * 2);
};

const readV2Records = async (store) => {
  const keys = await listV2Keys(store);
  const records = [];
  for (let index = 0; index < keys.length; index += 100) {
    const batch = keys.slice(index, index + 100);
    const values = await Promise.all(batch.map((key) => store.get(key, { type: 'json' })));
    values.forEach((value) => {
      const record = normalizeV2Record(value);
      if (record) records.push(record);
    });
  }
  return records;
};

const mergeStorage = (legacyData, v2Records) => {
  const merged = new Map(legacyData.map((item) => [item.id, item]));
  v2Records.forEach((record) => {
    if (record.deleted) merged.delete(record.id);
    else merged.set(record.id, normalizeDemand(record));
  });
  return [...merged.values()]
    .sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0))
    .slice(0, MAX_ITEMS);
};

const fingerprint = async (item) => {
  const bytes = new TextEncoder().encode(JSON.stringify(item));
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (value) => value.toString(16).padStart(2, '0')).join('');
};

const buildVersionMap = async (data) => {
  const entries = await Promise.all(data.map(async (item) => [item.id, await fingerprint(item)]));
  return Object.fromEntries(entries);
};

const encodeRevision = (versionMap) => `v2:${encodeURIComponent(JSON.stringify(versionMap))}`;

const decodeRevision = (revision) => {
  if (!revision || !String(revision).startsWith('v2:')) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(String(revision).slice(3)));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const readDocument = async (store) => {
  const [legacy, v2Records] = await Promise.all([
    readLegacyDocument(store),
    readV2Records(store),
  ]);
  const data = mergeStorage(legacy.data, v2Records);
  const versionMap = await buildVersionMap(data);
  return {
    revision: encodeRevision(versionMap),
    updatedAt: data[0]?.updatedAt || legacy.updatedAt || null,
    data,
  };
};

const writeDemand = async (store, item, updatedAt) => {
  const normalized = normalizeDemand({ ...item, updatedAt: item.updatedAt || updatedAt });
  await store.put(itemStorageKey(normalized.id), JSON.stringify({ ...normalized, deleted: false }));
  return normalized;
};

const writeTombstone = async (store, id, updatedAt) => {
  const tombstone = { id: cleanText(id, 120), deleted: true, updatedAt };
  await store.put(itemStorageKey(tombstone.id), JSON.stringify(tombstone));
  return tombstone;
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
    const baseVersions = payload.baseRevision ? decodeRevision(payload.baseRevision) : {};
    if (payload.baseRevision && !baseVersions) {
      return json({
        error: 'A versão aberta das demandas ficou desatualizada. Recarregue os dados antes de salvar.',
        conflict: true,
        ...current,
      }, 409);
    }

    const incoming = payload.data.map(normalizeDemand);
    const incomingById = new Map(incoming.map((item) => [item.id, item]));
    const currentById = new Map(current.data.map((item) => [item.id, item]));
    const currentVersions = await buildVersionMap(current.data);
    const incomingVersions = await buildVersionMap(incoming);
    const changedIds = incoming
      .filter((item) => !baseVersions[item.id] || incomingVersions[item.id] !== baseVersions[item.id])
      .map((item) => item.id);
    const deletedIds = Object.keys(baseVersions).filter((id) => !incomingById.has(id));

    const conflictingIds = [...changedIds, ...deletedIds].filter((id) => (
      baseVersions[id]
      && currentVersions[id]
      && currentVersions[id] !== baseVersions[id]
    ));
    if (conflictingIds.length) {
      return json({
        error: 'Esta demanda foi alterada em outro navegador.',
        conflict: true,
        conflictIds: conflictingIds,
        ...current,
      }, 409);
    }

    const updatedAt = new Date().toISOString();
    await Promise.all([
      ...changedIds.map((id) => writeDemand(store, incomingById.get(id), updatedAt)),
      ...deletedIds.map((id) => writeTombstone(store, id, updatedAt)),
    ]);

    const nextById = new Map(currentById);
    changedIds.forEach((id) => nextById.set(id, normalizeDemand({ ...incomingById.get(id), updatedAt: incomingById.get(id).updatedAt || updatedAt })));
    deletedIds.forEach((id) => nextById.delete(id));
    const data = [...nextById.values()]
      .sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0))
      .slice(0, MAX_ITEMS);
    const document = {
      revision: encodeRevision(await buildVersionMap(data)),
      updatedAt: data[0]?.updatedAt || updatedAt,
      data,
    };

    const serialized = JSON.stringify(document);
    if (new TextEncoder().encode(serialized).byteLength > MAX_BODY_BYTES) {
      return json({ error: 'Os dados normalizados ultrapassam o limite permitido.' }, 413);
    }

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
