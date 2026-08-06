import {
  PLANET_LEAD_STATUSES,
  cleanLeadText,
  createPlanetLeadHistoryEvent,
  findPlanetLeadDuplicate,
  normalizePlanetLead,
  planetLeadNowIso,
  readPlanetLeadsDocument,
  writePlanetLeadsDocument,
} from '../../../_lib/planet-leads.js';

const MAX_BODY_BYTES = 128_000;

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

const readPayload = async (request) => {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return { error: json({ error: 'Payload acima do limite permitido.' }, 413) };
  }
  try {
    return { payload: await request.json() };
  } catch {
    return { error: json({ error: 'JSON inválido.' }, 400) };
  }
};

export async function onRequestGet({ env }) {
  const store = env.PLANET_HUB_DATA;
  if (!store) {
    return json({ error: 'PLANET_HUB_DATA não configurado.', data: [], storage: 'local' }, 503);
  }
  try {
    return json({ ...(await readPlanetLeadsDocument(store)), storage: 'shared' });
  } catch (error) {
    return json({
      error: 'Falha ao carregar os leads da Planet.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export async function onRequestPost({ env, request }) {
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ error: 'PLANET_HUB_DATA não configurado.' }, 503);

  const parsed = await readPayload(request);
  if (parsed.error) return parsed.error;

  const incoming = normalizePlanetLead(parsed.payload?.lead || parsed.payload);
  if (!incoming.phone && !incoming.email) {
    return json({ error: 'O lead precisa ter telefone ou e-mail.' }, 400);
  }

  try {
    const current = await readPlanetLeadsDocument(store);
    const duplicate = findPlanetLeadDuplicate(current.data, incoming, { source: incoming.source });

    if (duplicate) {
      const updated = normalizePlanetLead({
        ...duplicate,
        ...incoming,
        id: duplicate.id,
        createdAt: duplicate.createdAt,
        history: duplicate.history,
        updatedAt: planetLeadNowIso(),
      });
      const data = current.data.map((lead) => lead.id === duplicate.id ? updated : lead);
      const document = await writePlanetLeadsDocument(store, data);
      return json({ lead: updated, duplicate: true, revision: document.revision }, 200);
    }

    const timestamp = planetLeadNowIso();
    const lead = normalizePlanetLead({
      ...incoming,
      id: `lead-${crypto.randomUUID()}`,
      createdAt: timestamp,
      updatedAt: timestamp,
      history: [createPlanetLeadHistoryEvent('created', 'Lead cadastrado manualmente')],
    });
    const document = await writePlanetLeadsDocument(store, [lead, ...current.data]);
    return json({ lead, duplicate: false, revision: document.revision }, 201);
  } catch (error) {
    return json({
      error: 'Falha ao salvar o lead da Planet.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export async function onRequestPut({ env, request }) {
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ error: 'PLANET_HUB_DATA não configurado.' }, 503);

  const parsed = await readPayload(request);
  if (parsed.error) return parsed.error;

  const id = cleanLeadText(parsed.payload?.id, 120);
  const changes = parsed.payload?.changes && typeof parsed.payload.changes === 'object'
    ? parsed.payload.changes
    : {};
  if (!id) return json({ error: 'Informe o lead.' }, 400);

  try {
    const current = await readPlanetLeadsDocument(store);
    const existing = current.data.find((lead) => lead.id === id);
    if (!existing) return json({ error: 'Lead não encontrado.' }, 404);

    const next = { ...existing };
    const changedLabels = [];

    if (Object.prototype.hasOwnProperty.call(changes, 'status')) {
      if (!PLANET_LEAD_STATUSES.has(changes.status)) {
        return json({ error: 'Status de lead inválido.' }, 400);
      }
      if (changes.status !== existing.status) changedLabels.push('status');
      next.status = changes.status;
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'assignedTo')) {
      const value = cleanLeadText(changes.assignedTo, 160);
      if (value !== existing.assignedTo) changedLabels.push('responsável');
      next.assignedTo = value;
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'notes')) {
      const value = cleanLeadText(changes.notes, 1600);
      if (value !== existing.notes) changedLabels.push('observações');
      next.notes = value;
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'viewedAt')) {
      next.viewedAt = cleanLeadText(changes.viewedAt, 40) || planetLeadNowIso();
    }
    if (Object.prototype.hasOwnProperty.call(changes, 'lastActionAt')) {
      next.lastActionAt = cleanLeadText(changes.lastActionAt, 40) || planetLeadNowIso();
    }

    const timestamp = planetLeadNowIso();
    next.updatedAt = timestamp;
    if (changedLabels.length) {
      next.history = [
        createPlanetLeadHistoryEvent('updated', 'Lead atualizado no André OS', changedLabels),
        ...existing.history,
      ].slice(0, 100);
    }

    const lead = normalizePlanetLead(next);
    const data = current.data.map((item) => item.id === id ? lead : item);
    const document = await writePlanetLeadsDocument(store, data);
    return json({ lead, revision: document.revision });
  } catch (error) {
    return json({
      error: 'Falha ao atualizar o lead da Planet.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
