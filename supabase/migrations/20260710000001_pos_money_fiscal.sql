-- ============================================================
-- Chehia Caisse — point-of-sale money + fiscal layer
--
-- Turns the ordering engine into a POS: staff-initiated orders that
-- capture payment, a cash-drawer session, and gap-free fiscal receipt
-- numbering. Reuses the existing conventions verbatim:
--   * integer millimes (1 TND = 1000)
--   * RLS scoped by restaurant_id via staff_restaurant_id()/staff_has_role()
--   * money-mutating writes ONLY through SECURITY DEFINER _tx functions
--     (the edge function is the sole privileged caller — never the client)
--   * idempotency on client_ref
--
-- Fiscal specifics (TVA rate, timbre, régime) are CONFIGURABLE per venue and
-- default to the simplest legal case (forfaitaire: no TVA, no timbre). The
-- actual rates must be confirmed with a Tunisian accountant before go-live.
-- ============================================================

-- ------------------------------------------------------------
-- 1. orders — extend for staff origination + money breakdown + fiscal id
-- ------------------------------------------------------------
alter table public.orders
  add column if not exists created_by_staff uuid references public.staff(id) on delete set null,
  add column if not exists order_type text not null default 'dine_in'
    check (order_type in ('dine_in', 'takeaway', 'walk_in', 'phone')),
  add column if not exists paid_at timestamptz,
  add column if not exists subtotal_millimes int not null default 0 check (subtotal_millimes >= 0),
  add column if not exists tax_total_millimes int not null default 0 check (tax_total_millimes >= 0),
  add column if not exists timbre_millimes int not null default 0 check (timbre_millimes >= 0),
  add column if not exists discount_total_millimes int not null default 0 check (discount_total_millimes >= 0),
  add column if not exists rounding_millimes int not null default 0,
  add column if not exists fiscal_number text,
  add column if not exists fiscal_year int,
  add column if not exists cash_session_id uuid;

-- Broaden the origin whitelist to include the register's channels.
alter table public.orders drop constraint if exists orders_origin_check;
alter table public.orders
  add constraint orders_origin_check
  check (origin in ('scan', 'browse', 'counter', 'takeaway', 'staff_dine_in'));

-- One fiscal number per (venue, year). Enforced only for stamped orders.
create unique index if not exists orders_fiscal_number_unique
  on public.orders (restaurant_id, fiscal_year, fiscal_number)
  where fiscal_number is not null;

create index if not exists orders_paid_idx on public.orders (restaurant_id, paid_at);

-- ------------------------------------------------------------
-- 2. restaurant_fiscal — the per-venue fiscal profile (master switch)
-- ------------------------------------------------------------
create table if not exists public.restaurant_fiscal (
  restaurant_id uuid primary key references public.restaurants(id) on delete cascade,
  regime text not null default 'forfait' check (regime in ('forfait', 'reel')),
  tva_registered boolean not null default false,
  matricule_fiscal text not null default '',
  legal_name text not null default '',
  legal_form text not null default '',
  -- Percent (e.g. 19.00). Zero + not-registered = forfaitaire, no TVA line.
  default_tva_rate numeric(5,2) not null default 0 check (default_tva_rate >= 0 and default_tva_rate <= 100),
  timbre_millimes int not null default 0 check (timbre_millimes >= 0),
  cash_rounding_millimes int not null default 100 check (cash_rounding_millimes >= 0),
  receipt_header text not null default '',
  receipt_footer text not null default '',
  updated_at timestamptz not null default now()
);

create trigger restaurant_fiscal_updated_at before update on public.restaurant_fiscal
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 3. cash_sessions — the drawer / shift
-- ------------------------------------------------------------
create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  opened_by uuid not null references public.staff(id) on delete restrict,
  opened_at timestamptz not null default now(),
  opening_float_millimes int not null default 0 check (opening_float_millimes >= 0),
  closed_by uuid references public.staff(id) on delete set null,
  closed_at timestamptz,
  counted_cash_millimes int,
  expected_cash_millimes int,
  over_short_millimes int,
  status text not null default 'open' check (status in ('open', 'closed')),
  note text not null default ''
);

