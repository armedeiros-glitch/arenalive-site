const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers });

export async function onRequestGet({ env }) {
  const token = String(
    env.RADAR_ANDRE_API_KEY
      || env.RADAR_API_KEY
      || env.CHAT_API_KEY
      || '',
  ).trim();
  const baseUrl = String(env.RADAR_ANDRE_BASE_URL || 'https://radar-andre.armedeiros.workers.dev').replace(/\/+$/, '');

  if (!token) {
    return json({
      ok: false,
      keyConfigured: false,
      upstreamReachable: null,
      upstreamStatus: null,
      code: 'RADAR_KEY_MISSING_IN_PAGES_RUNTIME',
    });
  }

  try {
    const response = await fetch(`${baseUrl}/api/v1/today`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    return json({
      ok: response.ok,
      keyConfigured: true,
      upstreamReachable: true,
      upstreamStatus: response.status,
      code: response.ok ? 'RADAR_BRIDGE_OK' : (response.status === 401 ? 'RADAR_KEY_MISMATCH' : 'RADAR_UPSTREAM_ERROR'),
    });
  } catch {
    return json({
      ok: false,
      keyConfigured: true,
      upstreamReachable: false,
      upstreamStatus: null,
      code: 'RADAR_UPSTREAM_UNREACHABLE',
    });
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers });
}
