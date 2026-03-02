import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { ticketId } = await req.json();

  const { data: ticket, error: fetchError } = await supabase
    .from("tickets")
    .select("*")
    .eq("id", ticketId)
    .single();

  if (fetchError || !ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  if (ticket.checked_in) {
    return NextResponse.json(
      { error: "Already checked in", ticket },
      { status: 409 }
    );
  }

  const { error: updateError } = await supabase
    .from("tickets")
    .update({ checked_in: true })
    .eq("id", ticketId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    ticket: { ...ticket, checked_in: true },
  });
}
