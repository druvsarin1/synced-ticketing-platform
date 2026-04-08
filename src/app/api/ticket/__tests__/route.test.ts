import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockSupabase, mockRetrieve, mockListLineItems, mockSendTicketEmail } =
  vi.hoisted(() => ({
    mockSupabase: { from: vi.fn(), rpc: vi.fn() },
    mockRetrieve: vi.fn(),
    mockListLineItems: vi.fn(),
    mockSendTicketEmail: vi.fn(),
  }));

vi.mock("@/lib/supabase", () => ({ supabase: mockSupabase }));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        retrieve: (...args: unknown[]) => mockRetrieve(...args),
        listLineItems: (...args: unknown[]) => mockListLineItems(...args),
      },
    },
  },
}));

vi.mock("@/lib/sendTicket", () => ({
  sendTicketEmail: (...args: unknown[]) => mockSendTicketEmail(...args),
}));

vi.mock("@/lib/capacity", () => ({
  getTierCapacities: vi.fn().mockResolvedValue(
    new Map([["dance", 100], ["eboard", 15], ["ga", 17], ["ga2", 20]])
  ),
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,fakeQR"),
  },
}));

vi.mock("uuid", () => ({
  v4: () => "test-uuid-1234",
}));

import { GET } from "@/app/api/ticket/route";

function makeRequest(sessionId?: string) {
  const url = sessionId
    ? `http://localhost:3000/api/ticket?session_id=${sessionId}`
    : "http://localhost:3000/api/ticket";
  return new NextRequest(url);
}

const mockSession = {
  payment_status: "paid",
  customer_details: {
    name: "John Doe",
    email: "john@example.com",
    phone: "+15551234567",
  },
  metadata: {
    tierName: "Dance Team",
    tierId: "dance",
    eventName: "SHOLAY",
    eventDate: "Saturday, April 18, 2026",
    eventLocation: "Infinite Lounge",
  },
};

/** Sets up supabase mocks for a successful new-ticket flow:
 *  1. existing ticket check → null
 *  2. rpc claim_ticket → ok: true
 */
function mockNewTicketFlow() {
  // 1. existing ticket check
  mockSupabase.from.mockReturnValueOnce({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: null }),
      }),
    }),
  });
  // 2. atomic RPC insert → success
  mockSupabase.rpc.mockResolvedValueOnce({ data: { ok: true, sold: 1 }, error: null });
}

