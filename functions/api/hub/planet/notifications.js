import {
  readNotificationDocument,
  summarizeNotifications,
  writeNotificationDocument,
} from '../../../_lib/planet-notifications.js';
import { cleanText, nowIso } from '../../../_lib/planet-leads.js';

const MAX_BODY_BYTES = 32_000;

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

export async function onRequestGet({ env }) {
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ error: 'PLANET_HUB_DATA não configurado.', data: [], unread: 0 }, 503);
  try {
    return json({ ...summarizeNotifications(await readNotificationDocument(store)), storage: 'shared' });
  } catch (error) {
    return json({
      error: 'Falha ao carregar as notificações da Planet.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export async function onRequestPut({ env, request }) {
  const store = env.PLANET_HUB_DATA;
  if (!store) return json({ error: 'PLANET_HUB_DATA não configurado.' }, 503);

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) return json({ error: 'Payload acima do limite permitido.' }, 413);

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'JSON inválido.' }, 400);
  }

  const action = cleanText(payload?.action, 40);
  const ids = new Set([
    cleanText(payload?.id, 120),
    ...(Array.isArray(payload?.ids) ? payload.ids.map((value) => cleanText(value, 120)) : []),
  ].filter(Boolean));

  if (!['read', 'read_all', 'resolve'].includes(action)) {
    return json({ error: 'Ação de notificação inválida.' }, 400);
  }
  if (action !== 'read_all' && !ids.size) return json({ error: 'Informe a notificação.' }, 400);

  try {
    const current = await readNotificationDocument(store);
    const timestamp = nowIso();
    const data = current.data.map((item) => {
      const selected = action === 'read_all' ? !item.resolvedAt : ids.has(item.id);
      if (!selected) return item;
      if (action === 'resolve') {
        return {
          ...item,
          readAt: item.readAt || timestamp,
          resolvedAt: timestamp,
          updatedAt: timestamp,
        };
      }
      return { ...item, readAt: item.readAt || timestamp, updatedAt: timestamp };
    });
    return json(summarizeNotifications(await writeNotificationDocument(store, data)));
  } catch (error) {
    return json({
      error: 'Falha ao atualizar as notificações da Planet.',
      details: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
