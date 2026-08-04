const SULTS_ENDPOINT = 'https://api.sults.com.br/api/v1/chamado/ticket';

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
          error: 'O SULTS recusou a consulta de chamados.',
          status: response.status,
          details: payload,
        },
        response.status,
      );
    }

    const chamados = (Array.isArray(payload.data) ? payload.data : []).map((ticket) => ({
      source: 'sults',
      id: ticket.id,
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
      subject: ticket.assunto?.nome ?? null,
      subjectId: ticket.assunto?.id ?? null,
      labels: Array.isArray(ticket.etiqueta) ? ticket.etiqueta : [],
      support: Array.isArray(ticket.apoio) ? ticket.apoio : [],
      type: ticket.tipo ?? null,
      situation: ticket.situacao ?? null,
      openedAt: ticket.aberto ?? null,
      resolvedAt: ticket.resolvido ?? null,
      completedAt: ticket.concluido ?? null,
      plannedResolutionAt: ticket.resolverPlanejado ?? null,
      stipulatedResolutionAt: ticket.resolverEstipulado ?? null,
      firstInteractionAt: ticket.primeiraInteracao ?? null,
      lastUpdatedAt: ticket.ultimaAlteracao ?? null,
      publicInteractionCount: ticket.countInteracaoPublico ?? 0,
      internalInteractionCount: ticket.countInteracaoInterno ?? 0,
      rating: ticket.avaliacaoNota ?? null,
      ratingNote: ticket.avaliacaoObservacao ?? null,
    }));

    return json({
      data: chamados,
      pagination: {
        start: payload.start ?? start,
        limit: payload.limit ?? limit,
        totalPage: payload.totalPage ?? 0,
        size: payload.size ?? chamados.length,
      },
    });
  } catch (error) {
    return json(
      {
        error: 'Falha ao conectar com os chamados do SULTS.',
        details: error instanceof Error ? error.message : String(error),
      },
      502,
    );
  }
}