describe("GET /api/ticket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendTicketEmail.mockResolvedValue(undefined);
  });

  it("returns 400 for missing session_id", async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Missing session_id");
  });

  it("returns existing ticket if session already processed (idempotency)", async () => {
    const existingTicket = {
      id: "existing-uuid",
      buyer_name: "John Doe",
      buyer_email: "john@example.com",
      ticket_tier: "Dance Team",
      quantity: 2,
    };
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: existingTicket }),
        }),
      }),
    });

    const res = await GET(makeRequest("sess_123"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ticketId).toBe("existing-uuid");
    expect(json.buyerName).toBe("John Doe");
    expect(mockRetrieve).not.toHaveBeenCalled();
  });

  it("creates new ticket for new session", async () => {
    mockNewTicketFlow();
    mockRetrieve.mockResolvedValue(mockSession);
    mockListLineItems.mockResolvedValue({ data: [{ quantity: 3 }] });

    const res = await GET(makeRequest("sess_new"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ticketId).toBe("test-uuid-1234");
    expect(json.buyerName).toBe("John Doe");
    expect(json.quantity).toBe(3);
  });

  it("calls RPC with correct fields including tier_id and capacity", async () => {
    mockNewTicketFlow();
    mockRetrieve.mockResolvedValue(mockSession);
    mockListLineItems.mockResolvedValue({ data: [{ quantity: 1 }] });

    await GET(makeRequest("sess_new"));

    expect(mockSupabase.rpc).toHaveBeenCalledWith("claim_ticket", expect.objectContaining({
      p_ticket_id: "test-uuid-1234",
      p_stripe_session_id: "sess_new",
      p_buyer_email: "john@example.com",
      p_buyer_name: "John Doe",
      p_buyer_phone: "+15551234567",
      p_ticket_tier: "Dance Team",
      p_tier_id: "dance",
      p_quantity: 1,
      p_capacity: 100,
    }));
  });

  it("sends email after successful RPC insert", async () => {
    mockNewTicketFlow();
    mockRetrieve.mockResolvedValue(mockSession);
    mockListLineItems.mockResolvedValue({ data: [{ quantity: 1 }] });

    await GET(makeRequest("sess_new"));

    expect(mockSendTicketEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        ticketId: "test-uuid-1234",
        buyerEmail: "john@example.com",
        buyerName: "John Doe",
        ticketTier: "Dance Team",
      })
    );
  });

  it("returns 409 when RPC reports sold out (capacity enforcement)", async () => {
    // existing ticket check → null
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });
    // RPC → sold out
    mockSupabase.rpc.mockResolvedValueOnce({ data: { ok: false, sold: 20 }, error: null });

    mockRetrieve.mockResolvedValue(mockSession);
    mockListLineItems.mockResolvedValue({ data: [{ quantity: 1 }] });

    const res = await GET(makeRequest("sess_oversold"));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("Sold out");
    // No email sent for sold-out
    expect(mockSendTicketEmail).not.toHaveBeenCalled();
  });

  it("returns 402 if payment not completed", async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });
    mockRetrieve.mockResolvedValue({ ...mockSession, payment_status: "unpaid" });

    const res = await GET(makeRequest("sess_unpaid"));
    expect(res.status).toBe(402);
    const json = await res.json();
    expect(json.error).toBe("Payment not completed");
  });

  it("only 20 of 21 concurrent buyers get tickets when capacity is 20", async () => {
    const CAPACITY = 20;
    let sold = 0;

    // RPC mock behaves like the real advisory lock: serialized, tracks sold count
    mockSupabase.rpc.mockImplementation(async () => {
      if (sold >= CAPACITY) {
        return { data: { ok: false, sold }, error: null };
      }
      sold++;
      return { data: { ok: true, sold }, error: null };
    });

    // All 21 are new sessions (no existing ticket)
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });

    mockRetrieve.mockResolvedValue({
      ...mockSession,
      metadata: { ...mockSession.metadata, tierId: "ga2", tierName: "General Admission" },
    });
    mockListLineItems.mockResolvedValue({ data: [{ quantity: 1 }] });

    // Fire all 21 requests simultaneously
    const responses = await Promise.all(
      Array.from({ length: 21 }, (_, i) => GET(makeRequest(`sess_${i}`)))
    );

    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 200).length).toBe(20);
    expect(statuses.filter((s) => s === 409).length).toBe(1);
    expect(mockSendTicketEmail).toHaveBeenCalledTimes(20);
  });

  it("uses attendee custom field name over card holder name", async () => {
    mockNewTicketFlow();
    mockRetrieve.mockResolvedValue({
      ...mockSession,
      custom_fields: [{ key: "attendee_name", text: { value: "Jane Smith" } }],
      customer_details: { name: "Parent Card", email: "john@example.com", phone: "" },
    });
    mockListLineItems.mockResolvedValue({ data: [{ quantity: 1 }] });

    const res = await GET(makeRequest("sess_attendee"));
    const json = await res.json();
    expect(json.buyerName).toBe("Jane Smith");
  });

  it("falls back to card holder name if no attendee custom field", async () => {
    mockNewTicketFlow();
    mockRetrieve.mockResolvedValue({
      ...mockSession,
      custom_fields: [],
      customer_details: { name: "Card Holder", email: "john@example.com", phone: "" },
    });
    mockListLineItems.mockResolvedValue({ data: [{ quantity: 1 }] });

    const res = await GET(makeRequest("sess_fallback"));
    const json = await res.json();
    expect(json.buyerName).toBe("Card Holder");
  });

  it("returns 409 (not crash) when RPC returns an error", async () => {
    // existing ticket check → null
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });
    // RPC returns supabase error (e.g. function not found, DB down)
    mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: { message: "function not found" } });

    mockRetrieve.mockResolvedValue(mockSession);
    mockListLineItems.mockResolvedValue({ data: [{ quantity: 1 }] });

    const res = await GET(makeRequest("sess_rpc_error"));
    expect(res.status).toBe(409);
    expect(mockSendTicketEmail).not.toHaveBeenCalled();
  });

  it("does not send email when tier is sold out", async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });
    mockSupabase.rpc.mockResolvedValueOnce({ data: { ok: false, sold: 20 }, error: null });

    mockRetrieve.mockResolvedValue({
      ...mockSession,
      metadata: { ...mockSession.metadata, tierId: "ga2", tierName: "General Admission" },
    });
    mockListLineItems.mockResolvedValue({ data: [{ quantity: 1 }] });

    const res = await GET(makeRequest("sess_sold_out"));
    expect(res.status).toBe(409);
    expect(mockSendTicketEmail).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid session", async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });
    mockRetrieve.mockRejectedValue(new Error("No such session"));

    const res = await GET(makeRequest("sess_invalid"));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid session");
  });
});
