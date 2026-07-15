-- Group-session hygiene (2026-07-15 customer-UX audit, findings G1/G2):
--
-- G1 · "Leave group" left ghost items: leave_session never deleted the
--      leaver's session_cart_lines, but the group placement path submits ALL
--      lines of the session — so the host placed (and the kitchen billed)
--      items no visible participant owned, and nobody could remove them
--      (steppers only render on your own lines). The solo-split path already
--      deleted the placer's lines; the cleanup was simply missing here.
--      A leaver who re-joins now starts with an empty selection (expected).
--
-- G2 · Sessions never expired: start_session reused ANY open/placing session
--      on the table, so the next party inherited a zombie group ("2 items ·
--      ready" from strangers hours ago) and could never start fresh. Sessions
--      older than 6 hours are now closed on sight (start) or rejected (join).

-- G1: delete the leaver's lines before marking them gone.
create or replace function public.leave_session(p_session uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_was_host boolean;
  v_new_host uuid;
  v_participant_id uuid;
begin
  update public.session_participants set left_at = now(), is_ready = false
  where session_id = p_session and auth_uid = auth.uid() and left_at is null
  returning is_host, id into v_was_host, v_participant_id;
  if not found then
    return;
  end if;

  -- The leaver's items must not ride along in the group order they are no
  -- longer part of (mirrors the solo-split cleanup in place_order_tx).
  delete from public.session_cart_lines where participant_id = v_participant_id;

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

-- G2: start_session — close table sessions past the freshness window, then
-- only reuse a live one created within it.
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

  -- A meal doesn't last 6 hours: anything older is a zombie from an earlier
  -- party at this table — close it so the next group can start fresh.
  update public.order_sessions set status = 'closed', closed_at = now()
    where table_id = v_table.id and status in ('open', 'placing')
      and created_at <= now() - interval '6 hours';

  -- Reuse an existing live (fresh) session on this table, else create one.
  select id into v_session_id from public.order_sessions
    where table_id = v_table.id and status in ('open', 'placing')
      and created_at > now() - interval '6 hours'
    limit 1;

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
          where table_id = v_table.id and status in ('open', 'placing')
            and created_at > now() - interval '6 hours'
          limit 1;
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

-- G2: join_session — a share code for an expired session reads as closed.
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
  if v_session.status <> 'open' or v_session.created_at <= now() - interval '6 hours' then
    -- Lazily close what start_session would have swept.
    if v_session.status in ('open', 'placing') then
      update public.order_sessions set status = 'closed', closed_at = now() where id = v_session.id;
    end if;
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
