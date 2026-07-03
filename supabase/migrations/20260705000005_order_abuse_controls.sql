-- ============================================================
-- Order abuse controls (discovery/browse flow hardening)
-- The browse flow lets a customer order to a table without scanning its QR,
-- which widens the remote-abuse surface. Defences:
--  1. restaurants.require_qr — a per-venue switch to disable remote/browse
--     ordering entirely (only scanned qr_token orders are then accepted).
--  2. orders.origin — records whether an order came from a scanned QR or the
--     browse flow, so staff can see (and be more skeptical of) remote orders.
-- Rate limiting itself lives in the place-order edge function (per-session and
-- per-table time windows) on top of place_order_tx's existing open-order cap.
-- The staff-accept gate + server-side price recompute remain the primary
-- protections: nothing is prepared until a staff member accepts, and prices
-- can never be manipulated by the client.
-- ============================================================

alter table public.restaurants
  add column if not exists require_qr boolean not null default false;

alter table public.orders
  add column if not exists origin text not null default 'scan'
  check (origin in ('scan', 'browse'));

-- Speeds up the per-table rate-limit window check in the edge function.
create index if not exists orders_table_recent_idx
  on public.orders (table_id, created_at desc);
