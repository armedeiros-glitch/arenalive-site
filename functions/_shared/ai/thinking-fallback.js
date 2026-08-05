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

const readItemField = (item, snake, camel) => clean(item?.[snake] ?? item?.[camel]);

export const buildThinkingFallback = (payload = {}) => {
  const context = payload?.context || {};
  const item = selectedItemFrom(context);
  const title = clean(item?.title, 240);
  const blocker = readItemField(item, 'blocker_reason', 'blockerReason')
    || clean(context?.decision_context?.attention_reason);
  const dependsOn = readItemField(item, 'depends_on', 'dependsOn');
  const nextAction = readItemField(item, 'next_action', 'nextAction')
    || clean(context?.decision_context?.next_action);
  const responsible = clean(item?.responsible, 180);
  const lastReading = item?.last_reading || item?.lastReading || null;
  const lastExcerpt = clean(lastReading?.excerpt, 420);

  if (!title && !blocker && !dependsOn && !nextAction && !responsible && !lastExcerpt) return '';

  const parts = [];
  if (title) parts.push(`O item em foco é “${title}”.`);

  if (blocker) {
    parts.push(`O bloqueio identificado é: ${sentence(blocker)}`);
  } else if (dependsOn) {
    parts.push(`Ele depende de ${sentence(dependsOn)}`);
  } else if (lastExcerpt) {
    parts.push(`O último retorno registrado foi: ${sentence(lastExcerpt)}`);
  }

  let move = nextAction;
  if (!move && dependsOn) {
    move = `confirmar com ${dependsOn} o que falta, quem executará e qual é o novo prazo`;
  }
  if (!move && responsible) {
    move = `abrir o item e confirmar com ${responsible} o que já foi feito, o que falta e a próxima data de entrega`;
  }
  if (!move) {
    move = 'abrir o item, revisar a última interação e registrar a próxima ação, o responsável e o prazo';
  }

  parts.push(`Próximo passo: ${sentence(move)}`);
  return parts.join('\n\n').slice(0, 1800);
};
