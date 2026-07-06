# Inventory / stock management

Stock management for `business.chehia.app`: track products, deplete them automatically as
orders come in, and alert owners **before** they run out.

## What it does

- **Products** (`inventory_items`) — on-hand quantity (fractional units), a **reorder threshold**
  (low-stock level), an optional **par level** (reorder-up-to target), a unit, an optional unit cost,
  a supplier, and per-product `track` / `auto_86` switches.
- **Ledger** (`stock_movements`) — append-only. Every change is one of: `receive`, `waste`,
  `adjustment`, `count`, `sale` (order depletion), `cancel_return` (cancellation). Writes go only
  through `SECURITY DEFINER` functions, so the ledger can't be forged from the client.
- **Recipes** (`item_ingredients`) — a menu dish → the stock it consumes per sale. When an order is
  placed, `place-order` calls `place_order_tx`, which **auto-depletes** the linked products
  (best-effort: a stock error never blocks a paying order). Cancelling an order **returns** the stock.
- **Alerts** (`notifications`) — every movement runs through one `apply_stock_change` path that raises
  an **edge-triggered** alert: it fires once when an item crosses into `low`/`out` and re-arms only
  after it recovers, so operators are never spammed. `apply_stock_change` and `sync_stock_alerts` both
  lock rows (`FOR UPDATE`) so concurrent scans can't duplicate an alert. Delivered live in the portal
  via Realtime (the sidebar **notification bell**).
- **Auto-86** (optional, per product) — when a tracked product hits zero and `auto_86` is on, the
  dishes that use it are marked sold out; restocking above zero re-enables them.

## Onboarding integration

New owners meet inventory during setup. The provisioning flow is:

1. A platform admin creates the venue + owner (`admin-provision-business`) and relays a **starter
   password**. Both provisioning functions stamp `user_metadata.must_change_password: true`.
2. On first login the portal shows a **"Choose your password"** gate (`SetPasswordGate` in
   PortalProvider) — the owner sets a personal password, which clears the flag in one atomic
   `updateUser`. Google-only accounts are exempt (no password). Settings has a matching "Security"
   card so anyone can change their password later.
3. The onboarding wizard has an optional **Stock** step (Profile → Hours → Menu → **Stock** → Tables →
   Team). Toggling a just-listed dish ON creates a `piece`-unit product named after the dish
   (`source='onboarding_dish'`) + an `item_ingredients` link at `qty_per_unit 1`, plus an opening
   balance and a low-stock threshold — so from day one, **every sale deducts one** and the owner is
   alerted before running out. A collapsible "ingredients" area adds standalone products
   (`source='onboarding'`). The step is skippable; skipping tracks nothing.

The wizard only ever edits/deletes products **it** created (keyed on the `source` marker), never a
real ingredient, and an already-onboarded owner is redirected out of the wizard. Opening balances go
through `set_stock_count` while the threshold is temporarily 0, so setup raises no spurious alert.

## Portal

- **`/business/inventory`** (owner/manager) — the stock board: summary (products / low / out / stock
  value), search + status filters, per-product Receive / Count / Waste / History / Edit, reorder
  hints, and "used in N dishes". Opening the page runs `sync_stock_alerts` (catches threshold edits).
- **Menu item editor** — a "Consumption per sale" section links a dish to the stock it uses.
- **Settings** — a per-venue toggle for the nightly low-stock **email** digest (in-portal alerts are
  always on).
- **Notification bell** (all staff) — live low/out alerts, localized (fr/ar/en), unread badge,
  mark-as-read.

## Nightly digest (`inventory-alerts` edge function)

Optional email reminder of what's low/out, in addition to the always-on in-portal alerts.

- Auth: cron secret (`x-cron-secret`, env `INVENTORY_CRON_SECRET` or the shared `INSIGHTS_CRON_SECRET`)
  or the service-role key — same shape as `generate-insights`. `verify_jwt = false` in `config.toml`.
- Emails owners/managers via Resend when `RESEND_API_KEY` is set (else it just refreshes the in-portal
  alerts and returns the digest payload). Sender: `INVENTORY_FROM` / `LEADS_FROM`.
- Localized to each venue's `default_language`.

Schedule it nightly the same way as `generate-insights` (pg_cron + pg_net calling the function URL
with the cron secret). It is safe to run repeatedly — `sync_stock_alerts` is idempotent.

## Cloud deploy checklist (when shipping to prod — needs your go-ahead)

1. Apply migrations `20260708000001_inventory.sql` **and** `20260708000002_inventory_item_source.sql`
   to **chehia-dev** and **chehia-prod** (via `supabase db push` or the Supabase MCP `apply_migration`).
2. Deploy the `inventory-alerts` edge function (self-contained; inline `_shared/cors.ts`,
   `verify_jwt = false`) — same pattern as the other functions.
3. Redeploy `admin-provision-business` + `create-staff` — they now stamp
   `user_metadata.must_change_password: true` so first-login owners/staff set their own password.
   (The `place-order` function is unchanged; depletion lives in `place_order_tx`, which the migration
   replaces.)
4. Optional: `RESEND_API_KEY` (+ verified sender domain) for the nightly digest, and a pg_cron
   schedule for `inventory-alerts`.

## Tests

- Shared: `packages/shared/src/__tests__/inventory.test.ts` (stock level, qty formatting, reorder,
  value).
- Integration: `packages/integration/src/inventory.test.ts` (RLS isolation, append-only ledger,
  owner/manager-only writes, cross-tenant denial, receive/count, edge-triggered alert + re-arm,
  auto-depletion, cancellation restock, oversell-allowed, auto-86).
