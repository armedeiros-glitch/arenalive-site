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
    notes: cleanText(item.notes, 1600),
    whatsappMessage: cleanText(item.whatsappMessage, 1200),
    whatsappUrl: cleanText(item.whatsappUrl, 1400),
    viewedAt: cleanText(item.viewedAt, 40),
    lastActionAt: cleanText(item.lastActionAt, 40),
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

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) return json({ error: 'Payload acima do limite permitido.' }, 413);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }

  const incoming = normalizeLead(payload?.lead || payload);
  if (!incoming.phone && !incoming.email) {
    return json({ error: 'O lead precisa ter telefone ou e-mail.' }, 400);
  }

  try {
    const current = await readDocument(store);
    const duplicate = current.data.find((lead) => (
      incoming.externalId && lead.externalId === incoming.externalId && lead.source === incoming.source
    ) || (
      incoming.phone && lead.phone === incoming.phone && lead.status !== 'discarded'
    ));

    if (duplicate) {
      const updated = normalizeLead({
        ...duplicate,
        ...incoming,
        id: duplicate.id,
        createdAt: duplicate.createdAt,
        updatedAt: nowIso(),
      });
      const data = current.data.map((lead) => lead.id === duplicate.id ? updated : lead);
      const document = await writeDocument(store, data);
      return json({ lead: updated, duplicate: true, revision: document.revision }, 200);
    }

    const lead = normalizeLead({ ...incoming, id: `lead-${crypto.randomUUID()}`, createdAt: nowIso(), updatedAt: nowIso() });
    const document = await writeDocument(store, [lead, ...current.data]);
    return json({ lead, duplicate: false, revision: document.revision }, 201);
  } catch (error) {
    return json({ error: 'Falha ao salvar o lead da Planet.', details: error instanceof Error ? error.message : String(error) }, 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
