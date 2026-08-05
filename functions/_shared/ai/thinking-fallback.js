const clean = (value, max = 700) => String(value ?? '')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, max);

const sentence = (value) => {
  const text = clean(value);
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : `${text}.`;
};

const selectedItemFrom = (context = {}) => context.selected_item
  || context.runtime_context?.focus?.item
  || null;

const ticketReferenceFrom = (payload = {}, context = {}) => context.ticket_reference
  || payload.ticket_reference
  || null;

const readItemField = (item, snake, camel) => clean(item?.[snake] ?? item?.[camel]);

const normalizeName = (value) => clean(value, 180).toLocaleLowerCase('pt-BR');

const GENERIC_DELAY_PATTERN = /(?:\b(?:prazo|item|chamado|tarefa)\b.*\b(?:atrasad[oa]|vencid[oa])\b|\batrasad[oa]\s+h[aá]\s+\d+)/i;
const GENERIC_MOVE_PATTERN = /(?:\babrir\b.*\b(?:definir|registrar|revisar)\b.*\bpr[oó]xim[oa]\b|\bdefinir\s+(?:o\s+)?pr[oó]ximo\s+passo\b)/i;
const COMMITMENT_PATTERN = /\b(?:combinad[oa]|agendad[oa]|marcad[oa]|vamos|podemos|ficou|realizar|fazer|iniciar|começar|executar)\b/i;
const COMPLETION_PATTERN = /\b(?:foi\s+(?:realizad[oa]|feit[oa]|conclu[ií]d[oa]|executad[oa]|publicad[oa])|j[aá]\s+(?:foi|fiz|fizemos|realizamos|conclu[ií]mos|executamos|publicamos)|finalizad[oa]|resultado\s+(?:registrado|enviado|publicado))\b/i;
const DATE_CUE_PATTERN = /((?:na\s+)?(?:segunda|terça|terca|quarta|quinta|sexta)(?:-feira)?(?:\s*,?\s*(?:dia\s*)?\d{1,2}(?:\/\d{1,2})?)?|(?:no\s+)?dia\s+\d{1,2}(?:\/\d{1,2})?|pr[oó]xima\s+semana|semana\s+(?:que\s+vem|seguinte))/i;

const usefulInteractions = (reference) => (Array.isArray(reference?.interactions)
  ? reference.interactions
  : [])
  .map((entry) => ({
    author: clean(entry?.author, 180),
    createdAt: clean(entry?.created_at, 40),
    text: clean(entry?.text, 1200),
  }))
  .filter((entry) => entry.text);

const commitmentFrom = (interactions) => {
  for (let index = 0; index < interactions.length; index += 1) {
    const entry = interactions[index];
    const dateCue = entry.text.match(DATE_CUE_PATTERN)?.[1] || '';
    if (!dateCue || !COMMITMENT_PATTERN.test(entry.text)) continue;

    const newerEntries = interactions.slice(0, index);
    const confirmedAfter = newerEntries.some((candidate) => COMPLETION_PATTERN.test(candidate.text));
    return {
      ...entry,
      dateCue: clean(dateCue, 120),
      confirmedAfter,
    };
  }
  return null;
};

const involvedPeople = (interactions, responsible) => {
  const responsibleKey = normalizeName(responsible);
  const names = [];

  interactions.forEach((entry) => {
    const name = clean(entry.author, 180);
    if (!name || normalizeName(name) === responsibleKey) return;
    if (names.some((existing) => normalizeName(existing) === normalizeName(name))) return;
    names.push(name);
  });

  if (names.length === 0 && responsible) names.push(responsible);
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} e ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} e ${names.at(-1)}`;
};

const isGenericDelay = (value) => GENERIC_DELAY_PATTERN.test(clean(value));
const isGenericMove = (value) => GENERIC_MOVE_PATTERN.test(clean(value));

export const buildThinkingFallback = (payload = {}) => {
  const context = payload?.context || {};
  const item = selectedItemFrom(context);
  const ticketReference = ticketReferenceFrom(payload, context);
  const interactions = usefulInteractions(ticketReference);
  const title = clean(item?.title || ticketReference?.title, 240);
  const rawBlocker = readItemField(item, 'blocker_reason', 'blockerReason')
    || clean(context?.decision_context?.attention_reason);
  const blocker = isGenericDelay(rawBlocker) ? '' : rawBlocker;
  const dependsOn = readItemField(item, 'depends_on', 'dependsOn');
  const rawNextAction = readItemField(item, 'next_action', 'nextAction')
    || clean(context?.decision_context?.next_action);
  const nextAction = isGenericMove(rawNextAction) ? '' : rawNextAction;
  const responsible = clean(item?.responsible || ticketReference?.responsible, 180);
  const lastReading = item?.last_reading || item?.lastReading || null;
  const lastExcerpt = clean(lastReading?.excerpt, 420);
  const commitment = commitmentFrom(interactions);
  const contacts = involvedPeople(interactions, responsible);

  if (!title && !blocker && !dependsOn && !nextAction && !responsible && !lastExcerpt && interactions.length === 0) {
    return '';
  }

  const parts = [];
  if (title) parts.push(`Para destravar “${title}”:`);

  if (commitment && !commitment.confirmedAfter) {
    const author = commitment.author ? `${commitment.author} registrou que ` : '';
    parts.push(`O atraso é consequência, não o bloqueio real. O histórico mostra que ${author}a ação ficou combinada para ${commitment.dateCue}, mas não há registro posterior confirmando o resultado.`);

    const contactTarget = contacts || responsible || 'as pessoas envolvidas';
    parts.push(`Próximo passo: confirmar com ${contactTarget} se a ação aconteceu. Se aconteceu, registrar o resultado e concluir o chamado; se não, definir uma nova data e quem executará.`);
    return parts.join('\n\n').slice(0, 1800);
  }

  if (blocker) {
    parts.push(`O bloqueio real é: ${sentence(blocker)}`);
  } else if (dependsOn) {
    parts.push(`O chamado depende de ${sentence(dependsOn)}`);
  } else if (lastExcerpt) {
    parts.push(`O último retorno registrado foi: ${sentence(lastExcerpt)}`);
  } else if (interactions[0]?.text) {
    parts.push(`O último retorno registrado foi: ${sentence(interactions[0].text)}`);
  } else if (rawBlocker && isGenericDelay(rawBlocker)) {
    parts.push('O atraso sinaliza que o chamado perdeu o próximo responsável ou a próxima data, mas não explica sozinho o bloqueio.');
  }

  let move = nextAction;
  if (!move && dependsOn) {
    move = `confirmar ${dependsOn}, definir quem responde e registrar uma nova data`;
  }
  if (!move && contacts) {
    move = `confirmar com ${contacts} o que foi executado e registrar o desfecho; se ainda não aconteceu, definir nova data e responsável`;
  }
  if (!move && responsible) {
    move = `revisar com ${responsible} a última interação e registrar uma ação concreta, com responsável, data e critério de conclusão`;
  }
  if (!move) {
    move = 'revisar a última interação e registrar uma ação concreta, com responsável, data e critério de conclusão';
  }

  parts.push(`Próximo passo: ${sentence(move)}`);
  return parts.join('\n\n').slice(0, 1800);
};
