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
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [sessionId]);

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
          <button
            onClick={() => {
              // Download QR code as image
              const link = document.createElement("a");
              link.href = ticket.qrDataUrl;
              link.download = `synced-ticket-${ticket.ticketId.slice(0, 8)}.png`;
              link.click();
            }}
            className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-3.5 rounded-xl transition-all cursor-pointer text-sm uppercase tracking-wider"
          >
            Save QR Code
          </button>
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
