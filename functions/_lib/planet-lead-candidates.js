import {
  cleanPhone,
  cleanText,
  findDuplicateLead,
  historyEvent,
  nowIso,
  normalizeLead,
  readLeadDocument,
  upsertLead,
} from './planet-leads.js';
import { scoreCandidate } from './planet-lead-scoring.js';
import { appendNotification } from './planet-notifications.js';

export const CANDIDATES_STORAGE_KEY = 'planet-hub:planet-expansion-candidates:v1';
export const MAX_CANDIDATES = 2000;
export const MAX_IMPORT_ITEMS = 500;
export const MAX_CANDIDATE_BODY_BYTES = 256_000;

const ENRICHMENT_STATUSES = new Set(['pending', 'processing', 'completed', 'failed']);
const REVIEW_STATUSES = new Set(['pending', 'approved', 'rejected']);

const cleanUrl = (value) => {
  const url = cleanText(value, 1200);
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString().slice(0, 1200) : '';
  } catch {
    return '';
  }
};

const boundedScore = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));

export const normalizeEvidence = (item = {}) => ({
  id: cleanText(item.id, 120) || `evidence-${crypto.randomUUID()}`,
  type: cleanText(item.type, 60) || 'indicio',
  description: cleanText(item.description, 600),
  sourceUrl: cleanUrl(item.sourceUrl),
  confidence: boundedScore(item.confidence),
  createdAt: cleanText(item.createdAt, 40) || nowIso(),
});

export const normalizeCandidate = (item = {}) => {
  const createdAt = cleanText(item.createdAt, 40) || nowIso();
  const phone = cleanPhone(item.phone);
  const email = cleanText(item.email, 220).toLowerCase();
  const base = {
    id: cleanText(item.id, 120) || `candidate-${crypto.randomUUID()}`,
    tenantId: 'planet',
    source: cleanText(item.source, 120) || 'manual_import',
    sourceRecordId: cleanText(item.sourceRecordId, 180),
    sourceUrl: cleanUrl(item.sourceUrl),
    sourceName: cleanText(item.sourceName, 180) || 'Importação manual',
    name: cleanText(item.name, 180),
    company: cleanText(item.company, 180),
    phone,
    email,
    city: cleanText(item.city, 140),
    state: cleanText(item.state, 40).toUpperCase(),
    franchiseModel: cleanText(item.franchiseModel, 120),
    normalizedPhone: phone,
    normalizedEmail: email,
    evidences: (Array.isArray(item.evidences) ? item.evidences : [])
      .slice(0, 20)
      .map(normalizeEvidence)
      .filter((evidence) => evidence.description || evidence.sourceUrl),
    enrichmentStatus: ENRICHMENT_STATUSES.has(item.enrichmentStatus)
      ? item.enrichmentStatus
      : 'pending',
    reviewStatus: REVIEW_STATUSES.has(item.reviewStatus) ? item.reviewStatus : 'pending',
    reviewNotes: cleanText(item.reviewNotes, 1600),
    reviewedAt: cleanText(item.reviewedAt, 40),
    reviewedBy: cleanText(item.reviewedBy, 160),
    discardReason: cleanText(item.discardReason, 600),
    promotedLeadId: cleanText(item.promotedLeadId, 120),
    promotedAt: cleanText(item.promotedAt, 40),
    createdAt,
    updatedAt: cleanText(item.updatedAt, 40) || createdAt,
  };
  const scoring = scoreCandidate(base);
  return {
    ...base,
    dataQualityScore: scoring.dataQualityScore,
    planetFitScore: scoring.planetFitScore,
    intentScore: scoring.intentScore,
    confidenceScore: scoring.confidenceScore,
    finalScore: scoring.finalScore,
    scoreVersion: scoring.scoreVersion,
    scoreReasons: scoring.scoreReasons,
  };
};

export const readCandidateDocument = async (store) => {
  const stored = await store.get(CANDIDATES_STORAGE_KEY, { type: 'json' });
  if (!stored || !Array.isArray(stored.data)) {
    return { revision: null, updatedAt: null, data: [] };
  }
  return {
    revision: stored.revision || null,
    updatedAt: stored.updatedAt || null,
    data: stored.data.slice(0, MAX_CANDIDATES).map(normalizeCandidate),
  };
};

