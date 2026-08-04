const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });
const cleanText = (value, max = 2000) => String(value ?? '').trim().slice(0, max);
const cleanDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : '';

const ORIGINS = new Set(['direction', 'meeting', 'whatsapp', 'internal', 'other']);
const PRIORITIES = new Set(['urgent', 'high', 'normal', 'low']);
const STATUSES = new Set(['new', 'in_progress', 'waiting', 'completed', 'cancelled']);

const stripAccents = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const iso = (date) => date.toISOString().slice(0, 10);
const parseToday = (value) => {
  const cleaned = cleanDate(value);
  const date = cleaned ? new Date(`${cleaned}T12:00:00Z`) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const addDays = (date, amount) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + amount);
  return next;
};

const endOfMonth = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 12));

const weekdayDate = (today, target) => {
  const current = today.getUTCDay();
  let distance = (target - current + 7) % 7;
  if (distance === 0) distance = 7;
  return addDays(today, distance);
};

const parseRuleDate = (normalized, today) => {
  if (/\bhoje\b/.test(normalized)) return iso(today);
  if (/\bamanha\b/.test(normalized)) return iso(addDays(today, 1));
  if (/fim do mes|final do mes|ainda este mes|ainda nesse mes/.test(normalized)) return iso(endOfMonth(today));

  const weekdays = {
    domingo: 0,
    segunda: 1,
    terca: 2,
    quarta: 3,
    quinta: 4,
    sexta: 5,
    sabado: 6,
  };
  const weekday = Object.entries(weekdays).find(([name]) => new RegExp(`(?:ate|pra|para|na)\\s+(?:a\\s+)?${name}`).test(normalized));
  if (weekday) return iso(weekdayDate(today, weekday[1]));

  const explicit = normalized.match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/);
  if (explicit) {
    const year = explicit[3]
      ? Number(explicit[3].length === 2 ? `20${explicit[3]}` : explicit[3])
      : today.getUTCFullYear();
    const month = Number(explicit[2]);
    const day = Number(explicit[1]);
    const parsed = new Date(Date.UTC(year, month - 1, day, 12));
    if (parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day) return iso(parsed);
  }

  return '';
};

const titleFromText = (text) => {
  let title = String(text || '').split(/[.!?\n]/)[0].trim();
  title = title
    .replace(/^(a\s+)?(direcao|diretoria)\s+(pediu|solicitou|quer|precisa)\s+(pra|para)?\s*/i, '')
    .replace(/^(preciso|precisamos|temos que|tem que|faz|fazer|montar|criar)\s+/i, '')
    .trim();
  if (!title) title = 'Nova demanda interna';
  return title.charAt(0).toUpperCase() + title.slice(1, 180);
};

const categoryFromText = (normalized) => {
  if (/campanh|promocao|acao comercial/.test(normalized)) return 'Campanha';
  if (/video|reels|filmagem|gravacao|editar/.test(normalized)) return 'Vídeo';
  if (/arte|peca|banner|card|criativ|layout|design/.test(normalized)) return 'Design';
  if (/inaugur|implantacao|nova unidade/.test(normalized)) return 'Inauguração';
  if (/evento|feira|ativacao/.test(normalized)) return 'Evento';
  if (/texto|legenda|conteudo|publicacao|post/.test(normalized)) return 'Conteúdo';
  if (/relatorio|apresentacao|documento|planilha/.test(normalized)) return 'Documento';
  return 'Demanda interna';
};

