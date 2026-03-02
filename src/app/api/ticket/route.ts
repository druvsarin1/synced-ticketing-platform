import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import QRCode from "qrcode";
import { v4 as uuidv4 } from "uuid";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
  }

  // Check if we already saved a ticket for this session
  const { data: existing } = await supabase
    .from("tickets")
    .select("*")
    .eq("stripe_session_id", sessionId)
    .single();

  if (existing) {
    const qrDataUrl = await QRCode.toDataURL(existing.id, {
      width: 400,
      margin: 2,
      color: { dark: "#ffffff", light: "#0a0a0a" },
    });
    return NextResponse.json({
      ticketId: existing.id,
      qrDataUrl,
      buyerName: existing.buyer_name,
      buyerEmail: existing.buyer_email,
      tierName: existing.ticket_tier,
      quantity: existing.quantity,
      eventName: "",
      eventDate: "",
      eventLocation: "",
    });
  }

  try {
    // Verify payment with Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json({ error: "Payment not completed" }, { status: 402 });
    }

    const ticketId = uuidv4();
    const qrDataUrl = await QRCode.toDataURL(ticketId, {
      width: 400,
      margin: 2,
      color: { dark: "#ffffff", light: "#0a0a0a" },
    });

    const buyerName = session.customer_details?.name ?? "";
    const buyerEmail = session.customer_details?.email ?? "";
    const buyerPhone = session.customer_details?.phone ?? "";
    const tierName = session.metadata?.tierName ?? "";
    const tierId = session.metadata?.tierId ?? "";

    // Get quantity from line items
    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId);
    const quantity = lineItems.data[0]?.quantity ?? 1;

    // Save to Supabase
    await supabase.from("tickets").insert({
      id: ticketId,
      stripe_session_id: sessionId,
      buyer_email: buyerEmail,
      buyer_name: buyerName,
      buyer_phone: buyerPhone,
      ticket_tier: tierName,
      tier_id: tierId,
      quantity,
      checked_in: false,
    });

    return NextResponse.json({
      ticketId,
      qrDataUrl,
      buyerName,
      buyerEmail,
      tierName,
      eventName: session.metadata?.eventName ?? "",
      eventDate: session.metadata?.eventDate ?? "",
      eventLocation: session.metadata?.eventLocation ?? "",
      quantity,
    });
  } catch (err) {
    console.error("Error retrieving session:", err);
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }
}
