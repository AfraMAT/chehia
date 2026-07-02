-- ============================================================
-- Harden table lookups.
-- The "public read tables" policy exposed every table's qr_token — the
-- ordering / waiter-call capability — to any anonymous caller, enumerable
-- across ALL tenants (GET /rest/v1/tables?select=qr_token). Replace it with a
-- token-scoped SECURITY DEFINER RPC: a caller can resolve a table only if they
-- already hold its qr_token (from scanning the printed QR). Tables can no
-- longer be listed by anon. Staff still manage their own tables via existing
-- policies; the edge functions resolve tables with the service role.
-- ============================================================
drop policy if exists "public read tables" on public.tables;

create or replace function public.resolve_table(p_qr_token text)
returns table (id uuid, restaurant_id uuid, label text, zone text)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.restaurant_id, t.label, t.zone
  from public.tables t
  where t.qr_token = p_qr_token and t.is_active
  limit 1;
$$;

revoke execute on function public.resolve_table(text) from public;
grant execute on function public.resolve_table(text) to anon, authenticated;
