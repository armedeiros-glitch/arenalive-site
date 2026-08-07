const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const ANALYTICS_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const ANALYTICS_BASE = 'https://analyticsdata.googleapis.com/v1beta';

const encoder = new TextEncoder();

const base64Url = (input) => {
  const bytes = typeof input === 'string' ? encoder.encode(input) : new Uint8Array(input);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const pemToArrayBuffer = (pem) => {
  const normalized = String(pem || '').replace(/\\n/g, '\n');
  const body = normalized
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s+/g, '');
  if (!body) throw new Error('GOOGLE_ANALYTICS_PRIVATE_KEY inválida.');
  const binary = atob(body);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer;
};

const importPrivateKey = (pem) => crypto.subtle.importKey(
  'pkcs8',
  pemToArrayBuffer(pem),
  { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
  false,
  ['sign'],
);

const createAssertion = async ({ clientEmail, privateKey }) => {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64Url(JSON.stringify({
    iss: clientEmail,
    scope: ANALYTICS_SCOPE,
    aud: TOKEN_ENDPOINT,
    iat: now,
    exp: now + 3600,
  }));
  const unsigned = `${header}.${payload}`;
  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsigned));
  return `${unsigned}.${base64Url(signature)}`;
};

export const getGoogleAnalyticsAccessToken = async (env) => {
  const clientEmail = String(env.GOOGLE_ANALYTICS_CLIENT_EMAIL || '').trim();
  const privateKey = String(env.GOOGLE_ANALYTICS_PRIVATE_KEY || '').trim();
  if (!clientEmail || !privateKey) throw new Error('Credenciais do Google Analytics não configuradas.');

  const assertion = await createAssertion({ clientEmail, privateKey });
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    const detail = payload.error_description || payload.error || `HTTP ${response.status}`;
    throw new Error(`Falha ao autenticar no Google Analytics: ${detail}`);
  }
  return payload.access_token;
};

export const batchRunReports = async ({ env, propertyId, requests }) => {
  const token = await getGoogleAnalyticsAccessToken(env);
  const response = await fetch(`${ANALYTICS_BASE}/properties/${encodeURIComponent(propertyId)}:batchRunReports`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      Accept: 'application/json',
    },
    body: JSON.stringify({ requests }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = payload?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Google Analytics Data API respondeu com erro: ${detail}`);
  }
  return Array.isArray(payload.reports) ? payload.reports : [];
};
