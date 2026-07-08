-- ============================================================
-- POS money-path fixes from the pre-prod adversarial review.
--
-- BLOCKER 1 (CRITICAL): the money/fiscal columns added to `orders`
-- (paid_at, fiscal_number, total_millimes, ...) sat under the row-only
-- RLS policy "staff update orders" with the default full-column UPDATE
-- grant to `authenticated`. Any staff could PATCH paid_at / fiscal_number
-- / total directly via PostgREST, bypassing settle_order_tx — marking
-- orders paid with no payment, minting/colliding fiscal numbers, re-opening
-- settled orders for double-posting, and zeroing revenue. Column-scope the
-- grant so clients may only advance `status` (the one column the kitchen
-- board writes); all money columns become writable ONLY through the
-- SECURITY DEFINER functions (which run as owner and are unaffected).
--
-- Also folds in two low-risk hardening fixes: register_order_tx idempotency
-- scoping (#5) and settle_order_tx fiscal-year computed in the venue's
-- timezone rather than UTC (#1, matters at the Dec-31 boundary).
-- ============================================================

-- ---- BLOCKER 1: column-scope client UPDATE on orders ----
revoke update on public.orders from anon, authenticated;
-- The kitchen/floor advance the order lifecycle; the BEFORE trigger
-- stamp_order_status sets accepted_at/ready_at/... in trigger context, which
-- is not subject to the caller's column privileges, so status flow keeps working.
grant update (status) on public.orders to authenticated;

-- ---- #5: scope register_order_tx idempotency to the venue ----
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

  -- Idempotency, scoped to the venue (mirrors place_order_tx hardening).
  if p_client_ref is not null then
    select * into v_order from public.orders
    where client_ref = p_client_ref and restaurant_id = p_restaurant_id;
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

-- ---- #1: settle_order_tx fiscal year in the venue timezone ----
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
  v_tz text;
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

  if v_order.paid_at is not null then
    return jsonb_build_object(
      'id', v_order.id, 'order_number', v_order.order_number,
      'fiscal_number', v_order.fiscal_number, 'fiscal_year', v_order.fiscal_year,
      'paid_at', v_order.paid_at, 'duplicate', true);
  end if;

  -- Fiscal year in the venue's local time, so the year never rolls over an
  -- hour early (Tunisia = UTC+1) and receipts dated in the new year can't carry
  -- the old year's number.
  select coalesce(nullif(timezone, ''), 'Africa/Tunis') into v_tz
  from public.restaurants where id = p_restaurant_id;
  v_year := extract(year from (now() at time zone coalesce(v_tz, 'Africa/Tunis')))::int;

  insert into public.receipt_sequences (restaurant_id, year, next_value)
  values (p_restaurant_id, v_year, 1)
  on conflict (restaurant_id, year) do nothing;

  update public.receipt_sequences
  set next_value = next_value + 1
  where restaurant_id = p_restaurant_id and year = v_year
  returning next_value - 1 into v_num;

  v_fiscal := lpad(v_num::text, 5, '0') || '/' || v_year::text;

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
