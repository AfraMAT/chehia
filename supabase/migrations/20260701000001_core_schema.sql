-- ============================================================
-- Chehia core schema
-- Multi-tenant: every domain table carries restaurant_id,
-- enforced by RLS keyed to the authenticated staff user.
-- Customers are anonymous-auth users; they own their orders.
-- Prices are stored in millimes (1 TND = 1000 millimes).
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
create type public.staff_role as enum ('owner', 'manager', 'waiter', 'kitchen');
create type public.order_status as enum ('new', 'preparing', 'ready', 'served', 'cancelled');
create type public.waiter_call_status as enum ('open', 'acknowledged');
create type public.waiter_call_reason as enum ('bill', 'water', 'cutlery', 'other');

-- ------------------------------------------------------------
-- Restaurants
-- ------------------------------------------------------------
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  tagline_i18n jsonb not null default '{}'::jsonb,
  address text not null default '',
  city text not null default '',
  phone text not null default '',
  languages text[] not null default '{fr,ar,en}',
  default_language text not null default 'fr' check (default_language in ('fr', 'ar', 'en')),
  timezone text not null default 'Africa/Tunis',
  logo_url text,
  cover_url text,
  currency text not null default 'TND',
  is_active boolean not null default true,
  opening_hours jsonb not null default '{}'::jsonb,
  plan text not null default 'starter' check (plan in ('starter', 'pro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Staff (links auth users to a restaurant + role)
-- ------------------------------------------------------------
create table public.staff (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  auth_uid uuid not null unique references auth.users(id) on delete cascade,
  role public.staff_role not null default 'waiter',
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index staff_restaurant_idx on public.staff (restaurant_id);
create index staff_auth_uid_idx on public.staff (auth_uid);

-- Helper: restaurant of the calling staff user (used across policies).
-- SECURITY DEFINER so it can read staff regardless of the caller's RLS.
create or replace function public.staff_restaurant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id from public.staff
  where auth_uid = auth.uid() and is_active
  limit 1;
$$;

create or replace function public.staff_has_role(roles public.staff_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.staff
    where auth_uid = auth.uid() and is_active and role = any(roles)
  );
$$;

-- ------------------------------------------------------------
-- Menu: categories, items, modifier groups, modifiers
-- name_i18n / description_i18n: {"fr": "...", "ar": "...", "en": "..."}
-- ------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name_i18n jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index categories_restaurant_idx on public.categories (restaurant_id, sort_order);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  name_i18n jsonb not null default '{}'::jsonb,
  description_i18n jsonb not null default '{}'::jsonb,
  price_millimes int not null check (price_millimes >= 0),
  photo_url text,
  is_available boolean not null default true,
  is_popular boolean not null default false,
  allergens text[] not null default '{}',
  dietary_tags text[] not null default '{}',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index items_restaurant_idx on public.items (restaurant_id, category_id, sort_order);

create table public.modifier_groups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  name_i18n jsonb not null default '{}'::jsonb,
  min_select int not null default 0 check (min_select >= 0),
  max_select int not null default 1 check (max_select >= 1),
  sort_order int not null default 0,
  check (max_select >= min_select)
);

create index modifier_groups_item_idx on public.modifier_groups (item_id, sort_order);

create table public.modifiers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  group_id uuid not null references public.modifier_groups(id) on delete cascade,
  name_i18n jsonb not null default '{}'::jsonb,
  price_delta_millimes int not null default 0,
  is_available boolean not null default true,
  sort_order int not null default 0
);

create index modifiers_group_idx on public.modifiers (group_id, sort_order);

-- ------------------------------------------------------------
-- Tables & QR
-- qr_token is the permanent secret encoded in the printed QR.
-- ------------------------------------------------------------
create table public.tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  label text not null,
  zone text not null default '',
  qr_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index tables_restaurant_idx on public.tables (restaurant_id, sort_order);

-- ------------------------------------------------------------
-- Orders
-- created_by: the anonymous (or later, registered) customer auth user.
-- Prices are recomputed server-side in the place-order edge function.
-- ------------------------------------------------------------
create sequence public.order_number_seq;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete restrict,
  order_number text not null default 'A-' || nextval('public.order_number_seq')::text,
  status public.order_status not null default 'new',
  note text not null default '',
  language text not null default 'fr',
  total_millimes int not null default 0 check (total_millimes >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  ready_at timestamptz,
  served_at timestamptz,
  cancelled_at timestamptz
);

create index orders_restaurant_idx on public.orders (restaurant_id, created_at desc);
create index orders_created_by_idx on public.orders (created_by, created_at desc);
create index orders_status_idx on public.orders (restaurant_id, status);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  name_snapshot jsonb not null default '{}'::jsonb,
  qty int not null check (qty > 0),
  unit_price_millimes int not null check (unit_price_millimes >= 0),
  modifiers_snapshot jsonb not null default '[]'::jsonb,
  note text not null default ''
);

create index order_items_order_idx on public.order_items (order_id);
create index order_items_restaurant_idx on public.order_items (restaurant_id);

-- ------------------------------------------------------------
-- Waiter calls
-- ------------------------------------------------------------
create table public.waiter_calls (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete cascade,
  reason public.waiter_call_reason not null default 'other',
  note text not null default '',
  status public.waiter_call_status not null default 'open',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.staff(id) on delete set null
);

create index waiter_calls_restaurant_idx on public.waiter_calls (restaurant_id, status, created_at desc);

-- ------------------------------------------------------------
-- Events (analytics) & AI insights
-- ------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index events_restaurant_idx on public.events (restaurant_id, type, created_at desc);

