# Chehia — customer app (Expo)

The customer-facing mobile app for **Chehia**, QR table-ordering for Tunisian
cafés and restaurants. Anonymous, order-only, pay-at-counter: no accounts, no
in-app payment, one permission (camera, to scan a table QR). Trilingual
**French / Arabic (RTL) / English**.

Part of the [`chehia`](../../README.md) pnpm monorepo — shares tokens, i18n, and
domain logic with `apps/web` via `@chehia/shared`.

## Stack

- Expo SDK 57 · React Native 0.86 · React 19 · TypeScript
- `expo-router` (typed routes) · `expo-camera` (QR scan) · `expo-location` (near-me)
- Supabase (anonymous auth + Postgres/RLS + edge functions + realtime)

## Backend selection

`src/lib/supabase.ts` defaults a **release build to the production** Supabase
project (its publishable/anon key is public — RLS is the trust boundary).
`EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` override it:

- **local dev** — `.env` points at the local stack (`http://127.0.0.1:54321`).
- **dev / preview builds** — the `eas.json` `development`/`preview` profiles inject the dev project.
- **production builds** — the `eas.json` `production` profile injects the prod project.

This guarantees a store build is never wired to localhost.

## Run locally

```bash
pnpm install                       # from the repo root
cd apps/mobile
cp .env.example .env               # then fill in your Supabase values
pnpm start                         # Expo dev server (scan the QR with Expo Go)
```

On the iOS simulator, open a table deep link directly:

```bash
xcrun simctl openurl booted "exp://127.0.0.1:8081/--/r/cafe-el-marsa/t/demo-elmarsa-t12"
```

## Screens

`src/app/` (expo-router):

- `index.tsx` — scan home (camera QR) + "Find a restaurant".
- `app.tsx` → `components/discover.tsx` — public venue discovery + near-me.
- `r/[slug]/t/[token]/` — scanned-QR flow · `r/[slug]/(browse)/` — pick-a-table flow.
- Shared venue UI in `components/venue/` (menu, item sheet, cart, order tracking, waiter).
- `about.tsx` — About & Privacy (links the privacy policy; data-request contact).

## Store build & submit

See [`docs/mobile-submission.md`](../../docs/mobile-submission.md) for the full
App Store / Google Play checklist. In short:

```bash
cd apps/mobile
eas build   --platform ios --profile production
eas submit  --platform ios --profile production
```

## Quality gates

```bash
pnpm typecheck   # tsc --noEmit
pnpm lint        # expo lint
```
