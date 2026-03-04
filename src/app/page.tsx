"use client";

import { useState } from "react";
import { EVENT } from "@/lib/event";

export default function Home() {
  const [loading, setLoading] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [unlockedTierIds, setUnlockedTierIds] = useState<string[]>([]);
  const [codeError, setCodeError] = useState(false);

  function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    const entered = code.trim().toLowerCase();
    const matchedTier = EVENT.tiers.find((t) => t.code === entered);
    if (matchedTier) {
      setUnlockedTierIds((prev) =>
        prev.includes(matchedTier.id) ? prev : [...prev, matchedTier.id]
      );
      setCodeError(false);
      setCode("");
    } else {
      setCodeError(true);
      setTimeout(() => setCodeError(false), 2000);
    }
  }

  async function handleCheckout(
    tierId: string,
    price: number,
    tierName: string
  ) {
    setLoading(tierId);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tierId,
          tierName,
          price,
          eventName: `${EVENT.name} — ${EVENT.subtitle}`,
          eventDate: `${EVENT.date} · ${EVENT.time}`,
          eventLocation: `${EVENT.location}, ${EVENT.address}`,
        }),
      });
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] suit-pattern overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-[2px] text-white">
            SYNCED
          </h1>
          <a
            href="#tickets"
            className="text-xs font-semibold bg-red-600 hover:bg-red-500 px-4 py-2 rounded-full transition-colors uppercase tracking-wider"
          >
            Get Tickets
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative min-h-[85vh] md:min-h-[80vh] flex flex-col items-center justify-center px-5 pt-20 pb-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-950/20 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[300px] sm:w-[500px] h-[300px] sm:h-[500px] bg-red-600/5 rounded-full blur-[120px]" />

        <div className="relative text-center max-w-lg mx-auto">
          <div className="flex items-center justify-center gap-3 mb-5 text-2xl opacity-40">
            <span className="text-red-500">♥</span>
            <span className="text-white">♠</span>
            <span className="text-red-500">♦</span>
            <span className="text-white">♣</span>
          </div>

          <p className="text-red-400 text-[10px] sm:text-xs uppercase tracking-[5px] mb-4 font-semibold">
            Synced Presents
          </p>

          <h2 className="text-6xl sm:text-7xl md:text-8xl font-black tracking-tight mb-2 bg-gradient-to-b from-white via-white to-zinc-500 bg-clip-text text-transparent leading-[0.9]">
            {EVENT.name}
          </h2>

          <p className="text-[10px] sm:text-xs uppercase tracking-[4px] text-zinc-500 font-medium mb-6">
            {EVENT.subtitle}
          </p>

          <div className="inline-flex items-center gap-2 bg-red-600/10 border border-red-500/20 rounded-full px-4 py-1.5 mb-8">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            <span className="text-red-400 text-[10px] uppercase tracking-[3px] font-bold">
              Theme: {EVENT.tagline}
            </span>
          </div>

          <div className="flex flex-col items-center gap-2.5 text-sm sm:text-base text-zinc-400 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-red-500/60 text-xs">♦</span>
              <span>{EVENT.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-500/60 text-xs">♦</span>
              <span>{EVENT.time}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-red-500/60 text-xs">♦</span>
              <span>{EVENT.location}</span>
            </div>
            <p className="text-zinc-600 text-xs mt-1">{EVENT.address}</p>
          </div>

          <p className="text-zinc-600 max-w-sm mx-auto text-sm leading-relaxed mb-8 px-4">
            {EVENT.description}
          </p>

          <a
            href="#tickets"
            className="inline-block bg-red-600 hover:bg-red-500 text-white font-semibold py-3.5 px-10 rounded-xl transition-all text-sm uppercase tracking-wider"
          >
            Buy Tickets
          </a>
        </div>
      </section>

      {/* Divider */}
      <div className="max-w-xs mx-auto flex items-center gap-4 px-5 mb-16">
        <div className="flex-1 h-px bg-gradient-to-r from-transparent to-red-900/30" />
        <span className="text-red-800/40 text-xs">♠ ♥ ♣ ♦</span>
        <div className="flex-1 h-px bg-gradient-to-l from-transparent to-red-900/30" />
      </div>

      {/* Tickets */}
      <section id="tickets" className="px-5 pb-12">
        <div className="max-w-lg mx-auto">
          <h3 className="text-center text-[10px] sm:text-xs uppercase tracking-[4px] text-zinc-600 mb-8">
            Place Your Bet
          </h3>

          {/* Unlocked tiers */}
          {unlockedTierIds.length > 0 && (
            <div className="flex flex-col gap-5 mb-5">
              {EVENT.tiers
                .filter((tier) => unlockedTierIds.includes(tier.id))
                .map((tier) => (
                  <div
                    key={tier.id}
                    className="ticket-card rounded-2xl p-6 sm:p-8 flex flex-col relative overflow-hidden"
                  >
                    <span className="absolute top-4 right-5 text-3xl opacity-10 text-red-500">
                      ♠
                    </span>

                    <h4 className="text-lg sm:text-xl font-bold mb-1 text-white">
                      {tier.name}
                    </h4>
                    <p className="text-zinc-500 text-sm mb-5">
                      {tier.description}
                    </p>
                    <p className="text-4xl sm:text-5xl font-black mb-6 text-white">
                      ${tier.price}
                      <span className="text-zinc-700 text-sm font-normal ml-1.5">
                        / ticket
                      </span>
                    </p>
                    <button
                      onClick={() =>
                        handleCheckout(tier.id, tier.price, tier.name)
                      }
                      disabled={loading === tier.id}
                      className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-3.5 px-6 rounded-xl transition-all cursor-pointer text-sm uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading === tier.id ? "Redirecting..." : "Buy Now"}
                    </button>
                  </div>
                ))}
            </div>
          )}

          {/* Code gate — always visible until all tiers unlocked */}
          {unlockedTierIds.length < EVENT.tiers.length && (
            <div className="ticket-card rounded-2xl p-6 sm:p-8 text-center">
              <span className="text-red-500/30 text-4xl mb-4 block">♠</span>
              <h4 className="text-lg font-bold mb-2">
                {unlockedTierIds.length === 0 ? "Invite Only" : "Have Another Code?"}
              </h4>
              <p className="text-zinc-500 text-sm mb-6">
                Enter your access code to unlock tickets
              </p>
              <form onSubmit={handleUnlock} className="flex flex-col gap-3">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter code"
                  className={`w-full bg-black/50 border rounded-xl px-4 py-3.5 text-white text-center placeholder:text-zinc-700 focus:outline-none font-mono tracking-wider text-base transition-colors ${
                    codeError
                      ? "border-red-500/50 bg-red-500/5"
                      : "border-white/10 focus:border-red-500/40"
                  }`}
                />
                {codeError && (
                  <p className="text-red-400 text-xs">
                    Invalid code. Try again.
                  </p>
                )}
                <button
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-500 text-white font-semibold py-3.5 rounded-xl transition-all cursor-pointer text-sm uppercase tracking-wider"
                >
                  Unlock
                </button>
              </form>
            </div>
          )}
        </div>
      </section>

      {/* Event policies */}
      <section className="px-5 py-12">
        <div className="max-w-lg mx-auto">
          <div className="bg-white/[.02] border border-white/5 rounded-2xl p-6">
            <h4 className="text-xs uppercase tracking-[2px] text-zinc-500 font-semibold mb-4">
              House Rules
            </h4>
            <ul className="space-y-3 text-zinc-500 text-sm leading-relaxed">
              <li className="flex items-start gap-2.5">
                <span className="text-red-500/50 mt-0.5 text-xs shrink-0">♦</span>
                <span>
                  This is an <strong className="text-zinc-400">18+ event</strong>. Valid government-issued photo ID is required for entry. Name on ID must match the name on the ticket or entry will be denied.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-red-500/50 mt-0.5 text-xs shrink-0">♦</span>
                <span>
                  All tickets are <strong className="text-zinc-400">non-transferable and non-refundable</strong>. No exceptions.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-red-500/50 mt-0.5 text-xs shrink-0">♦</span>
                <span>
                  <strong className="text-zinc-400">Zero-tolerance policy:</strong> Any behavior, acts, or omissions which are deemed by the promoter of the event to be harmful or disruptive will not be tolerated in any respect. Violators will be expelled from the event with no opportunity to re-enter and no refund will be issued.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-red-500/50 mt-0.5 text-xs shrink-0">♦</span>
                <span>
                  <strong className="text-zinc-400">Assumption of risk:</strong> Any party who enters and/or otherwise participates in the event assumes the risk of any injury to person or property, including loss of property, and any such party shall hold the promoter, its principals, and affiliates harmless from any such injury to person or property.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-red-500/50 mt-0.5 text-xs shrink-0">♦</span>
                <span>
                  Synced is not responsible for any venue-related issues or unforeseen circumstances. No event transportation is provided by Synced.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-red-500/50 mt-0.5 text-xs shrink-0">♦</span>
                <span>
                  Doors open at 11:30 PM. For questions, contact{" "}
                  <strong className="text-zinc-400">@synced_official</strong> on Instagram.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-6 text-center text-zinc-700 text-xs">
        Powered by{" "}
        <span className="text-zinc-500 font-semibold tracking-wide">
          Synced
        </span>
      </footer>
    </div>
  );
}
