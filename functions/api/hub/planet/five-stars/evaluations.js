const STORAGE_KEY = 'planet-hub:planet-five-stars-evaluations:v1';
const ITEM_PREFIX = 'planet-hub:planet-five-stars-evaluation:v1:';
const MAX_ITEMS = 1200;
const MAX_BODY_BYTES = 600_000;

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const cleanText = (value, max = 300) => String(value ?? '').trim().slice(0, max);
const cleanDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
const cleanCycle = (value) => /^\d{4}-S[12]$/.test(String(value || '')) ? String(value) : '';
const clamp = (value, max) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(max, Math.max(0, Math.round(number * 10) / 10));
};

const requirementState = (value) => ['ok', 'fail', 'pending'].includes(value) ? value : 'pending';

const normalizeEvaluation = (item = {}) => {
  const scores = {
    commercial: clamp(item?.scores?.commercial, 35),
    experience: clamp(item?.scores?.experience, 25),
    marketing: clamp(item?.scores?.marketing, 20),
    management: clamp(item?.scores?.management, 20),
  };
  const total = Math.round((scores.commercial + scores.experience + scores.marketing + scores.management) * 10) / 10;
  const starsByScore = total >= 90 ? 5 : total >= 75 ? 4 : total >= 60 ? 3 : total >= 40 ? 2 : 1;

  return {
    id: cleanText(item.id, 120) || `p5-${crypto.randomUUID()}`,
    tenantId: 'planet',
    unit: cleanText(item.unit, 180),
    cycle: cleanCycle(item.cycle),
    evaluatedAt: cleanDate(item.evaluatedAt),
    scores,
    total,
    starsByScore,
    requirements: {
      hiddenShopper: requirementState(item?.requirements?.hiddenShopper),
      reportsOnTime: requirementState(item?.requirements?.reportsOnTime),
      noSeriousPending: requirementState(item?.requirements?.noSeriousPending),
    },
    notes: cleanText(item.notes, 2000),
    createdAt: cleanText(item.createdAt, 40) || new Date().toISOString(),
    updatedAt: cleanText(item.updatedAt, 40) || new Date().toISOString(),
  };
};

const validateEvaluation = (evaluation) => {
  if (!evaluation.unit) return 'Informe a unidade.';
  if (!evaluation.cycle) return 'Informe o ciclo no formato semestre/ano.';
  if (!evaluation.evaluatedAt) return 'Informe a data da avaliação.';
  return '';
};

const readLegacyDocument = async (store) => {
  const stored = await store.get(STORAGE_KEY, { type: 'json' });
  if (!stored || !Array.isArray(stored.data)) return { revision: null, updatedAt: null, data: [] };
  return {
    revision: stored.revision || null,
    updatedAt: stored.updatedAt || null,
    data: stored.data.slice(0, MAX_ITEMS).map(normalizeEvaluation),
  };
};

const readItemRecords = async (store) => {
  const data = [];
  let cursor;
  do {
    const page = await store.list({ prefix: ITEM_PREFIX, limit: 1000, ...(cursor ? { cursor } : {}) });
    for (const key of page.keys || []) {
      if (data.length >= MAX_ITEMS) break;
      const item = await store.get(key.name, { type: 'json' });
      if (item) data.push(normalizeEvaluation(item));
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && data.length < MAX_ITEMS);
  return data;
};

const readDocument = async (store) => {
  const [legacy, records] = await Promise.all([readLegacyDocument(store), readItemRecords(store)]);
  const merged = new Map();
  legacy.data.forEach((item) => merged.set(item.id, item));
  records.forEach((item) => merged.set(item.id, item));
  const data = [...merged.values()]
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
    .slice(0, MAX_ITEMS);
  return {
    revision: crypto.randomUUID(),
    updatedAt: data[0]?.updatedAt || legacy.updatedAt || null,
    data,
  };
};

const readPayload = async (request) => {
  const contentLength = Number.parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_BODY_BYTES) return { error: json({ error: 'Payload acima do limite permitido.' }, 413) };
  try {
    return { payload: await request.json() };
  } catch {
    return { error: json({ error: 'JSON inválido.' }, 400) };
  }
};

export async function onRequestGet({ env }) {
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ error: 'PLANET_HUB_DATA não configurado.', data: [], storage: 'unavailable' }, 503);
  try {
    return json({ ...(await readDocument(store)), storage: 'shared' });
  } catch (error) {
    return json({ error: 'Falha ao carregar avaliações do Planet 5 Estrelas.', details: error instanceof Error ? error.message : String(error) }, 500);
  }
}

export async function onRequestPost({ env, request }) {
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ error: 'PLANET_HUB_DATA não configurado.' }, 503);
  const parsed = await readPayload(request);
  if (parsed.error) return parsed.error;

  try {
    const incoming = normalizeEvaluation(parsed.payload?.evaluation || parsed.payload || {});
    const validationError = validateEvaluation(incoming);
    if (validationError) return json({ error: validationError }, 400);

    const itemKey = `${ITEM_PREFIX}${incoming.id}`;
    const existing = await store.get(itemKey, { type: 'json' });
    const legacy = existing ? null : (await readLegacyDocument(store)).data.find((item) => item.id === incoming.id);
    const previous = existing || legacy || null;
    const now = new Date().toISOString();
    incoming.createdAt = cleanText(previous?.createdAt, 40) || now;
    incoming.updatedAt = now;

    const serialized = JSON.stringify(incoming);
    if (new TextEncoder().encode(serialized).byteLength > MAX_BODY_BYTES) {
      return json({ error: 'A avaliação ultrapassa o limite permitido.' }, 413);
    }

    await store.put(itemKey, serialized);
    return json({ evaluation: incoming, revision: crypto.randomUUID(), updatedAt: now }, previous ? 200 : 201);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Falha ao salvar avaliação.' }, Number(error?.status) || 500);
  }
}

export async function onRequestDelete({ env, request }) {
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ error: 'PLANET_HUB_DATA não configurado.' }, 503);
  const parsed = await readPayload(request);
  if (parsed.error) return parsed.error;
  const id = cleanText(parsed.payload?.id, 120);
  if (!id) return json({ error: 'Informe a avaliação que será excluída.' }, 400);

  try {
    const itemKey = `${ITEM_PREFIX}${id}`;
    const individual = await store.get(itemKey);
    const legacy = await readLegacyDocument(store);
    const legacyIndex = legacy.data.findIndex((item) => item.id === id);
    if (!individual && legacyIndex < 0) return json({ error: 'Avaliação não encontrada.' }, 404);

    if (individual) await store.delete(itemKey);
    if (legacyIndex >= 0) {
      legacy.data.splice(legacyIndex, 1);
      const document = {
        revision: crypto.randomUUID(),
        updatedAt: new Date().toISOString(),
        data: legacy.data,
      };
      await store.put(STORAGE_KEY, JSON.stringify(document));
    }

    return json({ ok: true, revision: crypto.randomUUID(), updatedAt: new Date().toISOString() });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Falha ao excluir avaliação.' }, Number(error?.status) || 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
