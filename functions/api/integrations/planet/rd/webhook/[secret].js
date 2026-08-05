import { onRequestPost as handlePost } from '../../../../../_lib/planet-rd-webhook.js';

const responseHeaders = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const json = (body, status = 200, extraHeaders = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { ...responseHeaders, ...extraHeaders },
});

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

const handlerContext = (context) => {
  const originalRequest = context.request;
  const secret = secretFromRequest(context);
  const url = new URL(originalRequest.url);
  const headers = new Headers(originalRequest.headers);

  url.search = '';
  url.searchParams.set('secret', secret);
  headers.set('X-RD-Webhook-Secret', secret);

  return {
    ...context,
    request: {
      url: url.toString(),
      headers,
      json: () => originalRequest.json(),
    },
  };
};

export function onRequestGet() {
  return json({ error: 'Método não permitido.' }, 405, { Allow: 'POST, OPTIONS' });
}

export function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Cache-Control': 'no-store',
      Allow: 'POST, OPTIONS',
    },
  });
}

export function onRequestPost(context) {
  return handlePost(handlerContext(context));
}
