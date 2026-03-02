import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "SHOLAY — The Official Afterparty | Synced";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a0a0a 50%, #0a0a0a 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
        }}
      >
        {/* Card suits */}
        <div style={{ display: "flex", gap: "16px", marginBottom: "24px", opacity: 0.3 }}>
          <span style={{ color: "#dc2626", fontSize: "32px" }}>♥</span>
          <span style={{ color: "#ffffff", fontSize: "32px" }}>♠</span>
          <span style={{ color: "#dc2626", fontSize: "32px" }}>♦</span>
          <span style={{ color: "#ffffff", fontSize: "32px" }}>♣</span>
        </div>

        {/* Synced presents */}
        <p
          style={{
            color: "#dc2626",
            fontSize: "14px",
            textTransform: "uppercase",
            letterSpacing: "6px",
            marginBottom: "16px",
          }}
        >
          Synced Presents
        </p>

        {/* Event name */}
        <h1
          style={{
            color: "#ffffff",
            fontSize: "120px",
            fontWeight: 900,
            letterSpacing: "-2px",
            margin: "0 0 8px 0",
            lineHeight: 1,
          }}
        >
          SHOLAY
        </h1>

        <p
          style={{
            color: "#666666",
            fontSize: "16px",
            textTransform: "uppercase",
            letterSpacing: "6px",
            marginBottom: "32px",
          }}
        >
          The Official Afterparty
        </p>

        {/* Event details */}
        <div style={{ display: "flex", gap: "24px", color: "#999999", fontSize: "18px" }}>
          <span>April 18, 2026</span>
          <span style={{ color: "#333" }}>·</span>
          <span>Infinite Lounge</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
