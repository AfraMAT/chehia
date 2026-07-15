-- ============================================================
-- Staff accountability + venue safety controls (product audit 2026-07-15)
--
-- A · ACCOUNTABILITY. The staff-accept gate existed, but no transition ever
--     recorded WHO acted — "who confirmed this fake order?" was unanswerable,
--     and the only write path was a bare client UPDATE of `status` with no
--     validation, no actor, no reason, and no way to cancel from the UI.
--     Now: per-actor columns on orders, an append-only order_status_events
--     audit trail, and a single SECURITY DEFINER RPC (advance_order_status)
--     that validates the transition server-side, attributes the acting staff
--     member, requires a reason to cancel, and enforces the venue's
--     table-confirmation policy. The direct UPDATE(status) grant is revoked —
--     the RPC is the only path.
--
-- B · VENUE CONTROLS.
--     require_table_confirmation — floor staff (owner/manager/waiter) must
--       confirm a customer order before the kitchen may see/prepare it; the
--       kitchen role cannot perform new→preparing. Off by default.
--     ordering_paused — the owner's kill switch: place-order refuses new
--       customer orders while on (incident response for abuse/rush).
--     enforce_opening_hours — opt-in: refuse customer orders outside the
--       venue's configured opening hours (off by default so venues with
--       aspirational hours — and the App-Review demo venue — keep working).
--     rotate_table_qr — invalidate a leaked/photographed table QR on demand
--       (reprint required); owner/manager only.
-- ============================================================

-- A1 · who acted, per milestone (kept on the row for cheap reads; the event
--      table below is the authoritative history).
alter table public.orders
  add column if not exists accepted_by uuid references public.staff(id) on delete set null,
  add column if not exists served_by uuid references public.staff(id) on delete set null,
  add column if not exists cancelled_by uuid references public.staff(id) on delete set null,
  add column if not exists cancel_reason text;

create index if not exists orders_accepted_by_idx on public.orders (accepted_by);
create index if not exists orders_served_by_idx on public.orders (served_by);
create index if not exists orders_cancelled_by_idx on public.orders (cancelled_by);

-- A2 · append-only transition log (dispute reconstruction).
create table if not exists public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  from_status public.order_status not null,
  to_status public.order_status not null,
  staff_id uuid references public.staff(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists order_status_events_order_idx
  on public.order_status_events (order_id, created_at);
create index if not exists order_status_events_restaurant_idx
  on public.order_status_events (restaurant_id, created_at desc);
create index if not exists order_status_events_staff_idx
  on public.order_status_events (staff_id);

alter table public.order_status_events enable row level security;

-- Venue staff may read their venue's history; nobody writes directly — only
-- the SECURITY DEFINER RPC below inserts, and nothing updates or deletes.
create policy "staff reads own venue order events" on public.order_status_events
  for select to authenticated
  using (restaurant_id = public.staff_restaurant_id());

revoke insert, update, delete on public.order_status_events from anon, authenticated;

-- B1 · venue flags.
alter table public.restaurants
  add column if not exists require_table_confirmation boolean not null default false,
  add column if not exists ordering_paused boolean not null default false,
  add column if not exists enforce_opening_hours boolean not null default false;

-- A3 · the single, attributed write path for order status.
create or replace function public.advance_order_status(
  p_order uuid,
  p_to public.order_status,
  p_reason text default null
) returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff  public.staff;
  v_order  public.orders;
  v_from   public.order_status;
  v_confirmation boolean;
  v_legal  boolean;
begin
  select * into v_staff from public.staff
    where auth_uid = auth.uid() and is_active limit 1;
  if v_staff.id is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;

  select * into v_order from public.orders
    where id = p_order and restaurant_id = v_staff.restaurant_id
    for update;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  v_from := v_order.status;

  -- Server-side mirror of packages/shared/src/status.ts TRANSITIONS.
  v_legal := case v_from
    when 'new'       then p_to in ('preparing', 'cancelled')
    when 'preparing' then p_to in ('ready', 'served', 'cancelled')
    when 'ready'     then p_to = 'served'
    else false
  end;
  if not v_legal then
    raise exception 'illegal_transition' using errcode = 'P0001';
  end if;

  -- Table-confirmation policy: confirming a customer order (new→preparing)
  -- is a floor action — the kitchen role may not do it. POS-originated
  -- orders (created_by_staff) were rung in person and are exempt.
  if v_from = 'new' and p_to = 'preparing' and v_staff.role = 'kitchen' then
    select require_table_confirmation into v_confirmation
      from public.restaurants where id = v_staff.restaurant_id;
    if v_confirmation and v_order.created_by_staff is null then
      raise exception 'confirmation_requires_floor_staff' using errcode = 'P0001';
    end if;
  end if;

  -- Cancellations always carry a reason — that is the accountability record.
  if p_to = 'cancelled' and coalesce(btrim(p_reason), '') = '' then
    raise exception 'reason_required' using errcode = 'P0001';
  end if;

  update public.orders set
    status = p_to,
    accepted_by  = case when p_to = 'preparing' then coalesce(accepted_by, v_staff.id) else accepted_by end,
    served_by    = case when p_to = 'served'    then coalesce(served_by,  v_staff.id) else served_by  end,
    cancelled_by = case when p_to = 'cancelled' then v_staff.id else cancelled_by end,
    cancel_reason = case when p_to = 'cancelled' then btrim(p_reason) else cancel_reason end
  where id = p_order
  returning * into v_order;

  insert into public.order_status_events (order_id, restaurant_id, from_status, to_status, staff_id, reason)
  values (p_order, v_staff.restaurant_id, v_from, p_to, v_staff.id, nullif(btrim(coalesce(p_reason, '')), ''));

  return v_order;
end;
$$;

revoke execute on function public.advance_order_status(uuid, public.order_status, text) from public, anon;
grant execute on function public.advance_order_status(uuid, public.order_status, text) to authenticated;

-- The RPC is now the only path: close the direct column grant from
-- 20260710000004_pos_review_fixes.sql.
revoke update (status) on public.orders from authenticated;

-- A4 · waiter-call acknowledgement, attributed (acknowledged_by existed in the
--      schema but nothing ever wrote it).
create or replace function public.ack_waiter_call(p_call uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff;
begin
  select * into v_staff from public.staff
    where auth_uid = auth.uid() and is_active limit 1;
  if v_staff.id is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  update public.waiter_calls
    set status = 'acknowledged',
        acknowledged_at = coalesce(acknowledged_at, now()),
        acknowledged_by = coalesce(acknowledged_by, v_staff.id)
    where id = p_call and restaurant_id = v_staff.restaurant_id;
end;
$$;

revoke execute on function public.ack_waiter_call(uuid) from public, anon;
grant execute on function public.ack_waiter_call(uuid) to authenticated;

-- B2 · rotate a table's QR capability (leaked/photographed token response).
--      Owner/manager only; the old printed QR stops working immediately.
create or replace function public.rotate_table_qr(p_table uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff;
  v_token text;
begin
  select * into v_staff from public.staff
    where auth_uid = auth.uid() and is_active limit 1;
  if v_staff.id is null or v_staff.role not in ('owner', 'manager') then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  update public.tables
    set qr_token = encode(gen_random_bytes(16), 'hex')
    where id = p_table and restaurant_id = v_staff.restaurant_id
    returning qr_token into v_token;
  if v_token is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  return v_token;
end;
$$;

revoke execute on function public.rotate_table_qr(uuid) from public, anon;
grant execute on function public.rotate_table_qr(uuid) to authenticated;
