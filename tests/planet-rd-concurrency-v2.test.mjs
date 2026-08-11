import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const webhook = await import('../functions/api/integrations/planet/rd/webhook/[secret].js');
const { readLeadDocument, LEAD_STORAGE_PREFIX } = await import('../functions/_lib/planet-leads.js');
const { readNotificationDocument, NOTIFICATION_STORAGE_PREFIX } = await import('../functions/_lib/planet-notifications.js');

class MemoryKv {
  constructor() { this.data = new Map(); }
  async get(key, options = {}) {
    await Promise.resolve();
    const value = this.data.get(key);
    if (value == null) return null;
    return options.type === 'json' ? JSON.parse(value) : value;
  }
  async put(key, value) {
    await Promise.resolve();
    this.data.set(key, String(value));
  }
  async list({ prefix = '', cursor = undefined, limit = 1000 } = {}) {
    await Promise.resolve();
    const keys = [...this.data.keys()]
      .filter((key) => key.startsWith(prefix))
      .slice(0, limit)
      .map((name) => ({ name }));
    return { keys, list_complete: true, cursor };
  }
}

const store = new MemoryKv();
const env = { PLANET_HUB_DATA: store, RD_WEBHOOK_SECRET: 'segredo-concorrencia' };

const post = (uuid, email, name) => webhook.onRequestPost({
  env,
  params: { secret: 'segredo-concorrencia' },
  request: new Request('https://andre-os.local/api/integrations/planet/rd/webhook/segredo-concorrencia', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      event_identifier: 'lp-franquias',
      lead: {
        uuid,
        email,
        name,
        city: 'Joinville',
        state: 'SC',
      },
    }),
  }),
});

const [a, b] = await Promise.all([
  post('rd-simultaneo-a', 'a@planet.test', 'Lead A'),
  post('rd-simultaneo-b', 'b@planet.test', 'Lead B'),
]);

assert.equal(a.status, 201);
assert.equal(b.status, 201);

const leads = await readLeadDocument(store);
assert.equal(leads.data.length, 2);
assert.deepEqual(new Set(leads.data.map((item) => item.email)), new Set(['a@planet.test', 'b@planet.test']));

const leadKeys = [...store.data.keys()].filter((key) => key.startsWith(LEAD_STORAGE_PREFIX));
assert.equal(leadKeys.length, 2, 'cada lead deve ter sua própria chave KV');

const notifications = await readNotificationDocument(store);
assert.equal(notifications.data.filter((item) => item.type === 'lead.new').length, 2);
const notificationKeys = [...store.data.keys()].filter((key) => key.startsWith(NOTIFICATION_STORAGE_PREFIX));
assert.equal(notificationKeys.length, 2, 'cada notificação deve ter sua própria chave KV');

assert.equal(store.data.has('planet-hub:planet-expansion-leads:v1'), false, 'novos leads não devem regravar o documento legado');
assert.equal(store.data.has('planet-hub:planet-notifications:v1'), false, 'novas notificações não devem regravar o documento legado');

console.log('Planet RD concorrência v2: dois leads simultâneos persistem sem atropelamento');
