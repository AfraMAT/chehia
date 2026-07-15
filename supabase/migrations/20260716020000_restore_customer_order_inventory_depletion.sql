-- ============================================================
-- Restore customer-order inventory depletion (product audit 2026-07-15).
--
-- REGRESSION: 20260708000001_inventory.sql added a best-effort
-- deplete_inventory_for_order() call to place_order_tx so that CUSTOMER (QR/
-- browse/group) orders draw down linked stock and auto-86 an item at zero.
-- 20260709000002_group_ordering.sql then redefined place_order_tx to add the
-- group-session parameters — and silently dropped the depletion call. Since
-- then, only POS-rung orders (register_order_tx / settle_order_tx) have
-- depleted stock; every customer order has left inventory untouched, so
-- auto-86 never fires from QR sales and stock counts drift high.
--
-- FIX: redefine place_order_tx (current group-ordering signature) verbatim,
-- with the best-effort depletion block restored after the order_items insert.
-- Depletion reads order_items, so it must run inside this tx after the lines
-- exist (a plain AFTER INSERT trigger on orders would see no lines yet).
-- ============================================================

create or replace function public.place_order_tx(
  p_restaurant_id uuid,
  p_table_id uuid,
  p_note text,
  p_language text,
  p_total_millimes int,
  p_created_by uuid,
  p_client_ref uuid,
  p_lines jsonb,
  p_session_id uuid default null,
  p_place_mode text default null,
  p_participant_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_seq int;
  v_order public.orders;
  v_open_count int;
  v_flipped uuid;
begin
  -- Idempotency: if this caller already committed this client_ref, return it.
  if p_client_ref is not null then
    select * into v_order from public.orders
    where client_ref = p_client_ref and created_by = p_created_by;
    if found then
      return jsonb_build_object(
        'id', v_order.id, 'order_number', v_order.order_number,
        'status', v_order.status, 'total_millimes', v_order.total_millimes,
        'created_at', v_order.created_at, 'duplicate', true);
    end if;
  end if;

  -- Group placement: atomically claim the session so only one order is created.
  if p_place_mode = 'group' then
    update public.order_sessions set status = 'placed', closed_at = now()
      where id = p_session_id and status = 'open'
      returning id into v_flipped;
    if v_flipped is null then
      raise exception 'session_not_placeable' using errcode = 'P0001';
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
    total_millimes, created_by, client_ref, session_id
  ) values (
    p_restaurant_id, p_table_id, 'A-' || v_seq::text, 'new', p_note, p_language,
    p_total_millimes, p_created_by, p_client_ref, p_session_id
  ) returning * into v_order;

  insert into public.order_items (
    order_id, restaurant_id, item_id, name_snapshot, qty,
    unit_price_millimes, modifiers_snapshot, note, participant_nickname
  )
  select
    v_order.id, p_restaurant_id,
    (line->>'item_id')::uuid,
    line->'name_snapshot',
    (line->>'qty')::int,
    (line->>'unit_price_millimes')::int,
    coalesce(line->'modifiers_snapshot', '[]'::jsonb),
    coalesce(line->>'note', ''),
    coalesce(line->>'participant_nickname', '')
  from jsonb_array_elements(p_lines) as line;

  -- Solo split: remove the placer's lines + mark them left; close if now empty.
  if p_place_mode = 'solo' and p_participant_id is not null then
    delete from public.session_cart_lines where participant_id = p_participant_id;
    update public.session_participants set left_at = now(), is_ready = false
      where id = p_participant_id and left_at is null;
    if not exists (
      select 1 from public.session_participants where session_id = p_session_id and left_at is null
    ) then
      update public.order_sessions set status = 'closed', closed_at = now()
        where id = p_session_id and status in ('open', 'placing');
    end if;
  end if;

  -- Auto-deplete linked inventory (RESTORED). Best-effort: a stock/recipe
  -- problem must never fail a customer's order. Crosses-zero → auto-86 fires.
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

revoke execute on function public.place_order_tx(uuid, uuid, text, text, int, uuid, uuid, jsonb, uuid, text, uuid) from public, anon, authenticated;
