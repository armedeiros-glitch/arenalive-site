const headers = {
  'Content-Type': 'application/json; charset=UTF-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};

const json = (body, status = 200) => new Response(JSON.stringify(body, null, 2), {
  status,
  headers,
});

const describe = (value) => {
  const raw = String(value ?? '');
  const trimmed = raw.trim();

  return {
    configured: raw.length > 0,
    rawLength: raw.length,
    trimmedLength: trimmed.length,
    hasOuterWhitespace: raw.length !== trimmed.length,
    asciiLettersAndNumbersOnly: /^[A-Za-z0-9]+$/.test(trimmed),
  };
};

export function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const expectedRaw = String(env.RD_WEBHOOK_SECRET ?? '');
  const receivedRaw = url.searchParams.get('secret') ?? '';
  const expected = expectedRaw.trim();
  const received = receivedRaw.trim();

  return json({
    ok: true,
    diagnostic: 'planet-rd-auth-check',
    expected: describe(expectedRaw),
    received: describe(receivedRaw),
    comparison: {
      matchAfterTrim: Boolean(expected) && received === expected,
      sameRawLength: expectedRaw.length === receivedRaw.length,
      sameTrimmedLength: expected.length === received.length,
    },
    note: 'Nenhum valor de segredo é retornado por esta rota. Remover após o diagnóstico.',
  });
}
