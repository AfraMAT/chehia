# chehia. — شهية

**Scannez. Commandez. Régalez-vous.** QR ordering for Tunisian cafés & restaurants — a native customer
app, a realtime business portal, and an AI insights layer. Android-first, trilingual (FR / AR-RTL / EN),
order-only (customers pay at the counter, as usual).

Built from [chehia-playbook.md](chehia-playbook.md) and the design canvas in
[Chehia app UIUX design/](Chehia%20app%20UIUX%20design/) ("Harissa & Sidi Bou" design system).

## Monorepo layout

```
apps/
  mobile/        Expo (React Native) customer app — QR scan → menu → order → live tracking
  web/           Next.js — customer web fallback (/r/[slug]/t/[token]) + business portal (/business)
packages/
  shared/        Design tokens, trilingual i18n, money/cart/status domain logic (unit-tested)
  integration/   Integration tests against the local Supabase stack (RLS, order flow, edge functions)
supabase/
  migrations/    Postgres schema + multi-tenant RLS policies
  seed.sql       Demo venue (Café El Marsa) with trilingual menu, tables, staff, sample orders
  functions/     Edge functions: place-order, call-waiter, generate-insights (nightly AI),
                 admin-provision-business (platform admin creates a venue + owner),
                 create-staff (owner/manager adds a team member)
```

## Local development

Prereqs: Node ≥ 20, pnpm, Docker, the Supabase CLI, and (for iOS) Xcode.

```bash
pnpm install
supabase start          # local Postgres + Auth + Realtime + Edge Functions (Docker)
```

`supabase start` prints the local URL and keys. Copy them into:

- `apps/web/.env.local` (see `apps/web/.env.example`)
- `apps/mobile/.env` (see `apps/mobile/.env.example`)

Then:

```bash
pnpm dev:web            # Next.js on http://localhost:3000
pnpm dev:mobile         # Expo (press i for the iOS simulator)
```

### Demo data (seeded automatically)

| What | Value |
|---|---|
| Customer demo (Table 12) | http://localhost:3000/r/cafe-el-marsa/t/demo-elmarsa-t12 |
| Portal | http://localhost:3000/business |
| Owner login | `owner@elmarsa.tn` / `chehia-demo` |
| Kitchen login | `cuisine@elmarsa.tn` / `chehia-demo` |
| Second tenant (isolation testing) | `owner@lezink.tn` / `chehia-demo` |
| Platform admin | http://localhost:3000/admin · `admin@chehia.app` / `chehia-demo` |

Every table has a permanent QR token (`demo-elmarsa-t01`…`t14`). The printed QR encodes
`https://{host}/r/{slug}/t/{token}`; with the app installed, universal/app links open the app
directly on that table, otherwise the web experience serves the same flow.

### Tests

```bash
pnpm --filter @chehia/shared test        # 46 unit tests (money, cart, reconcile, i18n parity, status machine, deep links)
pnpm --filter @chehia/integration test   # 30 integration tests (RLS isolation, table-token scoping, storage RLS, order flow, idempotency, abuse caps)
pnpm typecheck                           # all workspaces
```

Integration tests need `supabase start` running.

### AI insights locally

```bash
# Uses a deterministic template fallback without an API key — fully testable offline:
curl -X POST http://127.0.0.1:54321/functions/v1/generate-insights \
  -H "apikey: <publishable key>" -H "Authorization: Bearer <service role key>"
```

With `ANTHROPIC_API_KEY` set (in `supabase/functions/.env` locally, or project secrets in prod), the
function sends per-venue SQL aggregates to Claude (`INSIGHTS_MODEL`, default `claude-haiku-4-5`)
and stores three actionable cards per language, per venue. Analytics charts are plain SQL — the LLM
only writes the "what should I do" narrative.

## Architecture notes

- **Multi-tenancy** — single Postgres; every domain table carries `restaurant_id`, enforced with RLS
  keyed to the authenticated staff user (`staff_restaurant_id()`); owners/managers manage the menu,
  all active staff advance orders. Verified by integration tests.
- **Platform admin** — the `platform_admins` table + `is_platform_admin()` gate a super-admin who
  operates across tenants. The admin portal (`/admin`) lists every venue with live counts
  (`admin_venue_overview()` RPC), toggles active/paused, and provisions a new venue + owner account
  via the `admin-provision-business` edge function (service role; returns a one-time starter password).
  RLS grants the admin cross-tenant *read* + the activate toggle only; provisioning writes go through
  the edge function. The privilege table itself is unreadable/unwritable via the API (RLS + no write
  policy) — admins are seeded server-side.
