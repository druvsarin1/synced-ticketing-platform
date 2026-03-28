import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const { data, error } = await supabase
    .from("tickets")
    .select("buyer_name, ticket_tier, quantity")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch attendees" },
      { status: 500 }
    );
  }

  // Show first name + last initial only (e.g. "Druv S.")
  const attendees = data.flatMap((row) => {
    if (!row.buyer_name?.trim()) return [];
    const parts = row.buyer_name.trim().split(" ");
    const firstName = parts[0];
    const lastInitial =
      parts.length > 1 ? parts[parts.length - 1][0].toUpperCase() + "." : "";
    const display = lastInitial ? `${firstName} ${lastInitial}` : firstName;

    const entries: { name: string; tier: string }[] = [
      { name: display, tier: row.ticket_tier },
    ];
    for (let i = 1; i < row.quantity; i++) {
      entries.push({ name: `${display} +${i}`, tier: row.ticket_tier });
    }
    return entries;
  });

  return NextResponse.json({ attendees });
}
