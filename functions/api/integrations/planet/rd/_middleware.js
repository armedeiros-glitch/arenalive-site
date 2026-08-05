const normalizeSecret = (value) => String(value ?? '').trim();

const fingerprint = async (value) => {
  const normalized = normalizeSecret(value);
  if (!normalized) return null;

  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(normalized),
  );

  return Array.from(new Uint8Array(digest))
    .slice(0, 6)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

const describeSecret = async (value) => {
  const raw = String(value ?? '');
  const normalized = normalizeSecret(raw);

  return {
    configured: raw.length > 0,
    rawLength: raw.length,
    trimmedLength: normalized.length,
    fingerprint: await fingerprint(normalized),
  };
};

export async function onRequest(context) {
  const response = await context.next();

  if (context.request.method !== 'POST' || response.status !== 401) {
    return response;
  }

  try {
    const url = new URL(context.request.url);
    const authorization = context.request.headers.get('authorization') || '';
    const bearer = authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : '';
    const direct = context.request.headers.get('x-rd-webhook-secret') || '';
    const query = url.searchParams.get('secret') || '';
    const expected = context.env.RD_WEBHOOK_SECRET || '';

    const [expectedInfo, queryInfo, directInfo, bearerInfo] = await Promise.all([
      describeSecret(expected),
      describeSecret(query),
      describeSecret(direct),
      describeSecret(bearer),
    ]);

    const normalizedExpected = normalizeSecret(expected);

    console.warn('rd_webhook_auth_mismatch', {
      path: url.pathname,
      expected: expectedInfo,
      query: queryInfo,
      header: directInfo,
      bearer: bearerInfo,
      matches: {
        query: normalizeSecret(query) === normalizedExpected,
        header: normalizeSecret(direct) === normalizedExpected,
        bearer: normalizeSecret(bearer) === normalizedExpected,
      },
    });
  } catch (error) {
    console.warn('rd_webhook_auth_diagnostic_failed', {
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return response;
}
