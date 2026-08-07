import { getAuthState } from '../../_lib/hub-auth.js';

const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

export async function onRequestGet({ request, env }) {
  const auth = await getAuthState(request, env);
  if (auth.configured && !auth.authenticated) return json({ ok: false, error: 'Não autorizado.' }, 401);

  const token = String(
    env.RADAR_ANDRE_API_KEY
      || env.RADAR_API_KEY
      || env.CHAT_API_KEY
      || '',
  ).trim();

  if (!token) {
    return json({
      ok: false,
      code: 'RADAR_NOT_CONFIGURED',
      error: 'Radar André ainda não está conectado ao André OS.',
    }, 503);
  }

  const baseUrl = String(env.RADAR_ANDRE_BASE_URL || 'https://radar-andre.armedeiros.workers.dev').replace(/\/+$/, '');

  try {
    const response = await fetch(`${baseUrl}/api/v1/today`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return json({
        ok: false,
        code: 'RADAR_UPSTREAM_ERROR',
        error: payload.error || `Radar respondeu HTTP ${response.status}.`,
      }, response.status === 401 ? 502 : response.status);
    }

    return json({
      ok: true,
      date: payload.date || null,
      recommended_task_id: payload.recommended_task_id || null,
      tasks: Array.isArray(payload.tasks) ? payload.tasks : [],
    });
  } catch (error) {
    return json({
      ok: false,
      code: 'RADAR_UNAVAILABLE',
      error: error instanceof Error ? error.message : 'Não foi possível consultar o Radar André.',
    }, 502);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
