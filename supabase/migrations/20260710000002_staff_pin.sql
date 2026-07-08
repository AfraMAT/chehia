-- ============================================================
-- Staff PIN — a short code to lock/unlock the register on a shared
-- tablet (protects the till when the cashier steps away). Stored as a
-- bcrypt hash via pgcrypto; never returned to the client. Verification
-- happens inside SECURITY DEFINER functions.
-- ============================================================

alter table public.staff add column if not exists pin_hash text;

-- A staff member sets their own 4–6 digit PIN.
create or replace function public.set_my_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'bad_pin' using errcode = 'P0001';
  end if;
  -- pgcrypto lives in the `extensions` schema on Supabase — qualify explicitly.
  update public.staff
  set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf'))
  where auth_uid = auth.uid() and is_active;
end;
$$;

-- Verify the caller's own PIN (to unlock the register).
create or replace function public.verify_my_pin(p_pin text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
begin
  select pin_hash into v_hash from public.staff where auth_uid = auth.uid() and is_active;
  if v_hash is null then
    return false;
  end if;
  return v_hash = extensions.crypt(p_pin, v_hash);
end;
$$;

-- Whether the caller has a PIN set (drives the "set your code" prompt).
create or replace function public.my_pin_is_set()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((select pin_hash is not null from public.staff where auth_uid = auth.uid() and is_active), false);
$$;
