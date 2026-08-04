const SULTS_ENDPOINT = 'https://api.sults.com.br/api/v1/chamado/ticket';
const PAGE_LIMIT = 100;
const MAX_PAGES = 20;
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 180;
const CACHE_REFRESH_MS = 15 * 60 * 1000;
const ACTIVE_SITUATIONS = [1, 4, 5, 6];
const MARKETING_DEPARTMENT_ID = 10;
const DEFAULT_PERSON_NAME = 'André Roberto Medeiros';
const DEFAULT_BRAND_TERM = 'Planet Chocolate';
const IGNORED_STORAGE_KEY = 'planet-hub:chamados-ignorados:v1';
const SNAPSHOT_STORAGE_PREFIX = 'planet-hub:sults-chamados-completos:v2';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': 'no-store',
    },
  });

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const parsePayload = async (response) => {
  const raw = await response.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return { raw };
  }
};

const fetchTickets = async (token, params = {}) => {
  const url = new URL(SULTS_ENDPOINT);
  url.searchParams.set('start', String(params.start ?? 0));
  url.searchParams.set('limit', String(params.limit ?? PAGE_LIMIT));

  if (params.situation != null) url.searchParams.set('situacao', String(params.situation));
  if (params.responsible != null) url.searchParams.set('responsavel', String(params.responsible));
  if (params.requester != null) url.searchParams.set('solicitante', String(params.requester));

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: token,
      'Content-Type': 'application/json;charset=UTF-8',
      Accept: 'application/json',
    },
  });

  const payload = await parsePayload(response);
  return {
    response,
    payload,
    situation: params.situation ?? null,
    start: params.start ?? 0,
    limit: params.limit ?? PAGE_LIMIT,
  };
};

const fetchPageWithRetry = async (token, params) => {
  let lastResult = null;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await fetchTickets(token, params);
      lastResult = result;
      if (result.response.ok) return { ...result, attempts: attempt };
      lastError = new Error(`SULTS respondeu HTTP ${result.response.status}.`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
  }

  const failure = new Error(lastError instanceof Error ? lastError.message : 'Falha ao consultar o SULTS.');
  failure.status = lastResult?.response?.status || 502;
  failure.details = lastResult?.payload || {};
  failure.situation = params.situation ?? null;
  failure.start = params.start ?? 0;
  throw failure;
};

const fetchAllPages = async (token, params = {}) => {
  const items = [];
  const seenIds = new Set();
  const pages = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    const start = page * PAGE_LIMIT;
    const result = await fetchPageWithRetry(token, {
      ...params,
      start,
      limit: PAGE_LIMIT,
    });
    const data = Array.isArray(result.payload?.data) ? result.payload.data : [];
    let newItems = 0;

    data.forEach((item) => {
      const id = item?.id == null ? '' : String(item.id);
      if (!id || seenIds.has(id)) return;
      seenIds.add(id);
      items.push(item);
      newItems += 1;
    });

    pages.push({
      page: page + 1,
      start,
      received: data.length,
      accepted: newItems,
      attempts: result.attempts,
    });

    if (data.length < PAGE_LIMIT || newItems === 0) {
      return {
        data: items,
        situation: params.situation ?? null,
        pages,
        complete: true,
      };
    }
  }

  const error = new Error('A paginação do SULTS excedeu o limite de segurança.');
  error.status = 502;
  error.situation = params.situation ?? null;
  throw error;
};

const readIgnoredIds = async (env) => {
  if (!env.PLANET_HUB_DATA) return new Set();
  try {
    const stored = await env.PLANET_HUB_DATA.get(IGNORED_STORAGE_KEY, { type: 'json' });
    const data = Array.isArray(stored?.data) ? stored.data : [];
    return new Set(data.map((item) => String(item?.id || '')).filter(Boolean));
  } catch {
    return new Set();
  }
};

const snapshotKey = (includeClosed) => `${SNAPSHOT_STORAGE_PREFIX}:${includeClosed ? 'todos' : 'ativos'}`;

const readSnapshot = async (env, includeClosed) => {
  if (!env.PLANET_HUB_DATA) return null;
  try {
    const stored = await env.PLANET_HUB_DATA.get(snapshotKey(includeClosed), { type: 'json' });
    return Array.isArray(stored?.tickets) ? stored : null;
  } catch {
    return null;
  }
};

