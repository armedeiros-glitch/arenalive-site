import {
  onRequestGet as handleGet,
  onRequestOptions as handleOptions,
  onRequestPost as handlePost,
} from '../events.js';

const routeSecret = (value) => {
  if (Array.isArray(value)) return String(value[0] ?? '').trim();
  return String(value ?? '').trim();
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
  return handleGet(forwardWithSecret(context));
}

export function onRequestOptions(context) {
  return handleOptions(forwardWithSecret(context));
}

export async function onRequestPost(context) {
  return handlePost(forwardWithSecret(context));
}
