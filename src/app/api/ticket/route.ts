import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import { sendTicketEmail } from "@/lib/sendTicket";
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

    const attendeeField = session.custom_fields?.find((f) => f.key === "attendee_name");
    const buyerName = attendeeField?.text?.value || session.customer_details?.name || "";
    const buyerEmail = session.customer_details?.email ?? "";
    const buyerPhone = session.customer_details?.phone ?? "";
    const tierName = session.metadata?.tierName ?? "";
    const tierId = session.metadata?.tierId ?? "";

    // Get quantity from line items
    const lineItems = await stripe.checkout.sessions.listLineItems(sessionId);
    const quantity = lineItems.data[0]?.quantity ?? 1;

    const eventName = session.metadata?.eventName ?? "";
    const eventDate = session.metadata?.eventDate ?? "";
    const eventLocation = session.metadata?.eventLocation ?? "";

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

    // Send ticket email
    const qrBase64 = qrDataUrl.split(",")[1];
    try {
      await sendTicketEmail({
        ticketId,
        buyerEmail,
        buyerName,
        ticketTier: tierName,
        quantity,
        eventName,
        eventDate,
        eventLocation,
        qrBase64,
      });
      console.log("Ticket email sent to:", buyerEmail);
    } catch (emailErr) {
      console.error("Failed to send ticket email:", emailErr);
    }

    return NextResponse.json({
      ticketId,
      qrDataUrl,
      buyerName,
      buyerEmail,
      tierName,
      eventName,
      eventDate,
      eventLocation,
      quantity,
    });
  } catch (err) {
    console.error("Error retrieving session:", err);
    return NextResponse.json({ error: "Invalid session" }, { status: 400 });
  }
}