const hashText = (value) => {
  let hash = 2166136261;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

const datasetSignature = (tickets) => hashText(
  tickets
    .map((ticket) => `${ticket.id}:${ticket.lastUpdatedAt || ticket.openedAt || ''}`)
    .sort()
    .join('|'),
);

const saveSnapshot = async (env, includeClosed, tickets, queryStats, previousSnapshot) => {
  if (!env.PLANET_HUB_DATA) return { stored: false, reason: 'binding-unavailable' };

  const now = new Date().toISOString();
  const signature = datasetSignature(tickets);
  const previousTime = Date.parse(previousSnapshot?.fetchedAt || 0);
  const sameDataset = previousSnapshot?.signature === signature;
  const recentlyStored = Number.isFinite(previousTime) && Date.now() - previousTime < CACHE_REFRESH_MS;

  if (sameDataset && recentlyStored) return { stored: false, reason: 'unchanged' };

  try {
    await env.PLANET_HUB_DATA.put(snapshotKey(includeClosed), JSON.stringify({
      version: 2,
      complete: true,
      fetchedAt: now,
      signature,
      tickets,
      queryStats,
    }));
    return { stored: true, reason: sameDataset ? 'refreshed' : 'changed', fetchedAt: now };
  } catch {
    return { stored: false, reason: 'write-failed' };
  }
};

const mapTicket = (ticket) => ({
  source: 'sults',
  id: ticket.id,
  sultsTicketId: ticket.id,
  title: ticket.titulo ?? 'Chamado sem título',
  requester: ticket.solicitante?.nome ?? null,
  requesterId: ticket.solicitante?.id ?? null,
  responsible: ticket.responsavel?.nome ?? null,
  responsibleId: ticket.responsavel?.id ?? null,
  unit: ticket.unidade?.nome ?? null,
  unitId: ticket.unidade?.id ?? null,
  department: ticket.departamento?.nome ?? null,
  departmentId: ticket.departamento?.id ?? null,
  sendingDepartment: ticket.departamentoEnvio?.nome ?? null,
  sendingDepartmentId: ticket.departamentoEnvio?.id ?? null,
  subject: ticket.assunto?.nome ?? null,
  subjectId: ticket.assunto?.id ?? null,
  labels: Array.isArray(ticket.etiqueta) ? ticket.etiqueta : [],
  support: Array.isArray(ticket.apoio) ? ticket.apoio : [],
  type: ticket.tipo ?? null,
  situation: ticket.situacao ?? null,
  openedAt: ticket.aberto ?? null,
  resolvedAt: ticket.resolvido ?? null,
  completedAt: ticket.concluido ?? null,
  concludedAt: ticket.concluido ?? null,
  plannedResolutionAt: ticket.resolverPlanejado ?? null,
  stipulatedResolutionAt: ticket.resolverEstipulado ?? null,
  firstInteractionAt: ticket.primeiraInteracao ?? null,
  lastUpdatedAt: ticket.ultimaAlteracao ?? null,
  lastChangeAt: ticket.ultimaAlteracao ?? null,
  publicInteractionCount: ticket.countInteracaoPublico ?? 0,
  internalInteractionCount: ticket.countInteracaoInterno ?? 0,
  rating: ticket.avaliacaoNota ?? null,
  ratingNote: ticket.avaliacaoObservacao ?? null,
});

const uniqueById = (tickets) =>
  tickets.filter((ticket, index, array) =>
    array.findIndex((candidate) => String(candidate.id) === String(ticket.id)) === index,
  );

const normalizeText = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

const personIsIncluded = (ticket, personId, personName) => {
  const normalizedName = normalizeText(personName);
  const responsibleMatches =
    (personId && ticket.responsibleId === personId) ||
    (normalizedName && normalizeText(ticket.responsible) === normalizedName);

  if (responsibleMatches) return true;

  return ticket.support.some((item) => {
    const supportPerson = item?.pessoa;
    if (!supportPerson) return false;
    return (
      (personId && supportPerson.id === personId) ||
      (normalizedName && normalizeText(supportPerson.nome) === normalizedName)
    );
  });
};

const departmentIsIncluded = (ticket, departmentId) => {
  if (!departmentId) return true;
  if (ticket.departmentId === departmentId) return true;
  return ticket.support.some((item) => item?.departamento?.id === departmentId);
};

const brandIsIncluded = (ticket, brandTerm) => {
  const normalizedBrand = normalizeText(brandTerm);
  if (!normalizedBrand) return true;
  return normalizeText(ticket.unit).includes(normalizedBrand);
};

const filterTickets = ({
  tickets,
  ignoredIds,
  scope,
  personId,
  personName,
  brandTerm,
  departmentId,
}) => uniqueById(tickets)
  .filter((ticket) => {
    if (ignoredIds.has(String(ticket.id))) return false;
    if (scope === 'all') return true;
    if (scope === 'marketing') return departmentIsIncluded(ticket, departmentId);
    if (scope === 'mine') return personIsIncluded(ticket, personId, personName);
    return brandIsIncluded(ticket, brandTerm);
  })
  .sort((a, b) =>
    new Date(b.lastUpdatedAt || b.openedAt || 0).getTime() -
    new Date(a.lastUpdatedAt || a.openedAt || 0).getTime(),
  );

const filtersPayload = ({
  scope,
  includeIgnored,
  brandTerm,
  departmentId,
  personId,
  personName,
}) => ({
  scope,
  includeIgnored,
  brandTerm: scope === 'planet' ? brandTerm : null,
  departmentId: scope === 'marketing' ? departmentId : null,
  personId: scope === 'mine' ? personId : null,
  personName: scope === 'mine' ? personName : null,
  membership: scope === 'mine' ? ['responsible', 'support'] : null,
});

const safeFailure = (error) => ({
  message: error instanceof Error ? error.message : String(error),
  status: Number(error?.status || 502),
  situation: error?.situation ?? null,
  start: error?.start ?? null,
});

export async function onRequestGet({ env, request }) {
  if (!env.SULTS_API_TOKEN) {
    return json({ error: 'SULTS_API_TOKEN não configurado.' }, 500);
  }

  const incomingUrl = new URL(request.url);
  const includeClosed = incomingUrl.searchParams.get('includeClosed') === '1';
  const includeIgnored = incomingUrl.searchParams.get('includeIgnored') === '1';
  const scope = incomingUrl.searchParams.get('scope') || 'planet';
  const personId = Number.parseInt(incomingUrl.searchParams.get('personId') || '', 10) || null;
  const personName = incomingUrl.searchParams.get('personName') || DEFAULT_PERSON_NAME;
  const brandTerm = incomingUrl.searchParams.get('brand') || DEFAULT_BRAND_TERM;
  const departmentId = Number.parseInt(
    incomingUrl.searchParams.get('departmentId') || String(MARKETING_DEPARTMENT_ID),
    10,
  );

  const ignoredPromise = includeIgnored ? Promise.resolve(new Set()) : readIgnoredIds(env);
  const cachedPromise = readSnapshot(env, includeClosed);
  const servedAt = new Date().toISOString();

  try {
    const queryResults = includeClosed
      ? [await fetchAllPages(env.SULTS_API_TOKEN)]
      : await Promise.all(
        ACTIVE_SITUATIONS.map((situation) => fetchAllPages(env.SULTS_API_TOKEN, { situation })),
      );

    const rawTickets = uniqueById(queryResults.flatMap((result) => result.data));
    const mappedTickets = rawTickets.map(mapTicket);
    const queryStats = queryResults.map((result) => ({
      situation: result.situation,
      pages: result.pages,
      size: result.data.length,
      complete: result.complete,
    }));
    const [ignoredIds, previousSnapshot] = await Promise.all([ignoredPromise, cachedPromise]);
    const cacheResult = await saveSnapshot(
      env,
      includeClosed,
      mappedTickets,
      queryStats,
      previousSnapshot,
    );
    const chamados = filterTickets({
      tickets: mappedTickets,
      ignoredIds,
      scope,
      personId,
      personName,
      brandTerm,
      departmentId,
    });
    const fetchedAt = cacheResult.fetchedAt || servedAt;

    return json({
      data: chamados,
      filters: filtersPayload({
        scope,
        includeIgnored,
        brandTerm,
        departmentId,
        personId,
        personName,
      }),
      pagination: {
        mode: includeClosed ? 'all-pages' : 'active-situations-all-pages',
        situations: includeClosed ? [] : ACTIVE_SITUATIONS,
        queries: queryStats,
        ignored: ignoredIds.size,
        rawSize: mappedTickets.length,
        size: chamados.length,
      },
      reliability: {
        complete: true,
        stale: false,
        source: 'sults-live',
        fetchedAt,
        servedAt,
        cache: cacheResult,
      },
      warning: null,
    });
  } catch (error) {
    const [ignoredIds, cachedSnapshot] = await Promise.all([ignoredPromise, cachedPromise]);

    if (cachedSnapshot?.complete && Array.isArray(cachedSnapshot.tickets)) {
      const chamados = filterTickets({
        tickets: cachedSnapshot.tickets,
        ignoredIds,
        scope,
        personId,
        personName,
        brandTerm,
        departmentId,
      });
      const ageSeconds = Math.max(
        0,
        Math.round((Date.now() - Date.parse(cachedSnapshot.fetchedAt || 0)) / 1000),
      );

      return json({
        data: chamados,
        filters: filtersPayload({
          scope,
          includeIgnored,
          brandTerm,
          departmentId,
          personId,
          personName,
        }),
        pagination: {
          mode: 'cached-complete-snapshot',
          situations: includeClosed ? [] : ACTIVE_SITUATIONS,
          queries: cachedSnapshot.queryStats || [],
          ignored: ignoredIds.size,
          rawSize: cachedSnapshot.tickets.length,
          size: chamados.length,
        },
        reliability: {
          complete: true,
          stale: true,
          source: 'shared-cache',
          fetchedAt: cachedSnapshot.fetchedAt || null,
          servedAt,
          ageSeconds,
          liveFailure: safeFailure(error),
        },
        warning: 'O SULTS oscilou. O sistema manteve a última leitura completa dos chamados.',
      });
    }

    return json({
      error: 'Não foi possível obter uma leitura completa dos chamados do SULTS.',
      details: safeFailure(error),
      reliability: {
        complete: false,
        stale: false,
        source: 'unavailable',
        fetchedAt: null,
        servedAt,
      },
    }, 503);
  }
}
