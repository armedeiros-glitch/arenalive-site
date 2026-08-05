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
const escapeHtml = (value) => cleanText(value, 1600).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[char]));

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
  const funnel = lead.funnel || {};

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
    createdAt: cleanText(root.event_timestamp || root.created_at || lead.created_at, 40) || nowIso(),
  };
};

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
    notes: cleanText(item.notes, 1600),
    whatsappMessage,
    whatsappUrl: phone ? `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage)}` : '',
    viewedAt: cleanText(item.viewedAt, 40),
    lastActionAt: cleanText(item.lastActionAt, 40),
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
  const document = { revision: crypto.randomUUID(), updatedAt: nowIso(), data: data.slice(0, MAX_ITEMS) };
  await store.put(STORAGE_KEY, JSON.stringify(document));
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
    name: 'nome', phone: 'telefone', email: 'e-mail', city: 'cidade', state: 'estado',
    origin: 'origem', conversion: 'movimentação', assignedTo: 'responsável', status: 'status',
  };
  return Object.entries(labels)
    .filter(([key]) => cleanText(before?.[key], 300) !== cleanText(after?.[key], 300))
    .map(([, label]) => label);
};

const sendTelegram = async (env, lead, { duplicate, changes }) => {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return { sent: false, reason: 'not_configured' };

  const location = [lead.city, lead.state].filter(Boolean).join(' / ') || 'Não informado';
  const isMovement = duplicate && changes.length;
  const lines = isMovement
    ? [
        '<b>🔄 Movimentação no RD</b>', '',
        `👤 <b>Nome:</b> ${escapeHtml(lead.name)}`,
        `🎯 <b>Movimentação:</b> ${escapeHtml(lead.conversion || changes.join(', '))}`,
        `🧩 <b>Campos alterados:</b> ${escapeHtml(changes.join(', '))}`,
      ]
    : [
        '<b>🔔 Novo lead Planet Chocolate</b>', '',
        `👤 <b>Nome:</b> ${escapeHtml(lead.name)}`,
        `📱 <b>Telefone:</b> ${escapeHtml(lead.phone || 'Não informado')}`,
        `📧 <b>E-mail:</b> ${escapeHtml(lead.email || 'Não informado')}`,
        `📍 <b>Localização:</b> ${escapeHtml(location)}`,
        `🎯 <b>Conversão:</b> ${escapeHtml(lead.conversion || 'Não informada')}`,
        `🌐 <b>Origem:</b> ${escapeHtml(lead.origin || 'Não informada')}`,
      ];

  const telegramPayload = {
    chat_id: env.TELEGRAM_CHAT_ID,
    text: lines.join('\n'),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  if (lead.whatsappUrl) {
    telegramPayload.reply_markup = { inline_keyboard: [[{ text: '💬 Chamar no WhatsApp', url: lead.whatsappUrl }]] };
  }

  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(telegramPayload),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.ok) throw new Error(result.description || 'Telegram recusou a notificação.');
  return { sent: true, messageId: result.result?.message_id || null };
};

export async function onRequestPost({ env, request }) {
  if (!env.RD_WEBHOOK_SECRET) return json({ error: 'RD_WEBHOOK_SECRET não configurado.' }, 503);
  if (!authorized(request, env)) return json({ error: 'Não autorizado.' }, 401);
  if (!env.PLANET_HUB_DATA) return json({ error: 'PLANET_HUB_DATA não configurado.' }, 503);

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) return json({ error: 'Payload acima do limite permitido.' }, 413);

  let payload;
  try { payload = await request.json(); } catch { return json({ error: 'JSON inválido.' }, 400); }

  const incoming = normalizeLead(extractPayload(payload));
  if (!incoming.phone && !incoming.email) return json({ error: 'Lead sem telefone e e-mail.' }, 400);

  try {
    const current = await readDocument(env.PLANET_HUB_DATA);
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
      lead = normalizeLead({ ...duplicate, ...incoming, id: duplicate.id, createdAt: duplicate.createdAt, viewedAt: duplicate.viewedAt });
      changes = relevantChanges(duplicate, lead);
      data = current.data.map((item) => item.id === duplicate.id ? lead : item);
    } else {
      lead = normalizeLead({ ...incoming, id: `lead-${crypto.randomUUID()}`, createdAt: nowIso() });
      data = [lead, ...current.data];
    }

    const document = await writeDocument(env.PLANET_HUB_DATA, data);
    let telegram = { sent: false, reason: duplicate && !changes.length ? 'no_relevant_changes' : 'not_configured' };
    if (!duplicate || changes.length) {
      try { telegram = await sendTelegram(env, lead, { duplicate: Boolean(duplicate), changes }); }
      catch (error) { telegram = { sent: false, reason: error instanceof Error ? error.message : String(error) }; }
    }

    return json({
      ok: true,
      duplicate: Boolean(duplicate),
      changes,
      leadId: lead.id,
      revision: document.revision,
      telegram,
    }, duplicate ? 200 : 201);
  } catch (error) {
    return json({ error: 'Falha ao processar o webhook do RD.', details: error instanceof Error ? error.message : String(error) }, 500);
  }
}

export function onRequestGet() {
  return json({ ok: true, integration: 'planet-rd-station', method: 'POST', telegram: 'optional' });
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
