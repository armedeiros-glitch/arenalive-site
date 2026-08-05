const STORAGE_KEY = 'planet-hub:planet-expansion-leads:v1';
const MAX_ITEMS = 2000;
const MAX_BODY_BYTES = 128_000;

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const cleanText = (value, max = 300) => String(value ?? '').trim().slice(0, max);
const cleanPhone = (value) => cleanText(value, 40).replace(/[^\d+]/g, '');
const nowIso = () => new Date().toISOString();

const SOURCES = new Set(['rd_station', 'reactivated', 'caca_lead', 'manual']);
const STATUSES = new Set(['new', 'claimed', 'contacted', 'qualified', 'discarded']);

const normalizeHistory = (items) => (Array.isArray(items) ? items : [])
  .map((item) => ({
    id: cleanText(item?.id, 120) || `history-${crypto.randomUUID()}`,
    type: cleanText(item?.type, 40) || 'updated',
    title: cleanText(item?.title, 180),
    changes: Array.isArray(item?.changes) ? item.changes.map((value) => cleanText(value, 80)).filter(Boolean).slice(0, 20) : [],
    createdAt: cleanText(item?.createdAt, 40) || nowIso(),
  }))
  .slice(0, 100);

const normalizeLead = (item = {}) => {
  const createdAt = cleanText(item.createdAt, 40) || nowIso();
  return {
    id: cleanText(item.id, 120) || `lead-${crypto.randomUUID()}`,
    tenantId: 'planet',
    source: SOURCES.has(item.source) ? item.source : 'manual',
    externalId: cleanText(item.externalId, 180),
    status: STATUSES.has(item.status) ? item.status : 'new',
    name: cleanText(item.name, 180) || 'Lead sem nome',
    phone: cleanPhone(item.phone),
    email: cleanText(item.email, 220).toLowerCase(),
    city: cleanText(item.city, 140),
    state: cleanText(item.state, 80),
    company: cleanText(item.company, 180),
    origin: cleanText(item.origin, 180),
    conversion: cleanText(item.conversion, 220),
    assignedTo: cleanText(item.assignedTo, 160),
    rdStage: cleanText(item.rdStage, 160),
    notes: cleanText(item.notes, 1600),
    whatsappMessage: cleanText(item.whatsappMessage, 1200),
    whatsappUrl: cleanText(item.whatsappUrl, 1400),
    viewedAt: cleanText(item.viewedAt, 40),
    lastActionAt: cleanText(item.lastActionAt, 40),
    history: normalizeHistory(item.history),
    createdAt,
    updatedAt: cleanText(item.updatedAt, 40) || createdAt,
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
    data: stored.data.slice(0, MAX_ITEMS).map(normalizeLead),
  };
};

const writeDocument = async (store, data) => {
  const updatedAt = nowIso();
  const document = {
    revision: crypto.randomUUID(),
    updatedAt,
    data: data.slice(0, MAX_ITEMS).map((item) => normalizeLead(item)),
  };
  await store.put(STORAGE_KEY, JSON.stringify(document));
  return document;
};

const readPayload = async (request) => {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) return { error: json({ error: 'Payload acima do limite permitido.' }, 413) };
  try {
    return { payload: await request.json() };
  } catch {
    return { error: json({ error: 'JSON inválido.' }, 400) };
  }
};

export async function onRequestGet({ env }) {
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ error: 'PLANET_HUB_DATA não configurado.', data: [], storage: 'local' }, 503);
  try {
    return json({ ...(await readDocument(store)), storage: 'shared' });
  } catch (error) {
    return json({ error: 'Falha ao carregar os leads da Planet.', details: error instanceof Error ? error.message : String(error) }, 500);
  }
}

