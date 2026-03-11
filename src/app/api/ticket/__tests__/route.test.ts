import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockSupabase, mockRetrieve, mockListLineItems, mockSendTicketEmail } =
  vi.hoisted(() => ({
    mockSupabase: { from: vi.fn() },
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
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });
    mockSupabase.from.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });

    mockRetrieve.mockResolvedValue(mockSession);
    mockListLineItems.mockResolvedValue({ data: [{ quantity: 3 }] });

    const res = await GET(makeRequest("sess_new"));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ticketId).toBe("test-uuid-1234");
    expect(json.buyerName).toBe("John Doe");
    expect(json.quantity).toBe(3);
  });

  it("saves correct fields to Supabase (including phone, tier_id)", async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockSupabase.from.mockReturnValueOnce({ insert: mockInsert });

    mockRetrieve.mockResolvedValue(mockSession);
    mockListLineItems.mockResolvedValue({ data: [{ quantity: 1 }] });

    await GET(makeRequest("sess_new"));

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "test-uuid-1234",
        stripe_session_id: "sess_new",
        buyer_email: "john@example.com",
        buyer_name: "John Doe",
        buyer_phone: "+15551234567",
        ticket_tier: "Dance Team",
        tier_id: "dance",
        quantity: 1,
        checked_in: false,
      })
    );
  });

  it("sends email via sendTicketEmail", async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null }),
        }),
      }),
    });
    mockSupabase.from.mockReturnValueOnce({
      insert: vi.fn().mockResolvedValue({ error: null }),
    });
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
