const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const clean = (value, max = 300) => String(value ?? '').trim().slice(0, max);
const cleanDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').slice(0, 10))
  ? String(value).slice(0, 10)
  : '';

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
});

const dateDiff = (dateValue, todayValue) => {
  if (!dateValue) return null;
  const due = new Date(`${dateValue}T12:00:00Z`);
  const today = new Date(`${todayValue}T12:00:00Z`);
  if (Number.isNaN(due.getTime()) || Number.isNaN(today.getTime())) return null;
  return Math.round((due - today) / 86400000);
};

const localAnalysis = (items, today) => {
  const scored = items.map((item) => {
    const days = dateDiff(item.dueDate, today);
    const score = days == null
      ? 100 + item.priority
      : days < 0
        ? -1000 + days
        : days * 10 + item.priority;
    return { ...item, days, score };
  }).sort((a, b) => a.score - b.score);

  const focus = scored[0] || null;
  const urgent = scored.filter((item) => item.days != null && item.days <= 0).slice(0, 5);
  const noResponsible = scored.filter((item) => /não definido/i.test(item.responsible)).slice(0, 5);
  const noDate = scored.filter((item) => item.days == null).slice(0, 5);

  return {
    mode: 'rules',
    summary: items.length
      ? `${items.length} demandas ativas analisadas. A prioridade foi definida por prazo e urgência.`
      : 'Nenhuma demanda ativa foi enviada para análise.',
    focus: focus ? {
      title: focus.title,
      reason: focus.days == null
        ? 'É a demanda de maior prioridade entre as que não possuem prazo definido.'
        : focus.days < 0
          ? `Está atrasada há ${Math.abs(focus.days)} dia(s).`
          : focus.days === 0
            ? 'Vence hoje.'
            : `É a próxima demanda com prazo, em ${focus.days} dia(s).`,
      origin: focus.origin,
      dueDate: focus.dueDate,
    } : null,
    urgent: urgent.map((item) => ({
      title: item.title,
      reason: item.days < 0 ? `Atrasada há ${Math.abs(item.days)} dia(s).` : 'Vence hoje.',
      origin: item.origin,
    })),
    delegation: scored
      .filter((item) => !/não definido/i.test(item.responsible))
      .slice(0, 4)
      .map((item) => ({
        title: item.title,
        responsible: item.responsible,
        suggestion: `Confirmar execução e próximo passo com ${item.responsible}.`,
      })),
    blocked: noResponsible.map((item) => ({
      title: item.title,
      reason: 'Responsável não definido.',
    })),
    nextActions: scored.slice(0, 3).map((item) => ({
      action: item.responsible && !/não definido/i.test(item.responsible)
        ? `Validar o próximo passo de “${item.title}” com ${item.responsible}.`
        : `Definir responsável e próximo passo para “${item.title}”.`,
      relatedTitle: item.title,
    })),
    risks: [
      ...(urgent.length ? [`Existem ${urgent.length} demanda(s) vencida(s) ou com vencimento hoje.`] : []),
      ...(noResponsible.length ? [`Existem ${noResponsible.length} demanda(s) sem responsável definido.`] : []),
      ...(noDate.length ? [`Existem ${noDate.length} demanda(s) sem prazo entre as primeiras prioridades.`] : []),
    ].slice(0, 5),
    caveats: ['Análise automática baseada apenas nos dados cadastrados no Radar.'],
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

const sanitizeAnalysis = (raw, fallback) => {
  const source = raw && typeof raw === 'object' ? raw : {};
  const list = (value, max = 6) => Array.isArray(value) ? value.slice(0, max) : [];
  return {
    mode: 'ai',
    summary: clean(source.summary, 900) || fallback.summary,
    focus: source.focus && typeof source.focus === 'object' ? {
      title: clean(source.focus.title, 220),
      reason: clean(source.focus.reason, 700),
      origin: clean(source.focus.origin, 80),
      dueDate: cleanDate(source.focus.dueDate),
    } : fallback.focus,
    urgent: list(source.urgent).map((item) => ({
      title: clean(item?.title, 220),
      reason: clean(item?.reason, 500),
      origin: clean(item?.origin, 80),
    })).filter((item) => item.title),
    delegation: list(source.delegation).map((item) => ({
      title: clean(item?.title, 220),
      responsible: clean(item?.responsible, 160),
      suggestion: clean(item?.suggestion, 500),
    })).filter((item) => item.title),
    blocked: list(source.blocked).map((item) => ({
      title: clean(item?.title, 220),
      reason: clean(item?.reason, 500),
    })).filter((item) => item.title),
    nextActions: list(source.nextActions, 5).map((item) => ({
      action: clean(item?.action, 600),
      relatedTitle: clean(item?.relatedTitle, 220),
    })).filter((item) => item.action),
    risks: list(source.risks, 6).map((item) => clean(item, 500)).filter(Boolean),
    caveats: list(source.caveats, 5).map((item) => clean(item, 500)).filter(Boolean),
  };
};

const runAi = async (env, items, today, sourceErrors) => {
  const system = `Você é o analista operacional do Marketing da Planet Chocolate. Hoje é ${today}, fuso America/Sao_Paulo. Analise somente as demandas fornecidas. Não invente prazo, responsável, status, origem, dependência ou contexto. Escolha exatamente um foco principal, priorizando: atrasos, vencimento hoje, inaugurações próximas, campanhas ativas, aprovações e itens sem responsável que bloqueiem execução. Seja direto, prático e escreva em português brasileiro. Recomende no máximo 3 próximas ações e até 5 itens por bloco. Delegação significa cobrar ou confirmar execução com o responsável já cadastrado; não invente novos responsáveis. Se faltarem dados, registre em caveats. Fontes que falharam: ${sourceErrors.length ? sourceErrors.join(', ') : 'nenhuma'}.`;
  const user = JSON.stringify({ today, items }, null, 2);
  const request = {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    temperature: 0.1,
    max_completion_tokens: 1600,
    response_format: { type: 'json_schema', json_schema: schema },
  };
  try {
    return await env.AI.run('@cf/zai-org/glm-4.7-flash', request);
  } catch {
    return env.AI.run('@cf/zai-org/glm-4.7-flash', {
      messages: request.messages,
      temperature: 0.1,
      max_completion_tokens: 1600,
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
      warning: 'A IA não respondeu corretamente; usamos a análise local por prazo e prioridade.',
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
