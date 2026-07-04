-- ============================================================
-- ai_extractions: audit + rate-limit backing for the extract-menu edge function
-- (photo → AI menu import). Durable so the per-restaurant rate limit survives
-- edge isolate restarts. Only the service role (edge fn) writes; staff of the
-- venue may read their own extraction history.
-- ============================================================
create table if not exists public.ai_extractions (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  requested_by  uuid references auth.users(id) on delete set null,
  image_count   int  not null,
  total_bytes   int  not null,
  model         text not null,
  input_tokens  int,
  output_tokens int,
  created_at    timestamptz not null default now()
);

create index if not exists ai_extractions_recent_idx
  on public.ai_extractions (restaurant_id, created_at desc);

alter table public.ai_extractions enable row level security;

create policy "staff read own ai_extractions" on public.ai_extractions
  for select using (restaurant_id = public.staff_restaurant_id());
-- No client insert/update/delete policies: only the service role (edge fn) writes.
