-- ============================================================================
-- SECURITY FIX (high) — staff.pin_hash was readable and writable by colleagues,
-- and any manager could promote themselves to owner.
--
-- 1. pin_hash leak.
--    `20260710000002_staff_pin.sql` added `pin_hash` (bcrypt) to public.staff,
--    a table whose SELECT is gated only at ROW level:
--
--      create policy "staff read own profile" on public.staff
--        for select using (auth_uid = auth.uid()
--                          or restaurant_id = public.staff_restaurant_id());
--
--    Every colleague matches the second arm, so ANY signed-in staff member could
--    `select pin_hash` for every other staff member at their venue straight
--    through PostgREST — and `authenticated` also held UPDATE on the column, so
--    a manager could overwrite a colleague's PIN without going through
--    set_my_pin(). The PIN unlocks the Caisse register lock screen and is 4-6
--    digits, i.e. trivially brute-forced offline once the hash is in hand.
--
--    Rows were never the right granularity here — columns are. This mirrors the
--    column-scoped grant precedent from `20260710000004_pos_review_fixes.sql`,
--    which revoked UPDATE on orders and granted only `update (status)`.
--
--    Safe to narrow: no client anywhere selects `*` from staff. Every call site
--    names its columns explicitly and none of them asks for pin_hash
--    (portal-provider, caisse-provider, settings, onboarding, auth/callback).
--    my_pin_is_set() / set_my_pin() / verify_my_pin() are SECURITY DEFINER and
--    are unaffected — they remain the only path to the column.
--
-- 2. Self-promotion.
--    `owner manages staff` grants owner AND manager full write over every staff
--    row at their venue, with no guard on the `role` column. A manager could
--    therefore set their own role to 'owner' and then deactivate the real owner,
--    taking over the venue. Roles are now guarded by a trigger.
-- ============================================================================

-- ---- 1. pin_hash is not a client-readable column ----------------------------
revoke select (pin_hash), update (pin_hash), insert (pin_hash)
  on public.staff from anon, authenticated;

-- Re-grant the columns clients legitimately read, so narrowing SELECT above
-- cannot accidentally leave the portal without access to a column it uses.
grant select (id, restaurant_id, auth_uid, role, display_name, is_active, created_at)
  on public.staff to anon, authenticated;

grant update (display_name, is_active, role)
  on public.staff to authenticated;

grant insert (id, restaurant_id, auth_uid, role, display_name, is_active, created_at)
  on public.staff to authenticated;

-- ---- 2. A manager may not promote themselves (or anyone) to owner -----------
create or replace function public.guard_staff_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is not distinct from old.role then
    return new;
  end if;

  -- No JWT = the service role or a trusted server path (create-staff,
  -- admin-provision-business). Those already re-check tenancy themselves and
  -- must stay able to seed a venue's first owner.
  if (select auth.uid()) is null then
    return new;
  end if;

  -- Nobody edits their own role. This is the self-promotion path: a manager
  -- flipping themselves to 'owner' and then deactivating the real owner.
  if old.auth_uid = (select auth.uid()) then
    raise exception 'cannot_change_own_role' using errcode = 'P0001';
  end if;

  -- Granting or revoking 'owner' is an owner-only (or platform-admin) act, so a
  -- manager cannot mint a second owner and escalate through it either.
  if (new.role = 'owner' or old.role = 'owner')
     and not public.staff_has_role(array['owner']::public.staff_role[])
     and not public.is_platform_admin() then
    raise exception 'only_owner_grants_owner' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke execute on function public.guard_staff_role_change() from public, anon, authenticated;

drop trigger if exists guard_staff_role_change on public.staff;
create trigger guard_staff_role_change
  before update on public.staff
  for each row execute function public.guard_staff_role_change();
