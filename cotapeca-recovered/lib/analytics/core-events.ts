export const CORE_EVENTS = [
  "quote_started",
  "vehicle_added",
  "quote_created",
  "supplier_notified",
  "opportunity_viewed",
  "opportunity_declined",
  "offer_started",
  "offer_created",
  "offer_viewed",
  "whatsapp_clicked",
] as const;

export type CoreEventName = (typeof CORE_EVENTS)[number];
