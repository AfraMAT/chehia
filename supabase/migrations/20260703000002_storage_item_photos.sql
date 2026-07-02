-- ============================================================
-- Menu item photos — Supabase Storage bucket + tenant-scoped RLS.
-- Public read (photos are shown to anonymous customers). Writes are limited to
-- authenticated staff, and only within their own restaurant's folder: the
-- upload path is `<restaurant_id>/<uuid>.<ext>`, so the first path segment is
-- checked against the caller's staff_restaurant_id().
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-photos', 'item-photos', true, 5242880,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "item-photos public read" on storage.objects;
create policy "item-photos public read" on storage.objects
  for select using (bucket_id = 'item-photos');

drop policy if exists "item-photos staff insert" on storage.objects;
create policy "item-photos staff insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[1] = public.staff_restaurant_id()::text
  );

drop policy if exists "item-photos staff update" on storage.objects;
create policy "item-photos staff update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[1] = public.staff_restaurant_id()::text
  );

drop policy if exists "item-photos staff delete" on storage.objects;
create policy "item-photos staff delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'item-photos'
    and (storage.foldername(name))[1] = public.staff_restaurant_id()::text
  );