export const writeCandidateDocument = async (store, data) => {
  const document = {
    revision: crypto.randomUUID(),
    updatedAt: nowIso(),
    data: data.slice(0, MAX_CANDIDATES).map(normalizeCandidate),
  };
  await store.put(CANDIDATES_STORAGE_KEY, JSON.stringify(document));
  return document;
};

export const findDuplicateCandidate = (items, incoming) => {
  const candidates = Array.isArray(items) ? items : [];
  return candidates.find((candidate) => (
    incoming.sourceRecordId
    && candidate.sourceRecordId === incoming.sourceRecordId
    && candidate.source === incoming.source
  ) || (
    incoming.normalizedPhone
    && candidate.normalizedPhone === incoming.normalizedPhone
  ) || (
    incoming.normalizedEmail
    && candidate.normalizedEmail === incoming.normalizedEmail
  ) || (
    !incoming.normalizedPhone
    && !incoming.normalizedEmail
    && incoming.company
    && incoming.city
    && candidate.company.toLowerCase() === incoming.company.toLowerCase()
    && candidate.city.toLowerCase() === incoming.city.toLowerCase()
  ));
};

const candidateAsLeadProbe = (candidate) => normalizeLead({
  source: 'caca_lead',
  externalId: candidate.id,
  name: candidate.name,
  company: candidate.company,
  phone: candidate.phone,
  email: candidate.email,
  city: candidate.city,
  state: candidate.state,
});

const findCandidateLeadDuplicate = (leads, candidate) => findDuplicateLead(
  leads,
  candidateAsLeadProbe(candidate),
);

export const createCandidate = async (store, rawCandidate) => {
  const candidate = normalizeCandidate(rawCandidate);
  if (!candidate.name && !candidate.company) {
    const error = new Error('Informe o nome ou a empresa do candidato.');
    error.status = 400;
    throw error;
  }

  const [current, leadDocument] = await Promise.all([
    readCandidateDocument(store),
    readLeadDocument(store),
  ]);
  const duplicate = findDuplicateCandidate(current.data, candidate);
  if (duplicate) {
    return { candidate: duplicate, duplicate: true, duplicateType: 'candidate', revision: current.revision };
  }
  const leadDuplicate = findCandidateLeadDuplicate(leadDocument.data, candidate);
  if (leadDuplicate) {
    return {
      candidate,
      duplicate: true,
      duplicateType: 'lead',
      leadId: leadDuplicate.id,
      revision: current.revision,
    };
  }

  const timestamp = nowIso();
  const created = normalizeCandidate({
    ...candidate,
    id: `candidate-${crypto.randomUUID()}`,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  const document = await writeCandidateDocument(store, [created, ...current.data]);
  return { candidate: created, duplicate: false, revision: document.revision };
};

export const updateCandidate = async (store, id, changes = {}) => {
  const candidateId = cleanText(id, 120);
  const current = await readCandidateDocument(store);
  const existing = current.data.find((candidate) => candidate.id === candidateId);
  if (!existing) {
    const error = new Error('Candidato não encontrado.');
    error.status = 404;
    throw error;
  }

  const allowed = [
    'source', 'sourceRecordId', 'sourceUrl', 'sourceName', 'name', 'company',
    'phone', 'email', 'city', 'state', 'franchiseModel', 'evidences',
    'enrichmentStatus', 'reviewStatus', 'reviewNotes', 'reviewedBy', 'discardReason',
  ];
  const next = { ...existing };
  allowed.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(changes, field)) next[field] = changes[field];
  });

  if (Object.prototype.hasOwnProperty.call(changes, 'reviewStatus')) {
    if (!REVIEW_STATUSES.has(changes.reviewStatus)) {
      const error = new Error('Status de revisão inválido.');
      error.status = 400;
      throw error;
    }
    if (changes.reviewStatus === 'rejected' && !cleanText(changes.discardReason, 600)) {
      const error = new Error('Informe o motivo do descarte.');
      error.status = 400;
      throw error;
    }
    next.reviewedAt = nowIso();
    if (changes.reviewStatus !== 'rejected') next.discardReason = '';
  }

  next.id = existing.id;
  next.createdAt = existing.createdAt;
  next.promotedLeadId = existing.promotedLeadId;
  next.promotedAt = existing.promotedAt;
  next.updatedAt = nowIso();
  const candidate = normalizeCandidate(next);

  const identityFields = ['source', 'sourceRecordId', 'phone', 'email', 'company', 'city'];
  const identityChanged = identityFields.some((field) => Object.prototype.hasOwnProperty.call(changes, field));
  if (identityChanged) {
    const candidateDuplicate = findDuplicateCandidate(
      current.data.filter((item) => item.id !== candidateId),
      candidate,
    );
    if (candidateDuplicate) {
      const error = new Error('Os dados informados já pertencem a outro candidato.');
      error.status = 409;
      throw error;
    }

    const leadDocument = await readLeadDocument(store);
    const leadDuplicate = findCandidateLeadDuplicate(leadDocument.data, candidate);
    if (leadDuplicate && leadDuplicate.id !== existing.promotedLeadId) {
      const error = new Error('Os dados informados já pertencem a um lead do funil.');
      error.status = 409;
      throw error;
    }
  }

  const document = await writeCandidateDocument(
    store,
    current.data.map((item) => item.id === candidateId ? candidate : item),
  );
  return { candidate, revision: document.revision };
};

