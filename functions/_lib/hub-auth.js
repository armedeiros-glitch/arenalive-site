const COOKIE_NAME = 'pmh_session';
const SESSION_SECONDS = 12 * 60 * 60;

const textEncoder = new TextEncoder();

const toBase64Url = (bytes) => {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const fromBase64Url = (value) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const getSecret = (env) => String(env.PLANET_HUB_ACCESS_PASSWORD || '').trim();

const importHmacKey = (secret) => crypto.subtle.importKey(
  'raw', textEncoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'],
);

const parseCookies = (header = '') => Object.fromEntries(
  header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }),
);

const signPayload = async (secret, payload) => {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign('HMAC', key, textEncoder.encode(payload));
  return toBase64Url(new Uint8Array(signature));
};

const verifySignature = async (secret, payload, signature) => {
  try {
    const key = await importHmacKey(secret);
    return crypto.subtle.verify('HMAC', key, fromBase64Url(signature), textEncoder.encode(payload));
  } catch { return false; }
};

export const safeEqual = (left, right) => {
  const a = textEncoder.encode(String(left || ''));
  const b = textEncoder.encode(String(right || ''));
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) diff |= (a[index] || 0) ^ (b[index] || 0);
  return diff === 0;
};

export const getAuthState = async (request, env) => {
  const secret = getSecret(env);
  if (!secret) return { configured: false, authenticated: true };
  const token = parseCookies(request.headers.get('cookie') || '')[COOKIE_NAME];
  if (!token) return { configured: true, authenticated: false };
  const [version, expiresText, signature] = token.split('.');
  const expiresAt = Number(expiresText);
  if (version !== 'v1' || !Number.isFinite(expiresAt) || expiresAt <= Date.now() || !signature) return { configured: true, authenticated: false };
  const valid = await verifySignature(secret, `${version}.${expiresAt}`, signature);
  return { configured: true, authenticated: valid, expiresAt: valid ? expiresAt : null };
};

export const createSessionCookie = async (env) => {
  const secret = getSecret(env);
  if (!secret) throw new Error('PLANET_HUB_ACCESS_PASSWORD não configurado.');
  const expiresAt = Date.now() + (SESSION_SECONDS * 1000);
  const payload = `v1.${expiresAt}`;
  const signature = await signPayload(secret, payload);
  return `${COOKIE_NAME}=${encodeURIComponent(`${payload}.${signature}`)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_SECONDS}`;
};

export const clearSessionCookie = () => `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
export const isAccessConfigured = (env) => Boolean(getSecret(env));
