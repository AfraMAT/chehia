-- Store the submitting client's IP on leads, for anti-spam rate limiting.
-- The per-email cap is trivially bypassable (email is attacker-controlled), so
-- the submit-lead edge function also caps per IP and globally per hour.
alter table public.leads add column if not exists ip text;
create index if not exists leads_ip_idx on public.leads (ip, created_at desc);
