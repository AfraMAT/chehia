-- ============================================================
-- Inventory / stock management.
--
--   * `inventory_items`  — the stockable products a venue tracks
--     (ingredients, bottled drinks, supplies…). Quantity on hand,
--     a reorder threshold (low-stock level), an optional par level
--     to reorder up to, a unit, and an optional unit cost.
--   * `stock_movements`  — an append-only ledger: every change to
--     stock (receive, sale, waste, adjustment, count, cancel_return)
--     with a signed delta and the resulting quantity. This is the
--     audit trail that makes stock trustworthy.
--   * `item_ingredients` — a light bill-of-materials: how much of an
--     inventory item a menu dish consumes. When an order is placed,
--     the linked stock is depleted automatically; when the order is
--     cancelled, it is returned.
--   * `notifications`    — an in-portal alert feed. Low/out-of-stock
--     alerts are raised the moment a movement crosses the threshold
--     (edge-triggered, so no spam), delivered live via Realtime.
--
-- All quantities are numeric(12,3) so fractional units (0.250 kg,
-- 1.5 L) work. Costs stay in integer millimes like the rest of the app.
-- ============================================================

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------
create type public.stock_movement_type as enum (
  'receive',       -- goods received / restock (+)
  'sale',          -- auto-depletion from an order (−)
  'waste',         -- spoilage / breakage / loss (−)
  'adjustment',    -- manual signed correction (±)
  'count',         -- stock take: set to a counted absolute value (±)
  'cancel_return'  -- stock returned when an order is cancelled (+)
);

-- Alert level a tracked item is currently in. Stored on the item so
-- alerts are edge-triggered (fire once on worsening, reset on recovery).
create type public.stock_level as enum ('ok', 'low', 'out');

-- ------------------------------------------------------------
-- Per-venue switch: nightly low-stock digest emails (in-portal
-- alerts are always on). Defaults on.
-- ------------------------------------------------------------
alter table public.restaurants
  add column if not exists inventory_alerts_enabled boolean not null default true;

-- ------------------------------------------------------------
-- inventory_items
-- ------------------------------------------------------------
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  -- Staff-facing name (single language — this is internal ops, not the
  -- customer menu). Owners type "Café en grains" once.
  name text not null check (char_length(trim(name)) between 1 and 80),
  category text not null default 'other',
  unit text not null default 'piece' check (char_length(unit) <= 16),
  qty_on_hand numeric(12, 3) not null default 0,
  reorder_threshold numeric(12, 3) not null default 0 check (reorder_threshold >= 0),
  -- Target level to reorder up to (helps compute "how much to buy"). Optional.
  par_level numeric(12, 3) check (par_level is null or par_level >= 0),
  -- Cost per `unit`, in millimes. Optional; powers stock-value + waste-cost.
  unit_cost_millimes int check (unit_cost_millimes is null or unit_cost_millimes >= 0),
  -- When false the item is not depleted/alerted (e.g. tap water, salt).
  track boolean not null default true,
  -- When true, hitting zero auto-marks linked menu dishes unavailable
  -- (auto-86); restocking above zero re-enables them.
  auto_86 boolean not null default false,
  supplier_name text not null default '',
  supplier_phone text not null default '',
  note text not null default '',
  is_active boolean not null default true,
  -- Edge-trigger bookkeeping for alerts (never spam the same low item).
  last_alert_level public.stock_level not null default 'ok',
  last_alerted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index inventory_items_restaurant_idx on public.inventory_items (restaurant_id, is_active, category);
create index inventory_items_name_idx on public.inventory_items (restaurant_id, lower(name));

create trigger inventory_items_updated_at before update on public.inventory_items
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- stock_movements (append-only ledger)
-- ------------------------------------------------------------
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  -- Set for 'sale' / 'cancel_return' movements to trace them to an order.
  order_id uuid references public.orders(id) on delete set null,
  type public.stock_movement_type not null,
  qty_delta numeric(12, 3) not null,        -- signed change
  qty_after numeric(12, 3) not null,        -- snapshot of on-hand after applying
  unit_cost_millimes int,                   -- cost captured at receive time (optional)
  reason text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index stock_movements_item_idx on public.stock_movements (inventory_item_id, created_at desc);
