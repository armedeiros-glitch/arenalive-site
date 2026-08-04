const SULTS_ENDPOINT = 'https://api.sults.com.br/api/v1/implantacao/projeto';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': 'no-store',
    },
  });

export async function onRequestGet({ env, request }) {
  if (!env.SULTS_API_TOKEN) {
    return json({ error: 'SULTS_API_TOKEN não configurado.' }, 500);
  }

  const incomingUrl = new URL(request.url);
  const start = Math.max(0, Number.parseInt(incomingUrl.searchParams.get('start') || '0', 10) || 0);
  const limit = Math.min(100, Math.max(1, Number.parseInt(incomingUrl.searchParams.get('limit') || '100', 10) || 100));

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
      return json(
        {
          error: 'O SULTS recusou a consulta.',
          status: response.status,
          details: payload,
        },
        response.status,
      );
    }

    const implantacoes = (Array.isArray(payload.data) ? payload.data : []).map((projeto) => ({
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

    return json({
      data: implantacoes,
      pagination: {
        start: payload.start ?? start,
        limit: payload.limit ?? limit,
        totalPage: payload.totalPage ?? 0,
        size: payload.size ?? implantacoes.length,
      },
    });
  } catch (error) {
    return json(
      {
        error: 'Falha ao conectar com o SULTS.',
        details: error instanceof Error ? error.message : String(error),
      },
      502,
    );
  }
}
