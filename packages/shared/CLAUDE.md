# packages/shared

Zero runtime dependencies, ESM-only, **consumed as raw TypeScript source** — `main`/`types`
point at `src/index.ts` and there is no build step. This is where the domain logic and the
only meaningful test suite live (`src/__tests__/`, ~135 tests, offline, ~0.5s via
`pnpm test:unit`).

`tsconfig.json` sets **`noUncheckedIndexedAccess: true`** — stricter than either app. Code
that typechecks in `apps/web` can fail here: indexing yields `T | undefined` and needs a guard
or `!`. The existing tests use `draft.categories[0]!.items[0]!` for exactly this reason.

## Money

Everything is an integer count of millimes (1 TND = 1000). The canonical helpers are all in
`src/format.ts`:

| Fn | Behaviour |
|---|---|
| `millimesToDisplay(m, lang)` | ≥1 decimal, trailing zeros trimmed — 6000→`6,0`, 5550→`5,55`. `.` for en, `,` for fr/ar. Negatives use U+2212 `−`. |
| `currencyLabel(lang)` | `د.ت` for ar, else `TND` |
| `formatPrice` / `formatDelta` | `5,5 TND` · `+1,0`, empty string for a zero delta |

Western numerals in **every** language, including Arabic — only the separator and currency
word change.

`parseMenuPrice(raw)` in `src/menu-import.ts` is the only string→millimes parser: a decimal
separator means dinars (`"3,5"`→3500), a bare integer <100 means dinars (`"3"`→3000), ≥100 is
already millimes (`"3500"`→3500). Returns `null` for junk. New money parsing goes through it
rather than adding a fifth hand-rolled `× 1000` site.

## Hand-rolled validation

There is no zod/valibot/yup anywhere in the repo. The trust-boundary validators are pure and
defensive:

- `validateModifiers` (cart.ts) — mirrors the server's min/max select rules
- `validateDraft` (menu-import.ts) — normalizes untrusted `extract-menu` output; caps 40
  categories × 200 items, truncates to 300 chars, emits `DraftIssue[]`
- `resolveAppearance` (appearance.ts) — **the only sanctioned way to read
  `restaurants.appearance`**. Never throws, coerces enums, sanitizes partial palettes. Reading
  that jsonb blob's fields directly bypasses coercion and can render an illegible theme.
- `parseTableUrl` (deeplink.ts), `clampGeofence`/`withinGeofence` (geo.ts), `canTransition`
  (status.ts), `stockLevel` (inventory.ts), `coerceArtId` (menu-art.ts)

## Deliberate mirrors — change in lockstep

These duplicate logic that also lives in SQL or an edge function, because neither can import
from here:

- `inventory.ts` `stockLevel` ↔ SQL `stock_level_of` (`supabase/migrations/20260708000001_inventory.sql`)
- `geo.ts` ↔ hand-copied into `supabase/functions/place-order/index.ts` (its comment says so)
- `cart.ts` `MAX_LINE_QTY` + `validateModifiers` ↔ server-side caps

## i18n

`i18n/fr.ts` defines the `Dictionary` type; `__tests__/i18n.test.ts` asserts `ar` and `en`
have **exactly** the same key set and that no value is an empty string. A French key added
alone fails the suite. French is canonical (~983 keys).

## Traps

- `src/database.types.ts` is **generated** by `pnpm db:types` — the `>` redirect overwrites
  the whole file, so any hand edit dies on the next run. It is currently **stale** (2026-07-07
  vs migrations through 07-16: missing every POS/fiscal table, `staff_shifts`, and the
  location-gating columns) and **imported by nothing** — both Supabase clients are created
  untyped. So the staleness produces no type errors today; it bites the moment someone wires
  `createClient<Database>`.
- `format.ts` `formatCount` post-processes `Intl.NumberFormat` output to normalize NBSP /
  narrow-NBSP to a plain space. **The replace regex contains literal invisible characters** —
  do not "tidy" it.
- No `vitest.config.ts` — the suite runs on defaults. Adding coverage thresholds means
  creating one.
- The `./tokens`, `./i18n` and `./database` subpath exports exist but nothing uses them; all
  86 imports in `apps/` use the bare root specifier.

# packages/integration (sibling)

Vitest against the **local** Supabase stack. Requires `pnpm db:start` and, in practice, a
fresh `pnpm db:reset` — the tests hardcode seeded UUIDs and the shared table token
`demo-elmarsa-t12`, and reruns within ~90s trip the per-table burst limit (4 orders / 90s) and
the 5-open-order cap. Those failures are environmental, not regressions.

`fileParallelism: false` exists because the tests are stateful and destructive against that
local DB — do not re-enable parallelism.

`helpers.ts` defaults to `http://127.0.0.1:54321` and the well-known public supabase-demo
service-role JWT. **Never** point `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` at a hosted
project when running this suite.

It has **no tsconfig and no typecheck script**, so `pnpm -r typecheck` silently skips it and
vitest strips types without checking them. Type drift here is invisible until runtime.
