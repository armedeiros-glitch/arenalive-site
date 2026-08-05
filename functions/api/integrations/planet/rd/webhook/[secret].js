import {
  onRequestOptions as handleOptions,
  onRequestPost as handlePost,
} from '../events.js';

const routeSecret = (value) => {
  if (Array.isArray(value)) return String(value[0] ?? '').trim();
  return String(value ?? '').trim();
};

const json = (body, status = 200) => new Response(JSON.stringify(body, null, 2), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=UTF-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  },
});

const describeMatch = (context) => {
  const expectedRaw = String(context.env.RD_WEBHOOK_SECRET ?? '');
  const receivedRaw = routeSecret(context.params?.secret);
  const expected = expectedRaw.trim();
  const received = receivedRaw.trim();

  return {
    expectedConfigured: expected.length > 0,
    expectedLength: expected.length,
    receivedLength: received.length,
    matchAfterTrim: Boolean(expected) && received === expected,
  };
};

const forwardWithSecret = (context) => {
  const secret = routeSecret(context.params?.secret);
  const url = new URL(context.request.url);
  url.pathname = '/api/integrations/planet/rd/events';
  url.search = '';
  if (secret) url.searchParams.set('secret', secret);

  return {
    ...context,
    request: new Request(url.toString(), context.request),
  };
};

export function onRequestGet(context) {
  return json({
    ok: true,
    diagnostic: 'planet-rd-path-secret-check',
    ...describeMatch(context),
    note: 'Nenhum valor de segredo é retornado por esta rota.',
  });
}

export function onRequestOptions(context) {
  return handleOptions(forwardWithSecret(context));
}

export async function onRequestPost(context) {
  const match = describeMatch(context);

  if (!match.matchAfterTrim) {
    console.warn('rd_webhook_path_secret_mismatch', match);
    return json({
      error: 'Não autorizado.',
      diagnostic: match,
    }, 401);
  }

  return handlePost(forwardWithSecret(context));
}
