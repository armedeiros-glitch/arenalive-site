import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supplierEmail = 'cotapeca.e2e.supplier@local.test';
const adminEmail = 'cotapeca.e2e.admin@local.test';
const supplierPassword = process.env.COTAPECA_E2E_SUPPLIER_PASSWORD!;
const adminPassword = process.env.COTAPECA_E2E_ADMIN_PASSWORD!;

const fixtures = {
  desktop: {
    quoteId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    vehicle: 'Volkswagen Gol 2018',
    item: 'Farol dianteiro',
  },
  mobile: {
    quoteId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccd',
    vehicle: 'Chevrolet Onix 2020',
    item: 'Retrovisor externo',
  },
} as const;

test('supplier receives, opens and declines a real opportunity without refresh', async ({ page }, testInfo) => {
  const fixture = fixtures[testInfo.project.name as keyof typeof fixtures];
  expect(fixture).toBeTruthy();

  await page.addInitScript(() => {
    const w = window as Window & { __cotapecaRealtimeReady?: boolean; __cotapecaRealtimeEvents?: unknown[] };
    w.__cotapecaRealtimeReady = false;
    w.__cotapecaRealtimeEvents = [];
    window.addEventListener('cotapeca:opportunity-realtime-ready', () => { w.__cotapecaRealtimeReady = true; });
    window.addEventListener('cotapeca:opportunity-realtime', (event) => {
      w.__cotapecaRealtimeEvents?.push((event as CustomEvent).detail);
    });
  });

  const loginUrl = `/auth/test-session?email=${encodeURIComponent(supplierEmail)}&password=${encodeURIComponent(supplierPassword)}&next=${encodeURIComponent('/supplier/opportunities')}`;
  await page.goto(loginUrl);
  await expect(page).toHaveURL(/\/supplier\/opportunities$/, { timeout: 15_000 });
  await expect(page.getByTestId('empty-opportunities')).toBeVisible({ timeout: 10_000 });
  await page.waitForFunction(() => (window as Window & { __cotapecaRealtimeReady?: boolean }).__cotapecaRealtimeReady === true, undefined, { timeout: 15_000 });

  const admin = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: loginError } = await admin.auth.signInWithPassword({ email: adminEmail, password: adminPassword });
  expect(loginError).toBeNull();

  const { data: matchedCount, error: matchError } = await admin.rpc('run_quote_matching', { p_quote_id: fixture.quoteId });
  expect(matchError).toBeNull();
  expect(matchedCount).toBe(1);

  await expect.poll(async () => {
    const { count } = await admin.from('analytics_events').select('id', { count: 'exact', head: true }).eq('quote_id', fixture.quoteId).eq('event_name', 'opportunity_created');
    return count ?? 0;
  }, { timeout: 10_000 }).toBeGreaterThan(0);

  await page.waitForFunction((quoteId) => {
    const events = (window as Window & { __cotapecaRealtimeEvents?: Array<{ quote_id?: string }> }).__cotapecaRealtimeEvents ?? [];
    return events.some((event) => event.quote_id === quoteId);
  }, fixture.quoteId, { timeout: 15_000 });

  const realtimeEvent = await page.evaluate((quoteId) => {
    const events = (window as Window & { __cotapecaRealtimeEvents?: Array<Record<string, unknown>> }).__cotapecaRealtimeEvents ?? [];
    return events.find((event) => event.quote_id === quoteId) ?? null;
  }, fixture.quoteId);
  expect(realtimeEvent).not.toBeNull();

  const opportunityId = String((realtimeEvent as Record<string, unknown>).id ?? '');
  expect(opportunityId).toBeTruthy();
  const card = page.locator(`article[data-opportunity-id="${opportunityId}"]`);
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card).toContainText(fixture.vehicle);
  await expect(card).toContainText(fixture.item);

  const evidenceDir = path.join(process.cwd(), 'test-results');
  fs.mkdirSync(evidenceDir, { recursive: true });
  fs.writeFileSync(path.join(evidenceDir, `realtime-${testInfo.project.name}.json`), JSON.stringify({
    project: testInfo.project.name,
    receivedWithoutRefresh: true,
    quoteId: fixture.quoteId,
    opportunityId,
    event: realtimeEvent,
    receivedAt: new Date().toISOString(),
  }, null, 2));
  console.log('REALTIME_EVIDENCE', testInfo.project.name, JSON.stringify(realtimeEvent));

  await card.getByRole('link', { name: 'VER COTAÇÃO' }).click();
  await expect(page).toHaveURL(new RegExp(`/supplier/opportunities/${opportunityId}$`));
  await expect(page.getByRole('heading', { name: fixture.vehicle })).toBeVisible();
  await expect(page.getByText(fixture.item)).toBeVisible();
  await expect(page.getByTestId('privacy-note')).toContainText('Dados pessoais do comprador permanecem protegidos');

  await expect.poll(async () => {
    const { count } = await admin.from('analytics_events').select('id', { count: 'exact', head: true }).eq('opportunity_id', opportunityId).eq('event_name', 'opportunity_viewed');
    return count ?? 0;
  }, { timeout: 10_000 }).toBeGreaterThan(0);

  await page.getByTestId('decline').click();
  await expect(page.getByTestId('action-message')).toHaveText('Oportunidade recusada.');

  await expect.poll(async () => {
    const { data } = await admin.from('opportunities').select('status').eq('id', opportunityId).single();
    return data?.status;
  }, { timeout: 10_000 }).toBe('declined');

  await expect.poll(async () => {
    const { count } = await admin.from('analytics_events').select('id', { count: 'exact', head: true }).eq('opportunity_id', opportunityId).eq('event_name', 'opportunity_declined');
    return count ?? 0;
  }, { timeout: 10_000 }).toBeGreaterThan(0);

  await admin.auth.signOut();
});
