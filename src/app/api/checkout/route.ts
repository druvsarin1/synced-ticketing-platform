import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { EVENT } from "@/lib/event";
import { calculateFee } from "@/lib/fees";

export async function POST(req: NextRequest) {
  const { tierId, tierName, price, eventName, eventDate, eventLocation } =
    await req.json();

  // Check capacity
  const tier = EVENT.tiers.find((t) => t.id === tierId);
  if (tier) {
    const sessions = await stripe.checkout.sessions.list({
      status: "complete",
      limit: 100,
    });

    const sold = sessions.data
      .filter((s) => s.metadata?.tierId === tierId)
      .reduce((sum) => sum + 1, 0);

    if (sold >= tier.capacity) {
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
