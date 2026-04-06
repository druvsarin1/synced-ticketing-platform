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

vi.mock("@/lib/capacity", () => ({
  getTierCapacities: vi.fn().mockResolvedValue(
    new Map([["ga", 17], ["dance", 100], ["eboard", 15]])
  ),
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

// Supabase tickets — source of truth. sess_cancelled is absent (was cancelled).
const supabaseTickets = [
  {
    id: "ticket-1",
    stripe_session_id: "sess_1",
    buyer_name: "Alice",
    buyer_email: "alice@test.com",
    tier_id: "dance",
    ticket_tier: "Dance Team",
    quantity: 2,
  },
  {
    id: "ticket-2",
    stripe_session_id: "sess_2",
    buyer_name: "Bob",
    buyer_email: "bob@test.com",
    tier_id: "eboard",
    ticket_tier: "E-Board",
    quantity: 1,
  },
];

describe("GET /api/admin/tickets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionsList.mockResolvedValue({ data: stripeSessions });
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: supabaseTickets }),
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

  it("tier summary sold counts come from Supabase not Stripe metadata", async () => {
    const res = await GET(makeRequest("testpass"));
    const json = await res.json();

    const danceTier = json.tierSummary.find((t: { id: string }) => t.id === "dance");
    expect(danceTier.sold).toBe(2);
    expect(danceTier.capacity).toBe(100);
    expect(danceTier.remaining).toBe(98);

    const eboardTier = json.tierSummary.find((t: { id: string }) => t.id === "eboard");
    expect(eboardTier.sold).toBe(1);
    expect(eboardTier.capacity).toBe(15);
    expect(eboardTier.remaining).toBe(14);
  });

  it("calculates net revenue = totalRevenue minus actual Stripe processing fees", async () => {
    const res = await GET(makeRequest("testpass"));
    const json = await res.json();
    // sess_1: 5214 * 0.029 + 30 = 181.206 cents
    // sess_2: 2407 * 0.029 + 30 = 99.803 cents
    // stripeFees = Math.round(281.009) / 100 = $2.81
    // totalRevenue = (5214 + 2407) / 100 = $76.21
    // netRevenue = 76.21 - 2.81 = $73.40
    expect(json.netRevenue).toBe(73.40);
  });

  it("calculates Stripe fees = gross - net", async () => {
    const res = await GET(makeRequest("testpass"));
    const json = await res.json();
    expect(json.stripeFees).toBe(
      Math.round((json.totalRevenue - json.netRevenue) * 100) / 100
    );
  });
});
