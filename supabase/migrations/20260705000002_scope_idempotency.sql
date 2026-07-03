-- ============================================================
-- Harden place_order_tx idempotency: scope the client_ref lookup to the
-- calling user. Previously the lookup was global, so a caller who supplied
-- another user's client_ref would receive that order's id/number/total back.
-- client_ref is a random UUID (guessing it is infeasible), so this is a
-- defence-in-depth fix — the only functional change is the added
-- `and created_by = p_created_by` on the idempotency SELECT.
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

  return jsonb_build_object(
    'id', v_order.id, 'order_number', v_order.order_number,
    'status', v_order.status, 'total_millimes', v_order.total_millimes,
    'created_at', v_order.created_at, 'duplicate', false);
end;
$$;

revoke execute on function public.place_order_tx from public, anon, authenticated;
