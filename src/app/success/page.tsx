"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

interface TicketData {
  ticketId: string;
  qrDataUrl: string;
  buyerName: string;
  buyerEmail: string;
  tierName: string;
  eventName: string;
  eventDate: string;
  eventLocation: string;
  quantity: number;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const isDemo = searchParams.get("demo") === "true";
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemo) {
      setTicket({
        ticketId: "demo-0000-1111-2222-3333",
        qrDataUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect width='200' height='200' fill='white'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' font-size='16' fill='black'%3EDemo QR%3C/text%3E%3C/svg%3E",
        buyerName: "Test User",
        buyerEmail: "test@example.com",
        tierName: "E-Board",
        eventName: "SHOLAY",
        eventDate: "Saturday, April 18, 2026",
        eventLocation: "Infinite Lounge",
        quantity: 1,
      });
      setLoading(false);
      return;
    }

    if (!sessionId) {
      setLoading(false);
      setError("No session found");
      return;
    }

    fetch(`/api/ticket?session_id=${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load ticket");
        return res.json();
      })
      .then((data) => setTicket(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [sessionId, isDemo]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-500">Loading your ticket...</p>
        </div>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || "Something went wrong"}</p>
          <a href="/" className="text-zinc-500 hover:text-white text-sm transition-colors">
            ← Back to event
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-5 py-12">
      <div className="max-w-sm w-full">
        {/* Ticket card */}
        <div className="bg-gradient-to-b from-[#1a0a0a] to-[#0a0a0a] border border-red-500/15 rounded-3xl overflow-hidden">
          {/* Header */}
          <div className="p-6 pb-4 text-center border-b border-dashed border-white/10">
            <h1 className="text-lg font-bold tracking-[2px] mb-1">SYNCED</h1>
            <p className="text-red-400 text-[10px] uppercase tracking-[3px]">
              Digital Ticket
            </p>
          </div>

          {/* Event details */}
          <div className="p-6 pb-4">
            <h2 className="text-xl font-bold mb-3">{ticket.eventName}</h2>
            <div className="space-y-1.5 text-sm text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="text-red-500/60 text-xs">♦</span>
                <span>{ticket.eventDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-red-500/60 text-xs">♦</span>
                <span>{ticket.eventLocation}</span>
              </div>
            </div>

            <div className="flex justify-between mt-5 pt-4 border-t border-white/5">
              <div>
                <p className="text-zinc-600 text-[10px] uppercase tracking-wider">
                  Guest
                </p>
                <p className="text-sm font-medium">{ticket.buyerName}</p>
              </div>
              <div className="text-right">
                <p className="text-zinc-600 text-[10px] uppercase tracking-wider">
                  Tier
                </p>
                <p className="text-sm font-medium">{ticket.tierName}</p>
              </div>
              {ticket.quantity > 1 && (
                <div className="text-right">
                  <p className="text-zinc-600 text-[10px] uppercase tracking-wider">
                    Qty
                  </p>
                  <p className="text-sm font-medium">{ticket.quantity}</p>
                </div>
              )}
            </div>
          </div>

          {/* QR Code */}
          <div className="p-6 pt-2 text-center">
            <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl p-6 inline-block">
              <img
                src={ticket.qrDataUrl}
                alt="Ticket QR Code"
                className="w-48 h-48 mx-auto"
              />
            </div>
            <p className="text-zinc-700 text-[10px] font-mono mt-3 break-all px-4">
              {ticket.ticketId}
            </p>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 text-center">
            <p className="text-zinc-600 text-[10px] uppercase tracking-wider">
              Show this QR code at entry
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3">
          <div className="flex gap-3">
          <button
            onClick={() => {
              const canvas = document.createElement("canvas");
              const w = 800;
              const h = 1200;
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext("2d")!;

              // Background
              ctx.fillStyle = "#0a0a0a";
              ctx.fillRect(0, 0, w, h);

              // Red accent line at top
              ctx.fillStyle = "#ef4444";
              ctx.fillRect(0, 0, w, 4);

              // SYNCED header
              ctx.fillStyle = "#ffffff";
              ctx.font = "bold 36px -apple-system, sans-serif";
              ctx.textAlign = "center";
              ctx.letterSpacing = "4px";
              ctx.fillText("SYNCED", w / 2, 70);

              // Digital Ticket subtitle
              ctx.fillStyle = "#ef4444";
              ctx.font = "bold 13px -apple-system, sans-serif";
              ctx.fillText("DIGITAL TICKET", w / 2, 95);

              // Dashed line
              ctx.setLineDash([6, 4]);
              ctx.strokeStyle = "rgba(255,255,255,0.1)";
              ctx.beginPath();
              ctx.moveTo(60, 125);
              ctx.lineTo(w - 60, 125);
              ctx.stroke();
              ctx.setLineDash([]);

              // Event name
              ctx.fillStyle = "#ffffff";
              ctx.font = "bold 28px -apple-system, sans-serif";
              ctx.textAlign = "left";
              ctx.fillText(ticket.eventName || "", 60, 180);

              // Event details
              ctx.fillStyle = "#a1a1aa";
              ctx.font = "16px -apple-system, sans-serif";
              const diamond = "\u2666";
              ctx.fillStyle = "#ef4444";
              ctx.fillText(diamond, 60, 220);
              ctx.fillStyle = "#a1a1aa";
              ctx.fillText(ticket.eventDate || "", 82, 220);

              ctx.fillStyle = "#ef4444";
              ctx.fillText(diamond, 60, 250);
              ctx.fillStyle = "#a1a1aa";
              ctx.fillText(ticket.eventLocation || "", 82, 250);

              // Divider
              ctx.strokeStyle = "rgba(255,255,255,0.05)";
              ctx.beginPath();
              ctx.moveTo(60, 280);
              ctx.lineTo(w - 60, 280);
              ctx.stroke();

              // Guest / Tier / Qty
              ctx.fillStyle = "#52525b";
              ctx.font = "bold 11px -apple-system, sans-serif";
              ctx.textAlign = "left";
              ctx.fillText("GUEST", 60, 315);
              ctx.fillStyle = "#ffffff";
              ctx.font = "16px -apple-system, sans-serif";
              ctx.fillText(ticket.buyerName, 60, 340);

              ctx.fillStyle = "#52525b";
              ctx.font = "bold 11px -apple-system, sans-serif";
              ctx.textAlign = "center";
              ctx.fillText("TIER", w / 2, 315);
              ctx.fillStyle = "#ffffff";
              ctx.font = "16px -apple-system, sans-serif";
              ctx.fillText(ticket.tierName, w / 2, 340);

              if (ticket.quantity > 1) {
                ctx.fillStyle = "#52525b";
                ctx.font = "bold 11px -apple-system, sans-serif";
                ctx.textAlign = "right";
                ctx.fillText("QTY", w - 60, 315);
                ctx.fillStyle = "#ffffff";
                ctx.font = "16px -apple-system, sans-serif";
                ctx.fillText(String(ticket.quantity), w - 60, 340);
              }

              // QR code
              const qrImg = new Image();
              qrImg.onload = () => {
                const qrSize = 280;
                const qrX = (w - qrSize) / 2;
                const qrY = 400;

                // QR background box
                ctx.fillStyle = "#111";
                ctx.beginPath();
                ctx.roundRect(qrX - 30, qrY - 30, qrSize + 60, qrSize + 100, 16);
                ctx.fill();
                ctx.strokeStyle = "rgba(255,255,255,0.05)";
                ctx.stroke();

                // "Scan at entry" label
                ctx.fillStyle = "#71717a";
                ctx.font = "bold 11px -apple-system, sans-serif";
                ctx.textAlign = "center";
                ctx.fillText("SCAN AT ENTRY", w / 2, qrY - 8);

                ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

                // Ticket ID under QR
                ctx.fillStyle = "#3f3f46";
                ctx.font = "11px monospace";
                ctx.fillText(ticket.ticketId, w / 2, qrY + qrSize + 25);

                // 18+ warning bar
                ctx.fillStyle = "#ef4444";
                ctx.beginPath();
                ctx.roundRect(60, 810, w - 120, 50, 12);
                ctx.fill();
                ctx.fillStyle = "#ffffff";
                ctx.font = "bold 14px -apple-system, sans-serif";
                ctx.fillText("18+ EVENT — VALID ID REQUIRED", w / 2, 841);

                // Footer
                ctx.fillStyle = "#3f3f46";
                ctx.font = "12px -apple-system, sans-serif";
                ctx.fillText("Powered by Synced", w / 2, 910);

                // Download
                const link = document.createElement("a");
                link.href = canvas.toDataURL("image/png");
                link.download = `synced-ticket-${ticket.ticketId.slice(0, 8)}.png`;
                link.click();
              };
              qrImg.src = ticket.qrDataUrl;
            }}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white font-semibold py-3.5 rounded-xl transition-all cursor-pointer text-sm uppercase tracking-wider"
          >
            Save Ticket
          </button>
          <a
            href="https://instagram.com/synced_official"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 via-pink-500 to-orange-400 hover:opacity-90 text-white font-semibold py-3.5 rounded-xl transition-all cursor-pointer text-sm uppercase tracking-wider"
          >
            <svg className="w-4 h-4 fill-current shrink-0" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
            Follow
          </a>
          </div>
          <p className="text-zinc-500 text-[11px] text-center">
            Follow for event updates & announcements
          </p>
          <p className="text-zinc-600 text-xs text-center">
            A confirmation has been sent to{" "}
            <span className="text-zinc-400">{ticket.buyerEmail}</span>
          </p>
        </div>

        <div className="mt-8 text-center">
          <a
            href="/"
            className="text-zinc-600 hover:text-zinc-400 text-sm transition-colors"
          >
            ← Back to event
          </a>
        </div>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
