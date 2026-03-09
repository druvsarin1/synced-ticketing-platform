import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock supabase
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockFrom = vi.fn();
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Mock stripe
const mockCreate = vi.fn();
vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        create: (...args: unknown[]) => mockCreate(...args),
      },
    },
  },
}));

// Mock fees
vi.mock("@/lib/fees", () => ({
  calculateFee: (price: number) => ({ fee: 1.07, total: price + 1.07 }),
}));

import { POST } from "@/app/api/checkout/route";

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/checkout", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const validBody = {
  tierId: "dance",
  tierName: "Dance Team",
  price: 25,
  eventName: "SHOLAY",
  eventDate: "Saturday, April 18, 2026",
  eventLocation: "Infinite Lounge",
};

describe("POST /api/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no tickets sold
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ data: [] });
    mockCreate.mockResolvedValue({ url: "https://checkout.stripe.com/test" });
  });

  it("returns checkout URL on valid request", async () => {
    const res = await POST(makeRequest(validBody));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.url).toBe("https://checkout.stripe.com/test");
  });

  it("returns 400 'Sold out' when at capacity", async () => {
    // 100 tickets sold (dance tier capacity = 100)
    mockEq.mockResolvedValue({
      data: [{ quantity: 100 }],
    });

    const res = await POST(makeRequest(validBody));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("Sold out");
  });

  it("correctly counts quantities (not just sessions)", async () => {
    // 3 sessions with different quantities totaling 100
    mockEq.mockResolvedValue({
      data: [{ quantity: 40 }, { quantity: 35 }, { quantity: 25 }],
    });

    const res = await POST(makeRequest(validBody));
    const json = await res.json();
    expect(res.status).toBe(400);
    expect(json.error).toBe("Sold out");
  });

  it("cancelled tickets don't count toward capacity (Supabase is source of truth)", async () => {
    // Only 10 tickets in Supabase (cancelled ones are deleted)
    mockEq.mockResolvedValue({
      data: [{ quantity: 10 }],
    });

    const res = await POST(makeRequest(validBody));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.url).toBe("https://checkout.stripe.com/test");
    // Verify we queried Supabase, not Stripe
    expect(mockFrom).toHaveBeenCalledWith("tickets");
  });

  it("passes tier metadata to Stripe session", async () => {
    await POST(makeRequest(validBody));
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          tierId: "dance",
          tierName: "Dance Team",
        }),
      })
    );
  });
});
