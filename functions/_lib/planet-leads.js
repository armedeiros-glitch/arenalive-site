export const LEADS_STORAGE_KEY = 'planet-hub:planet-expansion-leads:v1';
export const LEAD_STORAGE_PREFIX = 'planet-hub:planet-expansion-lead:v2:';
export const MAX_LEADS = 2000;
export const MAX_LEAD_BODY_BYTES = 128_000;
export const LEAD_SOURCES = new Set(['rd_station', 'reactivated', 'caca_lead', 'manual']);
export const LEAD_STATUSES = new Set(['new', 'claimed', 'contacted', 'qualified', 'discarded']);

export const cleanText = (value, max = 300) => String(value ?? '').trim().slice(0, max);
export const cleanPhone = (value) => cleanText(value, 40).replace(/[^\d+]/g, '');
export const nowIso = () => new Date().toISOString();
export const leadStorageKey = (id) => `${LEAD_STORAGE_PREFIX}${cleanText(id, 120)}`;

const stableIdentityHash = (value) => {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return [first, second]
    .map((part) => (part >>> 0).toString(16).padStart(8, '0'))
    .join('');
};

export const deterministicExternalLeadId = (source, externalId) => {
  const normalizedSource = cleanText(source, 40).toLowerCase();
  const normalizedExternalId = cleanText(externalId, 180).toLowerCase();
  if (!normalizedSource || !normalizedExternalId) return '';
  const sourceToken = normalizedSource.replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'external';
  const directToken = /^[a-z0-9_-]{1,90}$/.test(normalizedExternalId) ? normalizedExternalId : '';
  return `lead-${sourceToken}-${directToken || stableIdentityHash(`${normalizedSource}:${normalizedExternalId}`)}`;
};

export const suggestedWhatsappMessage = (name) => {
  const normalizedName = cleanText(name, 180);
  const firstName = normalizedName && normalizedName !== 'Lead sem nome'
    ? normalizedName.split(/\s+/)[0] || ''
    : '';
  return firstName
    ? `Olá, ${firstName}! Tudo bem?\n\nSou da equipe Planet Chocolate. Recebemos seu interesse em conhecer nossa franquia.`
    : 'Olá! Tudo bem?\n\nSou da equipe Planet Chocolate. Recebemos seu interesse em conhecer nossa franquia.';
};

export const normalizeHistory = (items) => (Array.isArray(items) ? items : [])
  .map((item) => ({
    id: cleanText(item?.id, 120) || `history-${crypto.randomUUID()}`,
    type: cleanText(item?.type, 40) || 'updated',
    title: cleanText(item?.title, 180),
    changes: Array.isArray(item?.changes)
      ? item.changes.map((value) => cleanText(value, 160)).filter(Boolean).slice(0, 20)
      : [],
    createdAt: cleanText(item?.createdAt, 40) || nowIso(),
  }))
  .slice(0, 100);

export const historyEvent = (type, title, changes = [], createdAt = nowIso()) => ({
  id: `history-${crypto.randomUUID()}`,
  type: cleanText(type, 40) || 'updated',
  title: cleanText(title, 180),
  changes: (Array.isArray(changes) ? changes : [])
    .map((item) => cleanText(item?.label || item, 160))
    .filter(Boolean)
    .slice(0, 20),
  createdAt,
});

