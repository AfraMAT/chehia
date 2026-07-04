-- ============================================================
-- Admin allowlist: provision platform admins by email.
--
-- A row in admin_allowlist means "the auth user with this email is a
-- Chehia platform admin". A defensive AFTER INSERT trigger on
-- auth.users links a newly-created account (e.g. a first Google OAuth
-- sign-in) to a platform_admins row automatically, so the admin is
-- recognized on their very first sign-in — no dependence on Supabase's
-- automatic identity-linking setting, and no pre-created email/password
-- user that could collide ("email already registered") on OAuth.
--
-- The trigger is SECURITY DEFINER (writes platform_admins, reads the
-- allowlist regardless of caller RLS) and exception-safe: it must never
-- block an auth.users insert — anonymous customer sign-ins run through
-- the same table on every order.
-- ============================================================

create table if not exists public.admin_allowlist (
  email text primary key,
  display_name text not null default 'Admin',
  created_at timestamptz not null default now()
);

-- Only SECURITY DEFINER code (the trigger + backfill below) and
-- service-role tooling ever read/write this. RLS on with no policies =
-- invisible to every client; keeps the who-can-be-admin roster private.
alter table public.admin_allowlist enable row level security;

create or replace function public.link_allowlisted_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  wanted_name text;
begin
  if new.email is null or new.email = '' then
    return new;
  end if;

  select display_name into wanted_name
  from public.admin_allowlist
  where lower(email) = lower(new.email);

  if wanted_name is not null then
    insert into public.platform_admins (auth_uid, display_name)
    values (new.id, wanted_name)
    on conflict (auth_uid) do nothing;
  end if;

  return new;
exception
  when others then
    -- Never let admin-linking break account creation.
    return new;
end;
$$;

drop trigger if exists on_auth_user_created_link_admin on auth.users;
create trigger on_auth_user_created_link_admin
  after insert on auth.users
  for each row execute function public.link_allowlisted_admin();

-- Harden the exposed API surface. The trigger still fires regardless of
-- these grants (trigger execution does not check EXECUTE on the function),
-- and admin_allowlist is only touched by SECURITY DEFINER code + service role.
revoke all on table public.admin_allowlist from anon, authenticated;
revoke execute on function public.link_allowlisted_admin() from public, anon, authenticated;
