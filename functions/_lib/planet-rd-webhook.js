import {
  cleanPhone,
  cleanText,
  nowIso,
  upsertLead,
} from './planet-leads.js';
import {
  isLowSignalMovement,
  normalizeNotification,
  readNotificationDocument,
  summarizeNotifications,
  writeNotificationDocument,
} from './planet-notifications.js';

const MAX_BODY_BYTES = 128_000;
const MOVEMENT_GROUP_WINDOW_MS = 15 * 60 * 1000;
const NOTIFICATION_CHANGE_KEYS = new Set([
  'phone',
  'email',
  'city',
  'state',
  'conversion',
  'assignedTo',
  'rdStage',
]);

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

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
    name: cleanText(lead.name || lead.nome || lead.full_name, 180),
    phone: cleanPhone(
      lead.phone
      || lead.mobile_phone
      || lead.personal_phone
      || lead.telefone
      || lead.celular
      || lead.whatsapp
      || fieldValue(fields, ['telefone', 'phone', 'celular', 'whatsapp']),
    ),
    email: cleanText(lead.email, 220).toLowerCase(),
    city: cleanText(lead.city || lead.cidade || fieldValue(fields, ['cidade', 'city']), 140),
    state: cleanText(lead.state || lead.estado || lead.uf || fieldValue(fields, ['estado', 'state', 'uf']), 80),
    company: cleanText(
      lead.company?.name || lead.company || lead.empresa || fieldValue(fields, ['empresa', 'company']),
      180,
    ),
    origin: cleanText(
      funnel.origin
      || conversion.source
      || conversion.traffic_source
      || root.source
      || lead.source
      || fieldValue(fields, ['origem', 'source']),
      180,
    ),
    conversion: cleanText(
      root.event_identifier
      || root.conversion_identifier
      || conversion.name
      || conversion.identifier
      || lead.conversion_identifier
      || fieldValue(fields, ['conversao', 'conversion']),
      220,
    ),
    assignedTo: cleanText(
      owner.name
      || owner.email
      || lead.owner_name
      || lead.user_name
      || fieldValue(fields, ['responsavel', 'responsável', 'owner']),
      160,
    ),
    rdStage: cleanText(stage.name || stage.label || lead.lead_stage || lead.funnel_stage || root.lead_stage, 160),
    eventAt: cleanText(root.event_timestamp || root.created_at || lead.updated_at || lead.created_at, 40),
  };
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

const notificationForNewLead = (lead) => {
  const location = [lead.city, lead.state].filter(Boolean).join('/') || 'Local não informado';
  const origin = lead.origin || lead.conversion || 'Origem não informada';
  return normalizeNotification({
    id: `notification-lead-new-${lead.id}`,
    type: 'lead.new',
    priority: 'high',
    title: 'Novo lead de franquia',
    summary: `${lead.name} · ${location} · ${origin}`,
    leadId: lead.id,
    leadName: lead.name,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
};

const notificationChanges = (changes) => (Array.isArray(changes) ? changes : [])
  .filter((item) => NOTIFICATION_CHANGE_KEYS.has(item?.key));

const upsertMovementNotification = (items, lead, changes) => {
  const timestamp = nowIso();
  const labels = changes.map((item) => item.label);
  const cutoff = Date.now() - MOVEMENT_GROUP_WINDOW_MS;
  const index = items.findIndex((item) => (
    item.type === 'lead.updated'
    && item.leadId === lead.id
    && !item.readAt
    && !item.resolvedAt
    && !isLowSignalMovement(item)
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
    return {
      data: items.map((item, itemIndex) => itemIndex === index ? updated : item),
      notification: updated,
      grouped: true,
    };
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

  const extracted = extractPayload(payload);
  if (!extracted.phone && !extracted.email) return json({ error: 'Lead sem telefone e e-mail.' }, 400);

  try {
    const result = await upsertLead(env.PLANET_HUB_DATA, extracted, {
      sourceOverride: 'rd_station',
      stableExternalIdentity: true,
      ensureWhatsapp: true,
      mergeExternalOnly: true,
      preserveStatus: true,
      preserveNotes: true,
      preserveWhatsapp: true,
      preserveViewedAt: true,
      preserveLastActionAt: true,
      historyOnDuplicate: {
        type: 'updated',
        title: 'Movimentação recebida do RD Station',
      },
      initialHistory: [{
        id: `history-${crypto.randomUUID()}`,
        type: 'created',
        title: 'Lead recebido do RD Station',
        changes: [],
        createdAt: extracted.eventAt || nowIso(),
      }],
      createdAt: extracted.eventAt,
      missingContactMessage: 'Lead sem telefone e e-mail.',
    });

    const movementChanges = notificationChanges(result.changes);
    let notification = {
      created: false,
      grouped: false,
      reason: result.duplicate
        ? (result.changes.length ? 'low_signal_changes' : 'no_relevant_changes')
        : 'not_created',
    };

    if (!result.duplicate || movementChanges.length) {
      try {
        const currentNotifications = await readNotificationDocument(env.PLANET_HUB_DATA);
        const notificationResult = result.duplicate
          ? upsertMovementNotification(currentNotifications.data, result.lead, movementChanges)
          : {
              data: [notificationForNewLead(result.lead), ...currentNotifications.data],
              grouped: false,
            };
        const notificationDocument = await writeNotificationDocument(
          env.PLANET_HUB_DATA,
          notificationResult.data,
        );
        const createdNotification = notificationResult.notification || notificationDocument.data[0];
        const visibleNotifications = summarizeNotifications(notificationDocument);
        notification = {
          created: true,
          grouped: Boolean(notificationResult.grouped),
          id: createdNotification?.id || '',
          unread: visibleNotifications.unread,
        };
      } catch (error) {
        notification = {
          created: false,
          grouped: false,
          reason: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return json({
      ok: true,
      duplicate: result.duplicate,
      changes: result.changes.map((item) => item.label),
      notificationChanges: movementChanges.map((item) => item.label),
      leadId: result.lead.id,
      revision: result.revision,
      notification,
    }, result.duplicate ? 200 : 201);
  } catch (error) {
    return json({
      error: 'Falha ao processar o webhook do RD.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export function onRequestGet() {
  return json({
    ok: true,
    integration: 'planet-rd-station',
    method: 'POST',
    destination: 'andre-os',
  });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
