const LEADS_KEY = 'planet-hub:planet-expansion-leads:v1';
const NOTIFICATIONS_KEY = 'planet-hub:planet-notifications:v1';
const MAX_LEADS = 2000;
const MAX_NOTIFICATIONS = 1000;
const MAX_BODY_BYTES = 128_000;
const MOVEMENT_GROUP_WINDOW_MS = 15 * 60 * 1000;

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
  const lead = root.lead || root.contact || root.data?.lead || root.data?.contact || root.leads?.[0] || root;
  const fields = Array.isArray(lead.custom_fields)
    ? lead.custom_fields
    : Array.isArray(lead.contact_custom_fields)
      ? lead.contact_custom_fields
      : [];
  const conversion = root.conversion || root.data?.conversion || lead.last_conversion || {};
  const funnel = lead.funnel || root.funnel || {};
  const owner = lead.owner || lead.user || funnel.owner || root.owner || {};
  const stage = funnel.current_stage || funnel.stage || lead.stage || root.stage || {};

  return {
    source: 'rd_station',
    externalId: cleanText(lead.uuid || lead.id || lead.contact_id || root.uuid || lead.email, 180),
    name: cleanText(lead.name || lead.nome || lead.full_name, 180) || 'Lead sem nome',
    phone: cleanPhone(lead.phone || lead.mobile_phone || lead.personal_phone || lead.telefone || lead.celular || lead.whatsapp || fieldValue(fields, ['telefone', 'phone', 'celular', 'whatsapp'])),
    email: cleanText(lead.email, 220).toLowerCase(),
    city: cleanText(lead.city || lead.cidade || fieldValue(fields, ['cidade', 'city']), 140),
    state: cleanText(lead.state || lead.estado || lead.uf || fieldValue(fields, ['estado', 'state', 'uf']), 80),
    company: cleanText(lead.company?.name || lead.company || lead.empresa || fieldValue(fields, ['empresa', 'company']), 180),
    origin: cleanText(funnel.origin || conversion.source || conversion.traffic_source || root.source || lead.source || fieldValue(fields, ['origem', 'source']), 180),
    conversion: cleanText(root.event_identifier || root.conversion_identifier || conversion.name || conversion.identifier || lead.conversion_identifier || fieldValue(fields, ['conversao', 'conversion']), 220),
    assignedTo: cleanText(owner.name || owner.email || lead.owner_name || lead.user_name || fieldValue(fields, ['responsavel', 'responsável', 'owner']), 160),
    rdStage: cleanText(stage.name || stage.label || lead.lead_stage || lead.funnel_stage || root.lead_stage, 160),
    eventAt: cleanText(root.event_timestamp || root.created_at || lead.updated_at || lead.created_at, 40) || nowIso(),
  };
};

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
  const phone = cleanPhone(item.phone);
  const firstName = cleanText(item.name, 180).split(/\s+/)[0] || '';
  const whatsappMessage = firstName
    ? `Olá, ${firstName}! Tudo bem?\n\nSou da equipe Planet Chocolate. Recebemos seu interesse em conhecer nossa franquia.`
    : 'Olá! Tudo bem?\n\nSou da equipe Planet Chocolate. Recebemos seu interesse em conhecer nossa franquia.';

  return {
    id: cleanText(item.id, 120) || `lead-${crypto.randomUUID()}`,
    tenantId: 'planet',
    source: 'rd_station',
    externalId: cleanText(item.externalId, 180),
    status: cleanText(item.status, 40) || 'new',
    name: cleanText(item.name, 180) || 'Lead sem nome',
    phone,
    email: cleanText(item.email, 220).toLowerCase(),
    city: cleanText(item.city, 140),
    state: cleanText(item.state, 80),
    company: cleanText(item.company, 180),
    origin: cleanText(item.origin, 180),
    conversion: cleanText(item.conversion, 220),
    assignedTo: cleanText(item.assignedTo, 160),
    rdStage: cleanText(item.rdStage, 160),
    notes: cleanText(item.notes, 1600),
    whatsappMessage: cleanText(item.whatsappMessage, 1200) || whatsappMessage,
    whatsappUrl: cleanText(item.whatsappUrl, 1400) || (phone ? `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage)}` : ''),
    viewedAt: cleanText(item.viewedAt, 40),
    lastActionAt: cleanText(item.lastActionAt, 40),
    history: normalizeHistory(item.history),
    createdAt,
    updatedAt: cleanText(item.updatedAt, 40) || createdAt,
  };
};

