import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import { EVENT } from "@/lib/event";
import { getTierCapacities } from "@/lib/capacity";

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

  // Get active ticket session IDs from Supabase to filter out cancelled ones
  const { data: activeTickets } = await supabase
    .from("tickets")
    .select("stripe_session_id");
  const activeSessionIds = new Set(
    (activeTickets ?? []).map((t) => t.stripe_session_id)
  );

  // Only show sessions that still have a ticket in Supabase
  const activeSessions = sessions.data.filter((session) =>
    activeSessionIds.has(session.id)
  );

  const tickets = activeSessions.map((session) => ({
    id: session.id,
    buyerName: session.customer_details?.name ?? "—",
    buyerEmail: session.customer_details?.email ?? "—",
    tierName: session.metadata?.tierName ?? "—",
    tierId: session.metadata?.tierId ?? "—",
    quantity: session.line_items?.data[0]?.quantity ?? 1,
    amount: (session.amount_total ?? 0) / 100,
    date: new Date(session.created * 1000).toLocaleString("en-US", { timeZone: "America/New_York" }),
  }));

  // Build per-tier summary using dynamic capacities
  const capacities = await getTierCapacities();
  const tierSummary = EVENT.tiers.map((tier) => {
    const tierTickets = tickets.filter((t) => t.tierId === tier.id);
    const sold = tierTickets.reduce((sum, t) => sum + t.quantity, 0);
    const capacity = capacities.get(tier.id) ?? tier.capacity;
    return {
      id: tier.id,
      name: tier.name,
      price: tier.price,
      capacity,
      sold,
      remaining: capacity - sold,
      revenue: tierTickets.reduce((sum, t) => sum + t.amount, 0),
    };
  });

  const totalRevenue = tickets.reduce((sum, t) => sum + t.amount, 0);
  const totalSold = tickets.reduce((sum, t) => sum + t.quantity, 0);
  // Net revenue = what you keep (tier price × qty, no Stripe fees)
  const netRevenue = tierSummary.reduce(
    (sum, tier) => sum + tier.price * tier.sold, 0
  );
  const stripeFees = Math.round((totalRevenue - netRevenue) * 100) / 100;

  return NextResponse.json({
    tickets,
    tierSummary,
    totalRevenue,
    netRevenue,
    stripeFees,
    totalSold,
  });
}
