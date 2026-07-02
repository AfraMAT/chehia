-- ============================================================
-- Audit fixes: atomic order placement, per-tenant order numbers,
-- idempotency, abuse caps, waiter-call throttle backing, and
-- SQL-side analytics (no PostgREST row-cap truncation, correct TZ).
-- ============================================================

-- Per-restaurant order numbering (replaces the global sequence, which
-- leaked platform-wide volume across tenants).
alter table public.restaurants add column if not exists order_seq int not null default 0;

-- Client-supplied idempotency key: a retry of the same submission
-- cannot create a duplicate order.
alter table public.orders add column if not exists client_ref uuid;
create unique index if not exists orders_client_ref_unique
  on public.orders (client_ref) where client_ref is not null;

-- Back the call-waiter "one open call per table" throttle with a real
-- constraint (the check-then-insert in the function is racy on its own).
create unique index if not exists waiter_calls_one_open_per_table
  on public.waiter_calls (table_id) where status = 'open';

-- ------------------------------------------------------------
-- Atomic order placement. SECURITY DEFINER; called by the
-- place-order edge function with pre-validated, pre-priced lines.
-- Inserts order + items in ONE transaction, assigns a per-tenant
-- order number, enforces an open-order cap, and is idempotent
-- on client_ref.
-- ------------------------------------------------------------
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

  return jsonb_build_object(
    'id', v_order.id, 'order_number', v_order.order_number,
    'status', v_order.status, 'total_millimes', v_order.total_millimes,
    'created_at', v_order.created_at, 'duplicate', false);
end;
$$;

-- Only the service role (edge functions) may call it.
revoke execute on function public.place_order_tx from public, anon, authenticated;

-- ------------------------------------------------------------
-- Portal analytics computed in SQL — immune to the PostgREST
-- 1000-row cap and using the venue's timezone for hour buckets.
-- SECURITY INVOKER: RLS on orders/order_items scopes the caller.
-- ------------------------------------------------------------
create or replace function public.stats_summary(p_restaurant_id uuid, p_days int)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with tz as (
    select coalesce(nullif(r.timezone, ''), 'Africa/Tunis') as tz
    from public.restaurants r where r.id = p_restaurant_id
  ),
  bounds as (
    select
      case when p_days = 1
        then date_trunc('day', now() at time zone (select tz from tz)) at time zone (select tz from tz)
        else now() - make_interval(days => p_days) end as since,
      case when p_days = 1
        then (date_trunc('day', now() at time zone (select tz from tz)) - make_interval(days => 1)) at time zone (select tz from tz)
        else now() - make_interval(days => 2 * p_days) end as prev_since
  ),
  cur as (
    select * from public.orders o
    where o.restaurant_id = p_restaurant_id and o.status <> 'cancelled'
      and o.created_at >= (select since from bounds)
  ),
  prev as (
    select * from public.orders o
    where o.restaurant_id = p_restaurant_id and o.status <> 'cancelled'
      and o.created_at >= (select prev_since from bounds)
      and o.created_at < (select since from bounds)
  ),
  served as (
    select extract(epoch from (o.served_at - o.created_at)) / 60.0 as minutes
    from cur o where o.served_at is not null
  ),
  hourly as (
    select extract(hour from o.created_at at time zone (select tz from tz))::int as hour, count(*)::int as n
    from cur o group by 1
  ),
  top_items as (
    select oi.name_snapshot, sum(oi.qty)::int as qty,
           sum(oi.qty * oi.unit_price_millimes)::bigint as revenue_millimes
    from public.order_items oi
    join cur o on o.id = oi.order_id
    group by oi.name_snapshot
    order by qty desc
    limit 5
  )
  select jsonb_build_object(
    'revenue_millimes', coalesce((select sum(total_millimes) from cur), 0),
    'prev_revenue_millimes', coalesce((select sum(total_millimes) from prev), 0),
    'order_count', (select count(*) from cur),
    'prev_order_count', (select count(*) from prev),
    'median_service_minutes', (select percentile_cont(0.5) within group (order by minutes) from served),
    'hourly', coalesce((select jsonb_agg(jsonb_build_object('hour', hour, 'n', n) order by hour) from hourly), '[]'::jsonb),
    'top_items', coalesce((select jsonb_agg(jsonb_build_object(
        'name', name_snapshot, 'qty', qty, 'revenue_millimes', revenue_millimes)) from top_items), '[]'::jsonb)
  );
$$;

-- ------------------------------------------------------------
-- Insights metrics for the nightly job — same aggregation, plus
-- weekday distribution and sold-out list. SECURITY DEFINER so the
-- edge function computes without fetching rows.
-- ------------------------------------------------------------
create or replace function public.insights_metrics(p_restaurant_id uuid, p_days int)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with tz as (
    select coalesce(nullif(r.timezone, ''), 'Africa/Tunis') as tz
    from public.restaurants r where r.id = p_restaurant_id
  ),
  cur as (
    select * from public.orders o
    where o.restaurant_id = p_restaurant_id and o.status <> 'cancelled'
      and o.created_at >= now() - make_interval(days => p_days)
  ),
  served as (
    select extract(epoch from (o.served_at - o.created_at)) / 60.0 as minutes
    from cur o where o.served_at is not null
  ),
  hourly as (
    select extract(hour from o.created_at at time zone (select tz from tz))::int as hour, count(*)::int as n
    from cur o group by 1
  ),
  weekday as (
    select trim(to_char(o.created_at at time zone (select tz from tz), 'Dy')) as day, count(*)::int as n
    from cur o group by 1
  ),
  top_items as (
    select oi.name_snapshot->>'fr' as name, sum(oi.qty)::int as qty,
           sum(oi.qty * oi.unit_price_millimes)::bigint as revenue_millimes
    from public.order_items oi
    join cur o on o.id = oi.order_id
    group by 1 order by qty desc limit 5
  ),
  sold_out as (
    select i.name_i18n->>'fr' as name from public.items i
    where i.restaurant_id = p_restaurant_id and not i.is_available
  )
  select jsonb_build_object(
    'total_orders', (select count(*) from cur),
    'total_revenue_millimes', coalesce((select sum(total_millimes) from cur), 0),
    'median_service_minutes', (select percentile_cont(0.5) within group (order by minutes) from served),
    'orders_by_hour', coalesce((select jsonb_agg(jsonb_build_object('hour', hour, 'orders', n) order by hour) from hourly), '[]'::jsonb),
    'orders_by_weekday', coalesce((select jsonb_agg(jsonb_build_object('weekday', day, 'orders', n)) from weekday), '[]'::jsonb),
    'top_items', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'qty', qty, 'revenue_millimes', revenue_millimes)) from top_items), '[]'::jsonb),
    'unavailable_items', coalesce((select jsonb_agg(name) from sold_out), '[]'::jsonb)
  );
$$;

revoke execute on function public.insights_metrics from public, anon, authenticated;

-- Atomic replace of a day's insights (delete + insert in one tx).
create or replace function public.replace_insights(
  p_restaurant_id uuid,
  p_generated_for date,
  p_rows jsonb
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  delete from public.ai_insights
  where restaurant_id = p_restaurant_id and generated_for = p_generated_for;

  insert into public.ai_insights (
    restaurant_id, generated_for, language, title, body, recommendation, action_label, metrics
  )
  select p_restaurant_id, p_generated_for,
         row->>'language', row->>'title', row->>'body',
         coalesce(row->>'recommendation', ''), coalesce(row->>'action_label', ''),
         coalesce(row->'metrics', '{}'::jsonb)
  from jsonb_array_elements(p_rows) as row;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.replace_insights from public, anon, authenticated;
