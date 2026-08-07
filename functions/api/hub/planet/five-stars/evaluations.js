const STORAGE_KEY = 'planet-hub:planet-five-stars-evaluations:v1';
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

const readDocument = async (store) => {
  const stored = await store.get(STORAGE_KEY, { type: 'json' });
  if (!stored || !Array.isArray(stored.data)) return { revision: null, updatedAt: null, data: [] };
  return {
    revision: stored.revision || null,
    updatedAt: stored.updatedAt || null,
    data: stored.data.slice(0, MAX_ITEMS).map(normalizeEvaluation),
  };
};

const validateEvaluation = (evaluation) => {
  if (!evaluation.unit) return 'Informe a unidade.';
  if (!evaluation.cycle) return 'Informe o ciclo no formato semestre/ano.';
  if (!evaluation.evaluatedAt) return 'Informe a data da avaliação.';
  return '';
};

const writeDocument = async (store, data) => {
  const updatedAt = new Date().toISOString();
  const document = {
    revision: crypto.randomUUID(),
    updatedAt,
    data: data.slice(0, MAX_ITEMS).map((item) => normalizeEvaluation(item)),
  };
  const serialized = JSON.stringify(document);
  if (new TextEncoder().encode(serialized).byteLength > MAX_BODY_BYTES) {
    const error = new Error('Os dados ultrapassam o limite permitido.');
    error.status = 413;
    throw error;
  }
  await store.put(STORAGE_KEY, serialized);
  return document;
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
    const current = await readDocument(store);
    const incoming = normalizeEvaluation(parsed.payload?.evaluation || parsed.payload || {});
    const validationError = validateEvaluation(incoming);
    if (validationError) return json({ error: validationError }, 400);

    const index = current.data.findIndex((item) => item.id === incoming.id);
    if (index >= 0) {
      incoming.createdAt = current.data[index].createdAt;
      incoming.updatedAt = new Date().toISOString();
      current.data[index] = incoming;
    } else {
      incoming.createdAt = new Date().toISOString();
      incoming.updatedAt = incoming.createdAt;
      current.data.unshift(incoming);
    }

    const document = await writeDocument(store, current.data);
    return json({ evaluation: incoming, revision: document.revision, updatedAt: document.updatedAt }, index >= 0 ? 200 : 201);
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
    const current = await readDocument(store);
    const next = current.data.filter((item) => item.id !== id);
    if (next.length === current.data.length) return json({ error: 'Avaliação não encontrada.' }, 404);
    const document = await writeDocument(store, next);
    return json({ ok: true, revision: document.revision, updatedAt: document.updatedAt });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Falha ao excluir avaliação.' }, Number(error?.status) || 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