create index stock_movements_restaurant_idx on public.stock_movements (restaurant_id, created_at desc);
create index stock_movements_order_idx on public.stock_movements (order_id) where order_id is not null;

-- ------------------------------------------------------------
-- item_ingredients (menu dish → inventory item, quantity per unit)
-- ------------------------------------------------------------
create table public.item_ingredients (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  qty_per_unit numeric(12, 3) not null check (qty_per_unit > 0),
  created_at timestamptz not null default now(),
  unique (item_id, inventory_item_id)
);

create index item_ingredients_item_idx on public.item_ingredients (item_id);
create index item_ingredients_inventory_idx on public.item_ingredients (inventory_item_id);

-- ------------------------------------------------------------
-- notifications (in-portal alert feed)
-- ------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  type text not null,                       -- 'stock_low' | 'stock_out' | ...
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  inventory_item_id uuid references public.inventory_items(id) on delete cascade,
  -- Everything the client needs to render a localized message
  -- (name, qty, unit, level, threshold). Keeps the row language-neutral.
  data jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_restaurant_idx on public.notifications (restaurant_id, created_at desc);
create index notifications_unread_idx on public.notifications (restaurant_id) where not is_read;

-- ============================================================
-- Helpers
-- ============================================================

-- The alert level for a given quantity vs its threshold.
create or replace function public.stock_level_of(
  p_qty numeric, p_threshold numeric, p_track boolean
) returns public.stock_level
language sql
immutable
as $$
  select case
    when not p_track then 'ok'::public.stock_level
    when p_qty <= 0 then 'out'::public.stock_level
    when p_threshold > 0 and p_qty <= p_threshold then 'low'::public.stock_level
    else 'ok'::public.stock_level
  end;
$$;

-- Severity ordering so we can detect a *worsening* transition.
create or replace function public.stock_level_rank(p_level public.stock_level)
returns int language sql immutable as $$
  select case p_level when 'ok' then 0 when 'low' then 1 when 'out' then 2 end;
$$;

