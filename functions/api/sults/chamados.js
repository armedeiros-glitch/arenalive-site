const SULTS_ENDPOINT = 'https://api.sults.com.br/api/v1/chamado/ticket';
const PAGE_LIMIT = 100;
const ACTIVE_SITUATIONS = [1, 4, 5, 6];
const MARKETING_DEPARTMENT_ID = 10;
const DEFAULT_PERSON_NAME = 'André Roberto Medeiros';
const DEFAULT_BRAND_TERM = 'Planet Chocolate';

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
    array.findIndex((candidate) => candidate.id === ticket.id) === index,
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

export async function onRequestGet({ env, request }) {
  if (!env.SULTS_API_TOKEN) {
    return json({ error: 'SULTS_API_TOKEN não configurado.' }, 500);
  }

  const incomingUrl = new URL(request.url);
  const includeClosed = incomingUrl.searchParams.get('includeClosed') === '1';
  const scope = incomingUrl.searchParams.get('scope') || 'planet';
  const personId = Number.parseInt(incomingUrl.searchParams.get('personId') || '', 10) || null;
  const personName = incomingUrl.searchParams.get('personName') || DEFAULT_PERSON_NAME;
  const brandTerm = incomingUrl.searchParams.get('brand') || DEFAULT_BRAND_TERM;
  const departmentId = Number.parseInt(
    incomingUrl.searchParams.get('departmentId') || String(MARKETING_DEPARTMENT_ID),
    10,
  );

  try {
    const requests = includeClosed
      ? [fetchTickets(env.SULTS_API_TOKEN)]
      : ACTIVE_SITUATIONS.map((situation) =>
          fetchTickets(env.SULTS_API_TOKEN, { situation }),
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
      .filter((ticket) => {
        if (scope === 'all') return true;
        if (scope === 'marketing') return departmentIsIncluded(ticket, departmentId);
        if (scope === 'mine') return personIsIncluded(ticket, personId, personName);
        return brandIsIncluded(ticket, brandTerm);
      })
      .sort((a, b) =>
        new Date(b.lastUpdatedAt || b.openedAt || 0).getTime() -
        new Date(a.lastUpdatedAt || a.openedAt || 0).getTime(),
      );

    return json({
      data: chamados,
      filters: {
        scope,
        brandTerm: scope === 'planet' ? brandTerm : null,
        departmentId: scope === 'marketing' ? departmentId : null,
        personId: scope === 'mine' ? personId : null,
        personName: scope === 'mine' ? personName : null,
        membership: scope === 'mine' ? ['responsible', 'support'] : null,
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
