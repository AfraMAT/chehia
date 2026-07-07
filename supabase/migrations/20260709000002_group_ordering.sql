-- ============================================================
-- Group ordering sessions.
-- People at a table opt into a shared live session, each add attributed lines
-- to a shared cart, then EITHER the host places one combined order (one order /
-- one receipt) once everyone is ready, OR an individual splits off and places
-- only their own lines (their own order/receipt) without waiting.
--
-- Design:
-- - order_sessions / session_participants / session_cart_lines are the live
--   shared state, published to realtime; multiple distinct anonymous users
--   collaborate on one session (membership-based RLS).
-- - Cart-line reads/writes go through direct RLS (so realtime "just works");
--   join/ready/nickname/leave go through SECURITY DEFINER RPCs (validation).
-- - Placement always re-loads lines server-side in the place-order edge
--   function and reuses place_order_tx (extended here for session linkage +
--   per-person attribution + atomic single-placement).
-- ============================================================

-- ------------------------------------------------------------
-- Tables
-- ------------------------------------------------------------
create table public.order_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_id uuid not null references public.tables(id) on delete cascade,
  share_code text not null unique,
  host_uid uuid references auth.users(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'placing', 'placed', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

-- At most one live (open/placing) session per table.
create unique index order_sessions_one_live_per_table
  on public.order_sessions (table_id) where status in ('open', 'placing');
create index order_sessions_restaurant_idx on public.order_sessions (restaurant_id, created_at desc);

create table public.session_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.order_sessions(id) on delete cascade,
  auth_uid uuid not null,
  nickname text not null default 'Guest',
  is_host boolean not null default false,
  is_ready boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (session_id, auth_uid)
);
create index session_participants_session_idx on public.session_participants (session_id);

create table public.session_cart_lines (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.order_sessions(id) on delete cascade,
  participant_id uuid not null references public.session_participants(id) on delete cascade,
  item_id uuid not null references public.items(id) on delete cascade,
  qty int not null check (qty >= 1 and qty <= 20),
  modifier_ids uuid[] not null default '{}',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index session_cart_lines_session_idx on public.session_cart_lines (session_id);

-- Link placed orders back to their session + attribute each line to a person.
alter table public.orders
  add column if not exists session_id uuid references public.order_sessions(id) on delete set null;
alter table public.order_items
  add column if not exists participant_nickname text not null default '';

create trigger session_cart_lines_updated_at before update on public.session_cart_lines
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Realtime
-- ------------------------------------------------------------
alter publication supabase_realtime add table public.order_sessions;
alter publication supabase_realtime add table public.session_participants;
alter publication supabase_realtime add table public.session_cart_lines;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table public.order_sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.session_cart_lines enable row level security;

-- Membership check (SECURITY DEFINER so it can be used inside policies).
create or replace function public.is_session_member(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.session_participants sp
    where sp.session_id = p_session and sp.auth_uid = auth.uid() and sp.left_at is null
  );
$$;

-- order_sessions: members + restaurant staff + platform admins may read.
create policy "member reads session" on public.order_sessions
  for select using (
    public.is_session_member(id)
    or restaurant_id = public.staff_restaurant_id()
    or public.is_platform_admin()
  );

-- session_participants: members + admins may read.
create policy "member reads participants" on public.session_participants
  for select using (public.is_session_member(session_id) or public.is_platform_admin());

-- session_cart_lines: members + admins may read; a member writes only their OWN
-- lines, only while the session is open, and only for items on this venue's menu.
create policy "member reads cart lines" on public.session_cart_lines
  for select using (public.is_session_member(session_id) or public.is_platform_admin());

create policy "member inserts own cart line" on public.session_cart_lines
  for insert with check (
    exists (
      select 1 from public.session_participants sp
      where sp.id = participant_id and sp.session_id = session_cart_lines.session_id
        and sp.auth_uid = auth.uid() and sp.left_at is null
    )
    and exists (select 1 from public.order_sessions os where os.id = session_id and os.status = 'open')
    and exists (
      select 1 from public.items it join public.order_sessions os on os.id = session_cart_lines.session_id
      where it.id = item_id and it.restaurant_id = os.restaurant_id
    )
  );

create policy "member updates own cart line" on public.session_cart_lines
  for update using (
    exists (select 1 from public.session_participants sp where sp.id = participant_id and sp.auth_uid = auth.uid())
  ) with check (
    exists (select 1 from public.session_participants sp where sp.id = participant_id and sp.auth_uid = auth.uid())
  );

create policy "member deletes own cart line" on public.session_cart_lines
  for delete using (
    exists (select 1 from public.session_participants sp where sp.id = participant_id and sp.auth_uid = auth.uid())
  );

-- ------------------------------------------------------------
-- Short, unambiguous share codes (no I/L/O/0/1).
-- ------------------------------------------------------------
create or replace function public.gen_session_code()
returns text
language sql
volatile
as $$
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 30)::int, 1), '')
  from generate_series(1, 6);
