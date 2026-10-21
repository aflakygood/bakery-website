-- Shared stock: items in a group draw from the group's total spots instead of their own
-- (e.g. sourdough + multigrain share 4 loaves). When the group sells out, every item in it does.
create table if not exists public.item_groups (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references public.drops(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  total_qty integer not null default 0 check (total_qty >= 0),
  sort integer not null default 0,
  unique (drop_id, name),
  unique (id, drop_id)
);
grant select on public.item_groups to anon, authenticated;
grant insert, update, delete on public.item_groups to authenticated;
grant all on public.item_groups to service_role;
alter table public.item_groups enable row level security;
create policy "public read item groups" on public.item_groups for select using (true);
create policy "admin manage item groups" on public.item_groups for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- The composite key keeps an item's group in the same drop; deleting a group just ungroups its items.
alter table public.drop_items add column if not exists group_id uuid;
alter table public.drop_items
  add constraint drop_items_group_fk foreign key (group_id, drop_id)
  references public.item_groups (id, drop_id) on delete set null (group_id);

-- Grouped items report the group's remaining spots (sold across every item in the group).
create or replace function public.item_remaining(_item_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(g.total_qty, i.total_qty) - coalesce((
    select sum((e->>'qty')::int) from public.orders o, jsonb_array_elements(o.items) e
    where o.drop_id = i.drop_id
      and (o.status in ('paid', 'picked_up') or (o.status = 'pending' and o.created_at > now() - interval '15 minutes'))
      and e->>'item_id' in (
        select s.id::text from public.drop_items s
        where s.id = i.id or (i.group_id is not null and s.group_id = i.group_id)
      )
  ), 0)::int
  from public.drop_items i left join public.item_groups g on g.id = i.group_id
  where i.id = _item_id
$$;

-- Carry groups over (with 0 spots, like items) when starting the next drop.
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
    insert into public.drop_items (drop_id, name, description, price_cents, total_qty, max_per_order, sort, image_url, group_id)
    select new_id, i.name, i.description, i.price_cents, 0, i.max_per_order, i.sort, i.image_url, ng.id
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
