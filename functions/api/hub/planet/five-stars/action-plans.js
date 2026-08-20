import { getAuthState } from '../../../../_lib/hub-auth.js';

const PREFIX = 'planet-hub:planet-five-stars-action-plan:v1:';
const MAX_ITEMS = 1500;
const MAX_BODY_BYTES = 80_000;
const STATUSES = new Set(['aberto', 'em_andamento', 'concluido']);
const AREAS = new Set(['marketing', 'campanhas', 'chamados', 'unidade']);
const PILLARS = new Set(['commercial', 'experience', 'marketing', 'management', 'requirements', 'other']);

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const clean = (value, max = 400) => String(value ?? '').trim().slice(0, max);
const cleanDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';

const authorize = async (request, env) => {
  const auth = await getAuthState(request, env);
  if (auth.configured && !auth.authenticated) return json({ ok: false, error: 'Não autorizado.' }, 401);
  return null;
};

const normalize = (item = {}) => {
  const now = new Date().toISOString();
  return {
    id: clean(item.id, 120) || `p5-plan-${crypto.randomUUID()}`,
    unit: clean(item.unit, 180),
    title: clean(item.title, 220),
    pillar: PILLARS.has(item.pillar) ? item.pillar : 'other',
    ownerArea: AREAS.has(item.ownerArea) ? item.ownerArea : 'unidade',
    deadline: cleanDate(item.deadline),
    status: STATUSES.has(item.status) ? item.status : 'aberto',
    notes: clean(item.notes, 1800),
    createdAt: clean(item.createdAt, 40) || now,
    updatedAt: clean(item.updatedAt, 40) || now,
  };
};

const listPlans = async (store) => {
  const data = [];
  let cursor;
  do {
    const page = await store.list({ prefix: PREFIX, limit: 1000, ...(cursor ? { cursor } : {}) });
    for (const key of page.keys || []) {
      if (data.length >= MAX_ITEMS) break;
      const item = await store.get(key.name, { type: 'json' });
      if (item) data.push(normalize(item));
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && data.length < MAX_ITEMS);
  return data.sort((a, b) => {
    if (a.status === 'concluido' && b.status !== 'concluido') return 1;
    if (b.status === 'concluido' && a.status !== 'concluido') return -1;
    const deadlineCompare = String(a.deadline || '9999-12-31').localeCompare(String(b.deadline || '9999-12-31'));
    if (deadlineCompare) return deadlineCompare;
    return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
  });
};

const readPayload = async (request) => {
  const contentLength = Number.parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_BODY_BYTES) return { error: json({ ok: false, error: 'Payload acima do limite permitido.' }, 413) };
  try {
    return { payload: await request.json() };
  } catch {
    return { error: json({ ok: false, error: 'JSON inválido.' }, 400) };
  }
};

export async function onRequestGet({ request, env }) {
  const denied = await authorize(request, env);
  if (denied) return denied;
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ ok: false, error: 'PLANET_HUB_DATA não configurado.', data: [] }, 503);
  try {
    return json({ ok: true, data: await listPlans(store) });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Falha ao carregar planos de ação.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const denied = await authorize(request, env);
  if (denied) return denied;
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ ok: false, error: 'PLANET_HUB_DATA não configurado.' }, 503);
  const parsed = await readPayload(request);
  if (parsed.error) return parsed.error;

  const incoming = normalize(parsed.payload?.plan || parsed.payload || {});
  if (!incoming.unit) return json({ ok: false, error: 'Informe a unidade.' }, 400);
  if (!incoming.title) return json({ ok: false, error: 'Informe a ação.' }, 400);
  const key = `${PREFIX}${incoming.id}`;
  const previous = await store.get(key, { type: 'json' });
  if (previous?.createdAt) incoming.createdAt = previous.createdAt;
  incoming.updatedAt = new Date().toISOString();
  await store.put(key, JSON.stringify(incoming));
  return json({ ok: true, plan: incoming }, previous ? 200 : 201);
}

export async function onRequestDelete({ request, env }) {
  const denied = await authorize(request, env);
  if (denied) return denied;
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ ok: false, error: 'PLANET_HUB_DATA não configurado.' }, 503);
  const parsed = await readPayload(request);
  if (parsed.error) return parsed.error;
  const id = clean(parsed.payload?.id, 120);
  if (!id) return json({ ok: false, error: 'Informe o plano.' }, 400);
  const key = `${PREFIX}${id}`;
  const existing = await store.get(key);
  if (!existing) return json({ ok: false, error: 'Plano não encontrado.' }, 404);
  await store.delete(key);
  return json({ ok: true });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
