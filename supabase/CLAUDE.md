# supabase

35 migrations, 12 Deno edge functions, a local-only `config.toml` (every URL in it is
127.0.0.1) and `seed.sql`. Postgres 17.

## The one rule

**Never run `supabase db push`.** The repo, dev and prod migration ledgers deliberately
disagree — prod/dev were largely deployed through the Supabase MCP `apply_migration` with
apply-time versions and ad-hoc names, and `20260706000003_harden_admin_allowlist_trigger.sql`
(a privilege-escalation fix) exists in **neither** cloud ledger because it was hot-applied as
raw SQL. A push would replay non-idempotent DDL (`CREATE TABLE`, `ALTER … ADD COLUMN`) and
error or partially apply. Cloud changes go through `apply_migration`, dev before prod, and
only when explicitly asked.

Prod is `wpnouppukofzmvsieyeq`. Dev is `sxmbqwldtqkkmlfbjyzc`.

## Migrations

Filenames are `<14-digit timestamp>_<snake_case>.sql`, applied in lexical order. Two
generations coexist: hand-picked ordinals (`20260701000001_core_schema.sql`) and CLI
wall-clock stamps (`20260713044846_advisor_hardening_perf.sql`). The two `20260713` files were
**renamed to match what prod's ledger recorded** — filenames reconcile to prod, not the
reverse.

Every migration opens with a `-- ===` banner explaining the *why*, and for fixes, the exact
vulnerability or regression. Several are titled `SECURITY FIX (critical)`. These comments are
the audit trail — follow the style.

`20260713000003_schedule_nightly_functions.sql.staged` is **deliberately not `.sql`**.
Renaming it turns on pg_cron jobs that make paid Anthropic calls nightly and email venue
owners. It still has `<PROJECT_REF>` placeholders and needs a one-time
`select vault.create_secret(...)` per project.

**Regression precedent:** `20260709000002_group_ordering.sql` redefined `place_order_tx` to
add session params and silently dropped the inventory-depletion call added by
`20260708000001`. Customer orders stopped depleting stock for a week. When you
`create or replace` a function other migrations have extended, **diff against the current
definition, not the original**.

## RLS patterns

Tenancy keys off two SECURITY DEFINER helpers in `20260701000001_core_schema.sql`:
`staff_restaurant_id()` and `staff_has_role(staff_role[])`. Platform-wide access uses
`is_platform_admin()`.

The representative shape — role gate in `using`, tenant gate in `with check`:
```sql
create policy "staff manage categories" on public.categories for all
  using (restaurant_id = public.staff_restaurant_id()
         and public.staff_has_role(array['owner','manager']::public.staff_role[]))
  with check (restaurant_id = public.staff_restaurant_id());
```

Four other shapes in use: world-readable menu (`using (is_active)`); customer ownership
(`using (created_by = auth.uid())`); an additive platform-admin overlay; group-session
membership via `is_session_member()`.

New policies are declared `to authenticated` and wrap auth calls as `(select auth.uid())`
(the `auth_rls_initplan` advisor fix). Customer / "public read" policies are deliberately left
on `public` **because customers sign in anonymously**.

A private table is locked by *RLS enabled with zero policies* plus
`revoke all … from anon, authenticated` — see `admin_allowlist`. Invisible to every client,
reachable only from SECURITY DEFINER code and the service role.

## Functions

Every SECURITY DEFINER function declares `set search_path = public` (or `= ''` for trigger
helpers). Pinning is mandatory — advisor lint 0011 is tracked.

Grant hygiene: `revoke execute … from public, anon;` then `grant execute … to authenticated;`.

Column-scoped grants back up RLS where rows aren't enough: `20260710000004` revoked `update`
on `orders` and granted only `update (status)`, so money/fiscal columns are unreachable via
PostgREST. `20260716010000` then revoked even that — `advance_order_status()` is now the only
status write path. `stamp_order_status` / `set_updated_at` are BEFORE triggers, so they write
columns the caller has no grant on; that's intentional and why the revoke doesn't break
timestamps.

`pgcrypto` lives in the `extensions` schema on Supabase. With a pinned `search_path = public`
you must qualify it: `extensions.crypt(...)`, `extensions.gen_salt('bf')`. An unqualified call
fails at **runtime**, not at migration time.

**The admin-allowlist trigger.** The original `link_allowlisted_admin()` promoted any new
account whose email matched `admin_allowlist` — an open signup was a full anonymous →
super-admin takeover. `20260706000003` requires **all three** of
`raw_app_meta_data->>'provider' = 'google'` (GoTrue-set, unforgeable), `email_confirmed_at is
not null`, and `not is_anonymous`. Do not relax any of them, and do not reintroduce a
non-OAuth auto-link path. Its `exception when others then return new;` wrapper is also
deliberate: the trigger runs on every `auth.users` insert including every anonymous customer
sign-in, so it must never be able to block account creation. Keep the catch-all.

## Edge functions

Fixed skeleton: handle `OPTIONS` → `corsHeaders`; reject non-POST with 405; build a
user-scoped anon client from the caller's `Authorization` header and `auth.getUser()` to
establish identity; **then** build a service-role client for privileged work. Errors are
always `{ error: { code, message } }` via `_shared/cors.ts`.

Attacker-controlled ids go in the **WHERE clause of the authorization query**, not a post-hoc
check. Edge functions run with the service role and therefore bypass RLS — any new logic must
re-check tenancy itself.

`verify_jwt` is set per function in `config.toml` with a comment justifying the value. Note
that `place-order`, `register-order`, `settle-order` and `call-waiter` have **no
`[functions.*]` block** and inherit the CLI default — verify against the deployed project, not
the file. `supabase functions deploy` overwrites the live function **and** pushes the
config.toml `verify_jwt` value, so deploying after an unrelated config edit silently changes
gateway auth.

`geo.ts` is duplicated by hand inside `functions/place-order/index.ts` (edge functions can't
import from `@chehia/shared`). Change both together.

## Local stack

`config.toml` `[auth.email] enable_signup = false` governs the **local** stack only — mirror
it in each cloud project's dashboard. `enable_anonymous_sign_ins = true` must stay on
everywhere; it's how customer ordering works.

`seed.sql` inserts directly into `auth.users` with a shared known password
(`chehia-demo`) for local dev only — **never** run it against a cloud project. Two venues
(`cafe-el-marsa`, `le-zink`) exist so tenant-isolation tests have a second tenant.

`item-photos` is a public bucket with **no select policy** on purpose — a public bucket
already serves object URLs, and the broad policy let clients LIST every file (lint 0025).
Don't "restore" it.

`tables.qr_token` is a secret capability, not an identifier. `resolve_table(p_qr_token)`
takes the token; `list_venue_tables(slug)` deliberately returns id/label/zone **without** it.
Never add a policy or RPC that returns `qr_token` to a client.

## After any migration

```bash
pnpm db:reset   # DESTRUCTIVE — drops local DB, replays all 35, reseeds
pnpm db:types   # regenerate packages/shared/src/database.types.ts from the LOCAL stack
```
`db:types` reads the *running stack*, not the migration files. Against a stopped or stale
stack it silently overwrites the types with an old schema.
