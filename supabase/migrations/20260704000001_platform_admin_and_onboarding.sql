-- ============================================================
-- Platform admin (super-admin) + business onboarding
-- - platform_admins: the Chehia team; cross-tenant operators who
--   provision new venues and their owner accounts.
-- - restaurants.onboarding_completed_at: gates the owner into the
--   setup wizard until the venue is ready to take orders.
-- Provisioning of restaurants + owner auth users happens in the
-- `admin-provision-business` edge function (service role); these
-- policies only grant the admin *portal* its cross-tenant reads
-- and the activate/deactivate toggle.
-- ============================================================

-- ------------------------------------------------------------
-- Onboarding tracking
-- ------------------------------------------------------------
alter table public.restaurants
  add column if not exists onboarding_completed_at timestamptz;

-- Freshly provisioned venues start inactive (not taking orders) until
-- their owner finishes onboarding; the demo/seed venues stay active.
alter table public.restaurants
  alter column is_active set default false;

-- ------------------------------------------------------------
-- Platform admins
-- ------------------------------------------------------------
create table public.platform_admins (
  id uuid primary key default gen_random_uuid(),
  auth_uid uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null default 'Admin',
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;

-- SECURITY DEFINER: reads platform_admins regardless of the caller's RLS,
-- so it can be used inside policies without recursion.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.platform_admins where auth_uid = auth.uid()
  );
$$;

-- ------------------------------------------------------------
-- Platform-admin policies (additive to the tenant policies)
-- ------------------------------------------------------------
create policy "platform admins read roster" on public.platform_admins
  for select using (public.is_platform_admin());

create policy "platform read all restaurants" on public.restaurants
  for select using (public.is_platform_admin());

create policy "platform update all restaurants" on public.restaurants
  for update using (public.is_platform_admin())
  with check (public.is_platform_admin());

create policy "platform read all staff" on public.staff
  for select using (public.is_platform_admin());

create policy "platform read all orders" on public.orders
  for select using (public.is_platform_admin());

create policy "platform read all order_items" on public.order_items
  for select using (public.is_platform_admin());

-- ------------------------------------------------------------
-- Admin dashboard overview: per-venue counts in one round-trip.
-- Gated to platform admins (returns nothing otherwise).
-- ------------------------------------------------------------
create or replace function public.admin_venue_overview()
returns table (
  id uuid,
  slug text,
  name text,
  city text,
  plan text,
  is_active boolean,
  onboarding_completed_at timestamptz,
  created_at timestamptz,
  order_count bigint,
  table_count bigint,
  staff_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id, r.slug, r.name, r.city, r.plan, r.is_active,
    r.onboarding_completed_at, r.created_at,
    (select count(*) from public.orders o where o.restaurant_id = r.id) as order_count,
    (select count(*) from public.tables t where t.restaurant_id = r.id) as table_count,
    (select count(*) from public.staff s where s.restaurant_id = r.id) as staff_count
  from public.restaurants r
  where public.is_platform_admin()
  order by r.created_at desc;
$$;

revoke execute on function public.admin_venue_overview() from public;
grant execute on function public.admin_venue_overview() to authenticated;

-- ------------------------------------------------------------
-- Staff must read their own restaurant even while it is inactive
-- (the whole onboarding flow runs before the venue goes live, so the
-- "public read restaurants" is_active gate is not enough for the owner).
-- ------------------------------------------------------------
create policy "staff read own restaurant" on public.restaurants
  for select using (id = public.staff_restaurant_id());
