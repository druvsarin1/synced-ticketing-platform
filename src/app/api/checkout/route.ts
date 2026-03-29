import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import { EVENT } from "@/lib/event";
import { calculateFee } from "@/lib/fees";
import { getTierCapacities } from "@/lib/capacity";

export async function POST(req: NextRequest) {
  const { tierId, tierName, price, eventName, eventDate, eventLocation } =
    await req.json();

  // Check capacity against Supabase (source of truth, excludes cancelled tickets)
  const tier = EVENT.tiers.find((t) => t.id === tierId);
  if (tier) {
    const { data: tickets } = await supabase
      .from("tickets")
      .select("quantity")
      .eq("tier_id", tierId);

    const sold = (tickets ?? []).reduce((sum, t) => sum + (t.quantity ?? 1), 0);

    // Use dynamic capacity from Supabase, falling back to hardcoded
    const capacities = await getTierCapacities();
    const capacity = capacities.get(tierId) ?? tier.capacity;

    if (sold >= capacity) {
      return NextResponse.json({ error: "Sold out" }, { status: 400 });
    }
  }

  const origin = req.headers.get("origin") || req.nextUrl.origin;
  const { fee } = calculateFee(price);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    phone_number_collection: { enabled: true },
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${tierName} — ${eventName}`,
            description: `${eventDate} · ${eventLocation}`,
          },
          unit_amount: Math.round(price * 100),
        },
        quantity: 1,
        adjustable_quantity: { enabled: true, minimum: 1, maximum: 10 },
      },
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: "Stripe Service Fee",
          },
          unit_amount: Math.round(fee * 100),
        },
        quantity: 1,
      },
    ],
    custom_fields: [
      {
        key: "attendee_name",
        label: { type: "custom", custom: "Your name (as it will appear on your ticket)" },
        type: "text",
      },
    ],
    mode: "payment",
    success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: origin,
    metadata: {
      tierId,
      tierName,
      eventName,
      eventDate,
      eventLocation,
    },
  });

  return NextResponse.json({ url: session.url });
}
