import { getAuthState } from '../../../../_lib/hub-auth.js';
import { batchRunReports } from '../../../../_lib/google-analytics.js';

const FUNNEL_EVENTS = [
  'page_view',
  'form_open',
  'lead_step_1',
  'qualification_start',
  'lead_step_2',
  'whatsapp_click',
];
const DIAGNOSTIC_EVENTS = ['qualification_popup', 'generate_lead'];
const LP_PATH = '/franquias/';
const MAX_RANGE_DAYS = 366;

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'private, max-age=120',
  'X-Content-Type-Options': 'nosniff',
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

const dateKey = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
};
const parseDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))
  ? new Date(`${value}T12:00:00-03:00`) : null;
const addDays = (date, days) => new Date(date.getTime() + (days * 86400000));
const daysBetween = (start, end) => Math.floor((end - start) / 86400000) + 1;

const resolvePeriod = (url) => {
  const preset = String(url.searchParams.get('period') || '7d').toLowerCase();
  const today = parseDate(dateKey(new Date()));
  let start = today;
  let end = today;

  if (preset === '30d') start = addDays(today, -29);
  else if (preset === '7d') start = addDays(today, -6);
  else if (preset === 'today') start = today;
  else if (preset === 'custom') {
    start = parseDate(url.searchParams.get('from'));
    end = parseDate(url.searchParams.get('to'));
    if (!start || !end || start > end) throw new Error('Período personalizado inválido.');
  } else {
    throw new Error('Filtro de período inválido.');
  }

  const length = daysBetween(start, end);
  if (length < 1 || length > MAX_RANGE_DAYS) throw new Error('O período deve ter entre 1 e 366 dias.');
  const previousEnd = addDays(start, -1);
  const previousStart = addDays(previousEnd, -(length - 1));
  return {
    preset,
    current: { startDate: dateKey(start), endDate: dateKey(end) },
    previous: { startDate: dateKey(previousStart), endDate: dateKey(previousEnd) },
    days: length,
  };
};

const pathFilter = () => ({
  filter: {
    fieldName: 'pagePath',
    stringFilter: { matchType: 'BEGINS_WITH', value: LP_PATH, caseSensitive: false },
  },
});

const eventAndPathFilter = () => ({
  andGroup: {
    expressions: [
      pathFilter(),
      {
        filter: {
          fieldName: 'eventName',
          inListFilter: { values: [...FUNNEL_EVENTS, ...DIAGNOSTIC_EVENTS], caseSensitive: true },
        },
      },
    ],
  },
});

const requestsFor = (range) => [
  {
    dateRanges: [range],
    dimensions: [{ name: 'eventName' }],
    metrics: [{ name: 'totalUsers' }],
    dimensionFilter: eventAndPathFilter(),
    limit: '20',
  },
  {
    dateRanges: [range],
    metrics: [
      { name: 'totalUsers' }, { name: 'activeUsers' }, { name: 'sessions' },
      { name: 'screenPageViews' }, { name: 'userEngagementDuration' }, { name: 'engagementRate' },
    ],
    dimensionFilter: pathFilter(),
  },
  {
    dateRanges: [range], dimensions: [{ name: 'deviceCategory' }],
    metrics: [{ name: 'totalUsers' }], dimensionFilter: pathFilter(), limit: '20',
  },
  {
    dateRanges: [range], dimensions: [{ name: 'sessionSourceMedium' }],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }], dimensionFilter: pathFilter(), limit: '50',
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
  },
  {
    dateRanges: [range], dimensions: [{ name: 'sessionManualCampaignName' }],
    metrics: [{ name: 'sessions' }, { name: 'totalUsers' }], dimensionFilter: pathFilter(), limit: '50',
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
  },
];

const metricNumber = (value) => Number(value || 0) || 0;
const rowDimension = (row, index = 0) => String(row?.dimensionValues?.[index]?.value || '');
const rowMetric = (row, index = 0) => metricNumber(row?.metricValues?.[index]?.value);
const rows = (report) => Array.isArray(report?.rows) ? report.rows : [];

const parseFunnel = (report) => {
  const values = Object.fromEntries([...FUNNEL_EVENTS, ...DIAGNOSTIC_EVENTS].map((name) => [name, 0]));
  rows(report).forEach((row) => {
    const event = rowDimension(row);
    if (event in values) values[event] = rowMetric(row);
  });
  const visitors = values.page_view || 0;
  return {
    steps: FUNNEL_EVENTS.map((event, index) => {
      const count = values[event] || 0;
      const previous = index === 0 ? count : (values[FUNNEL_EVENTS[index - 1]] || 0);
      return {
        event,
        count,
        previousConversion: index === 0 ? 100 : (previous ? (count / previous) * 100 : 0),
        totalConversion: visitors ? (count / visitors) * 100 : 0,
      };
    }),
    diagnostics: {
      qualificationPopup: values.qualification_popup || 0,
      generateLead: values.generate_lead || 0,
    },
  };
};

const parseSummary = (report) => {
  const row = rows(report)[0] || {};
  const totalUsers = rowMetric(row, 0);
  const activeUsers = rowMetric(row, 1);
  const sessions = rowMetric(row, 2);
  const views = rowMetric(row, 3);
  const engagementSeconds = rowMetric(row, 4);
  return {
    users: totalUsers,
    activeUsers,
    sessions,
    views,
    averageEngagementSeconds: activeUsers ? engagementSeconds / activeUsers : 0,
    engagementRate: rowMetric(row, 5),
  };
};

const parseBreakdown = (report, metrics = 1) => rows(report).map((row) => ({
  label: rowDimension(row) || '(não definido)',
  values: Array.from({ length: metrics }, (_, index) => rowMetric(row, index)),
}));

const parsePeriod = (reports) => ({
  funnel: parseFunnel(reports[0]),
  summary: parseSummary(reports[1]),
  devices: parseBreakdown(reports[2], 1).map((item) => ({ label: item.label, users: item.values[0] })),
  sources: parseBreakdown(reports[3], 2).map((item) => ({ label: item.label, sessions: item.values[0], users: item.values[1] })),
  campaigns: parseBreakdown(reports[4], 2).map((item) => ({ label: item.label, sessions: item.values[0], users: item.values[1] })),
});

export async function onRequestGet({ env, request }) {
  const auth = await getAuthState(request, env);
  if (auth.configured && !auth.authenticated) return json({ error: 'Sessão inválida.' }, 401);

  const propertyId = String(env.GA4_PROPERTY_ID || '').trim();
  if (!propertyId) return json({ error: 'GA4_PROPERTY_ID não configurado.' }, 500);

  let period;
  try {
    period = resolvePeriod(new URL(request.url));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Período inválido.' }, 400);
  }

  try {
    const [currentReports, previousReports] = await Promise.all([
      batchRunReports({ env, propertyId, requests: requestsFor(period.current) }),
      batchRunReports({ env, propertyId, requests: requestsFor(period.previous) }),
    ]);
    return json({
      source: 'google-analytics-4',
      propertyId,
      path: LP_PATH,
      period,
      current: parsePeriod(currentReports),
      previous: parsePeriod(previousReports),
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return json({
      error: error instanceof Error ? error.message : 'Falha ao consultar o Google Analytics.',
      source: 'google-analytics-4',
    }, 502);
  }
}