create index if not exists cash_sessions_restaurant_idx
  on public.cash_sessions (restaurant_id, status, opened_at desc);

-- At most one open drawer per venue at a time.
create unique index if not exists cash_sessions_one_open_per_restaurant
  on public.cash_sessions (restaurant_id) where status = 'open';

-- Now that cash_sessions exists, wire the orders FK.
alter table public.orders drop constraint if exists orders_cash_session_fk;
alter table public.orders
  add constraint orders_cash_session_fk
  foreign key (cash_session_id) references public.cash_sessions(id) on delete set null;

-- ------------------------------------------------------------
-- 4. payments — each tender against an order (supports splits later)
-- ------------------------------------------------------------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  cash_session_id uuid references public.cash_sessions(id) on delete set null,
  method text not null check (method in ('cash', 'card', 'd17', 'other')),
  amount_millimes int not null check (amount_millimes >= 0),
  tendered_millimes int,
  change_millimes int not null default 0 check (change_millimes >= 0),
  created_by_staff uuid references public.staff(id) on delete set null,
  client_ref uuid,
  created_at timestamptz not null default now()
);

create index if not exists payments_restaurant_idx on public.payments (restaurant_id, created_at desc);
create index if not exists payments_order_idx on public.payments (order_id);
create index if not exists payments_session_idx on public.payments (cash_session_id);
create unique index if not exists payments_client_ref_unique
  on public.payments (client_ref) where client_ref is not null;

-- ------------------------------------------------------------
-- 5. cash_movements — non-sale drawer movements (paid-in / paid-out / drop)
-- ------------------------------------------------------------
create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  cash_session_id uuid not null references public.cash_sessions(id) on delete cascade,
  type text not null check (type in ('paid_in', 'paid_out', 'drop')),
  amount_millimes int not null check (amount_millimes > 0),
  reason text not null default '',
  created_by_staff uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists cash_movements_session_idx on public.cash_movements (cash_session_id, created_at);