export const emitCandidateNotification = async (store, input) => {
  const { notification } = await appendNotification(store, {
    ...input,
    type: 'lead.alert',
  });
  return notification;
};

const promotionNotes = (candidate) => {
  const evidenceLines = candidate.evidences
    .slice(0, 4)
    .map((evidence) => `- ${evidence.description}`)
    .join('\n');
  return cleanText([
    `Candidato promovido pelo Caça Lead.`,
    `Score final: ${candidate.finalScore}/100.`,
    `Fonte: ${candidate.sourceName || candidate.source}.`,
    `Revisão humana: ${candidate.reviewedBy || 'usuário autenticado'}.`,
    `Modelo sugerido: ${candidate.franchiseModel || 'não informado'}.`,
    evidenceLines ? `Principais evidências:\n${evidenceLines}` : 'Principais evidências: não informadas.',
    candidate.reviewNotes ? `Notas da revisão: ${candidate.reviewNotes}` : '',
  ].filter(Boolean).join('\n'), 1600);
};

export const promoteCandidate = async (store, id) => {
  const candidateId = cleanText(id, 120);
  const current = await readCandidateDocument(store);
  const candidate = current.data.find((item) => item.id === candidateId);
  if (!candidate) {
    const error = new Error('Candidato não encontrado.');
    error.status = 404;
    throw error;
  }
  if (candidate.promotedLeadId) {
    return { candidate, leadId: candidate.promotedLeadId, duplicate: true, idempotent: true };
  }
  if (candidate.reviewStatus === 'rejected') {
    const error = new Error('Candidato rejeitado não pode ser promovido.');
    error.status = 409;
    throw error;
  }
  if (candidate.reviewStatus !== 'approved') {
    const error = new Error('A promoção exige aprovação humana explícita.');
    error.status = 409;
    throw error;
  }
  if (!candidate.phone && !candidate.email) {
    const error = new Error('O candidato precisa ter telefone ou e-mail para ser promovido.');
    error.status = 400;
    throw error;
  }

  const timestamp = nowIso();
  const summaryChanges = [
    `Score final: ${candidate.finalScore}`,
    `Fonte: ${candidate.sourceName || candidate.source}`,
    `Revisão: ${candidate.reviewedBy || 'usuário autenticado'}`,
    `Modelo: ${candidate.franchiseModel || 'não informado'}`,
    ...candidate.evidences.slice(0, 4).map((item) => `Evidência: ${item.description}`),
  ];
  const promotionHistory = historyEvent(
    'created',
    'Lead promovido pelo Caça Lead',
    summaryChanges,
    timestamp,
  );
  const leadResult = await upsertLead(store, {
    source: 'caca_lead',
    externalId: candidate.id,
    name: candidate.name,
    company: candidate.company,
    phone: candidate.phone,
    email: candidate.email,
    city: candidate.city,
    state: candidate.state,
    origin: candidate.sourceName,
    conversion: 'Caça Lead',
    notes: promotionNotes(candidate),
  }, {
    mergeExternalOnly: true,
    preserveIdentityOnDuplicate: true,
    preserveStatus: true,
    preserveNotes: true,
    preserveWhatsapp: true,
    preserveViewedAt: true,
    preserveLastActionAt: true,
    initialHistory: [promotionHistory],
    appendHistory: [promotionHistory],
    createdTitle: 'Lead promovido pelo Caça Lead',
  });

  const promoted = normalizeCandidate({
    ...candidate,
    promotedLeadId: leadResult.lead.id,
    promotedAt: timestamp,
    updatedAt: timestamp,
  });
  const document = await writeCandidateDocument(
    store,
    current.data.map((item) => item.id === candidate.id ? promoted : item),
  );

  let notification = null;
  try {
    notification = await emitCandidateNotification(store, {
      priority: 'high',
      title: 'Candidato promovido para Leads',
      summary: `${promoted.name || promoted.company} · Score ${promoted.finalScore}`,
      leadId: leadResult.lead.id,
      leadName: leadResult.lead.name,
      changes: ['Caça Lead', 'promoção explícita'],
    });
  } catch {
    notification = null;
  }

  return {
    candidate: promoted,
    lead: leadResult.lead,
    leadId: leadResult.lead.id,
    duplicate: leadResult.duplicate,
    idempotent: false,
    revision: document.revision,
    notification,
  };
};

