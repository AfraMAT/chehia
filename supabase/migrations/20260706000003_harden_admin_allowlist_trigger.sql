-- ============================================================
-- SECURITY FIX (critical) — admin-allowlist auto-link privilege escalation.
--
-- The AFTER INSERT trigger link_allowlisted_admin() (migration
-- 20260705000006) granted a platform_admins row to ANY newly-created
-- auth.users whose email matched public.admin_allowlist — with NO proof the
-- signup actually controlled that email. Because email/password signup is
-- open and email confirmations are disabled by default, an attacker could:
--   POST /auth/v1/signup {email: "<allowlisted-admin-email>", password: "..."}
-- create an auth.users row bearing an allowlisted email they do NOT own, and
-- the trigger would auto-promote that account to Chehia PLATFORM ADMIN —
-- unlocking cross-tenant read/update of every venue's orders + staff, lead
-- PII (admin_leads), and arbitrary venue/owner provisioning
-- (admin-provision-business). Full anonymous -> super-admin takeover.
--
-- Fix: only auto-link a genuinely-verified, trusted identity. The intended
-- provisioning path is a Google OAuth first sign-in (Google-verified email),
-- so require ALL of:
--   * a real OAuth provider of 'google'  — raw_app_meta_data is set by GoTrue
--     from the actual auth method and CANNOT be set by the signup client (the
--     signup `data` field only populates raw_user_meta_data), so an email/
--     password signup (provider='email') can never satisfy this. This is the
--     decisive gate that closes the escalation.
--   * a confirmed email (email_confirmed_at is not null).
--   * a non-anonymous user (anonymous customer sign-ins run this same trigger
--     on every order and must never be linked).
--
-- Any admin that must NOT use Google OAuth is provisioned directly via
-- service-role tooling (platform_admins has no client-writable RLS policy),
-- not through this convenience trigger.
--
-- Independent of this migration, also close email/password signup or enable
-- email confirmations + captcha on the Supabase Auth project settings so no
-- auth.users row is ever created for an email the requester cannot prove they
-- control (defence in depth — the provider gate above already blocks the
-- escalation on its own).
-- ============================================================

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

  -- Trust only a Google-OAuth, email-verified, non-anonymous signup. An
  -- email/password signup (provider 'email') — the escalation vector — is
  -- rejected here and can never reach the allowlist lookup below.
  if coalesce(new.is_anonymous, false)
     or new.email_confirmed_at is null
     or coalesce(new.raw_app_meta_data ->> 'provider', '') <> 'google' then
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
