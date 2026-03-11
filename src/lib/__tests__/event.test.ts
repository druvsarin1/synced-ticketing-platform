import { describe, it, expect } from "vitest";
import { EVENT } from "@/lib/event";

describe("EVENT config validation", () => {
  it("all tiers have unique IDs", () => {
    const ids = EVENT.tiers.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("all tiers have unique codes", () => {
    const codes = EVENT.tiers.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("all tiers have positive prices", () => {
    for (const tier of EVENT.tiers) {
      expect(tier.price).toBeGreaterThan(0);
    }
  });

  it("all tiers have positive capacities", () => {
    for (const tier of EVENT.tiers) {
      expect(tier.capacity).toBeGreaterThan(0);
    }
  });

  it("all tiers have required fields", () => {
    for (const tier of EVENT.tiers) {
      expect(tier.id).toBeTruthy();
      expect(tier.name).toBeTruthy();
      expect(tier.description).toBeTruthy();
      expect(tier.code).toBeTruthy();
      expect(typeof tier.price).toBe("number");
      expect(typeof tier.capacity).toBe("number");
    }
  });
});