-- ------------------------------------------------------------
-- Core: apply a signed change to one inventory item.
-- Locks the row, writes the ledger entry, refreshes the alert
-- state (raising a notification only on a worsening transition),
-- and applies auto-86 when the item crosses zero. SECURITY DEFINER
-- so order-time depletion (service role) and portal RPCs share one
-- audited code path.
-- ------------------------------------------------------------
create or replace function public.apply_stock_change(
  p_item_id uuid,
  p_type public.stock_movement_type,
  p_delta numeric,
  p_reason text,
  p_unit_cost int,
  p_order_id uuid,
  p_actor uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  it public.inventory_items;
  v_old numeric;
  v_new numeric;
  v_old_level public.stock_level;
  v_new_level public.stock_level;
begin
  select * into it from public.inventory_items where id = p_item_id for update;
  if not found then
    raise exception 'inventory_item_not_found';
  end if;

  v_old := it.qty_on_hand;
  v_new := round(v_old + p_delta, 3);

  update public.inventory_items
    set qty_on_hand = v_new,
        -- Remember the last received cost so stock value stays meaningful.
        unit_cost_millimes = case
          when p_type = 'receive' and p_unit_cost is not null then p_unit_cost
          else unit_cost_millimes end
    where id = p_item_id;

  insert into public.stock_movements (
    restaurant_id, inventory_item_id, order_id, type,
    qty_delta, qty_after, unit_cost_millimes, reason, created_by
  ) values (
    it.restaurant_id, p_item_id, p_order_id, p_type,
    round(p_delta, 3), v_new, p_unit_cost, left(coalesce(p_reason, ''), 300), p_actor
  );

  v_old_level := public.stock_level_of(v_old, it.reorder_threshold, it.track);
  v_new_level := public.stock_level_of(v_new, it.reorder_threshold, it.track);

  -- Edge-triggered alert: raise only when the level gets *worse* than the
  -- last level we alerted on. Recovery quietly resets the marker so the
  -- next dip alerts again.
  if public.stock_level_rank(v_new_level) > public.stock_level_rank(it.last_alert_level) then
    insert into public.notifications (restaurant_id, type, severity, inventory_item_id, data)
    values (
      it.restaurant_id,
      case when v_new_level = 'out' then 'stock_out' else 'stock_low' end,
      case when v_new_level = 'out' then 'critical' else 'warning' end,
      p_item_id,
      jsonb_build_object(
        'name', it.name, 'qty', v_new, 'unit', it.unit,
        'level', v_new_level, 'threshold', it.reorder_threshold)
    );
    update public.inventory_items set last_alert_level = v_new_level, last_alerted_at = now()
      where id = p_item_id;
  elsif v_new_level <> it.last_alert_level then
    -- Track improvements too (out→low, low→ok) so state stays truthful.
    update public.inventory_items set last_alert_level = v_new_level where id = p_item_id;
  end if;

  -- Auto-86: only act when the on-hand crosses the zero boundary, so we
  -- don't fight a manual availability toggle on every small movement.
  if it.auto_86 then
    if v_old > 0 and v_new <= 0 then
      update public.items set is_available = false
        where id in (select item_id from public.item_ingredients where inventory_item_id = p_item_id);
    elsif v_old <= 0 and v_new > 0 then
      update public.items set is_available = true
        where id in (select item_id from public.item_ingredients where inventory_item_id = p_item_id);
    end if;
  end if;

  return jsonb_build_object('qty_on_hand', v_new::float8, 'level', v_new_level);
end;
$$;

revoke execute on function public.apply_stock_change(uuid, public.stock_movement_type, numeric, text, int, uuid, uuid)
  from public, anon, authenticated;

-- ------------------------------------------------------------
-- Guard used by the portal-facing write RPCs: the caller must be an
-- active owner/manager of the item's own venue.
-- ------------------------------------------------------------
create or replace function public.assert_manages_inventory(p_item_id uuid)
returns public.inventory_items
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  it public.inventory_items;
begin
  select * into it from public.inventory_items where id = p_item_id;
  if not found then
    raise exception 'inventory_item_not_found';
  end if;
  if it.restaurant_id <> public.staff_restaurant_id()
     or not public.staff_has_role(array['owner', 'manager']::public.staff_role[]) then
    raise exception 'not_authorized';
  end if;
  return it;
end;
$$;

revoke execute on function public.assert_manages_inventory(uuid) from public, anon, authenticated;
grant execute on function public.assert_manages_inventory(uuid) to authenticated;

-- ------------------------------------------------------------
-- Portal write RPC: record a receive / waste / adjustment movement.
--  * receive    → +abs(qty)     (unit cost optional)
--  * waste      → −abs(qty)
--  * adjustment → signed qty as given
-- ------------------------------------------------------------
create or replace function public.record_stock_movement(
  p_item_id uuid,
  p_type text,
  p_qty numeric,
  p_reason text default '',
  p_unit_cost int default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  it public.inventory_items;
  v_delta numeric;
begin
  it := public.assert_manages_inventory(p_item_id);
  if p_type not in ('receive', 'waste', 'adjustment') then
    raise exception 'invalid_movement_type';
  end if;
  if p_qty is null or (p_type <> 'adjustment' and p_qty <= 0) then
    raise exception 'invalid_quantity';
  end if;
  v_delta := case
    when p_type = 'receive' then abs(p_qty)
    when p_type = 'waste' then -abs(p_qty)
    else p_qty                      -- adjustment: signed
  end;
  return public.apply_stock_change(
    p_item_id, p_type::public.stock_movement_type, v_delta, p_reason,
    case when p_type = 'receive' then p_unit_cost else null end,
    null, auth.uid());
end;
$$;

revoke execute on function public.record_stock_movement(uuid, text, numeric, text, int) from public, anon;
grant execute on function public.record_stock_movement(uuid, text, numeric, text, int) to authenticated;

-- ------------------------------------------------------------
-- Portal write RPC: stock take — set the on-hand to a counted value,
-- logging the difference as a 'count' movement.
-- ------------------------------------------------------------
create or replace function public.set_stock_count(
  p_item_id uuid,
  p_new_qty numeric,
  p_reason text default ''
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  it public.inventory_items;
begin
  it := public.assert_manages_inventory(p_item_id);
  if p_new_qty is null or p_new_qty < 0 then
    raise exception 'invalid_quantity';
  end if;
  return public.apply_stock_change(
    p_item_id, 'count', round(p_new_qty - it.qty_on_hand, 3), p_reason, null, null, auth.uid());
end;
$$;

revoke execute on function public.set_stock_count(uuid, numeric, text) from public, anon;
grant execute on function public.set_stock_count(uuid, numeric, text) to authenticated;

-- ------------------------------------------------------------
-- Order-time depletion. Called from place_order_tx (service role).
-- Aggregates per inventory item so one order writes one movement per
-- consumed product. Best-effort at the call site (never blocks an order).
-- ------------------------------------------------------------
create or replace function public.deplete_inventory_for_order(p_order_id uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_number text;
  rec record;
begin
  select order_number into v_number from public.orders where id = p_order_id;
  for rec in
    select ing.inventory_item_id as inv_id, sum(oi.qty * ing.qty_per_unit) as needed
    from public.order_items oi
    join public.item_ingredients ing on ing.item_id = oi.item_id
    where oi.order_id = p_order_id
    group by ing.inventory_item_id
  loop
    perform public.apply_stock_change(
      rec.inv_id, 'sale', -round(rec.needed, 3),
      'Commande ' || coalesce(v_number, ''), null, p_order_id, p_actor);
  end loop;
end;
$$;

revoke execute on function public.deplete_inventory_for_order(uuid, uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- Return stock when an order is cancelled: reverse each 'sale'
-- movement for that order. Idempotent (skips if already returned).
-- ------------------------------------------------------------
create or replace function public.restock_cancelled_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  rec record;
begin
  if exists (select 1 from public.stock_movements
             where order_id = p_order_id and type = 'cancel_return') then
    return;   -- already restocked
  end if;
  for rec in
    select inventory_item_id as inv_id, sum(qty_delta) as delta
    from public.stock_movements
    where order_id = p_order_id and type = 'sale'
    group by inventory_item_id
  loop
    -- qty_delta of a sale is negative; returning it adds the amount back.
    perform public.apply_stock_change(
      rec.inv_id, 'cancel_return', -rec.delta,
      'Annulation commande', null, p_order_id, null);
  end loop;
end;
$$;

revoke execute on function public.restock_cancelled_order(uuid) from public, anon, authenticated;

-- AFTER UPDATE trigger: when an order flips to cancelled, return its stock.
create or replace function public.orders_restock_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    perform public.restock_cancelled_order(new.id);
  end if;
  return new;
end;
$$;

create trigger orders_inventory_restock after update on public.orders
  for each row execute function public.orders_restock_on_cancel();

-- ============================================================
-- Read RPCs (SECURITY INVOKER — the staff-read RLS scopes them).
-- ============================================================

-- Dashboard payload: per-item state + a summary (counts + stock value).
create or replace function public.inventory_overview(p_restaurant_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with rows as (
    select
      ii.*,
      public.stock_level_of(ii.qty_on_hand, ii.reorder_threshold, ii.track) as level,
      (select count(*) from public.item_ingredients ing where ing.inventory_item_id = ii.id) as linked_items
    from public.inventory_items ii
    where ii.restaurant_id = p_restaurant_id and ii.is_active
  )
  select jsonb_build_object(
    'summary', jsonb_build_object(
      'total', (select count(*) from rows),
      'ok',   (select count(*) from rows where level = 'ok'),
      'low',  (select count(*) from rows where level = 'low'),
      'out',  (select count(*) from rows where level = 'out'),
      'value_millimes', coalesce((select sum(greatest(qty_on_hand, 0) * coalesce(unit_cost_millimes, 0)) from rows), 0)::bigint
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'name', name, 'category', category, 'unit', unit,
        'qty_on_hand', qty_on_hand::float8, 'reorder_threshold', reorder_threshold::float8,
        'par_level', par_level::float8, 'unit_cost_millimes', unit_cost_millimes,
        'track', track, 'auto_86', auto_86, 'supplier_name', supplier_name,
        'supplier_phone', supplier_phone, 'note', note, 'level', level,
        'linked_items', linked_items, 'updated_at', updated_at)
        order by
          case level when 'out' then 0 when 'low' then 1 else 2 end,
          lower(name))
      from rows), '[]'::jsonb)
  );
$$;

-- Recent movements for one item (history sheet).
create or replace function public.stock_movements_list(p_item_id uuid, p_limit int default 50)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', m.id, 'type', m.type, 'qty_delta', m.qty_delta::float8,
      'qty_after', m.qty_after::float8, 'unit_cost_millimes', m.unit_cost_millimes,
      'reason', m.reason, 'order_id', m.order_id, 'created_at', m.created_at)
      order by m.created_at desc)
    from (
      select * from public.stock_movements
      where inventory_item_id = p_item_id
      order by created_at desc
      limit greatest(1, least(coalesce(p_limit, 50), 200))
    ) m
  ), '[]'::jsonb);
