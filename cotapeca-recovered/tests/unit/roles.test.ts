import { describe, expect, it } from "vitest";
import { canActAs, isRole } from "@/lib/auth/roles";

describe("role boundaries", () => {
  it("does not let a buyer act as supplier or admin", () => {
    expect(canActAs("buyer", "buyer")).toBe(true);
    expect(canActAs("buyer", "supplier")).toBe(false);
    expect(canActAs("buyer", "admin")).toBe(false);
  });

  it("allows admin to perform role-scoped operational work", () => {
    expect(canActAs("admin", "buyer")).toBe(true);
    expect(canActAs("admin", "supplier")).toBe(true);
    expect(canActAs("admin", "admin")).toBe(true);
  });

  it("rejects unknown roles", () => {
    expect(isRole("owner")).toBe(false);
    expect(isRole("admin")).toBe(true);
  });
});
