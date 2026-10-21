-- Minimum quantity per order (e.g. croissants come in pairs). Customers may still buy
-- fewer when that's all that's left; create-checkout enforces this.
alter table public.drop_items
  add column if not exists min_per_order integer not null default 1;
alter table public.drop_items
  add constraint drop_items_min_per_order_check check (min_per_order >= 1 and min_per_order <= max_per_order);

-- start_next_drop now carries min_per_order over to the new drop.
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
    insert into public.item_groups (drop_id, name, total_qty, sort)
    select new_id, name, 0, sort from public.item_groups where drop_id = prev.id;
    insert into public.drop_items (drop_id, name, description, price_cents, total_qty, min_per_order, max_per_order, sort, image_url, group_id)
    select new_id, i.name, i.description, i.price_cents, 0, i.min_per_order, i.max_per_order, i.sort, i.image_url, ng.id
    from public.drop_items i
    left join public.item_groups og on og.id = i.group_id
    left join public.item_groups ng on ng.drop_id = new_id and ng.name = og.name
    where i.drop_id = prev.id;
  end if;
  return new_id;
end
$$;
revoke execute on function public.start_next_drop() from public, anon;
grant execute on function public.start_next_drop() to authenticated;
