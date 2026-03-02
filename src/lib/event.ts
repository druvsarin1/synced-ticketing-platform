export const EVENT = {
  name: "SHOLAY",
  subtitle: "THE OFFICIAL AFTERPARTY",
  tagline: "BLACKOUT",
  date: "Saturday, April 18, 2026",
  time: "11:30 PM — 4:00 AM EDT",
  location: "Infinite Lounge",
  address: "104 Main St, Port Jefferson Station, NY",
  description:
    "The ultimate late-night celebration of dance, music, and community. Join us immediately after the competition for the biggest afterparty of the year.",
  age: "18+ with valid ID",
  tiers: [
    {
      id: "general",
      name: "General Admission",
      price: 25,
      description: "Entry to the afterparty",
      code: "syncedxsholay",
      capacity: 200,
    },
  ],
} as const;

export type Tier = (typeof EVENT.tiers)[number];
