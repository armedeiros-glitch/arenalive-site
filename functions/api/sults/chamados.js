const SULTS_ENDPOINT = 'https://api.sults.com.br/api/v1/chamado/ticket';
const PAGE_LIMIT = 100;
const ACTIVE_SITUATIONS = [1, 4, 5, 6];
const MARKETING_DEPARTMENT_ID = 10;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': 'no-store',
    },
  });

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

  if (params.situation != null) {
    url.searchParams.set('situacao', String(params.situation));
  }
  if (params.department != null) {
    url.searchParams.set('departamento', String(params.department));
  }
  if (params.responsible != null) {
    url.searchParams.set('responsavel', String(params.responsible));
  }
  if (params.requester != null) {
    url.searchParams.set('solicitante', String(params.requester));
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: token,
      'Content-Type': 'application/json;charset=UTF-8',
      Accept: 'application/json',
    },
  });

  const payload = await parsePayload(response);
  return { response, payload, situation: params.situation ?? null };
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
    array.findIndex((candidate) => candidate.id === ticket.id) === index,
  );

const personIsIncluded = (ticket, personId) => {
  if (!personId) return true;
  if (ticket.responsibleId === personId || ticket.requesterId === personId) return true;
  return ticket.support.some((item) => item?.pessoa?.id === personId);
};

export async function onRequestGet({ env, request }) {
  if (!env.SULTS_API_TOKEN) {
    return json({ error: 'SULTS_API_TOKEN não configurado.' }, 500);
  }

  const incomingUrl = new URL(request.url);
  const includeClosed = incomingUrl.searchParams.get('includeClosed') === '1';
  const scope = incomingUrl.searchParams.get('scope') || 'marketing';
  const personId = Number.parseInt(incomingUrl.searchParams.get('personId') || '', 10) || null;
  const departmentId = scope === 'all'
    ? null
    : Number.parseInt(incomingUrl.searchParams.get('departmentId') || String(MARKETING_DEPARTMENT_ID), 10);

  if (scope === 'mine' && !personId) {
    return json({ error: 'Para usar scope=mine, informe personId.' }, 400);
  }

  try {
    const baseFilters = { department: departmentId };
    const requests = includeClosed
      ? [fetchTickets(env.SULTS_API_TOKEN, baseFilters)]
      : ACTIVE_SITUATIONS.map((situation) =>
          fetchTickets(env.SULTS_API_TOKEN, { ...baseFilters, situation }),
        );

    const results = await Promise.all(requests);
    const successful = results.filter(({ response }) => response.ok);
    const failed = results.filter(({ response }) => !response.ok);

    if (!successful.length) {
      const firstFailure = failed[0];
      return json(
        {
          error: 'O SULTS recusou a consulta de chamados.',
          status: firstFailure?.response.status ?? 502,
          details: firstFailure?.payload ?? {},
        },
        firstFailure?.response.status ?? 502,
      );
    }

    const rawTickets = successful.flatMap(({ payload }) =>
      Array.isArray(payload.data) ? payload.data : [],
    );

    const chamados = uniqueById(rawTickets)
      .map(mapTicket)
      .filter((ticket) => scope !== 'mine' || personIsIncluded(ticket, personId))
      .sort((a, b) =>
        new Date(b.lastUpdatedAt || b.openedAt || 0).getTime() -
        new Date(a.lastUpdatedAt || a.openedAt || 0).getTime(),
      );

    return json({
      data: chamados,
      filters: {
        scope,
        departmentId,
        personId,
      },
      pagination: {
        mode: includeClosed ? 'all-first-page' : 'active-situations',
        situations: includeClosed ? [] : ACTIVE_SITUATIONS,
        successfulQueries: successful.length,
        failedQueries: failed.length,
        size: chamados.length,
      },
      warning: failed.length
        ? 'Algumas situações não puderam ser consultadas, mas os dados disponíveis foram mantidos.'
        : null,
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
