import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.stubEnv("ADMIN_PASSWORD", "testpass");
vi.stubEnv("RESEND_API_KEY", "re_test");

const { mockSupabase, mockSessionRetrieve, mockRefundCreate, mockEmailSend } =
  vi.hoisted(() => ({
    mockSupabase: { from: vi.fn() },
    mockSessionRetrieve: vi.fn(),
    mockRefundCreate: vi.fn(),
    mockEmailSend: vi.fn(),
  }));

vi.mock("@/lib/supabase", () => ({ supabase: mockSupabase }));

vi.mock("@/lib/stripe", () => ({
  stripe: {
    checkout: {
      sessions: {
        retrieve: (...args: unknown[]) => mockSessionRetrieve(...args),
      },
    },
    refunds: {
      create: (...args: unknown[]) => mockRefundCreate(...args),
    },
  },
}));

vi.mock("resend", () => {
  return {
    Resend: class {
      emails = { send: (...args: unknown[]) => mockEmailSend(...args) };
    },
  };
});

import { POST } from "@/app/api/admin/cancel/route";

function makeRequest(body: Record<string, unknown>, password?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (password) headers["x-admin-password"] = password;
  return new NextRequest("http://localhost:3000/api/admin/cancel", {
    method: "POST",
    body: JSON.stringify(body),
    headers,
  });
}

const mockTicket = {
  id: "ticket-uuid-1",
  stripe_session_id: "sess_123",
  buyer_name: "Jane Doe",
  buyer_email: "jane@example.com",
  ticket_tier: "Dance Team",
};

describe("POST /api/admin/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmailSend.mockResolvedValue({ data: { id: "email-1" }, error: null });
  });

  it("returns 401 without password", async () => {
    const res = await POST(makeRequest({ ticketId: "t1" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong password", async () => {
    const res = await POST(makeRequest({ ticketId: "t1" }, "wrongpass"));
    expect(res.status).toBe(401);
  });

  it("returns 404 for missing ticket", async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: "not found" },
          }),
        }),
      }),
    });

    const res = await POST(makeRequest({ ticketId: "nonexistent" }, "testpass"));
    expect(res.status).toBe(404);
  });

  it("refunds via Stripe payment intent", async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockTicket, error: null }),
        }),
      }),
    });
    mockSupabase.from.mockReturnValueOnce({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    mockSessionRetrieve.mockResolvedValue({ payment_intent: "pi_123" });
    mockRefundCreate.mockResolvedValue({ id: "re_123", status: "succeeded" });

    const res = await POST(makeRequest({ ticketId: "ticket-uuid-1" }, "testpass"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.refundId).toBe("re_123");
    expect(mockRefundCreate).toHaveBeenCalledWith({ payment_intent: "pi_123" });
  });

  it("deletes ticket from Supabase using ticket.id (not ticketId param)", async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockTicket, error: null }),
        }),
      }),
    });

    const mockDeleteEq = vi.fn().mockResolvedValue({ error: null });
    const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq });
    mockSupabase.from.mockReturnValueOnce({ delete: mockDelete });

    mockSessionRetrieve.mockResolvedValue({ payment_intent: "pi_123" });
    mockRefundCreate.mockResolvedValue({ id: "re_123", status: "succeeded" });

    await POST(makeRequest({ ticketId: "ticket-uuid-1" }, "testpass"));

    expect(mockDeleteEq).toHaveBeenCalledWith("id", mockTicket.id);
  });

  it("sends cancellation email", async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockTicket, error: null }),
        }),
      }),
    });
    mockSupabase.from.mockReturnValueOnce({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    mockSessionRetrieve.mockResolvedValue({ payment_intent: "pi_123" });
    mockRefundCreate.mockResolvedValue({ id: "re_123", status: "succeeded" });

    await POST(makeRequest({ ticketId: "ticket-uuid-1" }, "testpass"));

    expect(mockEmailSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "jane@example.com",
        subject: expect.stringContaining("Cancelled"),
      })
    );
  });

  it("works with stripeSessionId lookup", async () => {
    const mockEq = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: mockTicket, error: null }),
    });
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: mockEq }),
    });
    mockSupabase.from.mockReturnValueOnce({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    mockSessionRetrieve.mockResolvedValue({ payment_intent: "pi_123" });
    mockRefundCreate.mockResolvedValue({ id: "re_123", status: "succeeded" });

    const res = await POST(
      makeRequest({ stripeSessionId: "sess_123" }, "testpass")
    );
    expect(res.status).toBe(200);
    expect(mockEq).toHaveBeenCalledWith("stripe_session_id", "sess_123");
  });

  it("works with ticketId lookup", async () => {
    const mockEq = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: mockTicket, error: null }),
    });
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({ eq: mockEq }),
    });
    mockSupabase.from.mockReturnValueOnce({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    mockSessionRetrieve.mockResolvedValue({ payment_intent: "pi_123" });
    mockRefundCreate.mockResolvedValue({ id: "re_123", status: "succeeded" });

    const res = await POST(
      makeRequest({ ticketId: "ticket-uuid-1" }, "testpass")
    );
    expect(res.status).toBe(200);
    expect(mockEq).toHaveBeenCalledWith("id", "ticket-uuid-1");
  });
});
