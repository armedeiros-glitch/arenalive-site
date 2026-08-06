import { importCandidates } from './planet-lead-candidates.js';
import { nowIso } from './planet-leads.js';
import {
  googlePlaceToCandidate,
  searchGooglePlaces,
} from './planet-lead-hunt-google-places.js';

export const LEAD_HUNT_STORAGE_KEY = 'planet-hub:planet-lead-hunt-runs:v1';
export const DEFAULT_HUNT_LOCATIONS = Object.freeze([
  Object.freeze({ city: 'Joinville', state: 'SC' }),
]);
export const DEFAULT_HUNT_SEGMENTS = Object.freeze([
  'cafeteria',
  'sorveteria',
  'açaí',
  'chocolateria',
  'confeitaria',
  'alimentação em shopping',
]);
export const MAX_HUNT_QUERIES = 12;
export const MAX_RESULTS_PER_QUERY = 20;
export const DEFAULT_RESULTS_PER_QUERY = 8;
export const HUNT_LOCK_MINUTES = 20;

const clean = (value, limit = 500) => String(value || '').trim().slice(0, limit);
const clampInteger = (value, min, max, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
};

const parseList = (value) => String(value || '')
  .split(/[\n,;]+/)
  .map((item) => item.trim())
  .filter(Boolean);

const normalizeLocation = (value) => {
  if (value && typeof value === 'object') {
    const city = clean(value.city, 140);
    const state = clean(value.state, 40).toUpperCase();
    return city ? { city, state } : null;
  }
  const [cityPart, statePart = ''] = clean(value, 220).split('|');
  const city = clean(cityPart, 140);
  const state = clean(statePart, 40).toUpperCase();
  return city ? { city, state } : null;
};

const normalizeLocations = (value) => {
  const input = Array.isArray(value) ? value : parseList(value);
  const normalized = input.map(normalizeLocation).filter(Boolean);
  const unique = new Map();
  normalized.forEach((location) => {
    unique.set(`${location.city.toLowerCase()}|${location.state}`, location);
  });
  return [...unique.values()].slice(0, 4);
};

const normalizeSegments = (value) => {
  const input = Array.isArray(value) ? value : parseList(value);
  return [...new Set(input.map((segment) => clean(segment, 120)).filter(Boolean))].slice(0, 8);
};

export const leadHuntConfigFromEnv = (env = {}, overrides = {}) => {
  const envLocations = normalizeLocations(env.PLANET_LEAD_HUNT_CITIES);
  const envSegments = normalizeSegments(env.PLANET_LEAD_HUNT_SEGMENTS);
  const overrideLocations = normalizeLocations(overrides.locations || overrides.cities);
  const overrideSegments = normalizeSegments(overrides.segments);
  const locations = overrideLocations.length
    ? overrideLocations
    : envLocations.length
      ? envLocations
      : DEFAULT_HUNT_LOCATIONS.map((item) => ({ ...item }));
  const segments = overrideSegments.length
    ? overrideSegments
    : envSegments.length
      ? envSegments
      : [...DEFAULT_HUNT_SEGMENTS];
  const maxResultsPerQuery = clampInteger(
    overrides.maxResultsPerQuery ?? env.PLANET_LEAD_HUNT_MAX_RESULTS,
    1,
    MAX_RESULTS_PER_QUERY,
    DEFAULT_RESULTS_PER_QUERY,
  );
  const queries = [];
  locations.forEach((location) => {
    segments.forEach((segment) => {
      if (queries.length >= MAX_HUNT_QUERIES) return;
      queries.push({
        segment,
        city: location.city,
        state: location.state,
        textQuery: `${segment} em ${location.city}${location.state ? ` ${location.state}` : ''}`,
      });
    });
  });
  return {
    provider: 'google_places',
    locations,
    segments,
    maxResultsPerQuery,
    queries,
  };
};

const emptyRunDocument = () => ({ revision: null, updatedAt: null, lastRun: null, history: [] });

export const readLeadHuntDocument = async (store) => {
  if (!store) return emptyRunDocument();
  const stored = await store.get(LEAD_HUNT_STORAGE_KEY, { type: 'json' });
  if (!stored || typeof stored !== 'object') return emptyRunDocument();
  return {
    revision: stored.revision || null,
    updatedAt: stored.updatedAt || null,
    lastRun: stored.lastRun || null,
    history: Array.isArray(stored.history) ? stored.history.slice(0, 20) : [],
  };
};

const writeLeadHuntDocument = async (store, run) => {
  const current = await readLeadHuntDocument(store);
  const history = [run, ...current.history.filter((item) => item?.id !== run.id)].slice(0, 20);
  const document = {
    revision: crypto.randomUUID(),
    updatedAt: nowIso(),
    lastRun: run,
    history,
  };
  await store.put(LEAD_HUNT_STORAGE_KEY, JSON.stringify(document));
  return document;
};

const recentRunningJob = (lastRun) => {
  if (lastRun?.status !== 'running') return false;
  const startedAt = Date.parse(lastRun.startedAt || 0);
  if (!Number.isFinite(startedAt)) return false;
  return Date.now() - startedAt < HUNT_LOCK_MINUTES * 60_000;
};

const executeWithConcurrency = async (items, worker, concurrency = 2) => {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
};

const errorText = (error) => clean(error instanceof Error ? error.message : error, 800);