create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  generated_for date not null,
  language text not null default 'fr',
  title text not null,
  body text not null,
  recommendation text not null default '',
  action_label text not null default '',
  metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index ai_insights_restaurant_idx on public.ai_insights (restaurant_id, generated_for desc, language);

-- ------------------------------------------------------------
-- updated_at triggers
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger restaurants_updated_at before update on public.restaurants
  for each row execute function public.set_updated_at();
create trigger items_updated_at before update on public.items
  for each row execute function public.set_updated_at();

-- Stamp status-transition timestamps on orders.
create or replace function public.stamp_order_status()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status then
    case new.status
      when 'preparing' then new.accepted_at = coalesce(new.accepted_at, now());
      when 'ready' then new.ready_at = coalesce(new.ready_at, now());
      when 'served' then new.served_at = coalesce(new.served_at, now());
      when 'cancelled' then new.cancelled_at = coalesce(new.cancelled_at, now());
      else null;
    end case;
  end if;
  return new;
end;
$$;

create trigger orders_stamp_status before update on public.orders
  for each row execute function public.stamp_order_status();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.restaurants enable row level security;
alter table public.staff enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.modifier_groups enable row level security;
alter table public.modifiers enable row level security;
alter table public.tables enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.waiter_calls enable row level security;
alter table public.events enable row level security;
alter table public.ai_insights enable row level security;

-- ---- Public menu browsing (customers, anonymous or not) ----
-- The menu is public content: anyone with the link can read it.
create policy "public read restaurants" on public.restaurants
  for select using (is_active);

create policy "public read categories" on public.categories
  for select using (is_active);

create policy "public read items" on public.items
  for select using (true);

create policy "public read modifier_groups" on public.modifier_groups
  for select using (true);

create policy "public read modifiers" on public.modifiers
  for select using (true);

-- Tables: readable so the scan landing can resolve label/zone from token.
-- The qr_token itself is the capability; guessing UUID labels leaks nothing sensitive.
create policy "public read tables" on public.tables
  for select using (is_active);

-- ---- Staff policies ----
create policy "staff read own profile" on public.staff
  for select using (auth_uid = auth.uid() or restaurant_id = public.staff_restaurant_id());

create policy "owner manages staff" on public.staff
  for all using (
    restaurant_id = public.staff_restaurant_id()
    and public.staff_has_role(array['owner','manager']::public.staff_role[])
  ) with check (
    restaurant_id = public.staff_restaurant_id()
    and public.staff_has_role(array['owner','manager']::public.staff_role[])
  );

create policy "staff update own restaurant" on public.restaurants
  for update using (
    id = public.staff_restaurant_id()
    and public.staff_has_role(array['owner','manager']::public.staff_role[])
  ) with check (id = public.staff_restaurant_id());

-- Menu management: owner + manager only.
create policy "staff manage categories" on public.categories
  for all using (
    restaurant_id = public.staff_restaurant_id()
    and public.staff_has_role(array['owner','manager']::public.staff_role[])
  ) with check (restaurant_id = public.staff_restaurant_id());

create policy "staff manage items" on public.items
  for all using (
    restaurant_id = public.staff_restaurant_id()
    and public.staff_has_role(array['owner','manager']::public.staff_role[])
  ) with check (restaurant_id = public.staff_restaurant_id());

create policy "staff manage modifier_groups" on public.modifier_groups
  for all using (
    restaurant_id = public.staff_restaurant_id()
    and public.staff_has_role(array['owner','manager']::public.staff_role[])
  ) with check (restaurant_id = public.staff_restaurant_id());

create policy "staff manage modifiers" on public.modifiers
  for all using (
    restaurant_id = public.staff_restaurant_id()
    and public.staff_has_role(array['owner','manager']::public.staff_role[])
  ) with check (restaurant_id = public.staff_restaurant_id());

create policy "staff manage tables" on public.tables
  for all using (
    restaurant_id = public.staff_restaurant_id()
    and public.staff_has_role(array['owner','manager']::public.staff_role[])
  ) with check (restaurant_id = public.staff_restaurant_id());

-- Orders: all active staff of the restaurant can see and advance them.
create policy "staff read orders" on public.orders
  for select using (restaurant_id = public.staff_restaurant_id());

create policy "staff update orders" on public.orders
  for update using (restaurant_id = public.staff_restaurant_id())
  with check (restaurant_id = public.staff_restaurant_id());

create policy "staff read order_items" on public.order_items
  for select using (restaurant_id = public.staff_restaurant_id());

-- Customers: can read their own orders (for live tracking).
create policy "customer read own orders" on public.orders
  for select using (created_by = auth.uid());

create policy "customer read own order_items" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.created_by = auth.uid()
    )
  );

-- Waiter calls: staff of the restaurant manage; customers see their own.
create policy "staff manage waiter_calls" on public.waiter_calls
  for all using (restaurant_id = public.staff_restaurant_id())
  with check (restaurant_id = public.staff_restaurant_id());

create policy "customer read own waiter_calls" on public.waiter_calls
  for select using (created_by = auth.uid());

-- Events & insights: staff read; events also insertable by staff clients.
create policy "staff read events" on public.events
  for select using (restaurant_id = public.staff_restaurant_id());

create policy "staff insert events" on public.events
  for insert with check (restaurant_id = public.staff_restaurant_id());

create policy "staff read ai_insights" on public.ai_insights
  for select using (restaurant_id = public.staff_restaurant_id());

-- ------------------------------------------------------------
-- Realtime
-- ------------------------------------------------------------
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_items;
alter publication supabase_realtime add table public.waiter_calls;
alter publication supabase_realtime add table public.items;
