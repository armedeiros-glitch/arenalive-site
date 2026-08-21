import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const supplierEmail = process.env.E2E_SUPPLIER_EMAIL ?? '';
const supplierPassword = process.env.E2E_SUPPLIER_PASSWORD ?? '';
const buyerEmail = process.env.E2E_BUYER_EMAIL ?? '';
const buyerPassword = process.env.E2E_BUYER_PASSWORD ?? '';

const credentialsReady = Boolean(
  supabaseUrl &&
    publishableKey &&
    supplierEmail &&
    supplierPassword &&
    buyerEmail &&
    buyerPassword,
);

test.skip(!credentialsReady, 'Credenciais E2E efêmeras não configuradas.');

async function loginSupplier(page: Page) {
  await page.goto(
    `/auth/test-session?email=${encodeURIComponent(supplierEmail)}&password=${encodeURIComponent(supplierPassword)}&next=${encodeURIComponent('/supplier/opportunities')}`,
  );
  await page.waitForURL('**/supplier/opportunities');
  await expect(page.getByText('Oportunidades', { exact: true })).toBeVisible();
  await expect(page.getByTestId('realtime-status')).toContainText('Atualizações ao vivo');
}

async function createCompatibleQuote(label: string) {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: loginError } = await client.auth.signInWithPassword({
    email: buyerEmail,
    password: buyerPassword,
  });
  if (loginError) throw loginError;

  const quoteId = crypto.randomUUID();
  const itemId = crypto.randomUUID();
  const payload = {
    quote_id: quoteId,
    vehicle_id: crypto.randomUUID(),
    draft_id: crypto.randomUUID(),
    anonymous_session_id: crypto.randomUUID(),
    buyer_name: 'Comprador E2E',
    whatsapp_e164: '+5547999999998',
    email: buyerEmail,
    vehicle: {
      brand_name: 'Volkswagen',
      model: 'Gol',
      year: 2018,
      version: '1.6 MSI',
      plate: '',
    },
    location: {
      city: 'Joinville',
      state: 'SC',
      radius_km: 60,
      accepts_shipping: true,
    },
    conditions: ['used_original'],
    items: [
      {
        id: itemId,
        piece_name: `Farol dianteiro ${label}`,
        side: 'esquerdo',
        notes: 'Pedido gerado automaticamente para prova E2E da Sprint 2.',
        sort_order: 0,
        photos: [],
      },
    ],
  };

  const { data, error } = await client.rpc('submit_quote', { payload });
  if (error) throw error;
  return { quoteId, itemLabel: `Farol dianteiro ${label}`, response: data };
}

for (const viewportName of ['desktop', 'mobile'] as const) {
  test(`${viewportName}: oportunidade chega via realtime, abre e recusa`, async ({ page }, testInfo) => {
    await loginSupplier(page);

    await page.evaluate(() => {
      (window as typeof window & { __cotapecaRealtimeEvidence?: unknown }).__cotapecaRealtimeEvidence = null;
      window.addEventListener(
        'cotapeca:opportunity-realtime',
        (event) => {
          (window as typeof window & { __cotapecaRealtimeEvidence?: unknown }).__cotapecaRealtimeEvidence =
            (event as CustomEvent).detail;
        },
        { once: true },
      );
    });

    const unique = `${viewportName}-${Date.now()}`;
    const quote = await createCompatibleQuote(unique);

    const opportunityCard = page.locator('article').filter({ hasText: quote.itemLabel }).first();
    await expect(opportunityCard).toBeVisible({ timeout: 15_000 });

    const realtimeEvidence = await page.evaluate(
      () => (window as typeof window & { __cotapecaRealtimeEvidence?: unknown }).__cotapecaRealtimeEvidence,
    );
    expect(realtimeEvidence).toBeTruthy();

    await page.screenshot({
      path: testInfo.outputPath(`${viewportName}-realtime-list.png`),
      fullPage: true,
    });

    await opportunityCard.getByRole('link', { name: 'VER COTAÇÃO' }).click();
    await expect(page.getByText(quote.itemLabel)).toBeVisible();
    await expect(page.getByTestId('privacy-note')).toContainText('Dados pessoais do comprador permanecem protegidos');

    await page.getByTestId('have-part').click();
    await expect(page.getByTestId('action-message')).toContainText('Sprint 3');

    await page.screenshot({
      path: testInfo.outputPath(`${viewportName}-detail.png`),
      fullPage: true,
    });

    await page.getByTestId('decline').click();
    await expect(page.getByTestId('action-message')).toContainText('Oportunidade recusada.');

    await page.screenshot({
      path: testInfo.outputPath(`${viewportName}-declined.png`),
      fullPage: true,
    });

    await testInfo.attach(`${viewportName}-realtime-event.json`, {
      body: Buffer.from(JSON.stringify(realtimeEvidence, null, 2)),
      contentType: 'application/json',
    });
  });
}
