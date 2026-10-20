-- Product photos are kept forever (used for past-drop history), so the app
-- can only add new files. Removal is still possible from the Supabase dashboard.
drop policy if exists "admin update product images" on storage.objects;
drop policy if exists "admin delete product images" on storage.objects;
