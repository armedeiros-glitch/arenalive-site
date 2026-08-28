const SULTS_ENDPOINT = 'https://api.sults.com.br/api/v1/implantacao/projeto';
const SNAPSHOT_KEY = 'planet-hub:sults-implantacoes-completas:v1';
const STATUS_KEY = 'planet-hub:sults-implantacoes-status:v1';
const CACHE_FRESH_MS = 15 * 60 * 1000;
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000;
const MAX_PAGES = 20;

let refreshPromise = null;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': 'no-store',
    },
  });

const readJson = async (response) => {
  const raw = await response.text();
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return { raw };
  }
};

const readSnapshot = async (env) => {
  if (!env.PLANET_HUB_DATA) return null;
  try {
    const stored = await env.PLANET_HUB_DATA.get(SNAPSHOT_KEY, { type: 'json' });
    return stored?.complete && Array.isArray(stored?.data) ? stored : null;
  } catch {
    return null;
  }
};

const readStatus = async (env) => {
  if (!env.PLANET_HUB_DATA) return null;
  try {
    return await env.PLANET_HUB_DATA.get(STATUS_KEY, { type: 'json' });
  } catch {
    return null;
  }
};

const writeStatus = async (env, value) => {
  if (!env.PLANET_HUB_DATA) return false;
  try {
    await env.PLANET_HUB_DATA.put(STATUS_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

const saveSnapshot = async (env, payload) => {
  if (!env.PLANET_HUB_DATA) return { stored: false, reason: 'binding-unavailable' };
  try {
    const fetchedAt = new Date().toISOString();
    await env.PLANET_HUB_DATA.put(SNAPSHOT_KEY, JSON.stringify({
      version: 2,
      complete: true,
      fetchedAt,
      ...payload,
    }));
    return { stored: true, fetchedAt };
  } catch {
    return { stored: false, reason: 'write-failed' };
  }
};

const mapProject = (projeto) => ({
  source: 'sults',
  sultsProjectId: projeto.id,
  unitId: projeto.unidade?.id ?? null,
  unit: projeto.unidade?.nomeFantasia || projeto.nome || 'Unidade sem nome',
  cnpj: projeto.unidade?.cnpj ?? null,
  projectName: projeto.nome ?? null,
  model: projeto.modelo?.nome ?? null,
  category: projeto.categoria?.nome ?? null,
  responsible: projeto.responsavel?.nome ?? null,
  active: Boolean(projeto.ativo),
  paused: Boolean(projeto.pausado),
  completed: Boolean(projeto.concluido),
  status: projeto.concluido
    ? 'concluido'
    : projeto.pausado
      ? 'pausado'
      : projeto.ativo
        ? 'ativo'
        : 'inativo',
  createdAt: projeto.dtCriacao ?? null,
  startDate: projeto.dtInicio ?? null,
  endDate: projeto.dtFim ?? null,
  conclusionDate: projeto.dtConclusao ?? null,
  attentionNote: projeto.anotacaoAtencao ?? null,
  labels: Array.isArray(projeto.etiqueta) ? projeto.etiqueta : [],
});

const uniqueById = (items) => {
  const seen = new Set();
  return items.filter((item) => {
    const id = String(item?.sultsProjectId ?? '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const fetchPage = async (token, start, limit) => {
  const url = new URL(SULTS_ENDPOINT);
  url.searchParams.set('start', String(start));
  url.searchParams.set('limit', String(limit));
  const response = await fetch(url.toString(), {
    headers: {
      Authorization: token,
      'Content-Type': 'application/json;charset=UTF-8',
      Accept: 'application/json',
    },
  });
  const payload = await readJson(response);
  if (!response.ok) {
    const error = new Error('O SULTS recusou a consulta.');
    error.status = response.status;
    error.details = payload;
    throw error;
  }
  return payload;
};

const fetchCompleteDataset = async (token, limit) => {
  const rawProjects = [];
  const pages = [];
  let expectedPages = null;

  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
    const start = pageIndex * limit;
    const payload = await fetchPage(token, start, limit);
    const pageData = Array.isArray(payload?.data) ? payload.data : [];
    const reportedPages = Number(payload?.totalPage);
    if (Number.isFinite(reportedPages) && reportedPages > 0) expectedPages = reportedPages;
    rawProjects.push(...pageData);
    pages.push({
      page: pageIndex + 1,
      start,
      received: pageData.length,
    });

    if (pageData.length < limit || (expectedPages != null && pageIndex + 1 >= expectedPages)) {
      const mapped = uniqueById(rawProjects.map(mapProject));
      return {
        data: mapped,
        pages,
        reportedTotalPage: expectedPages,
      };
    }
  }

  const error = new Error('A paginação de implantações do SULTS excedeu o limite de segurança.');
  error.status = 502;
  error.details = { pages: MAX_PAGES, limit };
  throw error;
};

const snapshotAgeMs = (snapshot) => {
  const timestamp = Date.parse(snapshot?.fetchedAt || 0);
  return Number.isFinite(timestamp) ? Math.max(0, Date.now() - timestamp) : Number.POSITIVE_INFINITY;
};

const failureAgeMs = (status) => {
  const timestamp = Date.parse(status?.failedAt || 0);
  return Number.isFinite(timestamp) ? Math.max(0, Date.now() - timestamp) : Number.POSITIVE_INFINITY;
};

const scopeData = (data, scope) => {
  const items = Array.isArray(data) ? data : [];
  if (scope !== 'operational') return items;
  return items.filter((item) => !item.completed && (item.active || item.paused));
};

const pageOf = (data, start, limit) => data.slice(start, start + limit);

const paginationOf = (allData, scopedData, start, limit, meta = {}) => ({
  start,
  limit,
  totalPage: Math.max(1, Math.ceil(scopedData.length / limit)),
  size: scopedData.length,
  rawSize: allData.length,
  mode: 'complete-dataset',
  pages: meta.pages || [],
  reportedTotalPage: meta.reportedTotalPage ?? null,
});

const failurePayload = (status, details) => ({
  status: Number(status || 502),
  details: details || null,
});

const cachedResponse = ({ snapshot, status, scope, start, limit, servedAt, stale, throttled = false }) => {
  const allData = Array.isArray(snapshot.data) ? snapshot.data : [];
  const scoped = scopeData(allData, scope);
  const ageSeconds = Math.max(0, Math.round(snapshotAgeMs(snapshot) / 1000));
  return json({
    data: pageOf(scoped, start, limit),
    pagination: paginationOf(allData, scoped, start, limit, snapshot.pagination || {}),
    filters: { scope },
    reliability: {
      complete: true,
      stale,
      source: 'shared-cache',
      fetchedAt: snapshot.fetchedAt || null,
      servedAt,
      ageSeconds,
      throttled,
      ...(status?.failure ? { liveFailure: status.failure } : {}),
    },
    warning: stale
      ? 'O SULTS oscilou. O sistema manteve a última leitura completa das implantações.'
      : null,
  });
};

const refreshDataset = async (env, limit) => {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const attemptedAt = new Date().toISOString();
    await writeStatus(env, { attemptedAt, pending: true, failure: null });
    try {
      const complete = await fetchCompleteDataset(env.SULTS_API_TOKEN, limit);
      const cache = await saveSnapshot(env, {
        data: complete.data,
        pagination: {
          pages: complete.pages,
          reportedTotalPage: complete.reportedTotalPage,
        },
      });
      await writeStatus(env, {
        attemptedAt,
        succeededAt: cache.fetchedAt || attemptedAt,
        pending: false,
        failure: null,
      });
      return { ...complete, cache };
    } catch (error) {
      const failure = failurePayload(
        error?.status,
        error?.details || (error instanceof Error ? error.message : String(error)),
      );
      await writeStatus(env, {
        attemptedAt,
        failedAt: new Date().toISOString(),
        pending: false,
        failure,
      });
      throw Object.assign(error instanceof Error ? error : new Error(String(error)), { failure });
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
};

export async function onRequestGet({ env, request }) {
  if (!env.SULTS_API_TOKEN) {
    return json({ error: 'SULTS_API_TOKEN não configurado.' }, 500);
  }

  const incomingUrl = new URL(request.url);
  const start = Math.max(0, Number.parseInt(incomingUrl.searchParams.get('start') || '0', 10) || 0);
  const limit = Math.min(100, Math.max(1, Number.parseInt(incomingUrl.searchParams.get('limit') || '100', 10) || 100));
  const scope = incomingUrl.searchParams.get('scope') === 'operational' ? 'operational' : 'all';
  const servedAt = new Date().toISOString();
  const [snapshot, status] = await Promise.all([readSnapshot(env), readStatus(env)]);

  if (snapshot && snapshotAgeMs(snapshot) <= CACHE_FRESH_MS) {
    return cachedResponse({ snapshot, status, scope, start, limit, servedAt, stale: false });
  }

  if (snapshot && failureAgeMs(status) <= FAILURE_COOLDOWN_MS) {
    return cachedResponse({
      snapshot,
      status,
      scope,
      start,
      limit,
      servedAt,
      stale: true,
      throttled: true,
    });
  }

  try {
    const complete = await refreshDataset(env, limit);
    const scoped = scopeData(complete.data, scope);
    return json({
      data: pageOf(scoped, start, limit),
      pagination: paginationOf(complete.data, scoped, start, limit, complete),
      filters: { scope },
      reliability: {
        complete: true,
        stale: false,
        source: 'sults-live',
        fetchedAt: complete.cache.fetchedAt || servedAt,
        servedAt,
        cache: complete.cache,
      },
      warning: null,
    });
  } catch (error) {
    const fallback = snapshot || await readSnapshot(env);
    const latestStatus = await readStatus(env);
    if (fallback) {
      return cachedResponse({
        snapshot: fallback,
        status: latestStatus,
        scope,
        start,
        limit,
        servedAt,
        stale: true,
      });
    }

    const statusCode = Number(error?.status || 502);
    return json(
      {
        error: statusCode >= 500 ? 'Falha ao conectar com o SULTS.' : 'O SULTS recusou a consulta.',
        status: statusCode,
        details: error?.details || (error instanceof Error ? error.message : String(error)),
        filters: { scope },
        reliability: {
          complete: false,
          stale: false,
          source: 'unavailable',
          fetchedAt: null,
          servedAt,
        },
      },
      statusCode,
    );
  }
}
