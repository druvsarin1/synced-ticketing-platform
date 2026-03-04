import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabase";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticketId, stripeSessionId } = await req.json();

  // Get ticket from Supabase (by ticket UUID or stripe session ID)
  let query = supabase.from("tickets").select("*");
  if (ticketId) {
    query = query.eq("id", ticketId);
  } else if (stripeSessionId) {
    query = query.eq("stripe_session_id", stripeSessionId);
  } else {
    return NextResponse.json({ error: "Missing ticket ID" }, { status: 400 });
  }
  const { data: ticket, error: fetchError } = await query.single();

  if (fetchError || !ticket) {
    console.error("Ticket lookup failed:", fetchError);
    return NextResponse.json(
      { error: "Ticket not found", details: fetchError?.message },
      { status: 404 }
    );
  }

  console.log("Cancelling ticket:", ticket.id, "for", ticket.buyer_name);

  // Refund via Stripe using the session's payment intent
  let refundId: string | null = null;
  try {
    const session = await stripe.checkout.sessions.retrieve(
      ticket.stripe_session_id
    );

    if (session.payment_intent) {
      const refund = await stripe.refunds.create({
        payment_intent: session.payment_intent as string,
      });
      refundId = refund.id;
      console.log("Stripe refund created:", refund.id, "status:", refund.status);
    }
  } catch (err) {
    console.error("Stripe refund error:", err);
    return NextResponse.json(
      { error: "Failed to process refund" },
      { status: 500 }
    );
  }

  // Delete ticket from Supabase
  const { error: deleteError } = await supabase
    .from("tickets")
    .delete()
    .eq("id", ticket.id);

  if (deleteError) {
    console.error("Supabase delete failed:", deleteError);
    return NextResponse.json(
      { error: "Refund processed but failed to delete ticket", refundId },
      { status: 500 }
    );
  }

  console.log("Ticket deleted from Supabase:", ticket.id);

  // Send cancellation email
  if (ticket.buyer_email) {
    try {
      await resend.emails.send({
        from: "Synced Tickets <tickets@synced.vip>",
        to: ticket.buyer_email,
        subject: `Ticket Cancelled — ${ticket.ticket_tier}`,
        html: `
          <div style="background-color: #0a0a0a; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; max-width: 600px; margin: 0 auto;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-size: 28px; font-weight: 800; letter-spacing: 2px; margin: 0;">SYNCED</h1>
              <p style="color: #ef4444; font-size: 11px; text-transform: uppercase; letter-spacing: 3px; margin-top: 6px;">Ticket Cancelled</p>
            </div>

            <div style="background: #111; border: 1px solid #222; border-radius: 16px; padding: 32px; margin-bottom: 24px;">
              <h2 style="font-size: 20px; margin: 0 0 16px 0; font-weight: 700;">Your ticket has been cancelled</h2>
              <div style="color: #999; font-size: 14px; line-height: 2;">
                <p style="margin: 0;"><span style="color: #ef4444;">&#9830;</span> ${ticket.ticket_tier}</p>
                <p style="margin: 0;"><span style="color: #ef4444;">&#9830;</span> ${ticket.buyer_name}</p>
              </div>
              <p style="color: #999; font-size: 14px; margin-top: 16px;">
                A full refund has been issued to your original payment method. It may take 5–10 business days to appear on your statement.
              </p>
            </div>

            <p style="text-align: center; color: #555; font-size: 11px; margin: 0;">If you have questions, contact <span style="color: #999;">@synced_official</span> on Instagram.</p>
          </div>
        `,
      });
      console.log("Cancellation email sent to:", ticket.buyer_email);
    } catch (emailErr) {
      console.error("Cancel email failed:", emailErr);
    }
  }

  return NextResponse.json({ success: true, refundId, deletedTicketId: ticket.id });
}
