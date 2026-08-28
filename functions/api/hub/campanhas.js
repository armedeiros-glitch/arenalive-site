import { CAMPAIGN_CATALOG_2026, campaignById } from '../../_lib/planet-campaign-catalog.js';

const STORAGE_KEY = 'planet-hub:campanhas:v1';
const MAX_ITEMS = 120;
const MAX_BODY_BYTES = 180_000;

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const cleanText = (value, max = 500) => String(value ?? '').trim().slice(0, max);
const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';
const validStatus = (value) => ['planejamento', 'producao', 'aprovacao', 'ativa', 'concluida'].includes(value)
  ? value
  : 'planejamento';

const normalizeItem = (item = {}) => ({
  id: cleanText(item.id, 160),
  status: validStatus(item.status),
  responsible: cleanText(item.responsible, 160),
  nextMilestone: cleanText(item.nextMilestone, 280),
  milestoneDate: validDate(item.milestoneDate),
  materials: cleanText(item.materials, 900),
  notes: cleanText(item.notes, 1200),
  updatedAt: cleanText(item.updatedAt, 40) || new Date().toISOString(),
});

const todayIso = (reference = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(reference);

export const defaultCampaignStatus = (campaign, reference = new Date()) => {
  if (!campaign?.start) return 'planejamento';
  const today = todayIso(reference);
  const end = campaign.end || campaign.start;
  if (end < today) return 'concluida';
  if (campaign.start <= today && end >= today) return 'ativa';
  return 'planejamento';
};

const meaningfulFields = (item) => Boolean(
  item.responsible || item.nextMilestone || item.milestoneDate || item.materials || item.notes,
);

export const isOperationalOverride = (item = {}, reference = new Date()) => {
  const campaign = campaignById(item.id);
  if (!campaign) return meaningfulFields(item) || validStatus(item.status) !== 'planejamento';
  return meaningfulFields(item) || validStatus(item.status) !== defaultCampaignStatus(campaign, reference);
};

export const mergeCampaignCatalog = (overrides = [], reference = new Date()) => {
  const byId = new Map((Array.isArray(overrides) ? overrides : [])
    .filter((item) => item?.id)
    .map((item) => [String(item.id), normalizeItem(item)]));

  return CAMPAIGN_CATALOG_2026.map((campaign) => {
    const override = byId.get(campaign.id) || null;
    return {
      ...campaign,
      status: override?.status || defaultCampaignStatus(campaign, reference),
      responsible: override?.responsible || '',
      nextMilestone: override?.nextMilestone || '',
      milestoneDate: override?.milestoneDate || '',
      materials: override?.materials || '',
      notes: override?.notes || '',
      updatedAt: override?.updatedAt || '',
      hasOperationalOverride: Boolean(override),
    };
  });
};

const readDocument = async (store) => {
  const stored = await store.get(STORAGE_KEY, { type: 'json' });
  return {
    revision: stored?.revision || null,
    updatedAt: stored?.updatedAt || null,
    data: Array.isArray(stored?.data)
      ? stored.data.slice(0, MAX_ITEMS).map(normalizeItem).filter((item) => item.id)
      : [],
  };
};

const responseDocument = (document, reference = new Date()) => ({
  revision: document.revision || null,
  updatedAt: document.updatedAt || null,
  catalogVersion: '2026-v1',
  catalog: CAMPAIGN_CATALOG_2026,
  overrides: document.data,
  data: mergeCampaignCatalog(document.data, reference),
  storage: 'shared',
});

export async function onRequestGet({ env }) {
  if (!env.PLANET_HUB_DATA) {
    return json({ error: 'PLANET_HUB_DATA não configurado.', data: [], catalog: CAMPAIGN_CATALOG_2026, storage: 'local' }, 503);
  }

  try {
    return json(responseDocument(await readDocument(env.PLANET_HUB_DATA)));
  } catch (error) {
    return json({
      error: 'Falha ao carregar os dados operacionais das campanhas.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export async function onRequestPut({ env, request }) {
  if (!env.PLANET_HUB_DATA) {
    return json({ error: 'PLANET_HUB_DATA não configurado.', storage: 'local' }, 503);
  }

  const contentLength = Number.parseInt(request.headers.get('content-length') || '0', 10);
  if (contentLength > MAX_BODY_BYTES) return json({ error: 'Payload acima do limite permitido.' }, 413);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }

  if (!Array.isArray(payload?.data)) return json({ error: 'O campo data precisa ser uma lista.' }, 400);
  if (payload.data.length > MAX_ITEMS) return json({ error: `Limite de ${MAX_ITEMS} campanhas excedido.` }, 400);

  try {
    const current = await readDocument(env.PLANET_HUB_DATA);
    const baseRevision = payload.baseRevision || null;
    if (baseRevision && current.revision && baseRevision !== current.revision) {
      return json({ error: 'As campanhas foram alteradas em outro navegador.', conflict: true, ...responseDocument(current) }, 409);
    }

    const updatedAt = new Date().toISOString();
    const normalized = payload.data
      .map((item) => normalizeItem({ ...item, updatedAt: item.updatedAt || updatedAt }))
      .filter((item) => item.id);
    const overrides = normalized.filter((item) => isOperationalOverride(item));
    const document = {
      revision: crypto.randomUUID(),
      updatedAt,
      data: overrides,
    };

    const serialized = JSON.stringify(document);
    if (new TextEncoder().encode(serialized).byteLength > MAX_BODY_BYTES) {
      return json({ error: 'Os dados ultrapassam o limite permitido.' }, 413);
    }

    await env.PLANET_HUB_DATA.put(STORAGE_KEY, serialized);
    return json(responseDocument(document));
  } catch (error) {
    return json({
      error: 'Falha ao salvar os dados operacionais das campanhas.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
