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

  // Fetch all tickets from Supabase — this is the source of truth for sold counts
  const { data: supabaseTickets } = await supabase
    .from("tickets")
    .select("id, stripe_session_id, buyer_name, buyer_email, tier_id, ticket_tier, quantity");

  const activeSessionIds = new Set(
    (supabaseTickets ?? []).map((t) => t.stripe_session_id)
  );

  // Only show Stripe sessions that still have a ticket in Supabase (not cancelled)
  const activeSessions = sessions.data.filter((session) =>
    activeSessionIds.has(session.id)
  );

  // Use Supabase buyer_name (reflects the attendee custom field) and Stripe for amounts/dates
  const tickets = activeSessions.map((session) => {
    const sb = (supabaseTickets ?? []).find(
      (t) => t.stripe_session_id === session.id
    );
    return {
      id: session.id,
      buyerName: sb?.buyer_name ?? session.customer_details?.name ?? "—",
      buyerEmail: session.customer_details?.email ?? "—",
      tierName: sb?.ticket_tier ?? session.metadata?.tierName ?? "—",
      tierId: sb?.tier_id ?? session.metadata?.tierId ?? "—",
      quantity: sb?.quantity ?? session.line_items?.data[0]?.quantity ?? 1,
      amount: (session.amount_total ?? 0) / 100,
      date: new Date(session.created * 1000).toLocaleString("en-US", { timeZone: "America/New_York" }),
    };
  });

  // Build per-tier summary from Supabase (source of truth) not Stripe metadata
  const capacities = await getTierCapacities();
  const tierSummary = EVENT.tiers.map((tier) => {
    const tierRows = (supabaseTickets ?? []).filter(
      (t) => t.tier_id === tier.id
    );
    const sold = tierRows.reduce((sum, t) => sum + (t.quantity ?? 1), 0);
    const capacity = capacities.get(tier.id) ?? tier.capacity;
    // Revenue from Supabase: tier price × qty sold (source of truth)
    const tierRevenue = tier.price * sold;
    return {
      id: tier.id,
      name: tier.name,
      price: tier.price,
      capacity,
      sold,
      remaining: capacity - sold,
      revenue: tierRevenue,
    };
  });

  const totalSold = (supabaseTickets ?? []).reduce(
    (sum, t) => sum + (t.quantity ?? 1),
    0
  );
  // Gross revenue = actual Stripe amounts (matches Stripe dashboard gross volume)
  const totalRevenue =
    Math.round(
      activeSessions.reduce((sum, s) => sum + (s.amount_total ?? 0), 0)
    ) / 100;
  // Stripe processing fees: 2.9% of amount_total + $0.30 per session
  const stripeFees =
    Math.round(
      activeSessions.reduce(
        (sum, s) => sum + (s.amount_total ?? 0) * 0.029 + 30,
        0
      )
    ) / 100;
  // Net revenue = what we keep after Stripe takes their cut (matches Stripe dashboard net)
  const netRevenue = Math.round((totalRevenue - stripeFees) * 100) / 100;

  return NextResponse.json({
    tickets,
    tierSummary,
    totalRevenue,
    netRevenue,
    stripeFees,
    totalSold,
  });
}
