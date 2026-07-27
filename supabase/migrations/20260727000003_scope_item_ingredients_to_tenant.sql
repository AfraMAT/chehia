-- ============================================================================
-- SECURITY FIX (high) — cross-tenant menu sabotage and stock theft through
-- public.item_ingredients.
--
-- `manager manages item_ingredients` (20260708000001_inventory.sql:734) checks
-- only that the ROW's own restaurant_id is the caller's:
--
--   with check (restaurant_id = public.staff_restaurant_id() and staff_has_role(…))
--
-- It never checks that `item_id` and `inventory_item_id` belong to that same
-- venue. An owner or manager at venue A could therefore insert
--   { restaurant_id: A, item_id: <a dish belonging to venue B>,
--     inventory_item_id: <A's own stock item> }
-- and the row passes.
--
-- Two unscoped queries then act on it:
--
--   1. apply_stock_change's auto-86 —
--        update public.items set is_available = false
--          where id in (select item_id from item_ingredients
--                       where inventory_item_id = p_item_id);
--      No restaurant filter on `items`. When A's stock hits zero, **venue B's
--      dish is taken off sale.** A competitor can 86 another café's menu.
--
--   2. deplete_inventory_for_order —
--        join public.item_ingredients ing on ing.item_id = oi.item_id
--      No tenant predicate, so B selling that dish silently drains A's stock
--      (and fires A's low-stock alerts).
--
-- Both function bodies below are the CURRENT live definitions pulled from prod
-- with pg_get_functiondef, per the regression precedent in supabase/CLAUDE.md
-- (20260709000002 once clobbered the inventory-depletion call by replacing a
-- function against its ORIGINAL text). The only edits are the tenant predicates.
--
-- Fixed in two layers, because the bad rows may already exist:
--   • a BEFORE INSERT/UPDATE trigger rejects a link that crosses venues, and
--   • both readers are scoped by restaurant_id so any pre-existing bad row is
--     inert rather than merely un-creatable from now on.
-- ============================================================================

-- ---- 1. Reject cross-venue links at write time ------------------------------
-- A trigger rather than a WITH CHECK subquery: the policy's subquery would run
-- under the caller's own RLS on items / inventory_items, which makes "is this
-- id foreign?" and "am I allowed to see it?" the same question and the failure
-- mode hard to reason about. SECURITY DEFINER answers the tenancy question
-- directly.
create or replace function public.guard_item_ingredient_tenancy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.items i
    where i.id = new.item_id and i.restaurant_id = new.restaurant_id
  ) then
    raise exception 'item_not_in_restaurant' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.inventory_items ii
    where ii.id = new.inventory_item_id and ii.restaurant_id = new.restaurant_id
  ) then
    raise exception 'inventory_item_not_in_restaurant' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_item_ingredient_tenancy() from public, anon, authenticated;

drop trigger if exists guard_item_ingredient_tenancy on public.item_ingredients;
create trigger guard_item_ingredient_tenancy
  before insert or update on public.item_ingredients
  for each row execute function public.guard_item_ingredient_tenancy();

-- ---- 2. Scope the auto-86 update to the stock item's own venue --------------
create or replace function public.apply_stock_change(
  p_item_id uuid, p_type public.stock_movement_type, p_delta numeric,
  p_reason text, p_unit_cost integer, p_order_id uuid, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  it public.inventory_items;
  v_old numeric; v_new numeric;
  v_old_level public.stock_level; v_new_level public.stock_level;
begin
  select * into it from public.inventory_items where id = p_item_id for update;
  if not found then raise exception 'inventory_item_not_found'; end if;
  v_old := it.qty_on_hand;
  v_new := round(v_old + p_delta, 3);
  update public.inventory_items
    set qty_on_hand = v_new,
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
  if public.stock_level_rank(v_new_level) > public.stock_level_rank(it.last_alert_level) then
    insert into public.notifications (restaurant_id, type, severity, inventory_item_id, data)
    values (
      it.restaurant_id,
      case when v_new_level = 'out' then 'stock_out' else 'stock_low' end,
      case when v_new_level = 'out' then 'critical' else 'warning' end,
      p_item_id,
      jsonb_build_object('name', it.name, 'qty', v_new, 'unit', it.unit,
        'level', v_new_level, 'threshold', it.reorder_threshold));
    update public.inventory_items set last_alert_level = v_new_level, last_alerted_at = now()
      where id = p_item_id;
  elsif v_new_level <> it.last_alert_level then
    update public.inventory_items set last_alert_level = v_new_level where id = p_item_id;
  end if;
  if it.auto_86 then
    -- CHANGED: both the link lookup and the items update are pinned to this
    -- stock item's own venue, so a link naming another venue's dish cannot
    -- reach across and toggle that dish's availability.
    if v_old > 0 and v_new <= 0 then
      update public.items set is_available = false
        where restaurant_id = it.restaurant_id
          and id in (select item_id from public.item_ingredients
                     where inventory_item_id = p_item_id
                       and restaurant_id = it.restaurant_id);
    elsif v_old <= 0 and v_new > 0 then
      update public.items set is_available = true
        where restaurant_id = it.restaurant_id
          and id in (select item_id from public.item_ingredients
                     where inventory_item_id = p_item_id
                       and restaurant_id = it.restaurant_id);
    end if;
  end if;
  return jsonb_build_object('qty_on_hand', v_new::float8, 'level', v_new_level);
end;
$$;

-- ---- 3. Scope the depletion join to the order's own venue -------------------
create or replace function public.deplete_inventory_for_order(p_order_id uuid, p_actor uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_number text; rec record;
begin
  select order_number into v_number from public.orders where id = p_order_id;
  for rec in
    -- CHANGED: `and ing.restaurant_id = oi.restaurant_id`. Without it, a link
    -- row planted by another venue made this order deplete THAT venue's stock.
    select ing.inventory_item_id as inv_id, sum(oi.qty * ing.qty_per_unit) as needed
    from public.order_items oi
    join public.item_ingredients ing
      on ing.item_id = oi.item_id
     and ing.restaurant_id = oi.restaurant_id
    where oi.order_id = p_order_id
    group by ing.inventory_item_id
  loop
    perform public.apply_stock_change(
      rec.inv_id, 'sale', -round(rec.needed, 3),
      'Commande ' || coalesce(v_number, ''), null, p_order_id, p_actor);
  end loop;
end;
$$;
