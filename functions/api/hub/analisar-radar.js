const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const clean = (value, max = 300) => String(value ?? '').trim().slice(0, max);
const cleanDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').slice(0, 10))
  ? String(value).slice(0, 10)
  : '';
const OPERATIONAL_STATES = new Set([
  'actionable',
  'blocked',
  'waiting_info',
  'waiting_approval',
  'scheduled',
]);

const normalizeItem = (item = {}) => ({
  id: clean(item.id, 140),
  origin: clean(item.origin, 80) || 'Não informada',
  title: clean(item.title, 220) || 'Demanda sem título',
  context: clean(item.context, 360),
  responsible: clean(item.responsible, 160) || 'Não definido',
  status: clean(item.status, 120) || 'Ativa',
  dueDate: cleanDate(item.dueDate),
  priority: Number.isFinite(Number(item.priority)) ? Math.max(0, Math.min(5, Number(item.priority))) : 2,
  updatedAt: clean(item.updatedAt, 40),
  operationalState: OPERATIONAL_STATES.has(item.operationalState) ? item.operationalState : 'actionable',
  blockerReason: clean(item.blockerReason, 900),
  dependsOn: clean(item.dependsOn, 240),
  nextAction: clean(item.nextAction, 600),
  followUpDate: cleanDate(item.followUpDate),
});

const dateDiff = (dateValue, todayValue) => {
  if (!dateValue) return null;
  const due = new Date(`${dateValue}T12:00:00Z`);
  const today = new Date(`${todayValue}T12:00:00Z`);
  if (Number.isNaN(due.getTime()) || Number.isNaN(today.getTime())) return null;
  return Math.round((due - today) / 86400000);
};

const isDeferred = (item) => item.operationalState !== 'actionable';
const followUpDiff = (item, today) => dateDiff(item.followUpDate, today);
const followUpDue = (item, today) => isDeferred(item)
  && followUpDiff(item, today) != null
  && followUpDiff(item, today) <= 0;

const executionScore = (item, today) => {
  const days = dateDiff(item.dueDate, today);
  const score = days == null
    ? 100 + item.priority
    : days < 0
      ? -1000 + days
      : days * 10 + item.priority;
  return { ...item, days, score };
};

const blockerDescription = (item) => [
  item.dependsOn ? `Depende de ${item.dependsOn}.` : '',
  item.blockerReason,
  item.followUpDate ? `Revisar em ${item.followUpDate.split('-').reverse().join('/')}.` : '',
].filter(Boolean).join(' ');

