-- Optional Google Maps link shown next to a drop's pickup location. Null = no link.
alter table public.drops add column if not exists pickup_map_url text;

-- A new or planned drop starts with the previous drop's map link.
create or replace function public.start_next_drop()
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  prev public.drops;
  new_id uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'not allowed';
  end if;
  select * into prev from public.drops where not is_draft order by created_at desc limit 1;
  if prev.id is not null then
    update public.drops set is_open = false, closes_at = least(coalesce(closes_at, now()), now()) where id = prev.id;
  end if;
  insert into public.drops (title, pickup_info, is_open, pickup_location, cover_url, pickup_map_url)
  values (coalesce(prev.title, 'this week''s drop'), '', true, coalesce(prev.pickup_location, ''), prev.cover_url, prev.pickup_map_url)
  returning id into new_id;
  if prev.id is not null then
    insert into public.item_groups (drop_id, name, total_qty, sort)
    select new_id, name, 0, sort from public.item_groups where drop_id = prev.id;
    insert into public.drop_items (drop_id, name, description, ingredients, price_cents, variants, total_qty, min_per_order, max_per_order, sort, image_url, group_id)
    select new_id, i.name, i.description, i.ingredients, i.price_cents, i.variants, 0, i.min_per_order, i.max_per_order, i.sort, i.image_url, ng.id
    from public.drop_items i
    left join public.item_groups og on og.id = i.group_id
    left join public.item_groups ng on ng.drop_id = new_id and ng.name = og.name
    where i.drop_id = prev.id and not i.archived;
  end if;
  return new_id;
end
$$;
revoke execute on function public.start_next_drop() from public, anon;
grant execute on function public.start_next_drop() to authenticated;

create or replace function public.create_future_drop()
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  prev public.drops;
  new_id uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'not allowed';
  end if;
  if exists (select 1 from public.drops where is_draft) then
    raise exception 'a future drop already exists';
  end if;
  select * into prev from public.drops where not is_draft order by created_at desc limit 1;
  insert into public.drops (title, pickup_info, is_open, is_draft, pickup_location, cover_url, pickup_map_url)
  values (coalesce(prev.title, 'this week''s drop'), '', true, true, coalesce(prev.pickup_location, ''), prev.cover_url, prev.pickup_map_url)
  returning id into new_id;
  if prev.id is not null then
    insert into public.item_groups (drop_id, name, total_qty, sort)
    select new_id, name, 0, sort from public.item_groups where drop_id = prev.id;
    insert into public.drop_items (drop_id, name, description, ingredients, price_cents, variants, total_qty, min_per_order, max_per_order, sort, image_url, group_id)
    select new_id, i.name, i.description, i.ingredients, i.price_cents, i.variants, 0, i.min_per_order, i.max_per_order, i.sort, i.image_url, ng.id
    from public.drop_items i
    left join public.item_groups og on og.id = i.group_id
    left join public.item_groups ng on ng.drop_id = new_id and ng.name = og.name
    where i.drop_id = prev.id and not i.archived;
  end if;
  return new_id;
end
$$;
revoke execute on function public.create_future_drop() from public, anon;
grant execute on function public.create_future_drop() to authenticated;
