const STORAGE_KEY = 'planet-hub:inauguracoes:v1';
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

const readDocument = async (store) => {
  const stored = await store.get(STORAGE_KEY, { type: 'json' });
  if (!stored || !Array.isArray(stored.data)) {
    return { revision: null, updatedAt: null, data: [] };
  }
  return {
    revision: stored.revision || null,
    updatedAt: stored.updatedAt || null,
    data: stored.data.slice(0, MAX_ITEMS).map(normalizeInauguration),
  };
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
    const baseRevision = payload.baseRevision || null;
    if (baseRevision && current.revision && baseRevision !== current.revision) {
      return json({
        error: 'Os dados foram alterados em outro navegador.',
        conflict: true,
        ...current,
      }, 409);
    }

    const updatedAt = new Date().toISOString();
    const document = {
      revision: crypto.randomUUID(),
      updatedAt,
      data: payload.data.map((item) => normalizeInauguration({ ...item, updatedAt: item.updatedAt || updatedAt })),
    };

    const serialized = JSON.stringify(document);
    if (new TextEncoder().encode(serialized).byteLength > MAX_BODY_BYTES) {
      return json({ error: 'Os dados normalizados ultrapassam o limite permitido.' }, 413);
    }

    await store.put(STORAGE_KEY, serialized);
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
