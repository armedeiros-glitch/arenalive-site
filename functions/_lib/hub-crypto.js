const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64Url = (bytes) => {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const fromBase64Url = (value) => {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

const importKey = async (secret) => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
};

export const encryptionConfigured = (env) => String(env.PLANET_HUB_ENCRYPTION_KEY || '').trim().length >= 24;

export const encryptText = async (value, env) => {
  const text = String(value || '').trim();
  if (!text) return '';
  const secret = String(env.PLANET_HUB_ENCRYPTION_KEY || '').trim();
  if (secret.length < 24) throw new Error('PLANET_HUB_ENCRYPTION_KEY precisa ter pelo menos 24 caracteres.');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importKey(secret);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(text));
  return `v1.${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
};

export const decryptText = async (value, env) => {
  const packed = String(value || '');
  if (!packed) return '';
  const [version, ivText, cipherText] = packed.split('.');
  if (version !== 'v1' || !ivText || !cipherText) return '';
  const secret = String(env.PLANET_HUB_ENCRYPTION_KEY || '').trim();
  if (secret.length < 24) throw new Error('PLANET_HUB_ENCRYPTION_KEY não configurada.');
  const key = await importKey(secret);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64Url(ivText) }, key, fromBase64Url(cipherText));
  return decoder.decode(decrypted);
};