const localAnalysis = (items, today) => {
  const executable = items
    .filter((item) => !isDeferred(item))
    .map((item) => executionScore(item, today))
    .sort((a, b) => a.score - b.score);

  const followUps = items
    .filter((item) => followUpDue(item, today))
    .map((item) => ({ ...item, followUpDays: followUpDiff(item, today) }))
    .sort((a, b) => a.followUpDays - b.followUpDays);

  const blocked = items.filter(isDeferred);
  const focus = executable[0] || followUps[0] || null;
  const focusIsFollowUp = Boolean(focus && isDeferred(focus));
  const overdue = executable.filter((item) => item.days != null && item.days < 0);
  const dueToday = executable.filter((item) => item.days === 0);
  const urgent = executable.filter((item) => item.days != null && item.days <= 0).slice(0, 5);
  const noResponsible = executable.filter((item) => /não definido/i.test(item.responsible)).slice(0, 5);
  const noDate = executable.filter((item) => item.days == null).slice(0, 5);
  const missingNextAction = executable.filter((item) => !item.nextAction).slice(0, 5);

  const focusReason = focus ? (
    focusIsFollowUp
      ? `${blockerDescription(focus)} A data de cobrança ou revisão chegou; o movimento correto agora é destravar a dependência e registrar uma nova previsão.`
      : focus.days == null
        ? `É a demanda executável de maior prioridade entre as que não possuem prazo. Está com ${focus.responsible} e precisa de um próximo movimento explícito${focus.nextAction ? `: ${focus.nextAction}` : '.'}`
        : focus.days < 0
          ? `Entre as demandas que podem andar agora, é a mais vencida: está atrasada há ${Math.abs(focus.days)} dia(s), tem ${focus.responsible} como responsável e não possui bloqueio registrado.${focus.nextAction ? ` Próximo movimento registrado: ${focus.nextAction}` : ' O próximo movimento ainda precisa ser definido.'}`
          : focus.days === 0
            ? `Vence hoje, está executável e tem ${focus.responsible} como responsável.${focus.nextAction ? ` Próximo movimento registrado: ${focus.nextAction}` : ' O próximo movimento ainda precisa ser definido.'}`
            : `É a próxima demanda executável com prazo, em ${focus.days} dia(s), sob responsabilidade de ${focus.responsible}.${focus.nextAction ? ` Próximo movimento registrado: ${focus.nextAction}` : ''}`
  ) : '';

  return {
    mode: 'rules',
    summary: items.length
      ? `${items.length} demandas ativas foram comparadas: ${executable.length} podem andar agora e ${blocked.length} dependem de terceiros, informação, aprovação ou data futura. Entre as executáveis, ${overdue.length} estão atrasadas, ${dueToday.length} vencem hoje e ${noDate.length} não têm prazo; ${followUps.length} dependência(s) já chegaram à data de cobrança.`
      : 'Nenhuma demanda ativa foi enviada para análise.',
    focus: focus ? {
      title: focus.title,
      reason: focusReason,
      origin: focus.origin,
      dueDate: focusIsFollowUp ? focus.followUpDate : focus.dueDate,
    } : null,
    urgent: urgent.map((item) => ({
      title: item.title,
      reason: item.days < 0
        ? `Atrasada há ${Math.abs(item.days)} dia(s), executável e sob responsabilidade de ${item.responsible}.`
        : `Vence hoje, está executável e sob responsabilidade de ${item.responsible}.`,
      origin: item.origin,
    })),
    delegation: [
      ...followUps.map((item) => ({
        title: item.title,
        responsible: item.dependsOn || item.responsible || 'Responsável externo',
        suggestion: `Cobrar retorno, confirmar o bloqueio atual e registrar uma nova previsão. ${item.blockerReason}`.trim(),
      })),
      ...executable
        .filter((item) => !/não definido/i.test(item.responsible))
        .map((item) => ({
          title: item.title,
          responsible: item.responsible,
          suggestion: item.nextAction
            ? `Confirmar com ${item.responsible} a execução deste próximo movimento: ${item.nextAction}`
            : `Cobrar de ${item.responsible} um próximo passo objetivo e uma previsão de conclusão.`,
        })),
    ].slice(0, 5),
    blocked: blocked.slice(0, 6).map((item) => ({
      title: item.title,
      reason: blockerDescription(item) || 'Item marcado com dependência, mas sem descrição suficiente para decidir a cobrança.',
    })),
    nextActions: [
      ...executable.slice(0, 3).map((item) => ({
        action: item.nextAction || (/não definido/i.test(item.responsible)
          ? `Definir responsável e próximo passo para “${item.title}”.`
          : `Cobrar de ${item.responsible} o próximo passo e a previsão de “${item.title}”.`),
        relatedTitle: item.title,
      })),
      ...followUps.slice(0, 3).map((item) => ({
        action: `Cobrar ${item.dependsOn || item.responsible || 'a dependência'} sobre “${item.title}” e atualizar a previsão.`,
        relatedTitle: item.title,
      })),
    ].slice(0, 3),
    risks: [
      ...(overdue.length ? [`Há ${overdue.length} demanda(s) executáveis atrasadas; continuar tratando apenas por ordem de chegada aumenta o risco de novas pendências vencerem sem decisão.`] : []),
      ...(followUps.length ? [`Há ${followUps.length} dependência(s) cuja data de cobrança já chegou e que podem permanecer paradas sem uma ação explícita.`] : []),
      ...(blocked.filter((item) => !item.followUpDate).length
        ? [`Há ${blocked.filter((item) => !item.followUpDate).length} dependência(s) sem data de acompanhamento, o que favorece esquecimentos.`]
        : []),
      ...(noResponsible.length ? [`Há ${noResponsible.length} demanda(s) executáveis sem responsável definido.`] : []),
      ...(noDate.length ? [`Há ${noDate.length} demanda(s) executáveis sem prazo entre as primeiras prioridades.`] : []),
      ...(missingNextAction.length ? [`Há ${missingNextAction.length} demanda(s) executáveis sem próximo movimento registrado, reduzindo a qualidade da priorização.`] : []),
    ].slice(0, 5),
    caveats: ['A análise usa somente os prazos, responsáveis, contextos, dependências e próximos movimentos registrados no Radar.'],
  };
};

