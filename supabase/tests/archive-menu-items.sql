-- Run against a migrated test database. All fixtures and changes are rolled back.
begin;

insert into public.user_roles (user_id, role)
values ('10000000-0000-0000-0000-000000000001', 'admin');
insert into public.drops (id, title, opens_at, created_at)
values ('20000000-0000-0000-0000-000000000001', 'archive regression', now(), now() + interval '1 day');
insert into public.item_groups (id, drop_id, name, total_qty)
values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'loaves', 10);
insert into public.drop_items (id, drop_id, name, price_cents, total_qty, max_per_order, group_id, ingredients)
values
  ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'sourdough', 1200, 10, 2, '30000000-0000-0000-0000-000000000001', 'flour, water, salt'),
  ('40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'multigrain', 1400, 10, 2, '30000000-0000-0000-0000-000000000001', 'flour, seeds');
insert into public.orders (drop_id, customer_name, email, items, total_cents, status, created_at)
select '20000000-0000-0000-0000-000000000001', 'test customer', '', jsonb_build_array(jsonb_build_object(
  'item_id', '40000000-0000-0000-0000-000000000001', 'name', 'sourdough', 'qty', qty, 'price_cents', 1200
)), qty * 1200, status, created_at
from (values
  (2, 'paid', now()),
  (1, 'picked_up', now()),
  (3, 'pending', now()),
  (5, 'pending', now() - interval '1 hour')
) as reservations(qty, status, created_at);

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000002';
update public.drop_items set archived = true where id = '40000000-0000-0000-0000-000000000001';
do $$
begin
  if (select archived from public.drop_items where id = '40000000-0000-0000-0000-000000000001') then
    raise exception 'non-admin must not archive items';
  end if;
  begin
    perform public.start_next_drop();
    raise exception 'non-admin unexpectedly started a drop';
  exception when raise_exception then
    if sqlerrm <> 'not allowed' then raise; end if;
  end;
end
$$;

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
update public.drop_items set archived = true where id = '40000000-0000-0000-0000-000000000001';
do $$
declare
  next_id uuid;
begin
  if not (select archived from public.drop_items where id = '40000000-0000-0000-0000-000000000001') then
    raise exception 'admin archive failed';
  end if;
  if public.item_remaining('40000000-0000-0000-0000-000000000002') <> 4 then
    raise exception 'archiving changed paid, picked-up or recent pending shared reservations';
  end if;
  if (select count(*) from public.orders where drop_id = '20000000-0000-0000-0000-000000000001') <> 4 then
    raise exception 'archiving changed order history';
  end if;
  if (select count(*) from public.drop_items where drop_id = '20000000-0000-0000-0000-000000000001' and not archived) <> 1 then
    raise exception 'active menu must exclude archived items';
  end if;
  next_id := public.start_next_drop();
  if (select count(*) from public.drop_items where drop_id = next_id) <> 1
    or not exists (select 1 from public.drop_items where drop_id = next_id and name = 'multigrain'
      and not archived and total_qty = 0 and price_cents = 1400 and ingredients = 'flour, seeds' and group_id is not null) then
    raise exception 'next drop must copy only active items with their existing fields and group';
  end if;
end
$$;

rollback;
