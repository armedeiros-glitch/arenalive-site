import {
  onRequestOptions as handleOptions,
  onRequestPost as handlePost,
} from '../events.js';

const INTERNAL_AUTH_MARKER = 'rd-route-authenticated';

const cleanSecret = (value) => {
  if (Array.isArray(value)) return String(value[0] ?? '').trim();
  return String(value ?? '').trim();
};

const secretFromRequest = (context) => {
  const paramSecret = cleanSecret(context.params?.secret);
  if (paramSecret) return paramSecret;

  try {
    const pathname = new URL(context.request.url).pathname;
    const lastSegment = pathname.split('/').filter(Boolean).at(-1) || '';
    return decodeURIComponent(lastSegment).trim();
  } catch {
    return '';
  }
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
  const expected = cleanSecret(context.env.RD_WEBHOOK_SECRET);
  const received = secretFromRequest(context);

  return {
    expectedConfigured: expected.length > 0,
    expectedLength: expected.length,
    receivedLength: received.length,
    matchAfterTrim: Boolean(expected) && received === expected,
  };
};

const trustedContext = (context) => {
  const originalRequest = context.request;
  const url = new URL(originalRequest.url);
  const headers = new Headers(originalRequest.headers);
  const env = Object.create(context.env);

  url.pathname = '/api/integrations/planet/rd/events';
  url.search = '';
  url.searchParams.set('secret', INTERNAL_AUTH_MARKER);
  headers.set('X-RD-Webhook-Secret', INTERNAL_AUTH_MARKER);

  Object.defineProperty(env, 'RD_WEBHOOK_SECRET', {
    value: INTERNAL_AUTH_MARKER,
    enumerable: true,
    configurable: false,
    writable: false,
  });

  return {
    ...context,
    env,
    request: {
      url: url.toString(),
      headers,
      json: () => originalRequest.json(),
    },
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
  return handleOptions(trustedContext(context));
}

export async function onRequestPost(context) {
  const match = describeMatch(context);

  if (!match.matchAfterTrim) {
    console.warn('rd_webhook_path_secret_mismatch', match);
    return json({
      error: 'Não autorizado.',
      diagnostic: match,
    }, 403);
  }

  return handlePost(trustedContext(context));
}