const normalizeNotification = (item = {}) => {
  const createdAt = cleanText(item.createdAt, 40) || nowIso();
  return {
    id: cleanText(item.id, 120) || `notification-${crypto.randomUUID()}`,
    tenantId: 'planet',
    area: 'expansion',
    type: ['lead.new', 'lead.updated', 'lead.alert'].includes(item.type) ? item.type : 'lead.updated',
    priority: ['high', 'medium', 'low'].includes(item.priority) ? item.priority : 'medium',
    title: cleanText(item.title, 180) || 'Atualização da expansão',
    summary: cleanText(item.summary, 500),
    leadId: cleanText(item.leadId, 120),
    leadName: cleanText(item.leadName, 180),
    count: Math.max(1, Math.min(99, Number(item.count) || 1)),
    changes: Array.isArray(item.changes) ? item.changes.map((value) => cleanText(value, 80)).filter(Boolean).slice(0, 20) : [],
    readAt: cleanText(item.readAt, 40),
    resolvedAt: cleanText(item.resolvedAt, 40),
    createdAt,
    updatedAt: cleanText(item.updatedAt, 40) || createdAt,
  };
};

const readDocument = async (store, key, normalizer, maxItems) => {
  const stored = await store.get(key, { type: 'json' });
  return stored && Array.isArray(stored.data)
    ? { revision: stored.revision || null, updatedAt: stored.updatedAt || null, data: stored.data.slice(0, maxItems).map(normalizer) }
    : { revision: null, updatedAt: null, data: [] };
};

const writeDocument = async (store, key, data, normalizer, maxItems) => {
  const document = {
    revision: crypto.randomUUID(),
    updatedAt: nowIso(),
    data: data.slice(0, maxItems).map(normalizer),
  };
  await store.put(key, JSON.stringify(document));
  return document;
};

const authorized = (request, env) => {
  const expected = cleanText(env.RD_WEBHOOK_SECRET, 500);
  if (!expected) return false;
  const url = new URL(request.url);
  const authorization = request.headers.get('authorization') || '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const direct = request.headers.get('x-rd-webhook-secret') || '';
  const query = url.searchParams.get('secret') || '';
  return bearer === expected || direct === expected || query === expected;
};

const relevantChanges = (before, after) => {
  const labels = {
    name: 'nome',
    phone: 'telefone',
    email: 'e-mail',
    city: 'cidade',
    state: 'estado',
    origin: 'origem',
    conversion: 'conversão',
    assignedTo: 'responsável',
    rdStage: 'etapa do funil',
  };
  return Object.entries(labels)
    .filter(([key]) => cleanText(before?.[key], 300) !== cleanText(after?.[key], 300))
    .map(([key, label]) => ({
      key,
      label,
      before: cleanText(before?.[key], 300),
      after: cleanText(after?.[key], 300),
    }));
};

const historyEvent = (type, title, changes = []) => ({
  id: `history-${crypto.randomUUID()}`,
  type,
  title,
  changes: changes.map((item) => item.label || item).filter(Boolean),
  createdAt: nowIso(),
});

