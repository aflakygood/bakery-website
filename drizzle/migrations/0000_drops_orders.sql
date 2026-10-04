create type public.app_role as enum ('admin', 'user');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create table public.drops (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  pickup_info text not null default '',
  is_open boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.drops to anon, authenticated;
grant insert, update, delete on public.drops to authenticated;
grant all on public.drops to service_role;
alter table public.drops enable row level security;
create policy "public read drops" on public.drops for select using (true);
create policy "admin manage drops" on public.drops for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.drop_items (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references public.drops(id) on delete cascade,
  name text not null,
  price_cents integer not null,
  total_qty integer not null,
  max_per_order integer not null,
  sort integer not null default 0
);
grant select on public.drop_items to anon, authenticated;
grant insert, update, delete on public.drop_items to authenticated;
grant all on public.drop_items to service_role;
alter table public.drop_items enable row level security;
create policy "public read items" on public.drop_items for select using (true);
create policy "admin manage items" on public.drop_items for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  drop_id uuid not null references public.drops(id),
  customer_name text not null,
  email text not null,
  phone text not null default '',
  items jsonb not null,
  total_cents integer not null,
  status text not null default 'pending',
  checkout_token text,
  secret_token text,
  transaction_id text,
  created_at timestamptz not null default now()
);
grant select, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "admin read orders" on public.orders for select to authenticated using (public.has_role(auth.uid(), 'admin'));
create policy "admin update orders" on public.orders for update to authenticated using (public.has_role(auth.uid(), 'admin'));

-- remaining = total - paid - pending reservations younger than 15 minutes
create or replace function public.item_remaining(_item_id uuid)
returns integer language sql stable security definer set search_path = public as $$
  select i.total_qty - coalesce((
    select sum((e->>'qty')::int) from public.orders o, jsonb_array_elements(o.items) e
    where o.drop_id = i.drop_id and e->>'item_id' = i.id::text
      and (o.status = 'paid' or (o.status = 'pending' and o.created_at > now() - interval '15 minutes'))
  ), 0)::int
  from public.drop_items i where i.id = _item_id
$$;
grant execute on function public.item_remaining(uuid) to anon, authenticated, service_role;

insert into public.drops (title, pickup_info) values ('this week''s drop', 'pickup Saturday · 9 — 11 am · Maple Valley');
insert into public.drop_items (drop_id, name, price_cents, total_qty, max_per_order, sort)
select id, v.name, v.price, v.total, v.mx, v.s from public.drops,
 (values ('sourdough bread',1200,6,2,1),('olive rosemary focaccia',1000,6,2,2),('croissant',600,12,8,3),('pain au chocolat',700,12,8,4)) as v(name,price,total,mx,s);