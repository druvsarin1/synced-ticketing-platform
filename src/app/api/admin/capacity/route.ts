import { NextRequest, NextResponse } from "next/server";
import { EVENT } from "@/lib/event";
import { getTierCapacities, updateTierCapacity } from "@/lib/capacity";

export async function GET(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const capacities = await getTierCapacities();

  const tiers = EVENT.tiers.map((tier) => ({
    id: tier.id,
    name: tier.name,
    capacity: capacities.get(tier.id) ?? tier.capacity,
  }));

  return NextResponse.json({ tiers });
}

export async function PUT(req: NextRequest) {
  const password = req.headers.get("x-admin-password");
  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tierId, capacity } = await req.json();

  if (!tierId || typeof capacity !== "number" || capacity < 0) {
    return NextResponse.json(
      { error: "Invalid tierId or capacity" },
      { status: 400 }
    );
  }

  const tier = EVENT.tiers.find((t) => t.id === tierId);
  if (!tier) {
    return NextResponse.json({ error: "Tier not found" }, { status: 404 });
  }

  await updateTierCapacity(tierId, capacity);

  return NextResponse.json({ success: true, tierId, capacity });
}