const notificationForNewLead = (lead) => {
  const location = [lead.city, lead.state].filter(Boolean).join('/') || 'Local não informado';
  const origin = lead.origin || lead.conversion || 'Origem não informada';
  return normalizeNotification({
    type: 'lead.new',
    priority: 'high',
    title: 'Novo lead de franquia',
    summary: `${lead.name} · ${location} · ${origin}`,
    leadId: lead.id,
    leadName: lead.name,
    changes: [],
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
};

const upsertMovementNotification = (items, lead, changes) => {
  const timestamp = nowIso();
  const labels = changes.map((item) => item.label);
  const cutoff = Date.now() - MOVEMENT_GROUP_WINDOW_MS;
  const index = items.findIndex((item) => (
    item.type === 'lead.updated'
    && item.leadId === lead.id
    && !item.readAt
    && !item.resolvedAt
    && Date.parse(item.updatedAt || item.createdAt || 0) >= cutoff
  ));
  const highPriority = changes.some((item) => ['assignedTo', 'rdStage'].includes(item.key));

  if (index >= 0) {
    const current = normalizeNotification(items[index]);
    const mergedLabels = [...new Set([...current.changes, ...labels])].slice(0, 20);
    const updated = normalizeNotification({
      ...current,
      priority: highPriority ? 'high' : current.priority,
      title: 'Lead movimentado no RD',
      summary: `${lead.name} · ${mergedLabels.join(', ')}`,
      count: current.count + 1,
      changes: mergedLabels,
      updatedAt: timestamp,
    });
    return { data: items.map((item, itemIndex) => itemIndex === index ? updated : item), notification: updated, grouped: true };
  }

  const notification = normalizeNotification({
    type: 'lead.updated',
    priority: highPriority ? 'high' : 'medium',
    title: 'Lead movimentado no RD',
    summary: `${lead.name} · ${labels.join(', ')}`,
    leadId: lead.id,
    leadName: lead.name,
    count: 1,
    changes: labels,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  return { data: [notification, ...items], notification, grouped: false };
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
    const current = await readDocument(env.PLANET_HUB_DATA, LEADS_KEY, normalizeLead, MAX_LEADS);
    const duplicate = current.data.find((lead) => (
      incoming.externalId && lead.externalId === incoming.externalId && lead.source === 'rd_station'
    ) || (
      incoming.phone && lead.phone === incoming.phone && lead.status !== 'discarded'
    ) || (
      incoming.email && lead.email === incoming.email && lead.status !== 'discarded'
    ));

    let lead;
    let data;
    let changes = [];
    if (duplicate) {
      lead = normalizeLead({
        ...duplicate,
        ...incoming,
        id: duplicate.id,
        status: duplicate.status,
        notes: duplicate.notes,
        viewedAt: duplicate.viewedAt,
        lastActionAt: duplicate.lastActionAt,
        createdAt: duplicate.createdAt,
        history: duplicate.history,
        updatedAt: nowIso(),
      });
      changes = relevantChanges(duplicate, lead);
      if (changes.length) {
        lead.history = [historyEvent('updated', 'Movimentação recebida do RD Station', changes), ...lead.history].slice(0, 100);
      }
      data = current.data.map((item) => item.id === duplicate.id ? lead : item);
    } else {
      const createdAt = nowIso();
      lead = normalizeLead({
        ...incoming,
        id: `lead-${crypto.randomUUID()}`,
        createdAt,
        updatedAt: createdAt,
        history: [historyEvent('created', 'Lead recebido do RD Station')],
      });
      data = [lead, ...current.data];
    }

    const leadDocument = await writeDocument(env.PLANET_HUB_DATA, LEADS_KEY, data, normalizeLead, MAX_LEADS);
    let notification = { created: false, grouped: false, reason: duplicate && !changes.length ? 'no_relevant_changes' : 'not_created' };

    if (!duplicate || changes.length) {
      try {
        const currentNotifications = await readDocument(env.PLANET_HUB_DATA, NOTIFICATIONS_KEY, normalizeNotification, MAX_NOTIFICATIONS);
        const result = duplicate
          ? upsertMovementNotification(currentNotifications.data, lead, changes)
          : { data: [notificationForNewLead(lead), ...currentNotifications.data], grouped: false };
        const notificationDocument = await writeDocument(env.PLANET_HUB_DATA, NOTIFICATIONS_KEY, result.data, normalizeNotification, MAX_NOTIFICATIONS);
        const createdNotification = result.notification || notificationDocument.data[0];
        notification = {
          created: true,
          grouped: Boolean(result.grouped),
          id: createdNotification?.id || '',
          unread: notificationDocument.data.filter((item) => !item.readAt && !item.resolvedAt).length,
        };
      } catch (error) {
        notification = { created: false, grouped: false, reason: error instanceof Error ? error.message : String(error) };
      }
    }

    return json({
      ok: true,
      duplicate: Boolean(duplicate),
      changes: changes.map((item) => item.label),
      leadId: lead.id,
      revision: leadDocument.revision,
      notification,
    }, duplicate ? 200 : 201);
  } catch (error) {
    return json({ error: 'Falha ao processar o webhook do RD.', details: error instanceof Error ? error.message : String(error) }, 500);
  }
}

export function onRequestGet() {
  return json({ ok: true, integration: 'planet-rd-station', method: 'POST', destination: 'andre-os' });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
