import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

interface SendTicketParams {
  ticketId: string;
  buyerEmail: string;
  buyerName: string;
  ticketTier: string;
  quantity: number;
  eventName: string;
  eventDate: string;
  eventLocation: string;
  qrBase64: string;
}

export async function sendTicketEmail({
  ticketId,
  buyerEmail,
  buyerName,
  ticketTier,
  quantity,
  eventName,
  eventDate,
  eventLocation,
  qrBase64,
}: SendTicketParams) {
  const { data, error } = await resend.emails.send({
    from: "Synced Tickets <tickets@synced.vip>",
    to: buyerEmail,
    subject: `Your ${ticketTier} Ticket — ${eventName}`,
    html: `
      <div style="background-color: #0a0a0a; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; max-width: 600px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 28px; font-weight: 800; letter-spacing: 2px; margin: 0;">SYNCED</h1>
          <p style="color: #ef4444; font-size: 11px; text-transform: uppercase; letter-spacing: 3px; margin-top: 6px;">Digital Ticket</p>
        </div>

        <div style="background: #111; border: 1px solid #222; border-radius: 16px; padding: 32px; margin-bottom: 24px;">
          <h2 style="font-size: 22px; margin: 0 0 16px 0; font-weight: 700;">${eventName}</h2>
          <div style="color: #999; font-size: 14px; line-height: 2;">
            <p style="margin: 0;"><span style="color: #ef4444;">&#9830;</span> ${eventDate}</p>
            <p style="margin: 0;"><span style="color: #ef4444;">&#9830;</span> ${eventLocation}</p>
            <p style="margin: 0;"><span style="color: #ef4444;">&#9830;</span> ${ticketTier} x ${quantity}</p>
            <p style="margin: 0;"><span style="color: #ef4444;">&#9830;</span> ${buyerName}</p>
          </div>
        </div>

        <div style="text-align: center; background: #111; border: 1px solid #222; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
          <p style="color: #999; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 16px 0;">Scan at entry</p>
          <img src="data:image/png;base64,${qrBase64}" alt="QR Code" style="width: 200px; height: 200px;" />
          <p style="color: #555; font-size: 11px; margin: 16px 0 0 0; font-family: monospace;">${ticketId}</p>
        </div>

        <div style="text-align: center; background: #ef4444; border-radius: 12px; padding: 14px; margin-bottom: 24px;">
          <p style="margin: 0; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">18+ Event — Valid ID Required</p>
        </div>

        <p style="text-align: center; color: #555; font-size: 11px; margin: 0;">Powered by <span style="color: #999; font-weight: 600;">Synced</span></p>
      </div>
    `,
    attachments: [
      {
        filename: "qrcode.png",
        content: qrBase64,
        contentType: "image/png",
      },
    ],
    headers: {
      "X-Entity-Ref-ID": ticketId,
    },
  });

  if (error) {
    console.error("Resend error:", error);
    throw new Error(`Resend failed: ${JSON.stringify(error)}`);
  }

  console.log("Ticket email sent:", data);
}