const responsibleFromText = (text) => {
  const patterns = [
    /(?:respons[aá]vel(?:\s+vai\s+ser|\s*[ée:]?)|fica\s+com|passa\s+para)\s+([A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][\p{L}'-]+(?:\s+[A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][\p{L}'-]+)?)/u,
    /(?:a|o)\s+([A-ZÁÀÃÂÉÊÍÓÔÕÚÇ][\p{L}'-]+)\s+(?:pode|vai|fica|faz|toca|cuida)/u,
  ];
  for (const pattern of patterns) {
    const match = String(text || '').match(pattern);
    if (match?.[1]) return cleanText(match[1], 160);
  }
  return '';
};

const fallbackSteps = (category) => {
  const map = {
    Campanha: ['Definir objetivo e público', 'Definir conceito e materiais', 'Produzir as peças', 'Aprovar e distribuir'],
    Vídeo: ['Definir roteiro e formato', 'Separar referências e materiais', 'Produzir ou gravar', 'Editar e aprovar'],
    Design: ['Confirmar medidas e conteúdo', 'Criar primeira versão', 'Revisar e aprovar', 'Exportar arquivos finais'],
    Inauguração: ['Confirmar data e escopo', 'Definir responsáveis', 'Produzir materiais', 'Fazer conferência final'],
    Evento: ['Definir objetivo e estrutura', 'Confirmar fornecedores e materiais', 'Divulgar a ação', 'Executar e registrar'],
    Conteúdo: ['Definir mensagem e formato', 'Produzir conteúdo', 'Revisar e aprovar', 'Publicar ou distribuir'],
    Documento: ['Reunir informações', 'Montar primeira versão', 'Revisar e aprovar', 'Finalizar e compartilhar'],
    'Demanda interna': ['Definir entrega esperada', 'Confirmar responsável e prazo', 'Executar a demanda', 'Revisar e concluir'],
  };
  return (map[category] || map['Demanda interna']).map((text) => ({ text, done: false }));
};

const fallbackOrganize = (text, todayValue) => {
  const normalized = stripAccents(text);
  const today = parseToday(todayValue);
  const origin = /direcao|diretoria/.test(normalized)
    ? 'direction'
    : /reuniao|alinhamento/.test(normalized)
      ? 'meeting'
      : /whatsapp|zap/.test(normalized)
        ? 'whatsapp'
        : /intern[ao]|equipe/.test(normalized)
          ? 'internal'
          : 'other';
  const priority = /urgent|pra ontem|imediat|hoje/.test(normalized)
    ? 'urgent'
    : /prioridade alta|muito importante|importante/.test(normalized)
      ? 'high'
      : /sem pressa|quando der|baixa prioridade/.test(normalized)
        ? 'low'
        : 'normal';
  const category = categoryFromText(normalized);
  const responsible = responsibleFromText(text);
  const dueDate = parseRuleDate(normalized, today);
  const warnings = [];
  if (!responsible) warnings.push('Responsável não identificado.');
  if (!dueDate) warnings.push('Prazo não identificado.');

  return {
    mode: 'rules',
    data: {
      title: titleFromText(text),
      description: cleanText(text, 1600),
      origin,
      requestedBy: origin === 'direction' ? 'Direção' : '',
      responsible,
      priority,
      status: 'new',
      dueDate,
      category,
      notes: '',
      steps: fallbackSteps(category),
    },
    warnings,
  };
};

const normalizeAiResult = (raw, originalText, todayValue) => {
  const fallback = fallbackOrganize(originalText, todayValue);
  const source = raw && typeof raw === 'object' ? raw : {};
  const steps = Array.isArray(source.steps)
    ? source.steps.slice(0, 8).map((item) => ({
      text: cleanText(typeof item === 'string' ? item : item?.text, 240),
      done: false,
    })).filter((item) => item.text)
    : fallback.data.steps;
  const warnings = Array.isArray(source.warnings)
    ? source.warnings.slice(0, 8).map((item) => cleanText(item, 240)).filter(Boolean)
    : [];

  const result = {
    title: cleanText(source.title, 220) || fallback.data.title,
    description: cleanText(source.description, 1600) || fallback.data.description,
    origin: ORIGINS.has(source.origin) ? source.origin : fallback.data.origin,
    requestedBy: cleanText(source.requestedBy, 160),
    responsible: cleanText(source.responsible, 160),
    priority: PRIORITIES.has(source.priority) ? source.priority : 'normal',
    status: STATUSES.has(source.status) ? source.status : 'new',
    dueDate: cleanDate(source.dueDate),
    category: cleanText(source.category, 120) || fallback.data.category,
    notes: cleanText(source.notes, 1800),
    steps: steps.length ? steps : fallback.data.steps,
  };

  if (!result.responsible && !warnings.some((item) => /respons/i.test(item))) warnings.push('Responsável não identificado.');
  if (!result.dueDate && !warnings.some((item) => /prazo|data/i.test(item))) warnings.push('Prazo não identificado.');
  return { mode: 'ai', data: result, warnings };
};

const extractAiObject = (response) => {
  if (response?.response && typeof response.response === 'object') return response.response;
  const value = response?.response
    ?? response?.choices?.[0]?.message?.content
    ?? response?.result?.response
    ?? response;
  if (value && typeof value === 'object') return value;
  const text = String(value || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('A IA não retornou um cadastro estruturado.');
  return JSON.parse(text.slice(start, end + 1));
};

const aiSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    origin: { type: 'string', enum: ['direction', 'meeting', 'whatsapp', 'internal', 'other'] },
    requestedBy: { type: 'string' },
    responsible: { type: 'string' },
    priority: { type: 'string', enum: ['urgent', 'high', 'normal', 'low'] },
    status: { type: 'string', enum: ['new', 'in_progress', 'waiting'] },
    dueDate: { type: 'string' },
    category: { type: 'string' },
    notes: { type: 'string' },
    steps: {
      type: 'array',
      items: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'description', 'origin', 'requestedBy', 'responsible', 'priority', 'status', 'dueDate', 'category', 'notes', 'steps', 'warnings'],
};

const runAi = async (env, text, today) => {
  const system = `Você organiza demandas internas do Marketing da Planet Chocolate. Analise português brasileiro informal e devolva somente o cadastro estruturado. Hoje é ${today}, fuso America/Sao_Paulo. Não invente nomes, prazos, aprovações ou fatos. Resolva datas relativas apenas quando forem claras: hoje, amanhã, até um dia da semana e até o fim deste mês. Se algo importante não estiver explícito, deixe o campo vazio e registre em warnings. Origem: direction para direção/diretoria; meeting para reunião; whatsapp para WhatsApp; internal para equipe/operação interna; other para outras origens. Prioridade padrão normal. Status padrão new. Gere no máximo 5 etapas curtas e práticas, sem inventar orçamento, fornecedor ou canal.`;
  const request = {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: text },
    ],
    temperature: 0.1,
    max_completion_tokens: 900,
    response_format: { type: 'json_schema', json_schema: aiSchema },
  };

  try {
    return await env.AI.run('@cf/zai-org/glm-4.7-flash', request);
  } catch (firstError) {
    return env.AI.run('@cf/zai-org/glm-4.7-flash', {
      messages: request.messages,
      temperature: 0.1,
      max_completion_tokens: 900,
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

  const text = cleanText(payload?.text, 4000);
  const today = cleanDate(payload?.today) || new Date().toISOString().slice(0, 10);
  if (text.length < 8) return json({ error: 'Descreva um pouco melhor a demanda.' }, 400);

  const fallback = fallbackOrganize(text, today);
  if (!env.AI) return json({ ...fallback, aiConfigured: false });

  try {
    const response = await runAi(env, text, today);
    const result = normalizeAiResult(extractAiObject(response), text, today);
    return json({ ...result, aiConfigured: true, model: '@cf/zai-org/glm-4.7-flash' });
  } catch (error) {
    return json({
      ...fallback,
      aiConfigured: true,
      aiFailed: true,
      warning: 'A IA não respondeu corretamente; usamos o organizador local.',
      details: error instanceof Error ? error.message : String(error),
    });
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
