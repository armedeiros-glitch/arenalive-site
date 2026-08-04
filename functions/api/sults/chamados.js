const SULTS_ENDPOINT = 'https://api.sults.com.br/api/v1/chamado/ticket';
const PAGE_LIMIT = 100;
const MAX_PAGES = 10;

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

const fetchPage = async (token, start, limit = PAGE_LIMIT) => {
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

  const payload = await parsePayload(response);
  return { response, payload };
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

export async function onRequestGet({ env, request }) {
  if (!env.SULTS_API_TOKEN) {
    return json({ error: 'SULTS_API_TOKEN não configurado.' }, 500);
  }

  const incomingUrl = new URL(request.url);
  const requestedStart = Math.max(0, Number.parseInt(incomingUrl.searchParams.get('start') || '0', 10) || 0);
  const requestedLimit = Math.min(PAGE_LIMIT, Math.max(1, Number.parseInt(incomingUrl.searchParams.get('limit') || String(PAGE_LIMIT), 10) || PAGE_LIMIT));
  const fetchAll = incomingUrl.searchParams.get('all') !== '0';

  try {
    const first = await fetchPage(env.SULTS_API_TOKEN, requestedStart, requestedLimit);

    if (!first.response.ok) {
      return json(
        {
          error: 'O SULTS recusou a consulta de chamados.',
          status: first.response.status,
          details: first.payload,
        },
        first.response.status,
      );
    }

    const pages = [first.payload];
    const reportedPages = Math.max(1, Number(first.payload.totalPage) || 1);
    const remainingPages = fetchAll
      ? Math.min(MAX_PAGES, reportedPages) - 1
      : 0;

    if (remainingPages > 0) {
      const requests = Array.from({ length: remainingPages }, (_, index) =>
        fetchPage(env.SULTS_API_TOKEN, requestedStart + index + 1, PAGE_LIMIT),
      );
      const results = await Promise.all(requests);

      for (const result of results) {
        if (!result.response.ok) {
          return json(
            {
              error: 'O SULTS recusou uma página da consulta de chamados.',
              status: result.response.status,
              details: result.payload,
            },
            result.response.status,
          );
        }
        pages.push(result.payload);
      }
    }

    const rawTickets = pages.flatMap((page) => Array.isArray(page.data) ? page.data : []);
    const uniqueTickets = rawTickets.filter((ticket, index, array) =>
      array.findIndex((candidate) => candidate.id === ticket.id) === index,
    );
    const chamados = uniqueTickets.map(mapTicket);

    return json({
      data: chamados,
      pagination: {
        start: requestedStart,
        limit: requestedLimit,
        totalPage: reportedPages,
        fetchedPages: pages.length,
        size: chamados.length,
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