$$;

create or replace function public.clean_nickname(p_nickname text)
returns text
language sql
immutable
as $$
  select coalesce(nullif(left(btrim(coalesce(p_nickname, '')), 40), ''), 'Guest');
$$;

-- ------------------------------------------------------------
-- RPCs (customer-callable; SECURITY DEFINER + self-scoped)
-- ------------------------------------------------------------

-- Start (or join, if one is already live) a session for a table.
create or replace function public.start_session(
  p_qr_token text default null,
  p_table_id uuid default null,
  p_nickname text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_table         public.tables;
  v_restaurant    public.restaurants;
  v_session_id    uuid;
  v_is_host       boolean := false;
  v_participant_id uuid;
  v_share_code    text;
  v_status        text;
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;

  if p_qr_token is not null then
    select * into v_table from public.tables where qr_token = p_qr_token;
  elsif p_table_id is not null then
    select * into v_table from public.tables where id = p_table_id;
  else
    raise exception 'table_required' using errcode = 'P0001';
  end if;
  if not found or not v_table.is_active then
    raise exception 'unknown_table' using errcode = 'P0001';
  end if;

  select * into v_restaurant from public.restaurants where id = v_table.restaurant_id;
  if not found or not v_restaurant.is_active then
    raise exception 'restaurant_inactive' using errcode = 'P0001';
  end if;

  -- Reuse an existing live session on this table, else create one.
  select id into v_session_id from public.order_sessions
    where table_id = v_table.id and status in ('open', 'placing') limit 1;

  if v_session_id is null then
    loop
      begin
        insert into public.order_sessions (restaurant_id, table_id, share_code, host_uid, status)
        values (v_table.restaurant_id, v_table.id, public.gen_session_code(), auth.uid(), 'open')
        returning id into v_session_id;
        v_is_host := true;
        exit;
      exception when unique_violation then
        -- A concurrent open session, or a rare share_code collision.
        select id into v_session_id from public.order_sessions
          where table_id = v_table.id and status in ('open', 'placing') limit 1;
        if v_session_id is not null then exit; end if;
      end;
    end loop;
  end if;

  insert into public.session_participants (session_id, auth_uid, nickname, is_host)
  values (v_session_id, auth.uid(), public.clean_nickname(p_nickname), v_is_host)
  on conflict (session_id, auth_uid)
    do update set left_at = null, nickname = public.clean_nickname(p_nickname)
  returning id into v_participant_id;

  select share_code, status into v_share_code, v_status from public.order_sessions where id = v_session_id;
  return jsonb_build_object(
    'session_id', v_session_id, 'share_code', v_share_code, 'status', v_status,
    'participant_id', v_participant_id,
    'is_host', (select is_host from public.session_participants where id = v_participant_id)
  );
end;
$$;

-- Join an existing session by its share code (or id).
create or replace function public.join_session(
  p_share_code text default null,
  p_session_id uuid default null,
  p_nickname text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session       public.order_sessions;
  v_participant_id uuid;
  v_active_count  int;
begin
  if auth.uid() is null then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;

  if p_share_code is not null then
    select * into v_session from public.order_sessions where upper(share_code) = upper(btrim(p_share_code));
  elsif p_session_id is not null then
    select * into v_session from public.order_sessions where id = p_session_id;
  else
    raise exception 'code_required' using errcode = 'P0001';
  end if;
  if not found then
    raise exception 'session_not_found' using errcode = 'P0001';
  end if;
  if v_session.status <> 'open' then
    raise exception 'session_closed' using errcode = 'P0001';
  end if;

  -- Cap active participants (re-joining an existing row doesn't count against it).
  select count(*) into v_active_count from public.session_participants
    where session_id = v_session.id and left_at is null
      and auth_uid <> auth.uid();
  if v_active_count >= 12 then
    raise exception 'session_full' using errcode = 'P0001';
  end if;

  insert into public.session_participants (session_id, auth_uid, nickname, is_host)
  values (v_session.id, auth.uid(), public.clean_nickname(p_nickname), false)
  on conflict (session_id, auth_uid)
    do update set left_at = null, nickname = public.clean_nickname(p_nickname)
  returning id into v_participant_id;

  return jsonb_build_object(
    'session_id', v_session.id, 'share_code', v_session.share_code, 'status', v_session.status,
    'participant_id', v_participant_id,
    'is_host', (select is_host from public.session_participants where id = v_participant_id)
  );
end;
$$;

create or replace function public.set_session_ready(p_session uuid, p_ready boolean)
returns void
language sql
security definer
set search_path = public
as $$
  update public.session_participants set is_ready = coalesce(p_ready, false)
  where session_id = p_session and auth_uid = auth.uid() and left_at is null;
$$;

create or replace function public.set_session_nickname(p_session uuid, p_nickname text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.session_participants set nickname = public.clean_nickname(p_nickname)
  where session_id = p_session and auth_uid = auth.uid() and left_at is null;
$$;

-- Leave a session; if the host leaves, hand off to the earliest remaining
-- member; if nobody is left, close it.
create or replace function public.leave_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_was_host boolean;
  v_new_host uuid;
begin
  update public.session_participants set left_at = now(), is_ready = false
  where session_id = p_session and auth_uid = auth.uid() and left_at is null
  returning is_host into v_was_host;
  if not found then
    return;
  end if;

  if coalesce(v_was_host, false) then
    update public.session_participants set is_host = false
      where session_id = p_session and auth_uid = auth.uid();
    select id into v_new_host from public.session_participants
      where session_id = p_session and left_at is null order by joined_at limit 1;
    if v_new_host is not null then
      update public.session_participants set is_host = true where id = v_new_host;
      update public.order_sessions
        set host_uid = (select auth_uid from public.session_participants where id = v_new_host)
        where id = p_session;
    end if;
  end if;

  if not exists (select 1 from public.session_participants where session_id = p_session and left_at is null) then
    update public.order_sessions set status = 'closed', closed_at = now()
      where id = p_session and status in ('open', 'placing');
  end if;
end;
$$;

revoke execute on function public.start_session(text, uuid, text) from public, anon;
revoke execute on function public.join_session(text, uuid, text) from public, anon;
revoke execute on function public.set_session_ready(uuid, boolean) from public, anon;
revoke execute on function public.set_session_nickname(uuid, text) from public, anon;
revoke execute on function public.leave_session(uuid) from public, anon;
grant execute on function public.start_session(text, uuid, text) to authenticated;
grant execute on function public.join_session(text, uuid, text) to authenticated;
grant execute on function public.set_session_ready(uuid, boolean) to authenticated;
grant execute on function public.set_session_nickname(uuid, text) to authenticated;
grant execute on function public.leave_session(uuid) to authenticated;

-- ------------------------------------------------------------
-- Extend place_order_tx: optional session linkage, per-line attribution, and
-- an atomic single-placement guard for group orders / solo splits.
-- Called only by the service-role place-order edge function.
-- The new optional params change the signature, so drop the old 8-arg version
-- first (create-or-replace would otherwise create a second overload).
-- ------------------------------------------------------------
drop function if exists public.place_order_tx(uuid, uuid, text, text, int, uuid, uuid, jsonb);

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

  return jsonb_build_object(
    'id', v_order.id, 'order_number', v_order.order_number,
    'status', v_order.status, 'total_millimes', v_order.total_millimes,
    'created_at', v_order.created_at, 'duplicate', false);
end;
$$;

revoke execute on function public.place_order_tx(
  uuid, uuid, text, text, int, uuid, uuid, jsonb, uuid, text, uuid
) from public, anon, authenticated;
