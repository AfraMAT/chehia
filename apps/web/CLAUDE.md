@AGENTS.md

# apps/web

One Next.js app serving four hosts. `src/proxy.ts` remaps **only the root path** per host, so
`/business`, `/admin`, `/caisse` stay reachable by path everywhere — including localhost and
previews.

**Next 16 renamed `middleware` → `proxy`.** Host routing is `src/proxy.ts` exporting
`export function proxy(request)`. Creating `src/middleware.ts` would silently do nothing.
Per `AGENTS.md`, read `node_modules/next/dist/docs/` before writing Next-specific code — this
version diverges from training data.

## Supabase & auth

All clients come from `src/lib/supabase.ts`. Never call `createClient` directly.
- `getSupabase()` — memoized browser singleton (persisted session).
- `getServerSupabase()` — fresh per call, `persistSession: false`, **anon-key only, no cookie
  wiring**. Server components see no user session. Used in exactly 4 places.
- `callFunction<T>(name, body)` / `functionsUrl(name)` — edge function calls. Don't hand-roll
  the fetch; these attach the access token + apikey and return `{ ok, status, data }`.

`@supabase/ssr` is a declared dependency that is **imported nowhere**. There is no
cookie-based SSR auth. Auth is 100% client-side: `business/portal-provider.tsx`,
`admin/admin-provider.tsx` and `caisse/caisse-provider.tsx` each run the same 5-state machine
(loading / ready / unauthenticated / no-role / error). A transient query error yields `error`
+ retry, deliberately **not** a bounce to login — keep that distinction. Consequence: every
guarded page ships as a client component and flashes a loading state. There is no server-side
redirect, and adding one means wiring the SSR cookie client that doesn't exist yet.

Google OAuth redirects to `${window.location.origin}/auth/callback` — same-origin is required
because the PKCE verifier lives in localStorage. Google only *authenticates*; the callback
resolves the real role from the DB (`platform_admins` → /admin, active `staff` →
/business/orders, neither → signOut).

## Styling

Tailwind **v4, CSS-first**. There is no `tailwind.config.*`. Every token is an `@theme` block
at the top of `src/app/globals.css` (the "Harissa & Sidi Bou" system, mirrored in
`packages/shared/src/tokens.ts`). Use the semantic utilities — `bg-cream`, `text-ink`,
`border-line`, `bg-harissa`, and the dark `k*` kitchen-display palette — never raw hex or
stock Tailwind palette names.

Per-venue theming overrides the same `--color-*` custom properties via
`appearanceCssVars(restaurant.appearance)` applied as an inline style on a full-bleed
wrapper. Customer screens are capped at `max-w-[520px]`.

Reuse the primitives in `src/components/ui.tsx` (Button, StatusChip, Tag, Stepper, Toggle,
Card, PhotoPlaceholder, Spinner, Skeleton, Stars, StarInput, FaceInput) before writing a new one.

## Conventions

- Non-routable components live in an underscore folder inside their segment so App Router
  ignores them: `src/app/r/_venue/*`, `src/app/caisse/_register/*`. Truly cross-surface
  components go in `src/components/`.
- Each surface has its **own** i18n localStorage key so a staff language never leaks into the
  customer view: `chehia.lang`, `chehia.lang.{slug}`, `chehia.portal.lang`,
  `chehia.caisse.lang`, `chehia.admin.lang`.
- Use `src/lib/storage.ts` (`storageGet`/`storageSet`/`storageRemove`), never
  `window.localStorage` — it wraps every call for iOS Safari "Block All Cookies", quota and
  private windows.
- `react-hooks/set-state-in-effect` is **disabled on purpose**: post-hydration state
  (language, cart, network) must be applied in effects or SSR and first client render diverge.
  Reading localStorage in a `useState` initializer causes hydration mismatches.
- The two venue layouts are `force-dynamic`, load a whole `VenueBundle` via
  `src/app/r/_venue/loader.ts`, and hand it to the client provider. The loader distinguishes
  **not found** (return null → `<InvalidQr/>`) from **transient error** (throw → `error.tsx`
  retry boundary). Preserve that.

## Traps

- `src/app/app/page.tsx` uses `select("*")` **deliberately** (commented) so a prod deploy
  where a migration hasn't landed still returns the catalogue instead of erroring.
- Two different things are called "caisse": `src/app/caisse/**` is the full-screen POS
  register; `src/app/business/caisse/**` is only its settings + reports screen in the portal.
- `src/app/caisse/layout.tsx` injects `@page size 72mm` print CSS via
  `dangerouslySetInnerHTML` and renders the register inside `print:hidden` with
  `<PrintReceipt/>` outside it. Refactoring that structure breaks printing.
- Three PWA manifests must stay in sync with their surfaces: `src/app/manifest.ts`,
  `public/business.webmanifest`, `public/caisse.webmanifest` (+ `public/caisse-sw.js`).
- POS totals, change and fiscal numbers are stamped **server-side** by the `register-order` /
  `settle-order` edge functions. Never compute them client-side.
- `next.config.ts` sets baseline security headers (CSP `frame-ancestors`, HSTS without
  preload, `poweredByHeader: false`) on every route — edits there have production impact.
  Its `env` block is inlined at build time, so changing a Vercel variable needs a **rebuild**,
  not a redeploy.
- `apps/web/README.md` is untouched create-next-app boilerplate. Cite the root `README.md`.
- No tests here. Web logic is covered indirectly through `packages/shared`.
