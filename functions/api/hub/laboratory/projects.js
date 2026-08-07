import { getAuthState } from '../../../_lib/hub-auth.js';

const PREFIX = 'andre-os:lab-project:v1:';
const MAX_ITEMS = 200;
const MAX_BODY_BYTES = 50_000;

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const clean = (value, max = 400) => String(value ?? '').trim().slice(0, max);
const allowedStatus = new Set(['explorando', 'validando', 'executando', 'pausado']);

const normalize = (item = {}) => {
  const now = new Date().toISOString();
  return {
    id: clean(item.id, 120) || `lab-${crypto.randomUUID()}`,
    name: clean(item.name, 160),
    summary: clean(item.summary, 700),
    nextStep: clean(item.nextStep, 500),
    status: allowedStatus.has(item.status) ? item.status : 'explorando',
    createdAt: clean(item.createdAt, 40) || now,
    updatedAt: now,
  };
};

const authorize = async (request, env) => {
  const auth = await getAuthState(request, env);
  if (auth.configured && !auth.authenticated) return json({ ok: false, error: 'Não autorizado.' }, 401);
  return null;
};

const listProjects = async (store) => {
  const projects = [];
  let cursor;
  do {
    const page = await store.list({ prefix: PREFIX, limit: 1000, ...(cursor ? { cursor } : {}) });
    for (const key of page.keys || []) {
      if (projects.length >= MAX_ITEMS) break;
      const item = await store.get(key.name, { type: 'json' });
      if (item) projects.push(item);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && projects.length < MAX_ITEMS);
  return projects
    .map((item) => normalize({ ...item, updatedAt: item.updatedAt }))
    .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
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
    return json({ ok: true, data: await listProjects(store) });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Falha ao carregar o Laboratório.' }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const denied = await authorize(request, env);
  if (denied) return denied;
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ ok: false, error: 'PLANET_HUB_DATA não configurado.' }, 503);
  const parsed = await readPayload(request);
  if (parsed.error) return parsed.error;

  try {
    const incoming = normalize(parsed.payload?.project || parsed.payload || {});
    if (!incoming.name) return json({ ok: false, error: 'Informe o nome do projeto.' }, 400);
    const key = `${PREFIX}${incoming.id}`;
    const previous = await store.get(key, { type: 'json' });
    if (previous?.createdAt) incoming.createdAt = previous.createdAt;
    incoming.updatedAt = new Date().toISOString();
    await store.put(key, JSON.stringify(incoming));
    return json({ ok: true, project: incoming }, previous ? 200 : 201);
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Falha ao salvar o projeto.' }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  const denied = await authorize(request, env);
  if (denied) return denied;
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ ok: false, error: 'PLANET_HUB_DATA não configurado.' }, 503);
  const parsed = await readPayload(request);
  if (parsed.error) return parsed.error;
  const id = clean(parsed.payload?.id, 120);
  if (!id) return json({ ok: false, error: 'Informe o projeto.' }, 400);

  const key = `${PREFIX}${id}`;
  const existing = await store.get(key);
  if (!existing) return json({ ok: false, error: 'Projeto não encontrado.' }, 404);
  await store.delete(key);
  return json({ ok: true });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
