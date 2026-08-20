import { cleanText, nowIso } from './planet-leads.js';

export const NOTIFICATIONS_STORAGE_KEY = 'planet-hub:planet-notifications:v1';
export const NOTIFICATION_STORAGE_PREFIX = 'planet-hub:planet-notification:v2:';
export const MAX_NOTIFICATIONS = 1000;

const NOTIFICATION_TYPES = new Set(['lead.new', 'lead.updated', 'lead.alert']);
const NOTIFICATION_PRIORITIES = new Set(['high', 'medium', 'low']);

export const notificationStorageKey = (id) => `${NOTIFICATION_STORAGE_PREFIX}${cleanText(id, 120)}`;

export const normalizeNotification = (item = {}) => {
  const createdAt = cleanText(item.createdAt, 40) || nowIso();
  return {
    id: cleanText(item.id, 120) || `notification-${crypto.randomUUID()}`,
    tenantId: 'planet',
    area: 'expansion',
    type: NOTIFICATION_TYPES.has(item.type) ? item.type : 'lead.updated',
    priority: NOTIFICATION_PRIORITIES.has(item.priority) ? item.priority : 'medium',
    title: cleanText(item.title, 180) || 'Atualização da expansão',
    summary: cleanText(item.summary, 500),
    leadId: cleanText(item.leadId, 120),
    leadName: cleanText(item.leadName, 180),
    count: Math.max(1, Math.min(99, Number(item.count) || 1)),
    changes: Array.isArray(item.changes)
      ? item.changes.map((value) => cleanText(value, 80)).filter(Boolean).slice(0, 20)
      : [],
    readAt: cleanText(item.readAt, 40),
    resolvedAt: cleanText(item.resolvedAt, 40),
    createdAt,
    updatedAt: cleanText(item.updatedAt, 40) || createdAt,
  };
};

const readLegacyNotificationDocument = async (store) => {
  const stored = await store.get(NOTIFICATIONS_STORAGE_KEY, { type: 'json' });
  if (!stored || !Array.isArray(stored.data)) {
    return { revision: null, updatedAt: null, data: [] };
  }
  return {
    revision: stored.revision || null,
    updatedAt: stored.updatedAt || null,
    data: stored.data.slice(0, MAX_NOTIFICATIONS).map(normalizeNotification),
  };
};

const listNotificationKeys = async (store) => {
  const keys = [];
  let cursor;
  do {
    const page = await store.list({ prefix: NOTIFICATION_STORAGE_PREFIX, cursor, limit: 1000 });
    keys.push(...(page.keys || []).map((item) => item.name).filter(Boolean));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor && keys.length < MAX_NOTIFICATIONS);
  return keys.slice(0, MAX_NOTIFICATIONS);
};

const readNotificationItems = async (store, keys) => {
  const result = [];
  for (let index = 0; index < keys.length; index += 100) {
    const batch = keys.slice(index, index + 100);
    const values = await Promise.all(batch.map((key) => store.get(key, { type: 'json' })));
    values.forEach((item) => {
      if (item?.id) result.push(normalizeNotification(item));
    });
  }
  return result;
};

export const readNotificationDocument = async (store) => {
  const [legacy, keys] = await Promise.all([
    readLegacyNotificationDocument(store),
    listNotificationKeys(store),
  ]);
  const v2 = await readNotificationItems(store, keys);
  const merged = new Map();
  [...legacy.data, ...v2].forEach((item) => {
    const current = merged.get(item.id);
    if (!current || Date.parse(item.updatedAt || 0) >= Date.parse(current.updatedAt || 0)) {
      merged.set(item.id, item);
    }
  });
  const data = [...merged.values()]
    .sort((a, b) => Date.parse(b.updatedAt || 0) - Date.parse(a.updatedAt || 0))
    .slice(0, MAX_NOTIFICATIONS);
  return {
    revision: 'per-notification-v2',
    updatedAt: data[0]?.updatedAt || legacy.updatedAt || null,
    data,
  };
};

export const writeNotification = async (store, rawNotification) => {
  const notification = normalizeNotification(rawNotification);
  await store.put(notificationStorageKey(notification.id), JSON.stringify(notification));
  return notification;
};

export const writeNotificationDocument = async (store, data) => {
  const normalized = data.slice(0, MAX_NOTIFICATIONS).map(normalizeNotification);
  for (let index = 0; index < normalized.length; index += 100) {
    await Promise.all(normalized.slice(index, index + 100).map((item) => writeNotification(store, item)));
  }
  return {
    revision: 'per-notification-v2',
    updatedAt: normalized.reduce((latest, item) => (
      Date.parse(item.updatedAt || 0) > Date.parse(latest || 0) ? item.updatedAt : latest
    ), null),
    data: normalized,
  };
};

export const appendNotification = async (store, input) => {
  const notification = normalizeNotification(input);
  await writeNotification(store, notification);
  const document = await readNotificationDocument(store);
  return { notification, document };
};

export const summarizeNotifications = (document) => ({
  ...document,
  unread: document.data.filter((item) => !item.readAt && !item.resolvedAt).length,
});
