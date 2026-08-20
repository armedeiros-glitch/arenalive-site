const LEGACY_STORAGE_KEY = 'planet-hub:inauguracoes:v1';
const ITEM_STORAGE_PREFIX = 'planet-hub:inauguration:v2:';
const MAX_ITEMS = 150;
const MAX_BODY_BYTES = 700_000;

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });

const getStore = (env) => env.PLANET_HUB_DATA;
const cleanText = (value, max = 240) => String(value ?? '').trim().slice(0, max);
const itemStorageKey = (id) => `${ITEM_STORAGE_PREFIX}${cleanText(id, 120)}`;

const cleanMoney = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(10_000_000, Math.round(number * 100) / 100);
};

const normalizeChecklistItem = (item = {}) => ({
  action: cleanText(item.action, 180),
  owner: cleanText(item.owner, 80),
  daysBefore: Math.max(0, Math.min(365, Number.parseInt(item.daysBefore, 10) || 0)),
  done: Boolean(item.done),
});

const normalizeInauguralAction = (item = {}) => {
  const costType = ['package', 'unit', 'included'].includes(item.costType)
    ? item.costType
    : 'package';

  return {
    id: cleanText(item.id, 80) || `action-${crypto.randomUUID()}`,
    name: cleanText(item.name, 140) || 'Ação inaugural',
    description: cleanText(item.description, 320),
    owner: cleanText(item.owner, 100),
    timing: cleanText(item.timing, 80),
    plannedAmount: cleanMoney(item.plannedAmount),
    actualAmount: cleanMoney(item.actualAmount),
    costType,
    included: item.included !== false,
    done: Boolean(item.done),
    quantity: Math.max(0, Math.min(50, Number.parseInt(item.quantity, 10) || 0)),
    notes: cleanText(item.notes, 300),
  };
};

const normalizeInauguration = (item = {}) => {
  const checklist = Array.isArray(item.checklist)
    ? item.checklist.slice(0, 50).map(normalizeChecklistItem)
    : [];
  const inauguralActions = Array.isArray(item.inauguralActions)
    ? item.inauguralActions.slice(0, 20).map(normalizeInauguralAction)
    : [];

  return {
    id: cleanText(item.id, 120) || `inauguration-${crypto.randomUUID()}`,
    sourceProjectId: item.sourceProjectId == null ? null : cleanText(item.sourceProjectId, 120),
    unit: cleanText(item.unit, 180) || 'Unidade sem nome',
    openingDate: /^\d{4}-\d{2}-\d{2}$/.test(String(item.openingDate || ''))
      ? String(item.openingDate)
      : '',
    responsible: cleanText(item.responsible, 140),
    location: cleanText(item.location, 180),
    createdAt: cleanText(item.createdAt, 40) || new Date().toISOString(),
    updatedAt: cleanText(item.updatedAt, 40) || new Date().toISOString(),
    packageBudget: item.packageBudget == null ? 4100 : cleanMoney(item.packageBudget),
    actionsVersion: Math.max(0, Math.min(100, Number.parseInt(item.actionsVersion, 10) || 0)),
    checklist,
    inauguralActions,
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
  return { ...normalizeInauguration(item), deleted: false };
};

const readLegacyDocument = async (store) => {
  const stored = await store.get(LEGACY_STORAGE_KEY, { type: 'json' });
  if (!stored || !Array.isArray(stored.data)) {
    return { revision: null, updatedAt: null, data: [] };
  }
  return {
    revision: stored.revision || null,
    updatedAt: stored.updatedAt || null,
    data: stored.data.slice(0, MAX_ITEMS).map(normalizeInauguration),
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
    else merged.set(record.id, normalizeInauguration(record));
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

const writeProject = async (store, item, updatedAt) => {
  const normalized = normalizeInauguration({ ...item, updatedAt: item.updatedAt || updatedAt });
  await store.put(itemStorageKey(normalized.id), JSON.stringify({ ...normalized, deleted: false }));
  return normalized;
};

const writeTombstone = async (store, id, updatedAt) => {
  const tombstone = { id: cleanText(id, 120), deleted: true, updatedAt };
  await store.put(itemStorageKey(tombstone.id), JSON.stringify(tombstone));
  return tombstone;
};

export async function onRequestGet({ env }) {
  const store = getStore(env);
  if (!store) {
    return json({
      error: 'PLANET_HUB_DATA não configurado.',
      storage: 'local',
      data: [],
    }, 503);
  }

  try {
    const document = await readDocument(store);
    return json({ ...document, storage: 'shared' });
  } catch (error) {
    return json({
      error: 'Falha ao carregar as inaugurações compartilhadas.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export async function onRequestPut({ env, request }) {
  const store = getStore(env);
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
    return json({ error: `Limite de ${MAX_ITEMS} inaugurações excedido.` }, 400);
  }

  try {
    const current = await readDocument(store);
    const baseVersions = payload.baseRevision ? decodeRevision(payload.baseRevision) : {};
    if (payload.baseRevision && !baseVersions) {
      return json({
        error: 'A versão aberta do painel ficou desatualizada. Recarregue os dados antes de salvar.',
        conflict: true,
        ...current,
      }, 409);
    }

    const incoming = payload.data.map(normalizeInauguration);
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
        error: 'Esta inauguração foi alterada em outro navegador.',
        conflict: true,
        conflictIds: conflictingIds,
        ...current,
      }, 409);
    }

    const updatedAt = new Date().toISOString();
    await Promise.all([
      ...changedIds.map((id) => writeProject(store, incomingById.get(id), updatedAt)),
      ...deletedIds.map((id) => writeTombstone(store, id, updatedAt)),
    ]);

    const nextById = new Map(currentById);
    changedIds.forEach((id) => nextById.set(id, normalizeInauguration({ ...incomingById.get(id), updatedAt: incomingById.get(id).updatedAt || updatedAt })));
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
      error: 'Falha ao salvar as inaugurações compartilhadas.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