export async function onRequestPost({ env, request }) {
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ error: 'PLANET_HUB_DATA não configurado.' }, 503);

  const parsed = await readPayload(request);
  if (parsed.error) return parsed.error;
  const incoming = normalizeLead(parsed.payload?.lead || parsed.payload);
  if (!incoming.phone && !incoming.email) return json({ error: 'O lead precisa ter telefone ou e-mail.' }, 400);

  try {
    const current = await readDocument(store);
    const duplicate = current.data.find((lead) => (
      incoming.externalId && lead.externalId === incoming.externalId && lead.source === incoming.source
    ) || (
      incoming.phone && lead.phone === incoming.phone && lead.status !== 'discarded'
    ) || (
      incoming.email && lead.email === incoming.email && lead.status !== 'discarded'
    ));

    if (duplicate) {
      const updated = normalizeLead({
        ...duplicate,
        ...incoming,
        id: duplicate.id,
        createdAt: duplicate.createdAt,
        history: duplicate.history,
        updatedAt: nowIso(),
      });
      const data = current.data.map((lead) => lead.id === duplicate.id ? updated : lead);
      const document = await writeDocument(store, data);
      return json({ lead: updated, duplicate: true, revision: document.revision }, 200);
    }

    const timestamp = nowIso();
    const lead = normalizeLead({
      ...incoming,
      id: `lead-${crypto.randomUUID()}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      history: [{ id: `history-${crypto.randomUUID()}`, type: 'created', title: 'Lead cadastrado manualmente', changes: [], createdAt: timestamp }],
    });
    const document = await writeDocument(store, [lead, ...current.data]);
    return json({ lead, duplicate: false, revision: document.revision }, 201);
  } catch (error) {
    return json({ error: 'Falha ao salvar o lead da Planet.', details: error instanceof Error ? error.message : String(error) }, 500);
  }
}

export async function onRequestPut({ env, request }) {
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ error: 'PLANET_HUB_DATA não configurado.' }, 503);

  const parsed = await readPayload(request);
  if (parsed.error) return parsed.error;
  const id = cleanText(parsed.payload?.id, 120);
  const changes = parsed.payload?.changes && typeof parsed.payload.changes === 'object' ? parsed.payload.changes : {};
  if (!id) return json({ error: 'Informe o lead.' }, 400);

  try {
    const current = await readDocument(store);
    const existing = current.data.find((lead) => lead.id === id);
    if (!existing) return json({ error: 'Lead não encontrado.' }, 404);

    const next = { ...existing };
    const changedLabels = [];

    if (Object.prototype.hasOwnProperty.call(changes, 'status')) {
      if (!STATUSES.has(changes.status)) return json({ error: 'Status de lead inválido.' }, 400);
      if (changes.status !== existing.status) changedLabels.push('status');
      next.status = changes.status;
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'assignedTo')) {
      const value = cleanText(changes.assignedTo, 160);
      if (value !== existing.assignedTo) changedLabels.push('responsável');
      next.assignedTo = value;
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'notes')) {
      const value = cleanText(changes.notes, 1600);
      if (value !== existing.notes) changedLabels.push('observações');
      next.notes = value;
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'viewedAt')) next.viewedAt = cleanText(changes.viewedAt, 40) || nowIso();
    if (Object.prototype.hasOwnProperty.call(changes, 'lastActionAt')) next.lastActionAt = cleanText(changes.lastActionAt, 40) || nowIso();

    const timestamp = nowIso();
    next.updatedAt = timestamp;
    if (changedLabels.length) {
      next.history = [{
        id: `history-${crypto.randomUUID()}`,
        type: 'updated',
        title: 'Lead atualizado no André OS',
        changes: changedLabels,
        createdAt: timestamp,
      }, ...existing.history].slice(0, 100);
    }

    const lead = normalizeLead(next);
    const data = current.data.map((item) => item.id === id ? lead : item);
    const document = await writeDocument(store, data);
    return json({ lead, revision: document.revision });
  } catch (error) {
    return json({ error: 'Falha ao atualizar o lead da Planet.', details: error instanceof Error ? error.message : String(error) }, 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
