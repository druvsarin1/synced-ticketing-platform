import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import { sendTicketEmail } from "@/lib/sendTicket";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const buyerEmail = session.customer_details?.email ?? "";
    const buyerName = session.customer_details?.name ?? "";
    const { tierName, eventName, eventDate, eventLocation } =
      session.metadata ?? {};

    // Get line item quantity
    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    const quantity = lineItems.data[0]?.quantity ?? 1;

    // Send ticket email
    const ticketId = await sendTicketEmail({
      ticketId: "",
      buyerEmail,
      buyerName,
      ticketTier: tierName ?? "",
      quantity,
      eventName: eventName ?? "",
      eventDate: eventDate ?? "",
      eventLocation: eventLocation ?? "",
    });

    // Save to Supabase
    await supabase.from("tickets").insert({
      id: ticketId,
      stripe_session_id: session.id,
      buyer_email: buyerEmail,
      buyer_name: buyerName,
      ticket_tier: tierName,
      quantity,
      checked_in: false,
    });
  }

  return NextResponse.json({ received: true });
}