export const importCandidates = async (store, rawItems) => {
  const items = Array.isArray(rawItems) ? rawItems.slice(0, MAX_IMPORT_ITEMS) : [];
  const report = {
    linesRead: Array.isArray(rawItems) ? rawItems.length : 0,
    candidatesCreated: 0,
    duplicates: 0,
    invalid: 0,
    withoutContact: 0,
    errors: [],
  };
  if (!items.length) return { report, candidates: [], revision: null };

  const [current, leadDocument] = await Promise.all([
    readCandidateDocument(store),
    readLeadDocument(store),
  ]);
  const working = [...current.data];
  const created = [];

  items.forEach((rawItem, index) => {
    try {
      const candidate = normalizeCandidate(rawItem);
      if (!candidate.name && !candidate.company) {
        report.invalid += 1;
        report.errors.push({ line: index + 1, error: 'Nome ou empresa não informado.' });
        return;
      }
      if (!candidate.phone && !candidate.email) report.withoutContact += 1;
      const duplicate = findDuplicateCandidate(working, candidate);
      const leadDuplicate = findCandidateLeadDuplicate(leadDocument.data, candidate);
      if (duplicate || leadDuplicate) {
        report.duplicates += 1;
        return;
      }
      const timestamp = nowIso();
      const normalized = normalizeCandidate({
        ...candidate,
        id: `candidate-${crypto.randomUUID()}`,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
      working.unshift(normalized);
      created.push(normalized);
      report.candidatesCreated += 1;
    } catch (error) {
      report.invalid += 1;
      report.errors.push({
        line: index + 1,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  const document = created.length ? await writeCandidateDocument(store, working) : current;
  try {
    await emitCandidateNotification(store, {
      priority: report.invalid || report.errors.length ? 'medium' : 'low',
      title: report.invalid || report.errors.length ? 'Importação com erros' : 'Importação concluída',
      summary: `${report.candidatesCreated} criados · ${report.duplicates} duplicados · ${report.invalid} inválidos`,
      changes: ['Caça Lead', 'importação'],
    });
  } catch {
    // A importação continua válida mesmo se a notificação falhar.
  }

  return { report, candidates: created, revision: document.revision || null };
};
