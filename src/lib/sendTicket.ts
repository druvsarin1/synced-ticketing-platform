import { Resend } from "resend";
import QRCode from "qrcode";
import { v4 as uuidv4 } from "uuid";

const resend = new Resend(process.env.RESEND_API_KEY!);

interface SendTicketParams {
  buyerEmail: string;
  buyerName: string;
  ticketTier: string;
  quantity: number;
  eventName: string;
  eventDate: string;
  eventLocation: string;
}

export async function generateTicketId(): Promise<string> {
  return uuidv4();
}

export async function sendTicketEmail({
  buyerEmail,
  buyerName,
  ticketTier,
  quantity,
  eventName,
  eventDate,
  eventLocation,
}: SendTicketParams & { ticketId: string }) {
  const ticketId = await generateTicketId();
  const qrDataUrl = await QRCode.toDataURL(ticketId, {
    width: 300,
    margin: 2,
    color: { dark: "#ffffff", light: "#0a0a0a" },
  });

  // Convert data URL to base64 for email attachment
  const qrBase64 = qrDataUrl.split(",")[1];

  await resend.emails.send({
    from: "Synced Tickets <tickets@synced.com>",
    to: buyerEmail,
    subject: `Your ${ticketTier} Ticket for ${eventName}`,
    html: `
      <div style="background-color: #0a0a0a; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px; max-width: 600px; margin: 0 auto;">
        <div style="text-align: center; margin-bottom: 32px;">
          <h1 style="font-size: 28px; font-weight: 700; letter-spacing: -0.5px; margin: 0;">SYNCED</h1>
          <p style="color: #a855f7; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px;">Digital Ticket</p>
        </div>

        <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border: 1px solid #333; border-radius: 16px; padding: 32px; margin-bottom: 24px;">
          <h2 style="font-size: 24px; margin: 0 0 16px 0; font-weight: 600;">${eventName}</h2>
          <div style="color: #999; font-size: 14px; line-height: 1.8;">
            <p style="margin: 0;">📅 ${eventDate}</p>
            <p style="margin: 0;">📍 ${eventLocation}</p>
            <p style="margin: 0;">🎫 ${ticketTier} × ${quantity}</p>
            <p style="margin: 0;">👤 ${buyerName}</p>
          </div>
        </div>

        <div style="text-align: center; background: #111; border: 1px solid #333; border-radius: 16px; padding: 24px; margin-bottom: 24px;">
          <p style="color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 16px 0;">Scan at entry</p>
          <img src="cid:qrcode" alt="QR Code" style="width: 200px; height: 200px;" />
          <p style="color: #666; font-size: 11px; margin: 16px 0 0 0; font-family: monospace;">${ticketId}</p>
        </div>

        <p style="text-align: center; color: #666; font-size: 12px; margin: 0;">Powered by Synced</p>
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

  return ticketId;
}
