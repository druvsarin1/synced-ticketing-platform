"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import jsQR from "jsqr";

interface Ticket {
  id: string;
  buyerName: string;
  buyerEmail: string;
  tierName: string;
  tierId: string;
  quantity: number;
  amount: number;
  date: string;
}

interface TierSummary {
  id: string;
  name: string;
  price: number;
  capacity: number;
  sold: number;
  remaining: number;
  revenue: number;
}

interface CheckInEntry {
  id: string;
  buyer_name: string;
  buyer_email: string;
  ticket_tier: string;
  quantity: number;
  checked_in: boolean;
}

interface DashboardData {
  tickets: Ticket[];
  tierSummary: TierSummary[];
  totalRevenue: number;
  netRevenue: number;
  stripeFees: number;
  totalSold: number;
}

type Tab = "dashboard" | "checkin";

export default function AdminDashboard() {
  const [password, setPassword] = useState("");
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");

  // Check-in state
  const [scanInput, setScanInput] = useState("");
  const [checkinList, setCheckinList] = useState<CheckInEntry[]>([]);
  const [scanResult, setScanResult] = useState<{
    message: string;
    type: "success" | "error" | "warning";
  } | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());
  const scanInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const processingRef = useRef(false);

  const fetchData = useCallback(async () => {
    const res = await fetch("/api/admin/tickets", {
      headers: { "x-admin-password": password },
    });
    if (res.ok) {
      const json = await res.json();
      // Filter out locally cancelled tickets that server hasn't caught up on
      if (cancelledIds.size > 0) {
        json.tickets = json.tickets.filter(
          (t: Ticket) => !cancelledIds.has(t.id)
        );
        json.totalSold = json.tickets.reduce(
          (sum: number, t: Ticket) => sum + t.quantity, 0
        );
        json.totalRevenue = json.tickets.reduce(
          (sum: number, t: Ticket) => sum + t.amount, 0
        );
      }
      setData(json);
    }
  }, [password, cancelledIds]);

  const fetchCheckinList = useCallback(async () => {
    const res = await fetch("/api/admin/checkin-list", {
      headers: { "x-admin-password": password },
    });
    if (res.ok) {
      const json = await res.json();
      const tickets = (json.tickets ?? []).filter(
        (t: CheckInEntry) => !cancelledIds.has(t.id)
      );
      setCheckinList(tickets);
    }
  }, [password, cancelledIds]);

  useEffect(() => {
    if (authed) {
      fetchData();
      fetchCheckinList();
      const interval = setInterval(() => {
        fetchData();
        fetchCheckinList();
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [authed, fetchData, fetchCheckinList]);

  useEffect(() => {
    if (tab === "checkin" && scanInputRef.current) {
      scanInputRef.current.focus();
    }
  }, [tab]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/admin/tickets", {
      headers: { "x-admin-password": password },
    });
    if (res.ok) {
      setAuthed(true);
      const json = await res.json();
      setData(json);
    } else {
      alert("Wrong password");
    }
    setLoading(false);
  }

  async function handleCancel(
    id: string,
    buyerName: string,
    idType: "ticketId" | "stripeSessionId" = "ticketId"
  ) {
    if (!confirm(`Cancel ticket and refund ${buyerName}? This cannot be undone.`))
      return;

    const res = await fetch("/api/admin/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": password,
      },
      body: JSON.stringify({ [idType]: id }),
    });

    if (res.ok) {
      setScanResult({
        message: `Cancelled & refunded: ${buyerName}`,
        type: "success",
      });
      // Track cancelled ID so auto-refresh doesn't bring it back
      setCancelledIds((prev) => new Set([...prev, id]));
      // Immediately remove from UI
      if (data) {
        setData({
          ...data,
          tickets: data.tickets.filter((t) => t.id !== id),
          totalSold: data.totalSold - 1,
          totalRevenue: data.totalRevenue - (data.tickets.find((t) => t.id === id)?.amount ?? 0),
          tierSummary: data.tierSummary.map((tier) => {
            const cancelled = data.tickets.find((t) => t.id === id);
            if (cancelled && cancelled.tierId === tier.id) {
              return { ...tier, sold: tier.sold - 1, remaining: tier.remaining + 1, revenue: tier.revenue - cancelled.amount };
            }
            return tier;
          }),
        });
      }
      setCheckinList((prev) => prev.filter((t) => t.id !== id));
      // Refresh from server after a short delay to let Stripe/Supabase process
      setTimeout(() => {
        fetchData();
        fetchCheckinList();
      }, 2000);
    } else {
      const body = await res.json();
      setScanResult({
        message: body.error || "Failed to cancel",
        type: "error",
      });
    }
    setTimeout(() => setScanResult(null), 4000);
  }

  async function handleCheckin(ticketId: string) {
    const res = await fetch("/api/admin/checkin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-password": password,
      },
      body: JSON.stringify({ ticketId: ticketId.trim() }),
    });

    const body = await res.json();

    if (res.ok) {
      setScanResult({
        message: `${body.ticket.buyer_name} — ${body.ticket.ticket_tier}`,
        type: "success",
      });
      fetchCheckinList();
    } else if (res.status === 409) {
      setScanResult({
        message: `Already checked in: ${body.ticket.buyer_name}`,
        type: "warning",
      });
    } else {
      setScanResult({
        message: body.error || "Ticket not found",
        type: "error",
      });
    }

    setTimeout(() => setScanResult(null), 4000);
  }

  function scanFrame() {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code && !processingRef.current) {
      processingRef.current = true;
      handleCheckin(code.data);
      setTimeout(() => {
        processingRef.current = false;
      }, 3000);
    }

    animFrameRef.current = requestAnimationFrame(scanFrame);
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        setCameraActive(true);
        animFrameRef.current = requestAnimationFrame(scanFrame);
      }
    } catch {
      alert("Could not access camera. Make sure you allow camera permissions.");
    }
  }

  function stopCamera() {
    cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }

  // Stop camera when switching tabs
  useEffect(() => {
    if (tab !== "checkin") {
      stopCamera();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-6">
        <form onSubmit={handleLogin} className="w-full max-w-sm">
          <h1 className="text-2xl font-bold mb-1">Synced Admin</h1>
          <p className="text-zinc-500 text-sm mb-6">
            Enter password to continue
          </p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 mb-4 text-white text-base placeholder:text-zinc-600 focus:outline-none focus:border-red-500/40"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-red-600 hover:bg-red-500 py-3 rounded-xl font-medium transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? "Loading..." : "Login"}
          </button>
        </form>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const checkedInCount = checkinList.filter((t) => t.checked_in).length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] px-5 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Synced Admin</h1>
            <p className="text-zinc-500 text-sm">Live dashboard</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                fetchData();
                fetchCheckinList();
              }}
              className="text-sm text-zinc-500 hover:text-white transition-colors cursor-pointer"
            >
              Refresh
            </button>
            <button
              onClick={() => {
                setAuthed(false);
                setData(null);
              }}
              className="text-sm text-zinc-500 hover:text-white transition-colors cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1 mb-8">
          <button
            onClick={() => setTab("dashboard")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              tab === "dashboard"
                ? "bg-red-600 text-white"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setTab("checkin")}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              tab === "checkin"
                ? "bg-red-600 text-white"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            Check-in ({checkedInCount}/{checkinList.length})
          </button>
        </div>

        {tab === "dashboard" ? (
          <>
            {/* Top-level stats */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">
                  Gross Revenue
                </p>
                <p className="text-3xl font-bold">
                  ${data.totalRevenue.toLocaleString()}
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">
                  Tickets Sold
                </p>
                <p className="text-3xl font-bold">{data.totalSold}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-5">
                <p className="text-green-500/60 text-xs uppercase tracking-wider mb-1">
                  Net Revenue (You Keep)
                </p>
                <p className="text-3xl font-bold text-green-400">
                  ${data.netRevenue.toLocaleString()}
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">
                  Stripe Fees
                </p>
                <p className="text-3xl font-bold text-zinc-500">
                  ${data.stripeFees.toLocaleString()}
                </p>
              </div>
            </div>

            {/* Tier breakdown */}
            <div className="mb-8">
              <h2 className="text-sm uppercase tracking-wider text-zinc-500 font-semibold mb-4">
                Tiers
              </h2>
              <div className="flex flex-col gap-4">
                {data.tierSummary.map((tier) => {
                  const pct =
                    tier.capacity > 0
                      ? Math.round((tier.sold / tier.capacity) * 100)
                      : 0;
                  return (
                    <div
                      key={tier.id}
                      className="bg-white/5 border border-white/10 rounded-xl p-5"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">
                            {tier.name}
                          </h3>
                          <p className="text-zinc-500 text-sm">
                            ${tier.price} / ticket
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">
                            {tier.sold}
                            <span className="text-zinc-600 text-sm font-normal">
                              {" "}
                              / {tier.capacity}
                            </span>
                          </p>
                          <p className="text-zinc-500 text-xs">
                            {tier.remaining} remaining
                          </p>
                        </div>
                      </div>
                      <div className="w-full bg-white/5 rounded-full h-2.5 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            pct >= 90
                              ? "bg-red-500"
                              : pct >= 60
                              ? "bg-yellow-500"
                              : "bg-green-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex justify-between mt-2 text-xs text-zinc-600">
                        <span>{pct}% sold</span>
                        <span>
                          ${tier.revenue.toLocaleString()} revenue
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Purchases list */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-white/5">
                <h2 className="font-semibold">
                  All Purchases ({data.tickets.length})
                </h2>
              </div>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-zinc-500 text-xs uppercase tracking-wider">
                      <th className="px-5 py-3">Name</th>
                      <th className="px-5 py-3">Email</th>
                      <th className="px-5 py-3">Tier</th>
                      <th className="px-5 py-3">Qty</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.tickets.map((ticket) => (
                      <tr
                        key={ticket.id}
                        className="hover:bg-white/[.02]"
                      >
                        <td className="px-5 py-3 font-medium">
                          {ticket.buyerName}
                        </td>
                        <td className="px-5 py-3 text-zinc-400">
                          {ticket.buyerEmail}
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-300 border border-red-500/20">
                            {ticket.tierName}
                          </span>
                        </td>
                        <td className="px-5 py-3">{ticket.quantity}</td>
                        <td className="px-5 py-3">${ticket.amount}</td>
                        <td className="px-5 py-3 text-zinc-500">
                          {ticket.date}
                        </td>
                        <td className="px-5 py-3">
                          <button
                            onClick={() =>
                              handleCancel(ticket.id, ticket.buyerName, "stripeSessionId")
                            }
                            className="text-xs text-zinc-600 hover:text-red-400 transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                        </td>
                      </tr>
                    ))}
                    {data.tickets.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-5 py-8 text-center text-zinc-600"
                        >
                          No purchases yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y divide-white/5">
                {data.tickets.map((ticket) => (
                  <div key={ticket.id} className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium">{ticket.buyerName}</p>
                      <span className="text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-300 border border-red-500/20">
                        {ticket.tierName}
                      </span>
                    </div>
                    <p className="text-zinc-500 text-sm">
                      {ticket.buyerEmail}
                    </p>
                    <div className="flex items-center justify-between mt-2 text-xs text-zinc-600">
                      <span>
                        {ticket.quantity}x · ${ticket.amount}
                      </span>
                      <span>{ticket.date}</span>
                    </div>
                    <button
                      onClick={() =>
                        handleCancel(ticket.id, ticket.buyerName, "stripeSessionId")
                      }
                      className="mt-2 text-xs text-zinc-600 hover:text-red-400 transition-colors cursor-pointer"
                    >
                      Cancel & Refund
                    </button>
                  </div>
                ))}
                {data.tickets.length === 0 && (
                  <div className="p-8 text-center text-zinc-600">
                    No purchases yet
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* CHECK-IN TAB */
          <>
            {/* Scanner */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Scan Ticket</h2>
                <button
                  onClick={cameraActive ? stopCamera : startCamera}
                  className={`text-xs font-medium px-4 py-2 rounded-full cursor-pointer transition-colors ${
                    cameraActive
                      ? "bg-zinc-700 hover:bg-zinc-600 text-white"
                      : "bg-red-600 hover:bg-red-500 text-white"
                  }`}
                >
                  {cameraActive ? "Stop Camera" : "Open Camera"}
                </button>
              </div>

              {scanResult && (
                <div
                  className={`mb-4 p-4 rounded-xl text-sm font-medium ${
                    scanResult.type === "success"
                      ? "bg-green-500/10 border border-green-500/20 text-green-400"
                      : scanResult.type === "warning"
                      ? "bg-yellow-500/10 border border-yellow-500/20 text-yellow-400"
                      : "bg-red-500/10 border border-red-500/20 text-red-400"
                  }`}
                >
                  {scanResult.type === "success" && "Checked in: "}
                  {scanResult.message}
                </div>
              )}

              {/* Camera viewfinder */}
              <div
                className={`relative mb-4 rounded-xl overflow-hidden bg-black ${
                  cameraActive ? "block" : "hidden"
                }`}
              >
                <video
                  ref={videoRef}
                  className="w-full rounded-xl"
                  playsInline
                  muted
                />
                {/* Scan overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-2 border-red-500/50 rounded-2xl" />
                </div>
              </div>
              {/* Hidden canvas for QR processing */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Manual input fallback */}
              <div className="flex flex-col gap-3">
                <input
                  ref={scanInputRef}
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && scanInput.trim()) {
                      handleCheckin(scanInput);
                      setScanInput("");
                    }
                  }}
                  placeholder="Or paste ticket ID manually"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3.5 text-white text-base placeholder:text-zinc-600 focus:outline-none focus:border-red-500/40 font-mono"
                />
                <button
                  onClick={() => {
                    if (scanInput.trim()) {
                      handleCheckin(scanInput);
                      setScanInput("");
                    }
                  }}
                  className="w-full bg-red-600 hover:bg-red-500 py-3.5 rounded-xl font-semibold transition-colors cursor-pointer text-sm uppercase tracking-wider"
                >
                  Check In
                </button>
              </div>
            </div>

            {/* Check-in stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <p className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1">
                  Total
                </p>
                <p className="text-xl font-bold">{checkinList.length}</p>
              </div>
              <div className="bg-green-500/5 border border-green-500/10 rounded-xl p-4 text-center">
                <p className="text-green-500/60 text-[10px] uppercase tracking-wider mb-1">
                  Checked In
                </p>
                <p className="text-xl font-bold text-green-400">
                  {checkedInCount}
                </p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                <p className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1">
                  Remaining
                </p>
                <p className="text-xl font-bold">
                  {checkinList.length - checkedInCount}
                </p>
              </div>
            </div>

            {/* Attendee list */}
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <div className="p-5 border-b border-white/5">
                <h2 className="font-semibold">Guest List</h2>
              </div>

              <div className="divide-y divide-white/5">
                {checkinList.map((entry) => (
                  <div
                    key={entry.id}
                    className="p-4 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-medium truncate">
                          {entry.buyer_name}
                        </p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-300 border border-red-500/20 shrink-0">
                          {entry.ticket_tier}
                        </span>
                      </div>
                      <p className="text-zinc-600 text-sm truncate">
                        {entry.buyer_email}
                      </p>
                    </div>
                    <div className="ml-3 shrink-0 flex items-center gap-2">
                      {entry.checked_in ? (
                        <span className="text-xs font-medium text-green-400 bg-green-500/10 px-3 py-1.5 rounded-full">
                          In
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCheckin(entry.id)}
                          className="text-xs font-medium text-white bg-red-600 hover:bg-red-500 px-3 py-1.5 rounded-full cursor-pointer transition-colors"
                        >
                          Check in
                        </button>
                      )}
                      <button
                        onClick={() =>
                          handleCancel(entry.id, entry.buyer_name)
                        }
                        className="text-xs text-zinc-600 hover:text-red-400 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ))}
                {checkinList.length === 0 && (
                  <div className="p-8 text-center text-zinc-600">
                    No tickets yet — they&apos;ll appear here after purchases
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
