import { cleanText, nowIso } from './planet-leads.js';

export const NOTIFICATIONS_STORAGE_KEY = 'planet-hub:planet-notifications:v1';
export const MAX_NOTIFICATIONS = 1000;

const NOTIFICATION_TYPES = new Set(['lead.new', 'lead.updated', 'lead.alert']);
const NOTIFICATION_PRIORITIES = new Set(['high', 'medium', 'low']);

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

export const readNotificationDocument = async (store) => {
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

export const writeNotificationDocument = async (store, data) => {
  const document = {
    revision: crypto.randomUUID(),
    updatedAt: nowIso(),
    data: data.slice(0, MAX_NOTIFICATIONS).map(normalizeNotification),
  };
  await store.put(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(document));
  return document;
};

export const appendNotification = async (store, input) => {
  const current = await readNotificationDocument(store);
  const notification = normalizeNotification(input);
  const document = await writeNotificationDocument(store, [notification, ...current.data]);
  return { notification, document };
};

export const summarizeNotifications = (document) => ({
  ...document,
  unread: document.data.filter((item) => !item.readAt && !item.resolvedAt).length,
});
