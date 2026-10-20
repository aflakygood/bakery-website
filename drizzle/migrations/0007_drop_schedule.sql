-- Picked-up orders stay sold: stock only resets when the admin starts a new drop with new quantities.
create or replace function public.item_remaining(_item_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select i.total_qty - coalesce((
    select sum((e->>'qty')::int) from public.orders o, jsonb_array_elements(o.items) e
    where o.drop_id = i.drop_id and e->>'item_id' = i.id::text
      and (o.status in ('paid', 'picked_up') or (o.status = 'pending' and o.created_at > now() - interval '15 minutes'))
  ), 0)::int
  from public.drop_items i where i.id = _item_id
$$;

-- Scheduled preorder window. A drop with no opens_at is not live yet (hidden from customers).
-- is_open remains as the admin's emergency "close now" override.
alter table public.drops
  add column if not exists opens_at timestamptz,
  add column if not exists closes_at timestamptz;
update public.drops set opens_at = created_at where opens_at is null;

-- Admin-only: close the current drop and create the next one with the same items and prices
-- but zero quantities, so the admin must enter fresh stock. Runs as the caller, so RLS applies too.
create or replace function public.start_next_drop()
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  prev public.drops;
  new_id uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'not allowed';
  end if;
  select * into prev from public.drops order by created_at desc limit 1;
  if prev.id is not null then
    update public.drops set is_open = false, closes_at = least(coalesce(closes_at, now()), now()) where id = prev.id;
  end if;
  insert into public.drops (title, pickup_info, is_open, pickup_location)
  values (coalesce(prev.title, 'this week''s drop'), '', true, coalesce(prev.pickup_location, ''))
  returning id into new_id;
  if prev.id is not null then
    insert into public.drop_items (drop_id, name, description, price_cents, total_qty, max_per_order, sort)
    select new_id, name, description, price_cents, 0, max_per_order, sort from public.drop_items where drop_id = prev.id;
  end if;
  return new_id;
end
$$;
revoke execute on function public.start_next_drop() from public, anon;
grant execute on function public.start_next_drop() to authenticated;