$$;

-- Currently low/out items for a venue (used by the digest + a quick view).
create or replace function public.low_stock_items(p_restaurant_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id, 'name', name, 'unit', unit,
      'qty_on_hand', qty_on_hand::float8, 'reorder_threshold', reorder_threshold::float8,
      'par_level', par_level::float8, 'level', level, 'supplier_name', supplier_name)
      order by case level when 'out' then 0 else 1 end, lower(name))
    from (
      select ii.*, public.stock_level_of(ii.qty_on_hand, ii.reorder_threshold, ii.track) as level
      from public.inventory_items ii
      where ii.restaurant_id = p_restaurant_id and ii.is_active and ii.track
    ) s
    where level <> 'ok'
  ), '[]'::jsonb);
$$;

-- ------------------------------------------------------------
-- Refresh alert state without a movement (catches threshold edits
-- and daily re-checks). Idempotent: only raises on a worsening
-- transition, exactly like the movement path. Owner/manager only.
-- Also invoked by the nightly digest (service role).
-- ------------------------------------------------------------
create or replace function public.sync_stock_alerts(p_restaurant_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  it public.inventory_items;
  v_level public.stock_level;
  v_created int := 0;
  v_is_service boolean := auth.uid() is null;   -- service role / cron
begin
  if not v_is_service then
    if p_restaurant_id <> public.staff_restaurant_id()
       or not public.staff_has_role(array['owner', 'manager']::public.staff_role[]) then
      raise exception 'not_authorized';
    end if;
  end if;

  -- FOR UPDATE serialises concurrent scans (a second portal open, StrictMode's
  -- double effect, or the cron overlapping a manual check) so the same crossing
  -- can't raise duplicate notifications: the second scan waits, then re-reads the
  -- already-updated last_alert_level and skips. `order by id` fixes lock order.
  for it in
    select * from public.inventory_items
    where restaurant_id = p_restaurant_id and is_active and track
    order by id
    for update
  loop
    v_level := public.stock_level_of(it.qty_on_hand, it.reorder_threshold, it.track);
    if public.stock_level_rank(v_level) > public.stock_level_rank(it.last_alert_level) then
      insert into public.notifications (restaurant_id, type, severity, inventory_item_id, data)
      values (
        it.restaurant_id,
        case when v_level = 'out' then 'stock_out' else 'stock_low' end,
        case when v_level = 'out' then 'critical' else 'warning' end,
        it.id,
        jsonb_build_object('name', it.name, 'qty', it.qty_on_hand::float8, 'unit', it.unit,
                           'level', v_level, 'threshold', it.reorder_threshold));
      update public.inventory_items set last_alert_level = v_level, last_alerted_at = now()
        where id = it.id;
      v_created := v_created + 1;
    elsif v_level <> it.last_alert_level then
      update public.inventory_items set last_alert_level = v_level where id = it.id;
    end if;
  end loop;
  return v_created;
end;
$$;

revoke execute on function public.sync_stock_alerts(uuid) from public, anon;
grant execute on function public.sync_stock_alerts(uuid) to authenticated;

-- ------------------------------------------------------------
-- Digest recipients (owner/manager emails) for the nightly email.
-- SECURITY DEFINER so the service role can read auth.users; not part
-- of the public API.
-- ------------------------------------------------------------
create or replace function public.venue_alert_recipients(p_restaurant_id uuid)
returns table (email text, display_name text)
language sql
stable
security definer
set search_path = public
as $$
  select u.email, s.display_name
  from public.staff s
  join auth.users u on u.id = s.auth_uid
  where s.restaurant_id = p_restaurant_id
    and s.is_active
    and s.role in ('owner', 'manager')
    and u.email is not null;
$$;

revoke execute on function public.venue_alert_recipients(uuid) from public, anon, authenticated;

-- ============================================================
-- Redefine place_order_tx to deplete linked inventory after the
-- order + its lines are committed. Depletion is best-effort: a stock
-- error must never block a paying customer's order, so it runs in a
-- sub-block that swallows failures. (Body is otherwise identical to
-- migration 20260702000001.)
-- ============================================================
create or replace function public.place_order_tx(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_note text,
  p_language text,
  p_total_millimes int,
  p_created_by uuid,
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
  v_open_count int;
begin
  -- Idempotency: if this client_ref was already committed, return it.
  if p_client_ref is not null then
    select * into v_order from public.orders where client_ref = p_client_ref;
    if found then
      return jsonb_build_object(
        'id', v_order.id, 'order_number', v_order.order_number,
        'status', v_order.status, 'total_millimes', v_order.total_millimes,
        'created_at', v_order.created_at, 'duplicate', true);
    end if;
  end if;

  -- Abuse cap: at most 5 open orders per customer at a time.
  select count(*) into v_open_count from public.orders
  where created_by = p_created_by and status in ('new', 'preparing', 'ready');
  if v_open_count >= 5 then
    raise exception 'too_many_open_orders' using errcode = 'P0001';
  end if;

  -- Per-tenant order number.
  update public.restaurants set order_seq = order_seq + 1
  where id = p_restaurant_id
  returning order_seq into v_seq;

  insert into public.orders (
    restaurant_id, table_id, order_number, status, note, language,
    total_millimes, created_by, client_ref
  ) values (
    p_restaurant_id, p_table_id, 'A-' || v_seq::text, 'new', p_note, p_language,
    p_total_millimes, p_created_by, p_client_ref
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

  -- Auto-deplete linked inventory. Best-effort: never fail the order.
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

revoke execute on function public.place_order_tx from public, anon, authenticated;

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.inventory_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.item_ingredients enable row level security;
alter table public.notifications enable row level security;

-- inventory_items: all active staff read their venue; owner/manager manage.
create policy "staff read inventory_items" on public.inventory_items
  for select using (restaurant_id = public.staff_restaurant_id());
create policy "manager manages inventory_items" on public.inventory_items
  for all using (
    restaurant_id = public.staff_restaurant_id()
    and public.staff_has_role(array['owner', 'manager']::public.staff_role[])
  ) with check (
    restaurant_id = public.staff_restaurant_id()
    and public.staff_has_role(array['owner', 'manager']::public.staff_role[])
  );

-- stock_movements: staff read their venue's ledger. Writes go only through
-- the SECURITY DEFINER functions above (no insert/update/delete policy),
-- so the ledger is append-only and tamper-resistant.
create policy "staff read stock_movements" on public.stock_movements
  for select using (restaurant_id = public.staff_restaurant_id());

-- item_ingredients: staff read; owner/manager manage.
create policy "staff read item_ingredients" on public.item_ingredients
  for select using (restaurant_id = public.staff_restaurant_id());
create policy "manager manages item_ingredients" on public.item_ingredients
  for all using (
    restaurant_id = public.staff_restaurant_id()
    and public.staff_has_role(array['owner', 'manager']::public.staff_role[])
  ) with check (
    restaurant_id = public.staff_restaurant_id()
    and public.staff_has_role(array['owner', 'manager']::public.staff_role[])
  );

-- notifications: staff read + mark-read their venue's feed. Inserts happen
-- only through the alerting functions (service/definer), so no insert policy.
create policy "staff read notifications" on public.notifications
  for select using (restaurant_id = public.staff_restaurant_id());
create policy "staff update notifications" on public.notifications
  for update using (restaurant_id = public.staff_restaurant_id())
  with check (restaurant_id = public.staff_restaurant_id());

-- ------------------------------------------------------------
-- Realtime — the portal bell + inventory board subscribe.
-- ------------------------------------------------------------
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.inventory_items;
