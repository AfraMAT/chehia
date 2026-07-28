# apps/mobile

Expo SDK 57 / RN 0.86 customer app — scan a QR, browse, order. Anonymous auth only; there are
no user accounts. New Architecture + Hermes, `typedRoutes` and `reactCompiler` both on.

⚠️ **`src/lib/supabase.ts` falls back to PRODUCTION** when `EXPO_PUBLIC_SUPABASE_URL` is
unset. That fallback is intentional (a release build must never point at localhost) but it
means `expo start` without `apps/mobile/.env` talks to the live database. Confirm `.env`
exists before running locally. Its address is platform-specific: `127.0.0.1:54321` works on
the iOS simulator only — Android emulator needs `10.0.2.2:54321`, a physical device needs your
LAN IP.

## Routing

expo-router, file-based. No `@react-navigation/*` direct dependency; every layout is
`<Stack>` with `headerShown: false`.

`experiments.typedRoutes` makes `Href` a literal union. Any path assembled at runtime from
`basePath` **must** go through `go()` in `src/lib/nav.ts` — that file is the single sanctioned
`as Href` cast point. Don't scatter casts into screens.

Two parallel route trees share one implementation:
- `src/app/r/[slug]/t/[token]/*` — scanned QR, table known from `qr_token`
- `src/app/r/[slug]/(browse)/*` — discovery, table chosen in-session

Both mount the same `VenueProvider` (browse mode via the `browse` prop) and render the same
components from `src/components/venue/`. **Add venue UI there** — never duplicate per flow.

## Native

`ios/` and `android/` are **gitignored prebuild output**. Editing `ios/Chehia/Info.plist` or
`android/app/src/main/AndroidManifest.xml` accomplishes nothing — the change vanishes on the
next EAS build. Express native changes in `app.json` or a config plugin under `plugins/`.

- `plugins/with-android-lint-fix.js` is **load-bearing**. iOS permission strings shipped via
  `expo.locales` land in Android `values-b+{ar,en,fr}/strings.xml` while absent from
  `values/strings.xml`, failing `:app:lintVitalRelease` with `ExtraTranslation` — surfaced as
  an opaque `EAS_BUILD_UNKNOWN_GRADLE_ERROR`.
- Permissions in `app.json` are declared **narrowly and negatively**:
  `microphonePermission: false`, `recordAudioAndroid: false`, `locationAlwaysPermission:
  false`, background location off, Android `blockedPermissions: ["…RECORD_AUDIO"]`. Expo
  injects default *English* usage strings for any permission left undefined — that is exactly
  the Guideline 4 rejection class this app already hit. Keep the negations.
- Verify before a build: `npx expo prebuild -p ios --clean`, grep the generated
  `ios/Chehia/Info.plist`, then **delete the generated `ios/` dir** (EAS builds from config).
- Native RTL is pinned off (`supportsRTL: false`). Arabic direction is JS-side via `rowDir()`
  / `textDir()` in `src/lib/theme.ts`. Flipping `I18nManager` double-flips every screen.

## EAS

`eas.json` hardcodes Supabase URL + key **per profile**: `development` and `preview` → dev
project, `production` → prod. Editing the wrong profile silently ships a build pointed at the
wrong database. It also pins `node: 20.18.0` / `pnpm: 10.6.1` — bumping the root
`packageManager` without bumping these drifts the build from local.

`appVersionSource: "local"` + `production.autoIncrement: true` means a production build
**rewrites `app.json`** (`ios.buildNumber`, `android.versionCode`) on disk. Commit that diff
or numbers get reused. The counters have already drifted (buildNumber 6, versionCode 1).

`eas submit --platform android` needs `play-service-account.json` present (gitignored).

## State & data

- Reads go direct to PostgREST under RLS. Capability-scoped reads use RPCs (`resolve_table`,
  `list_venue_tables`, `start_session`, `join_session`, …). Writes needing server authority
  (`place-order`, `call-waiter`) go through edge functions.
- **Every order write carries a `client_ref` idempotency UUID**, stable across retries and
  reset when the cart signature changes (`clientRefRef` + `cartSig` in `src/lib/venue.tsx`).
  Never send an order without one.
- Realtime channels always tear down with `supabase.removeChannel(channel)` in the effect
  cleanup.
- AsyncStorage keys are namespaced in `src/lib/venue.tsx`: `chehia.menu.{slug}.{target}`,
  `chehia.cart.{target}`, `chehia.queue.{target}`, `chehia.order.{target}`,
  `chehia.usual.{slug}`, `chehia.session.{qrToken}`, `chehia.lang`. `target` is the qr_token
  in the scanned flow, `v.{slug}` in browse.
- **Bump `MENU_CACHE_VERSION`** whenever the cached `VenueBundle` shape changes, or a
  stale-shape entry hydrates into a mismatched object and can crash the offline menu.
- The offline queue drops orders by design: 3h TTL, and only `auth_failed`, `rate_limited`,
  `too_many_open_orders` are treated as transient. Anything else dequeues and hands the lines
  back to the cart.
- Permission denials are first-class states — `canAskAgain === false` routes to
  `Linking.openSettings()` or a distinct `blocked` status, never a silent no-op.

## Traps

- The `react-hooks/exhaustive-deps` and `set-state-in-effect` suppressions in
  `src/lib/venue.tsx` and `src/lib/session.tsx` are **correctness-critical comments**, not
  lint debt to clean up.
- `expo-env.d.ts` and `.expo/types/**` are gitignored but in tsconfig `include`. A clean
  checkout has neither until `expo start` runs, so `tsc --noEmit` can report route-type errors
  before the dev server has ever started.
- **No test script.** `pnpm -r test` skips this package entirely. Verification is
  `pnpm typecheck` + `pnpm lint` + the simulator.
- App UI strings come from `@chehia/shared`, **not** from `locales/`. `locales/{fr,ar,en}.json`
  holds only the three native permission strings.
- Location is no longer purely on-device: gated venues send `customer_lat`/`customer_lng` to
  `place-order`. Privacy copy must say "not stored / not linked to identity", never "never
  leaves the device".

Deep-link a table on the booted simulator:
```bash
xcrun simctl openurl booted "exp://127.0.0.1:8081/--/r/cafe-el-marsa/t/demo-elmarsa-t12"
```
