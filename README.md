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
  functions/     Edge functions: place-order, call-waiter, generate-insights (nightly AI)
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

Every table has a permanent QR token (`demo-elmarsa-t01`…`t14`). The printed QR encodes
`https://{host}/r/{slug}/t/{token}`; with the app installed, universal/app links open the app
directly on that table, otherwise the web experience serves the same flow.

### Tests

```bash
pnpm --filter @chehia/shared test        # 42 unit tests (money, cart, i18n parity, status machine, deep links)
pnpm --filter @chehia/integration test   # 18 integration tests (RLS tenant isolation, order flow, edge functions)
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

## Deploying (when ready to go live)

1. **Supabase Cloud** — create a project, then:
   ```bash
   supabase link --project-ref <ref>
   supabase db push                      # applies migrations
   supabase functions deploy place-order call-waiter generate-insights
   supabase secrets set ANTHROPIC_API_KEY=... INSIGHTS_CRON_SECRET=...
   ```
   Enable **anonymous sign-ins** (Auth settings) and schedule `generate-insights` nightly
   (Dashboard → Edge Functions → Schedules, or pg_cron) with the `x-cron-secret` header.
2. **Vercel** — import `apps/web`, set `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_BASE_URL=https://chehia.tn`.
3. **Domain** — point `chehia.tn` at Vercel. Host `apple-app-site-association` +
   `assetlinks.json` (Next.js `public/.well-known/`) once app bundle ids/signing certs exist,
   so installed apps open table links directly.
4. **EAS (mobile)** — `eas build` for iOS/Android with `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY`
   pointing at the cloud project; submit via `eas submit`.

### Credentials needed from you to finalize

- Supabase Cloud project (org + project ref, or invite)
- Vercel account/team for `apps/web` + the `chehia.tn` domain DNS
- Apple Developer account ($99/yr) & Google Play console ($25) for store builds
- `ANTHROPIC_API_KEY` for production AI insights (template fallback works without it)

## Known gaps (deliberate, pending cloud setup)

- Menu photo upload UI is stubbed — wiring to Supabase Storage is straightforward once the cloud
  bucket exists (schema already has `photo_url` everywhere).
- Store submission assets (app icon final art, splash, store listings) to generate at EAS setup.
- Phase 2/3 features per the playbook (favorites, reviews, promotions, payments) intentionally
  out of MVP scope.
