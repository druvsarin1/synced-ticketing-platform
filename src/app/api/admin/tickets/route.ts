import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { EVENT } from "@/lib/event";

export async function GET(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch all completed checkout sessions from Stripe
  const sessions = await stripe.checkout.sessions.list({
    status: "complete",
    limit: 100,
    expand: ["data.line_items"],
  });

  const tickets = sessions.data.map((session) => ({
    id: session.id,
    buyerName: session.customer_details?.name ?? "—",
    buyerEmail: session.customer_details?.email ?? "—",
    tierName: session.metadata?.tierName ?? "—",
    tierId: session.metadata?.tierId ?? "—",
    quantity: session.line_items?.data[0]?.quantity ?? 1,
    amount: (session.amount_total ?? 0) / 100,
    date: new Date(session.created * 1000).toLocaleString("en-US", { timeZone: "America/New_York" }),
  }));

  // Build per-tier summary
  const tierSummary = EVENT.tiers.map((tier) => {
    const tierTickets = tickets.filter((t) => t.tierId === tier.id);
    const sold = tierTickets.reduce((sum, t) => sum + t.quantity, 0);
    return {
      id: tier.id,
      name: tier.name,
      price: tier.price,
      capacity: tier.capacity,
      sold,
      remaining: tier.capacity - sold,
      revenue: tierTickets.reduce((sum, t) => sum + t.amount, 0),
    };
  });

  const totalRevenue = tickets.reduce((sum, t) => sum + t.amount, 0);
  const totalSold = tickets.reduce((sum, t) => sum + t.quantity, 0);

  return NextResponse.json({
    tickets,
    tierSummary,
    totalRevenue,
    totalSold,
  });
}
