-- Seeds item variations for the current menu (requires 0015_item_variants.sql).
-- price_cents mirrors the lowest variation, as the admin does when saving. Size/pack suffixes are
-- dropped from item names because the choice is now made in the picker. Items that already have
-- variations are left alone, so this is safe to re-run. Only the latest drop is touched.

-- cookies: 3 / 6 piece packs
update public.drop_items
set
  name = btrim(regexp_replace(name, '\s*\(3p\)\s*$', '', 'i')),
  price_cents = 899,
  variants = jsonb_build_array(
    jsonb_build_object('id', 'pack3', 'label', '3 piece pack', 'price_cents', 899),
    jsonb_build_object('id', 'pack6', 'label', '6 piece pack', 'price_cents', 1599)
  )
where archived = false
  and drop_id = (select id from public.drops order by created_at desc limit 1)
  and name ilike '%cookie%'
  and variants = '[]'::jsonb;

-- focaccia: mini / 8"x8"
update public.drop_items
set
  name = btrim(regexp_replace(name, '\s*\(8"x8"\)\s*$', '', 'i')),
  price_cents = 800,
  variants = jsonb_build_array(
    jsonb_build_object('id', 'mini', 'label', 'mini', 'price_cents', 800),
    jsonb_build_object('id', 'full', 'label', '8"x8"', 'price_cents', 2400)
  )
where archived = false
  and drop_id = (select id from public.drops order by created_at desc limit 1)
  and name ilike '%focaccia%'
  and variants = '[]'::jsonb;
