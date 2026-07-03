-- ============================================================
-- Sales leads / "contact us" from the marketing landing.
-- Restaurateurs submit an enquiry (via the submit-lead edge function, service
-- role) → stored here → surfaced to the Chehia/AfraMAT team in the admin portal,
-- and optionally emailed to contact@aframat.com (if RESEND_API_KEY is set).
-- No public/anon direct access: only platform admins can read/manage.
-- ============================================================
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_name text not null default '',
  email text not null,
  phone text not null default '',
  city text not null default '',
  message text not null default '',
  locale text not null default 'fr',
  source text not null default 'landing',
  status text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_status_idx on public.leads (status, created_at desc);
create index leads_email_idx on public.leads (email, created_at desc);

create trigger leads_updated_at before update on public.leads
  for each row execute function public.set_updated_at();

alter table public.leads enable row level security;

-- Inserts happen through the submit-lead edge function (service role); the table
-- is otherwise invisible. Only platform admins read + update status.
create policy "platform admins read leads" on public.leads
  for select using (public.is_platform_admin());

create policy "platform admins update leads" on public.leads
  for update using (public.is_platform_admin())
  with check (public.is_platform_admin());

-- Admin listing (platform-admin gated; returns nothing otherwise).
create or replace function public.admin_leads()
returns setof public.leads
language sql
stable
security definer
set search_path = public
as $$
  select * from public.leads
  where public.is_platform_admin()
  order by created_at desc;
$$;

revoke execute on function public.admin_leads() from public;
grant execute on function public.admin_leads() to authenticated;

-- Rate-limit helper for the submit-lead function: how many leads this email has
-- filed in the last 24h (service role calls it; keeps the logic in one place).
create or replace function public.recent_lead_count(p_email text)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int from public.leads
  where lower(email) = lower(p_email) and created_at > now() - interval '24 hours';
$$;

revoke execute on function public.recent_lead_count(text) from public, anon, authenticated;
