import { describe, it, expect } from "vitest";
import { calculateFee } from "@/lib/fees";

describe("calculateFee", () => {
  it("calculates correct fee for $25 ticket", () => {
    const { fee, total } = calculateFee(25);
    expect(total).toBeGreaterThan(25);
    // After Stripe takes 2.9% + $0.30 from total, organizer should get $25
    const stripesCut = total * 0.029 + 0.3;
    expect(total - stripesCut).toBeCloseTo(25, 1);
    expect(fee).toBe(Math.round((total - 25) * 100) / 100);
  });

  it("calculates correct fee for $23 ticket", () => {
    const { fee, total } = calculateFee(23);
    expect(total).toBeGreaterThan(23);
    const stripesCut = total * 0.029 + 0.3;
    expect(total - stripesCut).toBeCloseTo(23, 1);
    expect(fee).toBe(Math.round((total - 23) * 100) / 100);
  });

  it("fee + price = total (no rounding errors)", () => {
    const { fee, total } = calculateFee(25);
    expect(fee + 25).toBe(total);
  });

  it("handles zero price", () => {
    const { fee, total } = calculateFee(0);
    expect(total).toBeGreaterThanOrEqual(0);
    expect(fee).toBe(Math.round((total - 0) * 100) / 100);
  });

  it("handles high price", () => {
    const { fee, total } = calculateFee(500);
    expect(total).toBeGreaterThan(500);
    expect(fee + 500).toBe(total);
    const stripesCut = total * 0.029 + 0.3;
    expect(total - stripesCut).toBeCloseTo(500, 1);
  });
});
