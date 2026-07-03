-- ============================================================
-- Consumer discovery: geo-coordinates + a token-free table list.
-- Powers app.chehia.app — customers who arrive without scanning a QR
-- can find a venue (by name / near their location) and pick their table.
--   1) restaurants.latitude / longitude for "near me" sorting.
--   2) list_venue_tables(slug): tables (id/label/zone, NO qr_token) for an
--      active venue, so a customer can choose a table without the printed QR.
-- The qr_token stays a secret capability (never returned here); ordering by a
-- chosen table_id is handled by the place-order edge function, which re-checks
-- the venue is active. Pay-at-counter means a mis-picked table is low-risk.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Geo-coordinates (nullable — venues without a pin still list, just
--    without a distance). Loose bounds guard against obvious bad data.
-- ------------------------------------------------------------
alter table public.restaurants
  add column if not exists latitude double precision
    check (latitude is null or (latitude between -90 and 90)),
  add column if not exists longitude double precision
    check (longitude is null or (longitude between -180 and 180));

-- Backfill the demo venues so "near me" has something to show on both
-- environments (fresh DBs also get these via seed.sql).
update public.restaurants set latitude = 36.8783, longitude = 10.3247
  where slug = 'cafe-el-marsa' and latitude is null;
update public.restaurants set latitude = 36.8330, longitude = 10.2730
  where slug = 'le-zink' and latitude is null;

-- ------------------------------------------------------------
-- 2) Token-free table list for the "pick your table" step.
--    SECURITY DEFINER so it can read tables (which are otherwise not
--    publicly listable) — but it only ever exposes id/label/zone for an
--    ACTIVE venue, never the qr_token.
-- ------------------------------------------------------------
create or replace function public.list_venue_tables(p_slug text)
returns table (id uuid, label text, zone text, sort_order int)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.label, t.zone, t.sort_order
  from public.tables t
  join public.restaurants r on r.id = t.restaurant_id
  where r.slug = p_slug and r.is_active and t.is_active
  order by t.sort_order, t.label;
$$;

revoke execute on function public.list_venue_tables(text) from public;
grant execute on function public.list_venue_tables(text) to anon, authenticated;
