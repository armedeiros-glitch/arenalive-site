export const PLANET_LEADS_KEY = 'planet-hub:planet-expansion-leads:v1';
export const PLANET_LEADS_MAX_ITEMS = 2000;

export const PLANET_LEAD_SOURCES = new Set(['rd_station', 'reactivated', 'caca_lead', 'manual']);
export const PLANET_LEAD_STATUSES = new Set(['new', 'claimed', 'contacted', 'qualified', 'discarded']);

export const cleanLeadText = (value, max = 300) => String(value ?? '').trim().slice(0, max);
export const cleanLeadPhone = (value) => cleanLeadText(value, 40).replace(/[^\d+]/g, '');
export const planetLeadNowIso = () => new Date().toISOString();

export const normalizePlanetLeadHistory = (items) => (Array.isArray(items) ? items : [])
  .map((item) => ({
    id: cleanLeadText(item?.id, 120) || `history-${crypto.randomUUID()}`,
    type: cleanLeadText(item?.type, 40) || 'updated',
    title: cleanLeadText(item?.title, 180),
    changes: Array.isArray(item?.changes)
      ? item.changes.map((value) => cleanLeadText(value, 80)).filter(Boolean).slice(0, 20)
      : [],
    createdAt: cleanLeadText(item?.createdAt, 40) || planetLeadNowIso(),
  }))
  .slice(0, 100);

export const createPlanetLeadHistoryEvent = (type, title, changes = []) => ({
  id: `history-${crypto.randomUUID()}`,
  type: cleanLeadText(type, 40) || 'updated',
  title: cleanLeadText(title, 180),
  changes: changes
    .map((item) => cleanLeadText(item?.label || item, 80))
    .filter(Boolean)
    .slice(0, 20),
  createdAt: planetLeadNowIso(),
});

export const suggestedPlanetWhatsappMessage = (name) => {
  const normalizedName = cleanLeadText(name, 180);
  const firstName = normalizedName && normalizedName !== 'Lead sem nome'
    ? normalizedName.split(/\s+/)[0] || ''
    : '';
  return firstName
    ? `Olá, ${firstName}! Tudo bem?\n\nSou da equipe Planet Chocolate. Recebemos seu interesse em conhecer nossa franquia.`
    : 'Olá! Tudo bem?\n\nSou da equipe Planet Chocolate. Recebemos seu interesse em conhecer nossa franquia.';
};

export const normalizePlanetLead = (item = {}, options = {}) => {
  const createdAt = cleanLeadText(item.createdAt, 40) || planetLeadNowIso();
  const sourceCandidate = options.forceSource || item.source;
  const source = PLANET_LEAD_SOURCES.has(sourceCandidate) ? sourceCandidate : 'manual';
  const status = PLANET_LEAD_STATUSES.has(item.status) ? item.status : 'new';
  const name = cleanLeadText(item.name, 180) || 'Lead sem nome';
  const phone = cleanLeadPhone(item.phone);
  const whatsappMessage = cleanLeadText(item.whatsappMessage, 1200)
    || (options.suggestWhatsappMessage ? suggestedPlanetWhatsappMessage(name) : '');

  return {
    id: cleanLeadText(item.id, 120) || `lead-${crypto.randomUUID()}`,
    tenantId: 'planet',
    source,
    externalId: cleanLeadText(item.externalId, 180),
    status,
    name,
    phone,
    email: cleanLeadText(item.email, 220).toLowerCase(),
    city: cleanLeadText(item.city, 140),
    state: cleanLeadText(item.state, 80),
    company: cleanLeadText(item.company, 180),
    origin: cleanLeadText(item.origin, 180),
    conversion: cleanLeadText(item.conversion, 220),
    assignedTo: cleanLeadText(item.assignedTo, 160),
    rdStage: cleanLeadText(item.rdStage, 160),
    notes: cleanLeadText(item.notes, 1600),
    whatsappMessage,
    whatsappUrl: cleanLeadText(item.whatsappUrl, 1400)
      || (phone && whatsappMessage ? `https://wa.me/${phone}?text=${encodeURIComponent(whatsappMessage)}` : ''),
    viewedAt: cleanLeadText(item.viewedAt, 40),
    lastActionAt: cleanLeadText(item.lastActionAt, 40),
    history: normalizePlanetLeadHistory(item.history),
    createdAt,
    updatedAt: cleanLeadText(item.updatedAt, 40) || createdAt,
  };
};

export const readPlanetLeadsDocument = async (store, options = {}) => {
  const normalizerOptions = options.normalizerOptions || {};
  const stored = await store.get(PLANET_LEADS_KEY, { type: 'json' });
  if (!stored || !Array.isArray(stored.data)) {
    return { revision: null, updatedAt: null, data: [] };
  }
  return {
    revision: stored.revision || null,
    updatedAt: stored.updatedAt || null,
    data: stored.data
      .slice(0, PLANET_LEADS_MAX_ITEMS)
      .map((item) => normalizePlanetLead(item, normalizerOptions)),
  };
};

export const writePlanetLeadsDocument = async (store, data, options = {}) => {
  const normalizerOptions = options.normalizerOptions || {};
  const document = {
    revision: crypto.randomUUID(),
    updatedAt: planetLeadNowIso(),
    data: data
      .slice(0, PLANET_LEADS_MAX_ITEMS)
      .map((item) => normalizePlanetLead(item, normalizerOptions)),
  };
  await store.put(PLANET_LEADS_KEY, JSON.stringify(document));
  return document;
};

export const findPlanetLeadDuplicate = (leads, incoming, options = {}) => {
  const source = options.source || incoming.source;
  return leads.find((lead) => (
    incoming.externalId
    && lead.externalId === incoming.externalId
    && (!source || lead.source === source)
  ) || (
    incoming.phone
    && lead.phone === incoming.phone
    && lead.status !== 'discarded'
  ) || (
    incoming.email
    && lead.email === incoming.email
    && lead.status !== 'discarded'
  )) || null;
};

export const mergePlanetLeadExternalData = (existing, incoming) => {
  const merged = { ...existing };
  const fields = [
    'externalId', 'name', 'phone', 'email', 'city', 'state', 'company',
    'origin', 'conversion', 'assignedTo', 'rdStage',
  ];
  fields.forEach((key) => {
    const value = key === 'phone'
      ? cleanLeadPhone(incoming[key])
      : cleanLeadText(incoming[key], 500);
    if (value) merged[key] = incoming[key];
  });
  return merged;
};

export const planetLeadRelevantChanges = (before, after) => {
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
    .filter(([key]) => cleanLeadText(before?.[key], 300) !== cleanLeadText(after?.[key], 300))
    .map(([key, label]) => ({
      key,
      label,
      before: cleanLeadText(before?.[key], 300),
      after: cleanLeadText(after?.[key], 300),
    }));
};
