import { isAccessConfigured } from '../../_lib/hub-auth.js';

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers,
});

export function onRequestGet({ env }) {
  const services = {
    access: isAccessConfigured(env),
    workersAi: Boolean(env.AI?.run),
    sharedData: Boolean(env.PLANET_HUB_DATA),
    sults: Boolean(env.SULTS_API_TOKEN),
    r2Files: Boolean(env.ANDRE_OS_FILES || env.FILES),
  };

  const required = ['access', 'workersAi', 'sharedData', 'sults'];
  const missingRequired = required.filter((key) => !services[key]);

  return json({
    ok: missingRequired.length === 0,
    service: 'André OS · Marketing Command',
    checkedAt: new Date().toISOString(),
    services,
    missingRequired,
    notes: services.r2Files
      ? ['Armazenamento R2 conectado.']
      : ['O bucket R2 existe na conta, mas ainda não está conectado ao projeto.'],
  }, missingRequired.length ? 503 : 200);
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
