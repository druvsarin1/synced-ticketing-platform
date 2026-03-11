import { supabase } from "@/lib/supabase";
import { EVENT } from "@/lib/event";

interface TierCapacity {
  id: string;
  capacity: number;
}

/**
 * Get tier capacities from Supabase events table, falling back to hardcoded values.
 * The events table stores capacity overrides in ticket_tiers jsonb column.
 */
export async function getTierCapacities(): Promise<Map<string, number>> {
  const capacities = new Map<string, number>();

  // Start with hardcoded defaults
  for (const tier of EVENT.tiers) {
    capacities.set(tier.id, tier.capacity);
  }

  // Try to read overrides from Supabase
  try {
    const { data } = await supabase
      .from("events")
      .select("ticket_tiers")
      .eq("name", EVENT.name)
      .single();

    if (data?.ticket_tiers && Array.isArray(data.ticket_tiers)) {
      for (const override of data.ticket_tiers as TierCapacity[]) {
        if (override.id && typeof override.capacity === "number") {
          capacities.set(override.id, override.capacity);
        }
      }
    }
  } catch {
    // Fall back to hardcoded values silently
  }

  return capacities;
}

/**
 * Update a tier's capacity in Supabase.
 * Upserts an event row with the updated ticket_tiers jsonb.
 */
export async function updateTierCapacity(
  tierId: string,
  newCapacity: number
): Promise<void> {
  // Read current overrides
  const { data: existing } = await supabase
    .from("events")
    .select("id, ticket_tiers")
    .eq("name", EVENT.name)
    .single();

  const tiers: TierCapacity[] = EVENT.tiers.map((t) => ({
    id: t.id,
    capacity: t.capacity,
  }));

  // Apply existing overrides
  if (existing?.ticket_tiers && Array.isArray(existing.ticket_tiers)) {
    for (const override of existing.ticket_tiers as TierCapacity[]) {
      const idx = tiers.findIndex((t) => t.id === override.id);
      if (idx !== -1) {
        tiers[idx].capacity = override.capacity;
      }
    }
  }

  // Apply new capacity
  const idx = tiers.findIndex((t) => t.id === tierId);
  if (idx !== -1) {
    tiers[idx].capacity = newCapacity;
  }

  if (existing?.id) {
    // Update existing row
    await supabase
      .from("events")
      .update({ ticket_tiers: tiers })
      .eq("id", existing.id);
  } else {
    // Insert new row
    await supabase.from("events").insert({
      name: EVENT.name,
      date: EVENT.date,
      location: EVENT.location,
      description: EVENT.description,
      ticket_tiers: tiers,
    });
  }
}
