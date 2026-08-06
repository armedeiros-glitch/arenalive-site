import { cleanText } from './planet-leads.js';

export const SCORE_VERSION = 'planet-fit-v1';
export const SCORE_CONFIG = Object.freeze({
  weights: Object.freeze({
    planetFitScore: 0.30,
    intentScore: 0.25,
    dataQualityScore: 0.20,
    confidenceScore: 0.15,
    priorityScore: 0.10,
  }),
  priorityStates: Object.freeze(['SC', 'PR', 'SP', 'RJ', 'MG', 'GO', 'DF']),
  priorityCities: Object.freeze([
    'joinville', 'curitiba', 'florianopolis', 'sao paulo', 'rio de janeiro',
    'belo horizonte', 'brasilia', 'goiania', 'campinas', 'blumenau',
  ]),
  priorityModels: Object.freeze(['loja', 'quiosque', 'carrinho smart', 'shopping']),
  fitKeywords: Object.freeze([
    'franquia', 'varejo', 'alimentacao', 'alimentação', 'shopping', 'chocolate',
    'cafeteria', 'sorvete', 'acai', 'açaí', 'investidor', 'empreendedor',
  ]),
  intentKeywords: Object.freeze([
    'interesse', 'investir', 'investimento', 'abrir', 'expansao', 'expansão',
    'franquia', 'novo negocio', 'novo negócio', 'oportunidade', 'cotacao', 'cotação',
  ]),
});

const clamp = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
const normalizeSearch = (value) => cleanText(value, 2000)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const evidenceText = (candidate) => (Array.isArray(candidate?.evidences) ? candidate.evidences : [])
  .map((item) => `${item?.type || ''} ${item?.description || ''}`)
  .join(' ');

const keywordHits = (text, keywords) => keywords.filter((keyword) => text.includes(normalizeSearch(keyword)));

const qualityScore = (candidate) => {
  let score = 0;
  if (candidate.name) score += 12;
  if (candidate.company) score += 12;
  if (candidate.phone) score += 24;
  if (candidate.email) score += 24;
  if (candidate.city) score += 8;
  if (candidate.state) score += 6;
  if (candidate.sourceUrl) score += 6;
  if (Array.isArray(candidate.evidences) && candidate.evidences.length) score += 8;
  return clamp(score);
};

const fitScore = (candidate, text) => {
  const hits = keywordHits(text, SCORE_CONFIG.fitKeywords);
  let score = 25 + Math.min(50, hits.length * 10);
  if (candidate.franchiseModel) score += 15;
  if (candidate.company) score += 10;
  return { score: clamp(score), hits };
};

const intentScore = (candidate, text) => {
  const hits = keywordHits(text, SCORE_CONFIG.intentKeywords);
  let score = Math.min(80, hits.length * 16);
  if (candidate.sourceRecordId) score += 8;
  if (candidate.reviewNotes) score += 6;
  if (candidate.sourceName && normalizeSearch(candidate.sourceName).includes('indic')) score += 12;
  return { score: clamp(score), hits };
};

const confidenceScore = (candidate) => {
  const evidences = Array.isArray(candidate.evidences) ? candidate.evidences : [];
  const evidenceConfidence = evidences.length
    ? evidences.reduce((sum, item) => sum + clamp(item?.confidence), 0) / evidences.length
    : 0;
  let score = evidenceConfidence * 0.65;
  if (candidate.sourceRecordId) score += 10;
  if (candidate.sourceUrl) score += 10;
  if (candidate.phone || candidate.email) score += 15;
  return clamp(score);
};

const priorityScore = (candidate) => {
  const city = normalizeSearch(candidate.city);
  const state = cleanText(candidate.state, 20).toUpperCase();
  const model = normalizeSearch(candidate.franchiseModel);
  let score = 0;
  if (SCORE_CONFIG.priorityStates.includes(state)) score += 35;
  if (SCORE_CONFIG.priorityCities.includes(city)) score += 35;
  if (SCORE_CONFIG.priorityModels.some((item) => model.includes(normalizeSearch(item)))) score += 30;
  return clamp(score);
};

export const scoreCandidate = (candidate = {}) => {
  const text = normalizeSearch([
    candidate.name,
    candidate.company,
    candidate.franchiseModel,
    candidate.sourceName,
    candidate.reviewNotes,
    evidenceText(candidate),
  ].filter(Boolean).join(' '));

  const dataQualityScore = qualityScore(candidate);
  const fit = fitScore(candidate, text);
  const intent = intentScore(candidate, text);
  const confidenceScoreValue = confidenceScore(candidate);
  const priorityScoreValue = priorityScore(candidate);
  const finalScore = clamp(
    fit.score * SCORE_CONFIG.weights.planetFitScore
    + intent.score * SCORE_CONFIG.weights.intentScore
    + dataQualityScore * SCORE_CONFIG.weights.dataQualityScore
    + confidenceScoreValue * SCORE_CONFIG.weights.confidenceScore
    + priorityScoreValue * SCORE_CONFIG.weights.priorityScore,
  );

  const reasons = [];
  if (fit.hits.length) reasons.push(`Positivo: aderência identificada por ${fit.hits.slice(0, 4).join(', ')}.`);
  if (intent.hits.length) reasons.push(`Positivo: sinais de intenção em ${intent.hits.slice(0, 4).join(', ')}.`);
  if (priorityScoreValue >= 60) reasons.push('Positivo: praça ou modelo está entre as prioridades iniciais.');
  if (!candidate.phone) reasons.push('Ausente: telefone não informado.');
  if (!candidate.email) reasons.push('Ausente: e-mail não informado.');
  if (!candidate.city || !candidate.state) reasons.push('Ausente: localização incompleta.');
  if (!Array.isArray(candidate.evidences) || !candidate.evidences.length) reasons.push('Risco: nenhuma evidência estruturada foi anexada.');
  if (confidenceScoreValue < 45) reasons.push('Risco: confiança dos dados ainda é baixa.');
  if (!intent.hits.length) reasons.push('Risco: não há sinal claro de momento ou intenção.');

  return {
    dataQualityScore,
    planetFitScore: fit.score,
    intentScore: intent.score,
    confidenceScore: confidenceScoreValue,
    priorityScore: priorityScoreValue,
    finalScore,
    scoreVersion: SCORE_VERSION,
    scoreReasons: reasons.slice(0, 20),
  };
};
