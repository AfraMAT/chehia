-- ============================================================
-- Staff shifts / time-clock. A cashier clocks in at the start of
-- service and out at the end; a shift optionally links to the open
-- cash session. Feeds a labor view later. Writes go through SECURITY
-- DEFINER RPCs; staff read their venue's shifts.
-- ============================================================

create table if not exists public.staff_shifts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  cash_session_id uuid references public.cash_sessions(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists staff_shifts_restaurant_idx on public.staff_shifts (restaurant_id, clock_in desc);
-- One open shift per staff member at a time.
create unique index if not exists staff_shifts_one_open_per_staff
  on public.staff_shifts (staff_id) where clock_out is null;

-- Clock the caller in (idempotent — returns the open shift if already clocked in).
create or replace function public.clock_in()
returns public.staff_shifts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff;
  v_shift public.staff_shifts;
  v_session uuid;
begin
  select * into v_staff from public.staff where auth_uid = auth.uid() and is_active;
  if not found then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  select * into v_shift from public.staff_shifts where staff_id = v_staff.id and clock_out is null;
  if found then
    return v_shift;
  end if;
  select id into v_session from public.cash_sessions
  where restaurant_id = v_staff.restaurant_id and status = 'open' limit 1;
  insert into public.staff_shifts (restaurant_id, staff_id, cash_session_id)
  values (v_staff.restaurant_id, v_staff.id, v_session)
  returning * into v_shift;
  return v_shift;
end;
$$;

-- Clock the caller out (closes their open shift).
create or replace function public.clock_out()
returns public.staff_shifts
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff public.staff;
  v_shift public.staff_shifts;
begin
  select * into v_staff from public.staff where auth_uid = auth.uid() and is_active;
  if not found then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  update public.staff_shifts set clock_out = now()
  where staff_id = v_staff.id and clock_out is null
  returning * into v_shift;
  return v_shift;
end;
$$;

-- The caller's currently open shift, or null.
create or replace function public.my_open_shift()
returns public.staff_shifts
language sql
security definer
set search_path = public
as $$
  select s.* from public.staff_shifts s
  join public.staff st on st.id = s.staff_id
  where st.auth_uid = auth.uid() and s.clock_out is null
  limit 1;
$$;

alter table public.staff_shifts enable row level security;

create policy "staff read shifts" on public.staff_shifts
  for select using (restaurant_id = public.staff_restaurant_id());
