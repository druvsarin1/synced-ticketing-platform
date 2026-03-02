-- Synced Ticketing Platform — Supabase Schema
-- Run this in Supabase SQL Editor

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  date text not null,
  location text not null,
  description text,
  ticket_tiers jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table if not exists tickets (
  id uuid primary key,
  stripe_session_id text unique not null,
  buyer_email text not null,
  buyer_name text not null,
  ticket_tier text not null,
  quantity integer default 1,
  checked_in boolean default false,
  created_at timestamptz default now()
);

-- Index for faster check-in lookups
create index if not exists idx_tickets_checked_in on tickets(checked_in);

-- Enable Row Level Security
alter table tickets enable row level security;
alter table events enable row level security;

-- Allow service role full access (for webhook writes)
create policy "Service role can manage tickets" on tickets
  for all using (true) with check (true);

create policy "Service role can manage events" on events
  for all using (true) with check (true);