const extractObject = (response) => {
  if (response?.response && typeof response.response === 'object') return response.response;
  const value = response?.response
    ?? response?.choices?.[0]?.message?.content
    ?? response?.result?.response
    ?? response;
  if (value && typeof value === 'object') return value;
  const text = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('A IA não retornou uma análise estruturada.');
  return JSON.parse(text.slice(start, end + 1));
};

const schema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    focus: {
      type: ['object', 'null'],
      properties: {
        title: { type: 'string' },
        reason: { type: 'string' },
        origin: { type: 'string' },
        dueDate: { type: 'string' },
      },
      required: ['title', 'reason', 'origin', 'dueDate'],
    },
    urgent: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          reason: { type: 'string' },
          origin: { type: 'string' },
        },
        required: ['title', 'reason', 'origin'],
      },
    },
    delegation: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          responsible: { type: 'string' },
          suggestion: { type: 'string' },
        },
        required: ['title', 'responsible', 'suggestion'],
      },
    },
    blocked: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['title', 'reason'],
      },
    },
    nextActions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          action: { type: 'string' },
          relatedTitle: { type: 'string' },
        },
        required: ['action', 'relatedTitle'],
      },
    },
    risks: { type: 'array', items: { type: 'string' } },
    caveats: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'focus', 'urgent', 'delegation', 'blocked', 'nextActions', 'risks', 'caveats'],
};

const mergeUnique = (primary, fallback, key, max) => {
  const result = [];
  const seen = new Set();
  [...primary, ...fallback].forEach((item) => {
    const identity = clean(key(item), 320).toLowerCase();
    if (!identity || seen.has(identity) || result.length >= max) return;
    seen.add(identity);
    result.push(item);
  });
  return result;
};

const sanitizeAnalysis = (raw, fallback) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  const list = (value, max = 6) => Array.isArray(value) ? value.slice(0, max) : [];

  const aiUrgent = list(source.urgent).map((item) => ({
    title: clean(item?.title, 220),
    reason: clean(item?.reason, 500),
    origin: clean(item?.origin, 80),
  })).filter((item) => item.title);
  const aiDelegation = list(source.delegation).map((item) => ({
    title: clean(item?.title, 220),
    responsible: clean(item?.responsible, 160),
    suggestion: clean(item?.suggestion, 500),
  })).filter((item) => item.title);
  const aiBlocked = list(source.blocked).map((item) => ({
    title: clean(item?.title, 220),
    reason: clean(item?.reason, 500),
  })).filter((item) => item.title);
  const aiNextActions = list(source.nextActions, 5).map((item) => ({
    action: clean(item?.action, 600),
    relatedTitle: clean(item?.relatedTitle, 220),
  })).filter((item) => item.action);
  const aiRisks = list(source.risks, 6).map((item) => clean(item, 500)).filter(Boolean);
  const aiCaveats = list(source.caveats, 5).map((item) => clean(item, 500)).filter(Boolean);

  const aiSummary = clean(source.summary, 900);
  const aiFocus = source.focus && typeof source.focus === 'object' ? {
    title: clean(source.focus.title, 220),
    reason: clean(source.focus.reason, 700),
    origin: clean(source.focus.origin, 80),
    dueDate: cleanDate(source.focus.dueDate),
  } : null;

  return {
    mode: 'ai',
    summary: aiSummary.length >= 100 ? aiSummary : fallback.summary,
    focus: aiFocus?.title && aiFocus?.reason?.length >= 80 ? aiFocus : fallback.focus,
    urgent: mergeUnique(aiUrgent, fallback.urgent || [], (item) => item.title, 5),
    delegation: mergeUnique(aiDelegation, fallback.delegation || [], (item) => `${item.title}|${item.responsible}`, 5),
    blocked: mergeUnique(aiBlocked, fallback.blocked || [], (item) => item.title, 6),
    nextActions: mergeUnique(aiNextActions, fallback.nextActions || [], (item) => item.relatedTitle || item.action, 3),
    risks: mergeUnique(aiRisks, fallback.risks || [], (item) => item, 5),
    caveats: mergeUnique(aiCaveats, fallback.caveats || [], (item) => item, 5),
  };
};