- **Owner onboarding** — a provisioned venue starts `is_active = false` with `onboarding_completed_at
  = null`; the owner is routed into `/business/onboarding` (profile → hours → menu → tables/QR →
  staff) and the venue goes live on finish. Other staff see a "setup in progress" screen until then.
  Post-onboarding, hours and staff are managed from Settings (`create-staff` edge function).
- **Customers are anonymous** — Supabase anonymous auth; the table's `qr_token` is the ordering
  capability. Orders are inserted only by the `place-order` edge function, which **recomputes all
  prices server-side** and validates modifier min/max rules. Customers can read/subscribe to only
  their own orders (live tracking).
- **Realtime** — portal floor/kitchen views and the customer tracking screen subscribe to
  `postgres_changes`; RLS scopes what each role can see. New orders ring in the portal.
- **Offline (mobile)** — menu snapshot cached in AsyncStorage; failed order submissions are queued
  and auto-retry when connectivity returns (NetInfo).
- **RTL** — layouts mirror per-language at render time (instant switch, no app restart); Arabic uses
  IBM Plex Sans Arabic at +10% size, western numerals for prices (`5,5 د.ت`).
- **Money** — integer millimes end-to-end (1 TND = 1000). Display rule: minimum one decimal,
  trailing zeros trimmed (`2,8` / `6,0` / `5,55`).

## Environments (dev / prod)

Two branches map to two environments, each with its own Supabase project. Everything runs on free
tiers (~$0/month): one Vercel project with Git previews, two Supabase free projects.

| Branch      | Vercel deployment                          | Supabase project              |
| ----------- | ------------------------------------------ | ----------------------------- |
| `main`      | Production → **chehia.app**                | `chehia` (`wpnouppukofzmvsieyeq`) |
| `develop` (+ any other branch) | Preview → `chehia-web-git-<branch>-aframat.vercel.app` | `chehia-dev` (`sxmbqwldtqkkmlfbjyzc`) |

**The backend is selected in code, not in the dashboard.** `src/lib/supabase.ts` picks the Supabase
project from Vercel's build-time `VERCEL_ENV` (inlined via `next.config.ts`): `production` → prod,
`preview` → dev. Supabase publishable keys are safe to ship in the browser bundle (Row-Level Security
is the trust boundary), so there is nothing to configure per-environment in Vercel and a stale
dashboard env var can never point production at the wrong database. Locally, `.env.local` overrides
both to the local `supabase start` stack.

**Workflow:** develop on `develop` → push → check the preview URL (runs against the dev project) →
merge to `main` → production deploys to chehia.app (runs against the prod project).

## Deploying

- **Vercel** — a single project imported from `AfraMAT/chehia` with **Root Directory = `apps/web`** so
  Vercel auto-detects Next.js (its pnpm-workspace support installs from the repo root and resolves
  `@chehia/shared`). Production branch is `main`; every other branch gets an automatic preview. No
  Supabase env vars are required (selected in code, above).
- **Supabase** — both projects carry the same migrations (`supabase/migrations/`), seed, and the five
  edge functions (`place-order`, `call-waiter`, `generate-insights`, `admin-provision-business`,
  `create-staff`). The `item-photos` Storage bucket + RLS come from migration `20260703000002`.
  Schedule `generate-insights` nightly via `pg_cron` + `pg_net` on prod. **Enable anonymous sign-ins**
  (Auth → Providers) on **each** project — customer ordering signs in anonymously.
- **Domain** — `chehia.app` DNS points at Vercel. The app serves
  `/.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` from route handlers that
  activate once `APPLE_TEAM_ID` / `ANDROID_CERT_SHA256` env vars are set (they 404 until then, so no
  invalid association is ever published), letting installed apps open table links directly.
- **EAS (mobile)** — `eas login && eas init && eas build:configure`, then `eas build` for iOS/Android
  with `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY` in the build profile pointing at the cloud project; submit
  via `eas submit`. `app.json` universal/app links already target `chehia.app`.

### Credentials / one-time actions needed from you

- **Anonymous sign-ins** on the **dev** Supabase project (`chehia-dev`) — Auth → Providers → enable
  (prod already has it). Without it, customer ordering on preview deployments fails.
- **Apple Developer** ($99/yr) & **Google Play** ($25) for store builds; the Apple Team ID and Android
  signing SHA-256 then populate `APPLE_TEAM_ID` / `ANDROID_CERT_SHA256` (deep-link association files).
- **`ANTHROPIC_API_KEY`** for production AI insights (template fallback works without it) — set via
  `supabase secrets set`, never committed.

## Known gaps (deliberate)

- Store submission assets (app icon final art, splash, store listings) to generate at EAS setup.
- Phase 2/3 features per the playbook (favorites, reviews, promotions, payments) intentionally
  out of MVP scope.