export const normalizeLead = (item = {}, options = {}) => {
  const createdAt = cleanText(item.createdAt, 40) || nowIso();
  const source = options.sourceOverride || (LEAD_SOURCES.has(item.source) ? item.source : 'manual');
  const status = LEAD_STATUSES.has(item.status) ? item.status : 'new';
  const name = cleanText(item.name, 180) || 'Lead sem nome';
  const phone = cleanPhone(item.phone);
  const suggestedMessage = suggestedWhatsappMessage(name);
  const whatsappMessage = cleanText(item.whatsappMessage, 1200)
    || (options.ensureWhatsapp ? suggestedMessage : '');
  const whatsappUrl = cleanText(item.whatsappUrl, 1400)
    || (options.ensureWhatsapp && phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage || suggestedMessage)}`
      : '');

  return {
    id: cleanText(item.id, 120) || `lead-${crypto.randomUUID()}`,
    tenantId: 'planet',
    source,
    externalId: cleanText(item.externalId, 180),
    status,
    name,
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
    whatsappMessage,
    whatsappUrl,
    viewedAt: cleanText(item.viewedAt, 40),
    lastActionAt: cleanText(item.lastActionAt, 40),
    history: normalizeHistory(item.history),
    createdAt,
    updatedAt: cleanText(item.updatedAt, 40) || createdAt,
  };
};

const readLegacyLeadDocument = async (store, options = {}) => {
  const stored = await store.get(LEADS_STORAGE_KEY, { type: 'json' });
  if (!stored || !Array.isArray(stored.data)) {
    return { revision: null, updatedAt: null, data: [] };
  }
  return {
    revision: stored.revision || null,
    updatedAt: stored.updatedAt || null,
    data: stored.data
      .slice(0, MAX_LEADS)
      .map((item) => normalizeLead(item, options)),
  };
};

const listLeadKeys = async (store) => {
  const keys = [];
  let cursor;
  do {
    const page = await store.list({ prefix: LEAD_STORAGE_PREFIX, cursor, limit: 1000 });
    keys.push(...(page.keys || []).map((item) => item.name).filter(Boolean));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && keys.length < MAX_LEADS);
  return keys.slice(0, MAX_LEADS);
};

const readLeadItems = async (store, keys, options = {}) => {
  const result = [];
  for (let index = 0; index < keys.length; index += 100) {
    const batch = keys.slice(index, index + 100);
    const values = await Promise.all(batch.map((key) => store.get(key, { type: 'json' })));
    values.forEach((item) => {
      if (item?.id) result.push(normalizeLead(item, options));
    });
  }
  return result;
};

const timeValue = (value) => {
  const parsed = Date.parse(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const externalIdentityKey = (lead) => {
  const source = cleanText(lead?.source, 40).toLowerCase();
  const externalId = cleanText(lead?.externalId, 180).toLowerCase();
  return source && externalId ? `${source}:${externalId}` : '';
};

const hasOperatorState = (lead) => (
  lead?.status !== 'new'
  || Boolean(cleanText(lead?.notes, 1600))
  || Boolean(cleanText(lead?.viewedAt, 40))
  || Boolean(cleanText(lead?.lastActionAt, 40))
);

const historyFingerprint = (item) => [
  cleanText(item?.type, 40),
  cleanText(item?.title, 180),
  (Array.isArray(item?.changes) ? item.changes : []).map((value) => cleanText(value, 160)).join('|'),
  cleanText(item?.createdAt, 40),
].join('::');

const mergeExternalIdentityGroup = (group, options = {}) => {
  const ordered = [...group].sort((a, b) => timeValue(b.updatedAt) - timeValue(a.updatedAt));
  const latest = ordered[0];
  const operatorRecord = ordered.find(hasOperatorState) || latest;
  const createdAt = [...ordered]
    .map((item) => cleanText(item.createdAt, 40))
    .filter(Boolean)
    .sort((a, b) => timeValue(a) - timeValue(b))[0] || latest.createdAt;
  const history = [];
  const seenHistory = new Set();
  ordered
    .flatMap((item) => Array.isArray(item.history) ? item.history : [])
    .sort((a, b) => timeValue(b.createdAt) - timeValue(a.createdAt))
    .forEach((item) => {
      const fingerprint = historyFingerprint(item);
      if (seenHistory.has(fingerprint)) return;
      seenHistory.add(fingerprint);
      history.push(item);
    });

  return normalizeLead({
    ...latest,
    id: operatorRecord.id,
    status: operatorRecord.status,
    notes: operatorRecord.notes,
    whatsappMessage: operatorRecord.whatsappMessage || latest.whatsappMessage,
    whatsappUrl: operatorRecord.whatsappUrl || latest.whatsappUrl,
    viewedAt: operatorRecord.viewedAt,
    lastActionAt: operatorRecord.lastActionAt,
    createdAt,
    updatedAt: latest.updatedAt,
    history: history.slice(0, 100),
  }, options);
};

export const collapseExternalLeadDuplicates = (items, options = {}) => {
  const result = [];
  const positions = new Map();
  (Array.isArray(items) ? items : []).forEach((lead) => {
    const key = externalIdentityKey(lead);
    if (!key) {
      result.push(lead);
      return;
    }
    if (!positions.has(key)) {
      positions.set(key, result.length);
      result.push(lead);
      return;
    }
    const position = positions.get(key);
    result[position] = mergeExternalIdentityGroup([result[position], lead], options);
  });
  return result;
};

export const readLeadDocument = async (store, options = {}) => {
  const [legacy, keys] = await Promise.all([
    readLegacyLeadDocument(store, options),
    listLeadKeys(store),
  ]);
  const v2 = await readLeadItems(store, keys, options);
  const merged = new Map();
  [...legacy.data, ...v2].forEach((lead) => {
    const current = merged.get(lead.id);
    if (!current || Date.parse(lead.updatedAt || 0) >= Date.parse(current.updatedAt || 0)) {
      merged.set(lead.id, lead);
    }
  });
  const data = collapseExternalLeadDuplicates([...merged.values()], options)
    .sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0))
    .slice(0, MAX_LEADS);
  return {
    revision: 'per-lead-v2',
    updatedAt: data[0]?.updatedAt || legacy.updatedAt || null,
    data,
  };
};

export const writeLead = async (store, rawLead, options = {}) => {
  const lead = normalizeLead(rawLead, options);
  await store.put(leadStorageKey(lead.id), JSON.stringify(lead));
  return lead;
};

export const writeLeadDocument = async (store, data, options = {}) => {
  const normalized = data.slice(0, MAX_LEADS).map((item) => normalizeLead(item, options));
  for (let index = 0; index < normalized.length; index += 100) {
    await Promise.all(normalized.slice(index, index + 100).map((lead) => writeLead(store, lead)));
  }
  return {
    revision: 'per-lead-v2',
    updatedAt: normalized.reduce((latest, item) => (
      Date.parse(item.updatedAt || 0) > Date.parse(latest || 0) ? item.updatedAt : latest
    ), null),
    data: normalized,
  };
};

export const findDuplicateLead = (items, incoming) => (Array.isArray(items) ? items : []).find((lead) => (
  incoming.externalId
  && lead.externalId === incoming.externalId
  && lead.source === incoming.source
) || (
  incoming.phone
  && lead.phone === incoming.phone
  && lead.status !== 'discarded'
) || (
  incoming.email
  && lead.email === incoming.email
  && lead.status !== 'discarded'
));

export const mergeExternalLeadData = (existing, incoming) => {
  const merged = { ...existing };
  const externalFields = [
    'externalId', 'name', 'phone', 'email', 'city', 'state', 'company',
    'origin', 'conversion', 'assignedTo', 'rdStage',
  ];
  externalFields.forEach((key) => {
    const value = key === 'phone' ? cleanPhone(incoming[key]) : cleanText(incoming[key], 500);
    if (key === 'name' && value === 'Lead sem nome') return;
    if (value) merged[key] = incoming[key];
  });
  return merged;
};

export const relevantLeadChanges = (before, after) => {
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

export const upsertLead = async (store, rawLead, options = {}) => {
  const normalizeOptions = {
    sourceOverride: options.sourceOverride,
    ensureWhatsapp: Boolean(options.ensureWhatsapp),
  };
  const incoming = normalizeLead(rawLead, normalizeOptions);
  if (!incoming.phone && !incoming.email) {
    const error = new Error(options.missingContactMessage || 'O lead precisa ter telefone ou e-mail.');
    error.status = 400;
    throw error;
  }

  const current = await readLeadDocument(store);
  const duplicate = findDuplicateLead(current.data, incoming);
  const timestamp = nowIso();

  if (duplicate) {
    const merged = options.mergeExternalOnly
      ? mergeExternalLeadData(duplicate, incoming)
      : { ...duplicate, ...incoming };
    const lead = normalizeLead({
      ...merged,
      id: duplicate.id,
      source: options.preserveIdentityOnDuplicate ? duplicate.source : merged.source,
      externalId: options.preserveIdentityOnDuplicate ? duplicate.externalId : merged.externalId,
      origin: options.preserveIdentityOnDuplicate ? duplicate.origin : merged.origin,
      conversion: options.preserveIdentityOnDuplicate ? duplicate.conversion : merged.conversion,
      status: options.preserveStatus ? duplicate.status : merged.status,
      notes: options.preserveNotes ? duplicate.notes : merged.notes,
      whatsappMessage: options.preserveWhatsapp ? duplicate.whatsappMessage : merged.whatsappMessage,
      whatsappUrl: options.preserveWhatsapp ? duplicate.whatsappUrl : merged.whatsappUrl,
      viewedAt: options.preserveViewedAt ? duplicate.viewedAt : merged.viewedAt,
      lastActionAt: options.preserveLastActionAt ? duplicate.lastActionAt : merged.lastActionAt,
      createdAt: duplicate.createdAt,
      history: duplicate.history,
      updatedAt: timestamp,
    }, normalizeOptions);

    const changes = relevantLeadChanges(duplicate, lead);
    if (options.historyOnDuplicate && changes.length) {
      lead.history = [
        historyEvent(
          options.historyOnDuplicate.type || 'updated',
          options.historyOnDuplicate.title || 'Lead atualizado',
          changes,
          timestamp,
        ),
        ...lead.history,
      ].slice(0, 100);
    }
    if (Array.isArray(options.appendHistory) && options.appendHistory.length) {
      lead.history = [...options.appendHistory, ...lead.history].slice(0, 100);
    }

    await writeLead(store, lead);
    return { lead, duplicate: true, changes, revision: lead.updatedAt, document: { revision: lead.updatedAt, data: [lead] } };
  }

  const createdAt = cleanText(options.createdAt, 40) || timestamp;
  const stableId = options.stableExternalIdentity
    ? deterministicExternalLeadId(incoming.source, incoming.externalId)
    : '';
  const lead = normalizeLead({
    ...incoming,
    id: stableId || `lead-${crypto.randomUUID()}`,
    createdAt,
    updatedAt: timestamp,
    history: Array.isArray(options.initialHistory) && options.initialHistory.length
      ? options.initialHistory
      : [historyEvent('created', options.createdTitle || 'Lead cadastrado manualmente', [], createdAt)],
  }, normalizeOptions);
  await writeLead(store, lead);
  return { lead, duplicate: false, changes: [], revision: lead.updatedAt, document: { revision: lead.updatedAt, data: [lead] } };
};

export const updateLeadById = async (store, id, changes = {}) => {
  const leadId = cleanText(id, 120);
  if (!leadId) {
    const error = new Error('Informe o lead.');
    error.status = 400;
    throw error;
  }
  const current = await readLeadDocument(store);
  const existing = current.data.find((lead) => lead.id === leadId);
  if (!existing) {
    const error = new Error('Lead não encontrado.');
    error.status = 404;
    throw error;
  }

  const next = { ...existing };
  const changedLabels = [];
  if (Object.prototype.hasOwnProperty.call(changes, 'status')) {
    if (!LEAD_STATUSES.has(changes.status)) {
      const error = new Error('Status de lead inválido.');
      error.status = 400;
      throw error;
    }
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
  if (Object.prototype.hasOwnProperty.call(changes, 'viewedAt')) {
    next.viewedAt = cleanText(changes.viewedAt, 40) || nowIso();
  }
  if (Object.prototype.hasOwnProperty.call(changes, 'lastActionAt')) {
    next.lastActionAt = cleanText(changes.lastActionAt, 40) || nowIso();
  }

  const timestamp = nowIso();
  next.updatedAt = timestamp;
  if (changedLabels.length) {
    next.history = [
      historyEvent('updated', 'Lead atualizado no André OS', changedLabels, timestamp),
      ...existing.history,
    ].slice(0, 100);
  }
  const lead = normalizeLead(next);
  await writeLead(store, lead);
  return { lead, revision: lead.updatedAt, changedLabels };
};
