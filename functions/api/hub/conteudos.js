const LEGACY_STORAGE_KEY = 'planet-hub:conteudos:v1';
const ITEM_STORAGE_PREFIX = 'planet-hub:content:v2:';
const MAX_ITEMS = 1000;
const MAX_BODY_BYTES = 900_000;

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const cleanText = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const itemStorageKey = (id) => `${ITEM_STORAGE_PREFIX}${cleanText(id, 120)}`;

const ALLOWED_STATUS = new Set([
  'planejamento',
  'producao',
  'aprovacao',
  'publicado',
  'arquivado',
]);

const cleanUrl = (value) => {
  const raw = cleanText(value, 1200);
  if (!raw) return '';
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
  } catch {
    return '';
  }
};

const normalizeTags = (value) => {
  const tags = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(tags.map((tag) => cleanText(tag, 50)).filter(Boolean))].slice(0, 20);
};

const normalizeItem = (item = {}) => {
  const status = cleanText(item.status, 30);
  const now = new Date().toISOString();

  return {
    id: cleanText(item.id, 120) || `content-${crypto.randomUUID()}`,
    title: cleanText(item.title, 220) || 'Conteúdo sem título',
    description: cleanText(item.description, 700),
    category: cleanText(item.category, 100) || 'Outro',
    format: cleanText(item.format, 80) || 'Link',
    status: ALLOWED_STATUS.has(status) ? status : 'planejamento',
    campaign: cleanText(item.campaign, 180),
    unit: cleanText(item.unit, 180),
    responsible: cleanText(item.responsible, 160),
    url: cleanUrl(item.url),
    tags: normalizeTags(item.tags),
    notes: cleanText(item.notes, 1600),
    createdAt: cleanText(item.createdAt, 40) || now,
    updatedAt: cleanText(item.updatedAt, 40) || now,
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
  return { ...normalizeItem(item), deleted: false };
};

const readLegacyDocument = async (store) => {
  const stored = await store.get(LEGACY_STORAGE_KEY, { type: 'json' });
  if (!stored || !Array.isArray(stored.data)) {
    return { revision: null, updatedAt: null, data: [] };
  }

  return {
    revision: stored.revision || null,
    updatedAt: stored.updatedAt || null,
    data: stored.data.slice(0, MAX_ITEMS).map(normalizeItem),
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
    else merged.set(record.id, normalizeItem(record));
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
  return {
    document: {
      revision: encodeRevision(await buildVersionMap(data)),
      updatedAt: data[0]?.updatedAt || legacy.updatedAt || null,
      data,
    },
    tombstonedIds: new Set(v2Records.filter((record) => record.deleted).map((record) => record.id)),
  };
};

const writeContent = async (store, item, updatedAt) => {
  const normalized = normalizeItem({ ...item, updatedAt: item.updatedAt || updatedAt });
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
    const { document } = await readDocument(store);
    return json({ ...document, storage: 'shared' });
  } catch (error) {
    return json({
      error: 'Falha ao carregar a biblioteca de conteúdos.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export async function onRequestPut({ env, request }) {
  const store = env.PLANET_HUB_DATA;
  if (!store) {
    return json({ error: 'PLANET_HUB_DATA não configurado.', storage: 'local' }, 503);
  }

  const contentLength = Number.parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_BODY_BYTES) {
    return json({ error: 'Payload acima do limite permitido.' }, 413);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }

  if (!Array.isArray(payload?.data)) {
    return json({ error: 'O campo data precisa ser uma lista.' }, 400);
  }
  if (payload.data.length > MAX_ITEMS) {
    return json({ error: `Limite de ${MAX_ITEMS} conteúdos excedido.` }, 400);
  }

  try {
    const { document: current, tombstonedIds } = await readDocument(store);
    const baseVersions = payload.baseRevision ? decodeRevision(payload.baseRevision) : {};
    if (payload.baseRevision && !baseVersions) {
      return json({
        error: 'A versão aberta da biblioteca ficou desatualizada. Recarregue os dados antes de salvar.',
        conflict: true,
        ...current,
      }, 409);
    }

    const incoming = payload.data
      .map(normalizeItem)
      .filter((item) => !tombstonedIds.has(item.id));
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
        error: 'Este conteúdo foi alterado em outro navegador.',
        conflict: true,
        conflictIds: conflictingIds,
        ...current,
      }, 409);
    }

    const updatedAt = new Date().toISOString();
    await Promise.all([
      ...changedIds.map((id) => writeContent(store, incomingById.get(id), updatedAt)),
      ...deletedIds.map((id) => writeTombstone(store, id, updatedAt)),
    ]);

    const nextById = new Map(currentById);
    changedIds.forEach((id) => nextById.set(id, normalizeItem({ ...incomingById.get(id), updatedAt: incomingById.get(id).updatedAt || updatedAt })));
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
      error: 'Falha ao salvar a biblioteca de conteúdos.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
