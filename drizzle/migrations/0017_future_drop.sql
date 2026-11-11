-- A planned "future drop". It is a drops row flagged is_draft: customers can't see or order from it,
-- and it never counts as the latest drop until the admin publishes it.
alter table public.drops add column if not exists is_draft boolean not null default false;
create unique index if not exists drops_one_future_drop on public.drops ((true)) where is_draft;

-- Public reads only see live drops and their menus; admins keep full access through their own policies.
drop policy if exists "public read drops" on public.drops;
create policy "public read drops" on public.drops for select using (not is_draft);
drop policy if exists "public read items" on public.drop_items;
create policy "public read items" on public.drop_items for select
  using (exists (select 1 from public.drops d where d.id = drop_items.drop_id and not d.is_draft));
drop policy if exists "public read item groups" on public.item_groups;
create policy "public read item groups" on public.item_groups for select
  using (exists (select 1 from public.drops d where d.id = item_groups.drop_id and not d.is_draft));

-- Starting the next drop copies from the latest live drop, never from the planned one.
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
  insert into public.drops (title, pickup_info, is_open, pickup_location)
  values (coalesce(prev.title, 'this week''s drop'), '', true, coalesce(prev.pickup_location, ''))
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

-- Admin-only: start planning a future drop from the current menu (items, prices, groups; zero spots).
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
  insert into public.drops (title, pickup_info, is_open, is_draft, pickup_location)
  values (coalesce(prev.title, 'this week''s drop'), '', true, true, coalesce(prev.pickup_location, ''))
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

-- Admin-only: end the current drop and make the planned one the latest. It goes live at its own opens_at
-- (a drop with no opens_at stays hidden until one is set).
create or replace function public.publish_future_drop()
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  planned public.drops;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'not allowed';
  end if;
  select * into planned from public.drops where is_draft for update;
  if planned.id is null then
    raise exception 'no future drop to publish';
  end if;
  update public.drops set is_open = false, closes_at = least(coalesce(closes_at, now()), now())
  where not is_draft and id = (select id from public.drops where not is_draft order by created_at desc limit 1);
  update public.drops set is_draft = false, is_open = true, created_at = now() where id = planned.id;
  return planned.id;
end
$$;
revoke execute on function public.publish_future_drop() from public, anon;
grant execute on function public.publish_future_drop() to authenticated;
