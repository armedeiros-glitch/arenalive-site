import { describe, expect, it } from "vitest";
import { CORE_EVENTS } from "@/lib/analytics/core-events";

describe("required analytics events", () => {
  it("freezes the ten PRD events", () => {
    expect(CORE_EVENTS).toEqual([
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
    ]);
  });
});