const runAi = async (env, items, today, sourceErrors) => {
  const system = `Você é o analista operacional do Marketing da Planet Chocolate. Hoje é ${today}, fuso America/Sao_Paulo.

Seu trabalho não é apenas apontar a demanda mais atrasada. Transforme a fila em uma decisão operacional clara, comparando urgência, possibilidade real de execução, impacto indicado pelo contexto, responsável, dependências, prazo, ausência de prazo e próximo movimento registrado.

Regras obrigatórias:
1. Analise somente as demandas fornecidas. Não invente prazo, responsável, status, origem, dependência, impacto ou contexto.
2. operationalState é a verdade operacional: actionable pode andar agora; blocked, waiting_info, waiting_approval e scheduled possuem dependência.
3. Nunca escolha um item com dependência como foco de execução apenas porque está atrasado. Ele só pode ser foco quando followUpDate chegou ou venceu, e o foco deve ser cobrar, revisar ou atualizar a dependência.
4. Entre os itens actionable, compare atraso, vencimento hoje, inaugurações próximas, campanhas ativas, aprovações, ausência de responsável, ausência de prazo, contexto e nextAction. Não escolha automaticamente o mais antigo sem explicar por que ele merece prioridade sobre os demais.
5. O resumo deve ter de 2 a 4 frases e revelar padrões da fila, não apenas repetir contagens.
6. O motivo do foco deve explicar por que agir agora, qual evidência sustenta a escolha e qual é o próximo movimento.
7. Preencha Próximas ações com até 3 comandos específicos, começando por verbo e citando a demanda e o responsável ou dependência quando houver.
8. Preencha Urgentes, Delegar ou cobrar, Possíveis bloqueios e Riscos sempre que os dados sustentarem esses blocos. Não devolva listas vazias por conveniência.
9. Use blockerReason, dependsOn, nextAction e followUpDate literalmente, sem completar dados ausentes.
10. Seja direto, prático e escreva em português brasileiro. Use no máximo 5 itens por bloco.

Fontes que falharam: ${sourceErrors.length ? sourceErrors.join(', ') : 'nenhuma'}.`;
  const user = JSON.stringify({ today, items }, null, 2);
  const request = {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.1,
    max_completion_tokens: 2600,
    response_format: { type: 'json_schema', json_schema: schema },
  };
  try {
    return await env.AI.run('@cf/zai-org/glm-4.7-flash', request);
  } catch {
    return env.AI.run('@cf/zai-org/glm-4.7-flash', {
      messages: request.messages,
      temperature: 0.1,
      max_completion_tokens: 2600,
    });
  }
};

export async function onRequestPost({ env, request }) {
  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }

  const today = cleanDate(payload?.today) || new Date().toISOString().slice(0, 10);
  const sourceErrors = Array.isArray(payload?.sourceErrors)
    ? payload.sourceErrors.slice(0, 10).map((item) => clean(item, 120)).filter(Boolean)
    : [];
  const items = Array.isArray(payload?.items)
    ? payload.items.slice(0, 180).map(normalizeItem).filter((item) => item.title)
    : [];

  if (!items.length) return json({ error: 'Nenhuma demanda ativa foi enviada para análise.' }, 400);

  const fallback = localAnalysis(items, today);
  if (!env.AI) return json({ ...fallback, aiConfigured: false });

  try {
    const response = await runAi(env, items, today, sourceErrors);
    const analysis = sanitizeAnalysis(extractObject(response), fallback);
    return json({
      ...analysis,
      aiConfigured: true,
      model: '@cf/zai-org/glm-4.7-flash',
      analyzedAt: new Date().toISOString(),
      itemCount: items.length,
      sourceErrors,
    });
  } catch (error) {
    return json({
      ...fallback,
      aiConfigured: true,
      aiFailed: true,
      warning: 'A IA não respondeu corretamente; usamos a análise local com prazo, prioridade e dependências.',
      details: error instanceof Error ? error.message : String(error),
      analyzedAt: new Date().toISOString(),
      itemCount: items.length,
      sourceErrors,
    });
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
