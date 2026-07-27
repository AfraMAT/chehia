-- ============================================================================
-- SECURITY FIX (high) — a venue owner could PATCH their own star rating,
-- their billing plan, and their fiscal order counter.
--
-- `owner manages restaurant` / `staff manage items` correctly scope WHICH ROWS
-- an owner or manager may update, but nothing scoped WHICH COLUMNS: Supabase
-- ships `grant all on all tables in schema public to anon, authenticated`, and
-- a table-level UPDATE covers every column. So a signed-in owner could do a
-- plain PostgREST PATCH on their own restaurants row and set:
--
--   • rating_avg / rating_count — the public star rating shown in discovery.
--     The entire reviews pipeline exists to keep this honest: a customer review
--     lands as `pending` and a PLATFORM admin approves it before it counts
--     (20260707000001_reviews.sql). Writing the aggregate directly walks around
--     all of it — a venue could publish 5.0 ★ (999) having never had a review.
--   • plan — the subscription tier, i.e. self-service upgrade.
--   • order_seq — the per-tenant order-number counter, whose whole job is to be
--     monotonic; rewinding it duplicates order numbers.
--   • id / created_at — repointing a row's primary key.
--
-- Same story on public.items for rating_avg / rating_count.
--
-- Safe to revoke: both aggregates are written ONLY by
-- recompute_restaurant_rating() and recompute_item_rating(), which are
-- SECURITY DEFINER and therefore unaffected by a grant to `authenticated`.
-- order_seq is written only inside place_order_tx (also SECURITY DEFINER), plan
-- only by the admin-provision-business edge function (service role), and
-- updated_at only by the set_updated_at BEFORE trigger — which, per the
-- established pattern in 20260710000004, deliberately writes a column the
-- caller holds no grant on.
--
-- The grant lists below are every column the portal actually writes, taken from
-- the real update payloads in apps/web/src/app/business/{settings,appearance,
-- orders,onboarding,menu}/… and apps/web/src/app/admin/page.tsx. `is_active`
-- stays granted because the platform-admin console toggles it and a platform
-- admin authenticates as `authenticated` like everyone else — it is gated by
-- RLS, not by the grant.
-- ============================================================================

-- ---- restaurants ------------------------------------------------------------
revoke update on public.restaurants from anon, authenticated;

grant update (
  name, slug, address, city, phone, whatsapp, instagram, tagline_i18n,
  logo_url, cover_url, appearance,
  languages, default_language, currency, timezone,
  opening_hours, enforce_opening_hours, ordering_paused, is_active,
  latitude, longitude, geofence_radius_m,
  require_location, require_qr, require_table_confirmation,
  reviews_enabled, inventory_alerts_enabled, onboarding_completed_at
) on public.restaurants to authenticated;

-- ---- items ------------------------------------------------------------------
revoke update on public.items from anon, authenticated;

grant update (
  name_i18n, description_i18n, price_millimes, category_id, sort_order,
  is_available, is_popular, photo_url, art, allergens, dietary_tags,
  restaurant_id
) on public.items to authenticated;

-- restaurant_id stays updatable on purpose: item creation needs it, and moving
-- an item to another venue is already impossible because `staff manage items`
-- carries `with check (restaurant_id = public.staff_restaurant_id())`.
