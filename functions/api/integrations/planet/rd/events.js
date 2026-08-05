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

const fieldValue = (fields, names) => {
  const wanted = names.map((name) => String(name).toLowerCase());
  const item = fields.find((field) => wanted.includes(String(field?.name || field?.key || '').toLowerCase()));
  const value = item?.value ?? item?.values?.[0];
  return Array.isArray(value) ? value[0] : value;
};

const extractPayload = (payload = {}) => {
  const root = Array.isArray(payload) ? payload[0] || {} : payload;
  const lead = root.lead || root.contact || root.data?.lead || root.data?.contact || root;
  const fields = Array.isArray(lead.custom_fields) ? lead.custom_fields : Array.isArray(lead.contact_custom_fields) ? lead.contact_custom_fields : [];
  const conversion = root.conversion || root.data?.conversion || lead.last_conversion || {};

  return {
    source: 'rd_station',
    externalId: cleanText(lead.uuid || lead.id || lead.contact_id || root.event_identifier || root.uuid, 180),
    name: cleanText(lead.name || lead.nome || lead.full_name, 180) || 'Lead sem nome',
    phone: cleanPhone(lead.phone || lead.mobile_phone || lead.telefone || fieldValue(fields, ['telefone', 'phone', 'celular', 'whatsapp'])),
    email: cleanText(lead.email, 220).toLowerCase(),
    city: cleanText(lead.city || lead.cidade || fieldValue(fields, ['cidade', 'city']), 140),
    state: cleanText(lead.state || lead.estado || lead.uf || fieldValue(fields, ['estado', 'state', 'uf']), 80),
    company: cleanText(lead.company || lead.empresa || fieldValue(fields, ['empresa', 'company']), 180),
    origin: cleanText(conversion.source || conversion.traffic_source || root.source || lead.source || fieldValue(fields, ['origem', 'source']), 180),
    conversion: cleanText(conversion.name || conversion.identifier || root.conversion_identifier || lead.conversion_identifier || fieldValue(fields, ['conversao', 'conversion']), 220),
    createdAt: cleanText(root.event_timestamp || root.created_at || lead.created_at, 40) || nowIso(),
  };
};

const normalizeLead = (item = {}) => {
  const createdAt = cleanText(item.createdAt, 40) || nowIso();
  return {
    id: cleanText(item.id, 120) || `lead-${crypto.randomUUID()}`,
    tenantId: 'planet',
    source: 'rd_station',
    externalId: cleanText(item.externalId, 180),
    status: 'new',
    name: cleanText(item.name, 180) || 'Lead sem nome',
    phone: cleanPhone(item.phone),
    email: cleanText(item.email, 220).toLowerCase(),
    city: cleanText(item.city, 140),
    state: cleanText(item.state, 80),
    company: cleanText(item.company, 180),
    origin: cleanText(item.origin, 180),
    conversion: cleanText(item.conversion, 220),
    assignedTo: '',
    notes: '',
    whatsappMessage: '',
    whatsappUrl: '',
    viewedAt: '',
    lastActionAt: '',
    createdAt,
    updatedAt: nowIso(),
  };
};

const readDocument = async (store) => {
  const stored = await store.get(STORAGE_KEY, { type: 'json' });
  return stored && Array.isArray(stored.data)
    ? { revision: stored.revision || null, data: stored.data.slice(0, MAX_ITEMS) }
    : { revision: null, data: [] };
};

const writeDocument = async (store, data) => {
  const document = {
    revision: crypto.randomUUID(),
    updatedAt: nowIso(),
    data: data.slice(0, MAX_ITEMS),
  };
  await store.put(STORAGE_KEY, JSON.stringify(document));
  return document;
};

const authorized = (request, env) => {
  const expected = cleanText(env.RD_WEBHOOK_SECRET, 500);
  if (!expected) return false;
  const authorization = request.headers.get('authorization') || '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const direct = request.headers.get('x-rd-webhook-secret') || '';
  return bearer === expected || direct === expected;
};

export async function onRequestPost({ env, request }) {
  if (!env.RD_WEBHOOK_SECRET) return json({ error: 'RD_WEBHOOK_SECRET não configurado.' }, 503);
  if (!authorized(request, env)) return json({ error: 'Não autorizado.' }, 401);
  if (!env.PLANET_HUB_DATA) return json({ error: 'PLANET_HUB_DATA não configurado.' }, 503);

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) return json({ error: 'Payload acima do limite permitido.' }, 413);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }

  const incoming = normalizeLead(extractPayload(payload));
  if (!incoming.phone && !incoming.email) return json({ error: 'Lead sem telefone e e-mail.' }, 400);

  try {
    const current = await readDocument(env.PLANET_HUB_DATA);
    const duplicate = current.data.find((lead) => (
      incoming.externalId && lead.externalId === incoming.externalId && lead.source === 'rd_station'
    ) || (
      incoming.phone && lead.phone === incoming.phone && lead.status !== 'discarded'
    ));

    let lead;
    let data;
    if (duplicate) {
      lead = { ...duplicate, ...incoming, id: duplicate.id, createdAt: duplicate.createdAt, updatedAt: nowIso() };
      data = current.data.map((item) => item.id === duplicate.id ? lead : item);
    } else {
      lead = { ...incoming, id: `lead-${crypto.randomUUID()}`, createdAt: nowIso(), updatedAt: nowIso() };
      data = [lead, ...current.data];
    }

    const document = await writeDocument(env.PLANET_HUB_DATA, data);
    return json({ ok: true, duplicate: Boolean(duplicate), leadId: lead.id, revision: document.revision }, duplicate ? 200 : 201);
  } catch (error) {
    return json({ error: 'Falha ao processar o webhook do RD.', details: error instanceof Error ? error.message : String(error) }, 500);
  }
}

export function onRequestGet() {
  return json({ ok: true, integration: 'planet-rd-station', method: 'POST' });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
