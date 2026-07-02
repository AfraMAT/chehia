-- ============================================================
-- Database linter hardening.
-- 1) Pin a non-mutable search_path on the trigger functions
--    (lint 0011_function_search_path_mutable).
-- 2) Drop the item-photos public-read policy: a PUBLIC bucket already serves
--    object URLs without an RLS SELECT policy, and the broad policy let clients
--    LIST every file in the bucket (lint 0025_public_bucket_allows_listing).
--    Staff writes stay governed by the tenant-scoped insert/update/delete
--    policies; customers read photos via their public object URLs.
-- ============================================================
alter function public.set_updated_at() set search_path = '';
alter function public.stamp_order_status() set search_path = '';

drop policy if exists "item-photos public read" on storage.objects;
