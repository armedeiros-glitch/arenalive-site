import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

const webhook = await import('../functions/api/integrations/planet/rd/webhook/[secret].js');
const notifications = await import('../functions/api/hub/planet/notifications.js');
const { readLeadDocument } = await import('../functions/_lib/planet-leads.js');
const { readNotificationDocument } = await import('../functions/_lib/planet-notifications.js');

class MemoryKv {
  constructor() { this.data = new Map(); }
  async get(key, options = {}) {
    const value = this.data.get(key);
    if (value == null) return null;
    return options.type === 'json' ? JSON.parse(value) : value;
  }
  async put(key, value) { this.data.set(key, String(value)); }
  async list({ prefix = '', cursor = undefined, limit = 1000 } = {}) {
    const keys = [...this.data.keys()]
      .filter((key) => key.startsWith(prefix))
      .slice(0, limit)
      .map((name) => ({ name }));
    return { keys, list_complete: true, cursor };
  }
}

const store = new MemoryKv();
const env = { PLANET_HUB_DATA: store, RD_WEBHOOK_SECRET: 'segredo-teste' };
const endpoint = 'https://andre-os.local/api/integrations/planet/rd/webhook/segredo-teste';

const postWebhook = (payload, secret = 'segredo-teste') => webhook.onRequestPost({
  env,
  params: { secret },
  request: new Request(endpoint.replace('segredo-teste', secret), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }),
});

assert.equal((await postWebhook({ lead: { email: 'teste@planet.com' } }, 'errado')).status, 401);

const createdResponse = await postWebhook({
  event_identifier: 'lp-franquias',
  lead: {
    uuid: 'rd-contact-1',
    name: 'Maria Planet',
    email: 'maria@planet.com',
    mobile_phone: '(47) 99999-1111',
    city: 'Joinville',
    state: 'SC',
    funnel: {
      origin: 'Facebook Ads',
      current_stage: { name: 'Novo lead' },
      owner: { name: 'Comercial Planet' },
    },
  },
});
assert.equal(createdResponse.status, 201);
const created = await createdResponse.json();
assert.equal(created.duplicate, false);
assert.equal(created.notification.created, true);
assert.equal(created.notification.unread, 1);

const firstMovementResponse = await postWebhook({
  lead: {
    uuid: 'rd-contact-1',
    email: 'maria@planet.com',
    funnel: { current_stage: { name: 'Contato realizado' } },
  },
});
assert.equal(firstMovementResponse.status, 200);
const firstMovement = await firstMovementResponse.json();
assert.equal(firstMovement.duplicate, true);
assert.deepEqual(firstMovement.changes, ['etapa do funil']);
assert.equal(firstMovement.notification.created, true);
assert.equal(firstMovement.notification.grouped, false);
assert.equal(firstMovement.notification.unread, 2);

const secondMovementResponse = await postWebhook({
  lead: {
    uuid: 'rd-contact-1',
    email: 'maria@planet.com',
    funnel: { current_stage: { name: 'Negociação' } },
  },
});
const secondMovement = await secondMovementResponse.json();
assert.equal(secondMovement.notification.created, true);
assert.equal(secondMovement.notification.grouped, true);
assert.equal(secondMovement.notification.unread, 2);

const leadDocument = await readLeadDocument(store);
assert.equal(leadDocument.data.length, 1);
const lead = leadDocument.data[0];
assert.equal(lead.name, 'Maria Planet');
assert.equal(lead.phone, '47999991111');
assert.equal(lead.city, 'Joinville');
assert.equal(lead.state, 'SC');
assert.equal(lead.assignedTo, 'Comercial Planet');
assert.equal(lead.rdStage, 'Negociação');
assert.equal(lead.history.length, 3);

const notificationDocument = await readNotificationDocument(store);
assert.equal(notificationDocument.data.length, 2);
const movementNotification = notificationDocument.data.find((item) => item.type === 'lead.updated');
assert.ok(movementNotification);
assert.equal(movementNotification.count, 2);
assert.deepEqual(movementNotification.changes, ['etapa do funil']);

const repeated = await (await postWebhook({
  lead: {
    uuid: 'rd-contact-1',
    email: 'maria@planet.com',
    funnel: { current_stage: { name: 'Negociação' } },
  },
})).json();
assert.equal(repeated.notification.created, false);
assert.equal(repeated.notification.reason, 'no_relevant_changes');

const notificationList = await (await notifications.onRequestGet({ env })).json();
assert.equal(notificationList.unread, 2);
assert.equal(notificationList.data.length, 2);

const afterRead = await (await notifications.onRequestPut({
  env,
  request: new Request('https://andre-os.local/api/hub/planet/notifications', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'read', id: movementNotification.id }),
  }),
})).json();
assert.equal(afterRead.unread, 1);

console.log('Planet RD → núcleo compartilhado por item → notificações: integration tests passed');
