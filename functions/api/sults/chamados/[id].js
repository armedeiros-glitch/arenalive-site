const SULTS_TICKET_ENDPOINT = 'https://api.sults.com.br/api/v1/chamado/ticket';
const SULTS_PORTAL_BASE = 'https://planetchocolate.sults.com.br/chamados/interacoes';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
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

const fetchSults = async (url, token) => {
  const response = await fetch(url, {
    headers: {
      Authorization: token,
      'Content-Type': 'application/json;charset=UTF-8',
      Accept: 'application/json',
    },
  });
  const payload = await parsePayload(response);
  return { response, payload };
};

const person = (value) => value ? { id: value.id ?? null, name: value.nome ?? null } : null;

const mapTicket = (ticket) => ({
  id: ticket.id,
  sultsTicketId: ticket.id,
  title: ticket.titulo ?? 'Chamado sem título',
  requester: person(ticket.solicitante),
  responsible: person(ticket.responsavel),
  unit: ticket.unidade ? { id: ticket.unidade.id ?? null, name: ticket.unidade.nome ?? null } : null,
  department: ticket.departamento ? { id: ticket.departamento.id ?? null, name: ticket.departamento.nome ?? null } : null,
  sendingDepartment: ticket.departamentoEnvio ? { id: ticket.departamentoEnvio.id ?? null, name: ticket.departamentoEnvio.nome ?? null } : null,
  subject: ticket.assunto ? { id: ticket.assunto.id ?? null, name: ticket.assunto.nome ?? null } : null,
  labels: Array.isArray(ticket.etiqueta) ? ticket.etiqueta.map((item) => ({
    id: item?.id ?? null,
    name: item?.nome ?? '',
    color: item?.cor ?? null,
  })) : [],
  support: Array.isArray(ticket.apoio) ? ticket.apoio.map((item) => ({
    person: person(item?.pessoa),
    department: item?.departamento ? { id: item.departamento.id ?? null, name: item.departamento.nome ?? null } : null,
    unitPerson: Boolean(item?.pessoaUnidade),
  })) : [],
  type: ticket.tipo ?? null,
  situation: ticket.situacao ?? null,
  openedAt: ticket.aberto ?? null,
  resolvedAt: ticket.resolvido ?? null,
  concludedAt: ticket.concluido ?? null,
  plannedResolutionAt: ticket.resolverPlanejado ?? null,
  stipulatedResolutionAt: ticket.resolverEstipulado ?? null,
  firstInteractionAt: ticket.primeiraInteracao ?? null,
  lastChangeAt: ticket.ultimaAlteracao ?? null,
  publicInteractionCount: ticket.countInteracaoPublico ?? 0,
  internalInteractionCount: ticket.countInteracaoInterno ?? 0,
  rating: ticket.avaliacaoNota ?? null,
  ratingNote: ticket.avaliacaoObservacao ?? null,
  sultsUrl: `${SULTS_PORTAL_BASE}/${ticket.id}`,
});

const mapTimelineItem = (item, index) => ({
  id: item?.interacao?.id ?? `${item?.tipo ?? 'event'}-${index}-${item?.criado ?? ''}`,
  createdAt: item?.criado ?? null,
  person: person(item?.pessoa),
  type: item?.tipo ?? null,
  situation: item?.situacao ?? null,
  interaction: item?.interacao ? {
    id: item.interacao.id ?? null,
    messageHtml: item.interacao.mensagemHtml ?? '',
    internal: Boolean(item.interacao.interno),
    attachments: Array.isArray(item.interacao.anexos) ? item.interacao.anexos.map((attachment) => ({
      id: attachment?.id ?? null,
      name: attachment?.nome ?? 'Anexo',
      url: attachment?.url ?? attachment?.URL ?? null,
    })) : [],
  } : null,
  deadline: item?.prazoResolver ? {
    previous: item.prazoResolver.anterior ?? null,
    next: item.prazoResolver.novo ?? null,
  } : null,
  previousResponsible: person(item?.responsavelAnterior),
  nextResponsible: person(item?.responsavelNovo),
  previousSubject: item?.assuntoAnterior ? {
    id: item.assuntoAnterior.id ?? null,
    name: item.assuntoAnterior.assunto ?? item.assuntoAnterior.nome ?? null,
  } : null,
  nextSubject: item?.assuntoNovo ? {
    id: item.assuntoNovo.id ?? null,
    name: item.assuntoNovo.assunto ?? item.assuntoNovo.nome ?? null,
  } : null,
  support: item?.apoio ? {
    person: person(item.apoio.pessoa ?? item.apoio),
    department: item.apoio.departamento ? {
      id: item.apoio.departamento.id ?? null,
      name: item.apoio.departamento.nome ?? null,
    } : null,
    unitPerson: Boolean(item.apoio.pessoaUnidade),
  } : null,
  rating: item?.avaliacaoNota ?? null,
  ratingNote: item?.avaliacaoObservacao ?? null,
});

export async function onRequestGet({ env, params }) {
  if (!env.SULTS_API_TOKEN) {
    return json({ error: 'SULTS_API_TOKEN não configurado.' }, 500);
  }

  const id = Number.parseInt(String(params?.id || ''), 10);
  if (!Number.isFinite(id) || id <= 0) {
    return json({ error: 'Número do chamado inválido.' }, 400);
  }

  const ticketUrl = new URL(SULTS_TICKET_ENDPOINT);
  ticketUrl.searchParams.set('start', '0');
  ticketUrl.searchParams.set('limit', '1');
  ticketUrl.searchParams.set('id', String(id));
  const timelineUrl = `${SULTS_TICKET_ENDPOINT}/${id}/timeline`;

  try {
    const [ticketResult, timelineResult] = await Promise.all([
      fetchSults(ticketUrl.toString(), env.SULTS_API_TOKEN),
      fetchSults(timelineUrl, env.SULTS_API_TOKEN),
    ]);

    if (!ticketResult.response.ok) {
      return json({
        error: 'O SULTS recusou a consulta do chamado.',
        status: ticketResult.response.status,
        details: ticketResult.payload,
      }, ticketResult.response.status || 502);
    }

    const rawTicket = Array.isArray(ticketResult.payload?.data)
      ? ticketResult.payload.data.find((item) => Number(item?.id) === id) || ticketResult.payload.data[0]
      : null;

    if (!rawTicket) {
      return json({ error: 'Chamado não encontrado no SULTS.' }, 404);
    }

    const rawTimeline = timelineResult.response.ok && Array.isArray(timelineResult.payload?.data)
      ? timelineResult.payload.data
      : [];

    return json({
      ticket: mapTicket(rawTicket),
      timeline: rawTimeline.map(mapTimelineItem),
      warning: timelineResult.response.ok
        ? null
        : 'Os dados gerais carregaram, mas a timeline não pôde ser consultada.',
    });
  } catch (error) {
    return json({
      error: 'Falha ao carregar o detalhe do chamado.',
      details: error instanceof Error ? error.message : String(error),
    }, 502);
  }
}
