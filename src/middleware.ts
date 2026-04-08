import { NextResponse } from "next/server";

export function middleware() {
  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SHOLAY</title><style>body{margin:0;background:#0a0a0a;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}h1{font-size:3rem;font-weight:900;letter-spacing:4px}p{color:#52525b;font-size:.875rem;letter-spacing:2px;text-transform:uppercase;margin-top:1rem}</style></head><body><div><h1>SHOLAY</h1><p>Tickets are no longer available</p></div></body></html>`,
    { status: 200, headers: { "content-type": "text/html" } }
  );
}

export const config = { matcher: "/(.*)" };
