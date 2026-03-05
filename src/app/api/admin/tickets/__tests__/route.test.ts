import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.stubEnv("ADMIN_PASSWORD", "testpass");

const { mockSupabase, mockSessionsList } = vi.hoisted(() => ({
  mockSupabase: { from: vi.fn() },
  mockSessionsList: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({ supabase: mockSupabase }));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        list: (...args: unknown[]) => mockSessionsList(...args),
      },
    },
  },
}));

import { GET } from "@/app/api/admin/tickets/route";

function makeRequest(password?: string) {
  const headers: Record<string, string> = {};
  if (password) headers["x-admin-password"] = password;
  return new NextRequest("http://localhost:3000/api/admin/tickets", { headers });
}

const stripeSessions = [
  {
    id: "sess_1",
    customer_details: { name: "Alice", email: "alice@test.com" },
    metadata: { tierName: "Dance Team", tierId: "dance" },
    line_items: { data: [{ quantity: 2 }] },
    amount_total: 5214,
    created: 1713484800,
  },
  {
    id: "sess_2",
    customer_details: { name: "Bob", email: "bob@test.com" },
    metadata: { tierName: "E-Board", tierId: "eboard" },
    line_items: { data: [{ quantity: 1 }] },
    amount_total: 2407,
    created: 1713484900,
  },
  {
    id: "sess_cancelled",
    customer_details: { name: "Carol", email: "carol@test.com" },
    metadata: { tierName: "Dance Team", tierId: "dance" },
    line_items: { data: [{ quantity: 3 }] },
    amount_total: 7821,
    created: 1713485000,
  },
];

describe("GET /api/admin/tickets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionsList.mockResolvedValue({ data: stripeSessions });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [
          { stripe_session_id: "sess_1" },
          { stripe_session_id: "sess_2" },
        ],
      }),
    });
  });

  it("returns 401 without password", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("filters out cancelled tickets (not in Supabase)", async () => {
    const res = await GET(makeRequest("testpass"));
    const json = await res.json();
    expect(json.tickets).toHaveLength(2);
    const ids = json.tickets.map((t: { id: string }) => t.id);
    expect(ids).not.toContain("sess_cancelled");
  });

  it("calculates net revenue = tier price × qty", async () => {
    const res = await GET(makeRequest("testpass"));
    const json = await res.json();
    // Dance: $25 × 2 = $50, EBoard: $23 × 1 = $23, total net = $73
    expect(json.netRevenue).toBe(73);
  });

  it("calculates Stripe fees = gross - net", async () => {
    const res = await GET(makeRequest("testpass"));
    const json = await res.json();
    expect(json.stripeFees).toBe(
      Math.round((json.totalRevenue - json.netRevenue) * 100) / 100
    );
  });

  it("returns correct tier summaries with capacity", async () => {
    const res = await GET(makeRequest("testpass"));
    const json = await res.json();

    const danceTier = json.tierSummary.find(
      (t: { id: string }) => t.id === "dance"
    );
    expect(danceTier.sold).toBe(2);
    expect(danceTier.capacity).toBe(90);
    expect(danceTier.remaining).toBe(88);

    const eboardTier = json.tierSummary.find(
      (t: { id: string }) => t.id === "eboard"
    );
    expect(eboardTier.sold).toBe(1);
    expect(eboardTier.capacity).toBe(17);
    expect(eboardTier.remaining).toBe(16);
  });
});