export const runLeadHunt = async ({
  store,
  apiKey,
  env = {},
  options = {},
  fetchImpl = fetch,
}) => {
  if (!store) {
    const error = new Error('PLANET_HUB_DATA não configurado.');
    error.status = 503;
    throw error;
  }
  if (!clean(apiKey, 500)) {
    const error = new Error('GOOGLE_PLACES_API_KEY não configurada.');
    error.status = 503;
    throw error;
  }

  const config = leadHuntConfigFromEnv(env, options);
  if (!config.queries.length) {
    const error = new Error('Nenhuma praça ou segmento configurado para o Caça Leads.');
    error.status = 400;
    throw error;
  }

  const current = await readLeadHuntDocument(store);
  if (!options.force && recentRunningJob(current.lastRun)) {
    const error = new Error('Já existe uma busca automática em andamento.');
    error.status = 409;
    error.run = current.lastRun;
    throw error;
  }

  const startedAt = nowIso();
  const run = {
    id: `lead-hunt-${crypto.randomUUID()}`,
    provider: config.provider,
    trigger: clean(options.trigger, 40) || 'manual',
    status: 'running',
    startedAt,
    completedAt: '',
    locations: config.locations,
    segments: config.segments,
    maxResultsPerQuery: config.maxResultsPerQuery,
    queriesPlanned: config.queries.length,
    queriesCompleted: 0,
    placesFound: 0,
    uniqueCandidatesFound: 0,
    candidatesCreated: 0,
    duplicates: 0,
    invalid: 0,
    withoutContact: 0,
    errors: [],
    queryReports: [],
  };
  await writeLeadHuntDocument(store, run);

  try {
    const discoveredAt = nowIso();
    const queryReports = await executeWithConcurrency(config.queries, async (query) => {
      try {
        const places = await searchGooglePlaces({
          apiKey,
          textQuery: query.textQuery,
          pageSize: config.maxResultsPerQuery,
          fetchImpl,
        });
        return {
          ...query,
          ok: true,
          found: places.length,
          candidates: places.map((place) => googlePlaceToCandidate(place, {
            query: query.textQuery,
            city: query.city,
            state: query.state,
            discoveredAt,
          })),
        };
      } catch (error) {
        return {
          ...query,
          ok: false,
          found: 0,
          candidates: [],
          error: errorText(error),
        };
      }
    }, 2);

    const uniqueCandidates = new Map();
    queryReports.forEach((report) => {
      report.candidates.forEach((candidate) => {
        const key = candidate.sourceRecordId
          ? `${candidate.source}:${candidate.sourceRecordId}`
          : `${candidate.company.toLowerCase()}|${candidate.city.toLowerCase()}`;
        if (!uniqueCandidates.has(key)) uniqueCandidates.set(key, candidate);
      });
    });

    const candidates = [...uniqueCandidates.values()];
    const importResult = await importCandidates(store, candidates);
    const report = importResult.report || {};
    const failedQueries = queryReports.filter((item) => !item.ok);
    const successfulQueries = queryReports.filter((item) => item.ok);
    const completedAt = nowIso();
    const finalRun = {
      ...run,
      status: successfulQueries.length
        ? failedQueries.length ? 'partial' : 'completed'
        : 'failed',
      completedAt,
      queriesCompleted: successfulQueries.length,
      placesFound: queryReports.reduce((sum, item) => sum + Number(item.found || 0), 0),
      uniqueCandidatesFound: candidates.length,
      candidatesCreated: Number(report.candidatesCreated || 0),
      duplicates: Number(report.duplicates || 0),
      invalid: Number(report.invalid || 0),
      withoutContact: Number(report.withoutContact || 0),
      errors: [
        ...failedQueries.map((item) => ({ query: item.textQuery, error: item.error })),
        ...(Array.isArray(report.errors) ? report.errors.slice(0, 20) : []),
      ].slice(0, 40),
      queryReports: queryReports.map(({ candidates: _candidates, ...item }) => item),
    };
    const document = await writeLeadHuntDocument(store, finalRun);
    return {
      run: finalRun,
      report: {
        placesFound: finalRun.placesFound,
        uniqueCandidatesFound: finalRun.uniqueCandidatesFound,
        candidatesCreated: finalRun.candidatesCreated,
        duplicates: finalRun.duplicates,
        invalid: finalRun.invalid,
        withoutContact: finalRun.withoutContact,
        queriesCompleted: finalRun.queriesCompleted,
        queriesPlanned: finalRun.queriesPlanned,
      },
      candidates: importResult.candidates || [],
      revision: document.revision,
    };
  } catch (error) {
    const failedRun = {
      ...run,
      status: 'failed',
      completedAt: nowIso(),
      errors: [{ error: errorText(error) }],
    };
    await writeLeadHuntDocument(store, failedRun);
    throw error;
  }
};

export const getLeadHuntStatus = async ({ store, env = {} }) => {
  const document = await readLeadHuntDocument(store);
  const config = leadHuntConfigFromEnv(env);
  return {
    provider: config.provider,
    providerConfigured: Boolean(clean(env.GOOGLE_PLACES_API_KEY, 500)),
    locations: config.locations,
    segments: config.segments,
    maxResultsPerQuery: config.maxResultsPerQuery,
    queriesPlanned: config.queries.length,
    lastRun: document.lastRun,
    history: document.history.slice(0, 10),
    updatedAt: document.updatedAt,
  };
};
