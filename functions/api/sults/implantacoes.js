const SULTS_ENDPOINT = 'https://api.sults.com.br/api/v1/implantacao/projeto';
const SNAPSHOT_KEY = 'planet-hub:sults-implantacoes-completas:v1';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': 'no-store',
    },
  });

const readSnapshot = async (env) => {
  if (!env.PLANET_HUB_DATA) return null;
  try {
    const stored = await env.PLANET_HUB_DATA.get(SNAPSHOT_KEY, { type: 'json' });
    return stored?.complete && Array.isArray(stored?.data) ? stored : null;
  } catch {
    return null;
  }
};

const saveSnapshot = async (env, payload) => {
  if (!env.PLANET_HUB_DATA) return { stored: false, reason: 'binding-unavailable' };
  try {
    const fetchedAt = new Date().toISOString();
    await env.PLANET_HUB_DATA.put(SNAPSHOT_KEY, JSON.stringify({
      version: 1,
      complete: true,
      fetchedAt,
      ...payload,
    }));
    return { stored: true, fetchedAt };
  } catch {
    return { stored: false, reason: 'write-failed' };
  }
};

const mapProjects = (payload) => (Array.isArray(payload?.data) ? payload.data : []).map((projeto) => ({
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
}));

const paginationOf = (payload, start, limit, size) => ({
  start: payload?.start ?? start,
  limit: payload?.limit ?? limit,
  totalPage: payload?.totalPage ?? 0,
  size: payload?.size ?? size,
});

const failurePayload = (status, details) => ({
  status: Number(status || 502),
  details: details || null,
});

export async function onRequestGet({ env, request }) {
  if (!env.SULTS_API_TOKEN) {
    return json({ error: 'SULTS_API_TOKEN não configurado.' }, 500);
  }

  const incomingUrl = new URL(request.url);
  const start = Math.max(0, Number.parseInt(incomingUrl.searchParams.get('start') || '0', 10) || 0);
  const limit = Math.min(100, Math.max(1, Number.parseInt(incomingUrl.searchParams.get('limit') || '100', 10) || 100));
  const servedAt = new Date().toISOString();
  const snapshotPromise = readSnapshot(env);

  const url = new URL(SULTS_ENDPOINT);
  url.searchParams.set('start', String(start));
  url.searchParams.set('limit', String(limit));

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Authorization: env.SULTS_API_TOKEN,
        'Content-Type': 'application/json;charset=UTF-8',
        Accept: 'application/json',
      },
    });

    const raw = await response.text();
    let payload;

    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = { raw };
    }

    if (!response.ok) {
      const error = new Error('O SULTS recusou a consulta.');
      error.status = response.status;
      error.details = payload;
      throw error;
    }

    const implantacoes = mapProjects(payload);
    const pagination = paginationOf(payload, start, limit, implantacoes.length);
    const cache = await saveSnapshot(env, { data: implantacoes, pagination });

    return json({
      data: implantacoes,
      pagination,
      reliability: {
        complete: true,
        stale: false,
        source: 'sults-live',
        fetchedAt: cache.fetchedAt || servedAt,
        servedAt,
        cache,
      },
      warning: null,
    });
  } catch (error) {
    const snapshot = await snapshotPromise;
    if (snapshot) {
      const ageSeconds = Math.max(0, Math.round((Date.now() - Date.parse(snapshot.fetchedAt || 0)) / 1000));
      return json({
        data: snapshot.data,
        pagination: snapshot.pagination || paginationOf({}, start, limit, snapshot.data.length),
        reliability: {
          complete: true,
          stale: true,
          source: 'shared-cache',
          fetchedAt: snapshot.fetchedAt || null,
          servedAt,
          ageSeconds,
          liveFailure: failurePayload(error?.status, error?.details || (error instanceof Error ? error.message : String(error))),
        },
        warning: 'O SULTS oscilou. O sistema manteve a última leitura completa das implantações.',
      });
    }

    const status = Number(error?.status || 502);
    return json(
      {
        error: status >= 500 ? 'Falha ao conectar com o SULTS.' : 'O SULTS recusou a consulta.',
        status,
        details: error?.details || (error instanceof Error ? error.message : String(error)),
        reliability: {
          complete: false,
          stale: false,
          source: 'unavailable',
          fetchedAt: null,
          servedAt,
        },
      },
      status,
    );
  }
}
