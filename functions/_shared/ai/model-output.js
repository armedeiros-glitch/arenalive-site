const MAX_CONTAINER_DEPTH = 5;

const INTERNAL_DRAFT_PATTERN = /(?:response\s+internal\s+monologue|internal\s+monologue|\bdraft\s*\d*\b|\brefinement\b|\bformulate\s+the\s+response\b|^\s*[-*•#]*\s*(?:goal|blocker|last\s+action|current\s+state|role|data\s+sources?|interactions?\s+analysis|current\s+date|correction\s+on\s+status|crucial\s+detail|interpretation|the\s+blocker)\s*:|\b(?:i\s+must|let(?:'|’)s\s+look|looking\s+closer|the\s+user\s+is\s+asking)\b)/im;
const PROVIDER_ENVELOPE_PATTERN = /(?:["']?(?:logprobs|finish_reason|prompt_tokens|completion_tokens|token_ids|service_tier|system_fingerprint)["']?\s*:|["']choices["']\s*:\s*\[|["']usage["']\s*:\s*\{)/i;
const TRUNCATED_REASONS = new Set(['length', 'max_tokens', 'max_output_tokens']);

const textFromContent = (value) => {
  if (typeof value === 'string') return value.trim();
  if (!Array.isArray(value)) return '';
  return value
    .map((part) => {
      if (typeof part === 'string') return part;
      if (!part || typeof part !== 'object') return '';
      if (typeof part.text === 'string') return part.text;
      if (typeof part.content === 'string') return part.content;
      return '';
    })
    .filter(Boolean)
    .join('\n')
    .trim();
};

const parseEmbeddedEnvelope = (value) => {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text || (!text.startsWith('{') && !text.startsWith('['))) return value;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' ? parsed : value;
  } catch {
    return value;
  }
};

const knownContainers = (value) => {
  if (!value || typeof value !== 'object') return [];
  return [value.response, value.result, value.data, value.output]
    .map(parseEmbeddedEnvelope)
    .filter((entry) => entry && typeof entry === 'object');
};

export const extractModelText = (result) => {
  const initial = parseEmbeddedEnvelope(result);
  if (typeof initial === 'string') return initial.trim();
  if (!initial || typeof initial !== 'object') return '';

  const queue = [{ value: initial, depth: 0 }];
  const visited = new Set();

  while (queue.length) {
    const { value, depth } = queue.shift();
    if (!value || typeof value !== 'object' || visited.has(value)) continue;
    visited.add(value);

    const choice = Array.isArray(value.choices) ? value.choices[0] : null;
    const choiceText = textFromContent(choice?.message?.content)
      || textFromContent(choice?.delta?.content)
      || textFromContent(choice?.text);
    if (choiceText) return choiceText;

    const directText = textFromContent(value.message?.content)
      || textFromContent(value.output_text)
      || textFromContent(value.text)
      || textFromContent(value.content);
    if (directText) return directText;

    const responseText = textFromContent(value.response);
    if (responseText) return responseText;

    if (depth < MAX_CONTAINER_DEPTH) {
      knownContainers(value).forEach((entry) => queue.push({ value: entry, depth: depth + 1 }));
    }
  }

  return '';
};

export const extractFinishReason = (result) => {
  const initial = parseEmbeddedEnvelope(result);
  if (!initial || typeof initial !== 'object') return '';

  const queue = [{ value: initial, depth: 0 }];
  const visited = new Set();

  while (queue.length) {
    const { value, depth } = queue.shift();
    if (!value || typeof value !== 'object' || visited.has(value)) continue;
    visited.add(value);

    const choice = Array.isArray(value.choices) ? value.choices[0] : null;
    const reason = choice?.finish_reason ?? value.finish_reason ?? choice?.stop_reason ?? value.stop_reason;
    if (reason != null && String(reason).trim()) return String(reason).trim().toLowerCase();

    if (depth < MAX_CONTAINER_DEPTH) {
      knownContainers(value).forEach((entry) => queue.push({ value: entry, depth: depth + 1 }));
    }
  }

  return '';
};

export const cleanModelText = (value) => {
  let text = String(value || '').trim();
  if (!text) return '';

  if ((text.match(/\n/g) || []).length < 2 && /\\n/.test(text)) {
    text = text.replace(/\\n/g, '\n').replace(/\\t/g, '\t');
  }

  text = text.replace(/^```(?:markdown|text|md|json)?\s*/i, '').replace(/```\s*$/i, '').trim();

  const preferredMarker = /\*{0,2}\s*(?:refinement(?:\s*\([^)]*\))?|final answer|resposta final)\s*:?[\s*]*/gi;
  let preferredEnd = -1;
  for (const match of text.matchAll(preferredMarker)) preferredEnd = match.index + match[0].length;
  if (preferredEnd >= 0) text = text.slice(preferredEnd);

  return text
    .replace(/^\s*response\s+internal\s+monologue\/trial\)?\s*:?[\s*]*/i, '')
    .replace(/^\s*(?:analysis|reasoning|chain of thought)\s*:?[\s*]*/i, '')
    .replace(/^\*{1,2}|\*{1,2}$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

export const inspectModelOutput = (result, options = {}) => {
  const extracted = extractModelText(result);
  const text = cleanModelText(extracted);
  const finishReason = String(options.finishReason || extractFinishReason(result) || '').trim().toLowerCase();
  const reasons = [];

  if (!text) reasons.push('empty');
  if (TRUNCATED_REASONS.has(finishReason)) reasons.push('truncated');
  if (PROVIDER_ENVELOPE_PATTERN.test(text)) reasons.push('provider-envelope');
  if (INTERNAL_DRAFT_PATTERN.test(text)) reasons.push('internal-draft');
  if (options.forceUnsafe) reasons.push('upstream-unsafe');

  return Object.freeze({
    text,
    finishReason,
    unsafe: reasons.length > 0,
    reasons: Object.freeze([...new Set(reasons)]),
  });
};
