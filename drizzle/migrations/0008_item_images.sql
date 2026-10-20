-- Admin-managed item photos, stored in a public Storage bucket. Only admins can upload or change files.
alter table public.drop_items add column if not exists image_url text;

alter table public.drop_items
  add constraint drop_items_name_len check (char_length(btrim(name)) between 1 and 80),
  add constraint drop_items_price_nonneg check (price_cents >= 0),
  add constraint drop_items_qty_nonneg check (total_qty >= 0),
  add constraint drop_items_max_min check (max_per_order >= 1);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Public bucket: files are served by URL without a select policy, so nobody can list the bucket.
create policy "admin upload product images" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));
create policy "admin update product images" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));
create policy "admin delete product images" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'));

-- Carry photos over when starting the next drop.
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
    insert into public.drop_items (drop_id, name, description, price_cents, total_qty, max_per_order, sort, image_url)
    select new_id, name, description, price_cents, 0, max_per_order, sort, image_url from public.drop_items where drop_id = prev.id;
  end if;
  return new_id;
end
$$;
revoke execute on function public.start_next_drop() from public, anon;
grant execute on function public.start_next_drop() to authenticated;
