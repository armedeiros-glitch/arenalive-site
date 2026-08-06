import {
  getLeadHuntStatus,
  runLeadHunt,
} from '../../functions/_lib/planet-lead-hunt.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=UTF-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  },
});

const run = (env, trigger) => runLeadHunt({
  store: env.PLANET_HUB_DATA,
  env,
  options: { trigger },
});

const authorized = (request, env) => {
  const expected = String(env.CACA_LEADS_RUN_TOKEN || '').trim();
  if (!expected) return false;
  const authorization = String(request.headers.get('authorization') || '');
  return authorization === `Bearer ${expected}`;
};

export default {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(run(env, 'scheduled').catch((error) => {
      console.error('Caça Leads agendado falhou:', error);
    }));
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      const status = await getLeadHuntStatus({ store: env.PLANET_HUB_DATA, env });
      return json({
        ok: true,
        provider: status.provider,
        providerConfigured: status.providerConfigured,
        storageConfigured: Boolean(env.PLANET_HUB_DATA),
        attribution: status.attribution,
        lastRun: status.lastRun,
      });
    }
    if (request.method !== 'POST' || url.pathname !== '/run') {
      return json({ error: 'Rota não encontrada.' }, 404);
    }
    if (!authorized(request, env)) {
      return json({ error: 'Acesso não autorizado.' }, 401);
    }
    try {
      return json(await run(env, 'manual-worker'));
    } catch (error) {
      return json({
        error: error instanceof Error ? error.message : String(error),
        run: error?.run || null,
      }, Number(error?.status) || 500);
    }
  },
};