-- ------------------------------------------------------------
-- 6. order_discounts + refunds — transaction-level adjustments
-- ------------------------------------------------------------
create table if not exists public.order_discounts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete cascade,
  kind text not null check (kind in ('percent', 'fixed', 'comp')),
  percent numeric(5,2),
  amount_millimes int not null check (amount_millimes >= 0),
  reason text not null default '',
  approved_by_staff uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists order_discounts_order_idx on public.order_discounts (order_id);

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  amount_millimes int not null check (amount_millimes >= 0),
  method text not null default 'cash' check (method in ('cash', 'card', 'd17', 'other')),
  reason text not null default '',
  cash_session_id uuid references public.cash_sessions(id) on delete set null,
  approved_by_staff uuid references public.staff(id) on delete set null,
  created_by_staff uuid references public.staff(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists refunds_order_idx on public.refunds (order_id);
create index if not exists refunds_restaurant_idx on public.refunds (restaurant_id, created_at desc);

-- ------------------------------------------------------------
-- 7. receipt_sequences — gap-free fiscal counter per (venue, year)
-- Advanced atomically inside settle_order_tx; never touched by the client.
-- ------------------------------------------------------------
create table if not exists public.receipt_sequences (
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  year int not null,
  next_value int not null default 1,
  primary key (restaurant_id, year)
);

-- ============================================================
-- Functions
-- ============================================================

-- ------------------------------------------------------------
-- register_order_tx — staff analog of place_order_tx.
-- Sets origin/order_type/created_by_staff directly. No open-order cap
-- (staff are trusted; counter orders are settled/served quickly). Prices
-- are still recomputed by the caller before this runs; this only writes.
-- ------------------------------------------------------------
create or replace function public.register_order_tx(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_note text,
  p_language text,
  p_order_type text,
  p_origin text,
  p_subtotal_millimes int,
  p_total_millimes int,
  p_created_by uuid,
  p_created_by_staff uuid,
  p_client_ref uuid,
  p_lines jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq int;
  v_order public.orders;
begin
  if p_order_type not in ('dine_in', 'takeaway', 'walk_in', 'phone') then
    raise exception 'bad_order_type' using errcode = 'P0001';
  end if;
  if p_origin not in ('counter', 'takeaway', 'staff_dine_in') then
    raise exception 'bad_origin' using errcode = 'P0001';
  end if;

  -- Idempotency: a retried submission returns the same order.
  if p_client_ref is not null then
    select * into v_order from public.orders where client_ref = p_client_ref;
    if found then
      return jsonb_build_object(
        'id', v_order.id, 'order_number', v_order.order_number,
        'status', v_order.status, 'total_millimes', v_order.total_millimes,
        'created_at', v_order.created_at, 'duplicate', true);
    end if;
  end if;

  update public.restaurants set order_seq = order_seq + 1
  where id = p_restaurant_id
  returning order_seq into v_seq;

  insert into public.orders (
    restaurant_id, table_id, order_number, status, note, language,
    subtotal_millimes, total_millimes, created_by, created_by_staff,
    order_type, origin, client_ref
  ) values (
    p_restaurant_id, p_table_id, 'A-' || v_seq::text, 'new', p_note, p_language,
    p_subtotal_millimes, p_total_millimes, p_created_by, p_created_by_staff,
    p_order_type, p_origin, p_client_ref
  ) returning * into v_order;

  insert into public.order_items (
    order_id, restaurant_id, item_id, name_snapshot, qty,
    unit_price_millimes, modifiers_snapshot, note
  )
  select
    v_order.id, p_restaurant_id,
    (line->>'item_id')::uuid,
    line->'name_snapshot',
    (line->>'qty')::int,
    (line->>'unit_price_millimes')::int,
    coalesce(line->'modifiers_snapshot', '[]'::jsonb),
    coalesce(line->>'note', '')
  from jsonb_array_elements(p_lines) as line;

  -- Auto-deplete linked inventory. Best-effort: never fail the sale.
  begin
    perform public.deplete_inventory_for_order(v_order.id, p_created_by);
  exception when others then
    raise warning 'inventory depletion failed for order %: %', v_order.id, sqlerrm;
  end;

  return jsonb_build_object(
    'id', v_order.id, 'order_number', v_order.order_number,
    'status', v_order.status, 'total_millimes', v_order.total_millimes,
    'created_at', v_order.created_at, 'duplicate', false);
end;
$$;

revoke execute on function public.register_order_tx(uuid, uuid, text, text, text, text, int, int, uuid, uuid, uuid, jsonb)
  from public, anon, authenticated;

-- ------------------------------------------------------------
-- settle_order_tx — the one new money transaction.
-- Records a payment, stamps the gap-free fiscal number, marks the order
-- paid, and posts to the open cash session (if any). Idempotent: settling
-- an already-paid order returns its existing fiscal number.
-- ------------------------------------------------------------
create or replace function public.settle_order_tx(
  p_restaurant_id uuid,
  p_order_id uuid,
  p_method text,
  p_amount_millimes int,
  p_tendered_millimes int,
  p_change_millimes int,
  p_tax_total_millimes int,
  p_timbre_millimes int,
  p_rounding_millimes int,
  p_created_by_staff uuid,
  p_client_ref uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_year int;
  v_num int;
  v_fiscal text;
  v_session uuid;
begin
  if p_method not in ('cash', 'card', 'd17', 'other') then
    raise exception 'bad_method' using errcode = 'P0001';
  end if;

  select * into v_order from public.orders
  where id = p_order_id and restaurant_id = p_restaurant_id
  for update;
  if not found then
    raise exception 'unknown_order' using errcode = 'P0001';
  end if;

  -- Idempotency: already settled → return the existing fiscal receipt.
  if v_order.paid_at is not null then
    return jsonb_build_object(
      'id', v_order.id, 'order_number', v_order.order_number,
      'fiscal_number', v_order.fiscal_number, 'fiscal_year', v_order.fiscal_year,
      'paid_at', v_order.paid_at, 'duplicate', true);
  end if;

  v_year := extract(year from now())::int;

  -- Gap-free sequential fiscal number, serialized by the row lock on UPDATE.
  insert into public.receipt_sequences (restaurant_id, year, next_value)
  values (p_restaurant_id, v_year, 1)
  on conflict (restaurant_id, year) do nothing;

  update public.receipt_sequences
  set next_value = next_value + 1
  where restaurant_id = p_restaurant_id and year = v_year
  returning next_value - 1 into v_num;

  v_fiscal := lpad(v_num::text, 5, '0') || '/' || v_year::text;

  -- The open drawer, if one is running.
  select id into v_session from public.cash_sessions
  where restaurant_id = p_restaurant_id and status = 'open'
  limit 1;

  insert into public.payments (
    restaurant_id, order_id, cash_session_id, method,
    amount_millimes, tendered_millimes, change_millimes,
    created_by_staff, client_ref
  ) values (
    p_restaurant_id, p_order_id, v_session, p_method,
    p_amount_millimes, p_tendered_millimes, coalesce(p_change_millimes, 0),
    p_created_by_staff, p_client_ref
  );

  update public.orders set
    paid_at = now(),
    fiscal_number = v_fiscal,
    fiscal_year = v_year,
    cash_session_id = v_session,
    tax_total_millimes = coalesce(p_tax_total_millimes, 0),
    timbre_millimes = coalesce(p_timbre_millimes, 0),
    rounding_millimes = coalesce(p_rounding_millimes, 0)
  where id = p_order_id;

  return jsonb_build_object(
    'id', v_order.id, 'order_number', v_order.order_number,
    'fiscal_number', v_fiscal, 'fiscal_year', v_year,
    'cash_session_id', v_session, 'paid_at', now(), 'duplicate', false);
end;
$$;

revoke execute on function public.settle_order_tx(uuid, uuid, text, int, int, int, int, int, int, uuid, uuid)
  from public, anon, authenticated;

-- ------------------------------------------------------------
-- Cash session lifecycle — callable directly by authenticated staff
-- (owner/manager/waiter act as cashiers). Each guards the caller's venue.
-- ------------------------------------------------------------
create or replace function public.open_cash_session(
  p_restaurant_id uuid,
  p_opening_float_millimes int
) returns public.cash_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff;
  v_session public.cash_sessions;
begin
  select * into v_staff from public.staff
  where auth_uid = auth.uid() and restaurant_id = p_restaurant_id
    and is_active and role in ('owner', 'manager', 'waiter');
  if not found then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  insert into public.cash_sessions (restaurant_id, opened_by, opening_float_millimes)
  values (p_restaurant_id, v_staff.id, greatest(coalesce(p_opening_float_millimes, 0), 0))
  returning * into v_session;
  return v_session;
exception when unique_violation then
  raise exception 'session_already_open' using errcode = 'P0001';
end;
$$;

create or replace function public.close_cash_session(
  p_session_id uuid,
  p_counted_cash_millimes int
) returns public.cash_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff;
  v_session public.cash_sessions;
  v_expected int;
begin
  select * into v_session from public.cash_sessions where id = p_session_id for update;
  if not found or v_session.status <> 'open' then
    raise exception 'no_open_session' using errcode = 'P0001';
  end if;

  select * into v_staff from public.staff
  where auth_uid = auth.uid() and restaurant_id = v_session.restaurant_id
    and is_active and role in ('owner', 'manager', 'waiter');
  if not found then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  -- Expected cash = float + cash sales + paid-in − paid-out/drop − cash refunds.
  v_expected := v_session.opening_float_millimes
    + coalesce((select sum(amount_millimes) from public.payments
        where cash_session_id = p_session_id and method = 'cash'), 0)
    + coalesce((select sum(amount_millimes) from public.cash_movements
        where cash_session_id = p_session_id and type = 'paid_in'), 0)
    - coalesce((select sum(amount_millimes) from public.cash_movements
        where cash_session_id = p_session_id and type in ('paid_out', 'drop')), 0)
    - coalesce((select sum(amount_millimes) from public.refunds
        where cash_session_id = p_session_id and method = 'cash'), 0);

  update public.cash_sessions set
    status = 'closed',
    closed_by = v_staff.id,
    closed_at = now(),
    counted_cash_millimes = p_counted_cash_millimes,
    expected_cash_millimes = v_expected,
    over_short_millimes = coalesce(p_counted_cash_millimes, 0) - v_expected
  where id = p_session_id
  returning * into v_session;
  return v_session;
end;
$$;

-- Z/X report aggregation for a session (or the whole day if session null).
create or replace function public.cash_session_report(p_session_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session public.cash_sessions;
  v_result jsonb;
begin
  select * into v_session from public.cash_sessions where id = p_session_id;
  if not found then
    raise exception 'unknown_session' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.staff
    where auth_uid = auth.uid() and restaurant_id = v_session.restaurant_id and is_active
  ) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'session', to_jsonb(v_session),
    'orders_count', (select count(*) from public.orders where cash_session_id = p_session_id),
    'sales_total_millimes', coalesce((select sum(amount_millimes) from public.payments where cash_session_id = p_session_id), 0),
    'by_method', coalesce((
      select jsonb_object_agg(method, total) from (
        select method, sum(amount_millimes) as total
        from public.payments where cash_session_id = p_session_id group by method
      ) m), '{}'::jsonb),
    'tax_total_millimes', coalesce((select sum(tax_total_millimes) from public.orders where cash_session_id = p_session_id), 0),
    'timbre_total_millimes', coalesce((select sum(timbre_millimes) from public.orders where cash_session_id = p_session_id), 0),
    'refunds_total_millimes', coalesce((select sum(amount_millimes) from public.refunds where cash_session_id = p_session_id), 0)
  ) into v_result;
  return v_result;
end;
$$;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.restaurant_fiscal enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.payments enable row level security;
alter table public.cash_movements enable row level security;
alter table public.order_discounts enable row level security;
alter table public.refunds enable row level security;
alter table public.receipt_sequences enable row level security;

-- restaurant_fiscal: staff read their venue; owner/manager manage.
create policy "staff read fiscal" on public.restaurant_fiscal
  for select using (restaurant_id = public.staff_restaurant_id());
create policy "manager manages fiscal" on public.restaurant_fiscal
  for all using (
    restaurant_id = public.staff_restaurant_id()
    and public.staff_has_role(array['owner', 'manager']::public.staff_role[])
  ) with check (
    restaurant_id = public.staff_restaurant_id()
    and public.staff_has_role(array['owner', 'manager']::public.staff_role[])
  );

-- cash_sessions / payments / movements / discounts / refunds: staff READ their
-- venue's rows for the register + reporting. All money-mutating writes go through
-- the SECURITY DEFINER functions above (open/close via the cash-session RPCs;
-- payments only via settle_order_tx) — so there is intentionally no write policy.
create policy "staff read cash_sessions" on public.cash_sessions
  for select using (restaurant_id = public.staff_restaurant_id());
create policy "staff read payments" on public.payments
  for select using (restaurant_id = public.staff_restaurant_id());
create policy "staff read cash_movements" on public.cash_movements
  for select using (restaurant_id = public.staff_restaurant_id());
create policy "staff read order_discounts" on public.order_discounts
  for select using (restaurant_id = public.staff_restaurant_id());
create policy "staff read refunds" on public.refunds
  for select using (restaurant_id = public.staff_restaurant_id());

-- receipt_sequences: no policies at all — reachable only by the SECURITY DEFINER
-- settle function. Locked down entirely from the client.
revoke all on public.receipt_sequences from anon, authenticated;

-- ------------------------------------------------------------
-- Realtime — the register + kitchen react to payments/sessions live.
-- ------------------------------------------------------------
alter publication supabase_realtime add table public.payments;
alter publication supabase_realtime add table public.cash_sessions;

-- ------------------------------------------------------------
-- Seed a default (forfaitaire) fiscal profile for existing venues, so the
-- register has a config to read. Safe/simple defaults; venues edit later.
-- ------------------------------------------------------------
insert into public.restaurant_fiscal (restaurant_id, legal_name)
select id, name from public.restaurants
on conflict (restaurant_id) do nothing;
