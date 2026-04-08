-- Run this in your Supabase SQL editor (Database → SQL Editor → New query)
--
-- Creates an atomic claim_ticket function that uses a Postgres advisory lock
-- to serialize concurrent ticket purchases per tier, preventing overselling.

create or replace function claim_ticket(
  p_ticket_id     text,
  p_stripe_session_id text,
  p_buyer_name    text,
  p_buyer_email   text,
  p_buyer_phone   text,
  p_ticket_tier   text,
  p_tier_id       text,
  p_quantity      int,
  p_capacity      int
)
returns json
language plpgsql
as $$
declare
  v_sold int;
begin
  -- Advisory lock keyed to this tier — all concurrent calls for the same tier
  -- queue here. Lock is released automatically when the transaction ends.
  perform pg_advisory_xact_lock(hashtext('tier_' || p_tier_id));

  -- Count tickets already sold for this tier
  select coalesce(sum(quantity), 0)
  into v_sold
  from tickets
  where tier_id = p_tier_id;

  -- Reject if adding this purchase would exceed capacity
  if v_sold + p_quantity > p_capacity then
    return json_build_object('ok', false, 'sold', v_sold);
  end if;

  -- Insert atomically inside the lock — no other transaction can sneak in here
  insert into tickets (id, stripe_session_id, buyer_name, buyer_email, buyer_phone, ticket_tier, tier_id, quantity, checked_in)
  values (p_ticket_id, p_stripe_session_id, p_buyer_name, p_buyer_email, p_buyer_phone, p_ticket_tier, p_tier_id, p_quantity, false);

  return json_build_object('ok', true, 'sold', v_sold + p_quantity);
end;
$$;
