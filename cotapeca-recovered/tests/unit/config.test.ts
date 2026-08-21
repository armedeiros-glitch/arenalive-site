import { describe, expect, it } from "vitest";
import { DEFAULT_SYSTEM_SETTINGS } from "@/lib/config/defaults";

describe("launch invariants", () => {
  it("keeps launch mode on and monetization off", () => {
    expect(DEFAULT_SYSTEM_SETTINGS.launch_mode).toBe(true);
    expect(DEFAULT_SYSTEM_SETTINGS.monetization_enabled).toBe(false);
    expect(DEFAULT_SYSTEM_SETTINGS.quote_expiration_hours).toBe(48);
  });
});
