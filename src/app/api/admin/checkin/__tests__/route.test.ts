import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.stubEnv("ADMIN_PASSWORD", "testpass");

const { mockSupabase } = vi.hoisted(() => ({
  mockSupabase: { from: vi.fn() },
}));

vi.mock("@/lib/supabase", () => ({ supabase: mockSupabase }));

import { POST } from "@/app/api/admin/checkin/route";

function makeRequest(body: Record<string, unknown>, password?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (password) headers["x-admin-password"] = password;
  return new NextRequest("http://localhost:3000/api/admin/checkin", {
    method: "POST",
    body: JSON.stringify(body),
    headers,
  });
}

const mockTicket = {
  id: "ticket-1",
  buyer_name: "Alice",
  buyer_email: "alice@test.com",
  ticket_tier: "Dance Team",
  quantity: 1,
  checked_in: false,
};

describe("POST /api/admin/checkin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without password", async () => {
    const res = await POST(makeRequest({ ticketId: "t1" }));
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

    const res = await POST(
      makeRequest({ ticketId: "nonexistent" }, "testpass")
    );
    expect(res.status).toBe(404);
  });

  it("returns 409 for already checked in", async () => {
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { ...mockTicket, checked_in: true },
            error: null,
          }),
        }),
      }),
    });

    const res = await POST(makeRequest({ ticketId: "ticket-1" }, "testpass"));
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toBe("Already checked in");
  });

  it("marks ticket as checked in", async () => {
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockTicket,
            error: null,
          }),
        }),
      }),
    });

    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });
    mockSupabase.from.mockReturnValueOnce({ update: mockUpdate });

    const res = await POST(makeRequest({ ticketId: "ticket-1" }, "testpass"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.ticket.checked_in).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({ checked_in: true });
    expect(mockUpdateEq).toHaveBeenCalledWith("id", "ticket-1");
  });
});
