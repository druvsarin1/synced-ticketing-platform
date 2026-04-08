import { describe, it, expect } from "vitest";
import { EVENT } from "@/lib/event";

describe("EVENT config validation", () => {
  it("all tiers have unique IDs", () => {
    const ids = EVENT.tiers.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gated tiers have unique codes", () => {
    const codes = EVENT.tiers.map((t) => t.code).filter((c) => c !== null);
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
      expect(typeof tier.price).toBe("number");
      expect(typeof tier.capacity).toBe("number");
      // code is null for public tiers, non-empty string for gated tiers
      expect(tier.code === null || typeof tier.code === "string").toBe(true);
    }
  });

  it("gated tiers have a non-empty code", () => {
    for (const tier of EVENT.tiers.filter((t) => t.code !== null)) {
      expect(tier.code).toBeTruthy();
    }
  });
});

describe("General Admission tier", () => {
  const ga = EVENT.tiers.find((t) => t.id === "ga");

  it("exists as the first tier", () => {
    expect(EVENT.tiers[0].id).toBe("ga");
  });

  it("is public — no code required", () => {
    expect(ga?.code).toBeNull();
  });

  it("has a positive price", () => {
    expect(ga?.price).toBeGreaterThan(0);
  });

  it("has a positive capacity", () => {
    expect(ga?.capacity).toBeGreaterThan(0);
  });

  it("has no code expiry", () => {
    expect(ga?.codeExpiresAt).toBeNull();
  });

  it("is marked as sold out", () => {
    expect(ga?.soldOut).toBe(true);
  });

  it("has a label", () => {
    expect(ga?.label).toBeTruthy();
  });
});

describe("General Admission Tier 2", () => {
  const ga2 = EVENT.tiers.find((t) => t.id === "ga2");

  it("exists", () => {
    expect(ga2).toBeDefined();
  });

  it("is code-gated with syncedxtier2", () => {
    expect(ga2?.code).toBe("syncedxtier2");
  });

  it("costs $30", () => {
    expect(ga2?.price).toBe(30);
  });

  it("has capacity of 20", () => {
    expect(ga2?.capacity).toBe(20);
  });

  it("is not sold out", () => {
    expect(ga2?.soldOut).toBe(false);
  });

  it("has no code expiry", () => {
    expect(ga2?.codeExpiresAt).toBeNull();
  });

  it("has a label", () => {
    expect(ga2?.label).toBe("TIER 2");
  });
});
