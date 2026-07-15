# Chehia — Road to Launch: complete audit & execution doc

_Generated 2026-07-12 from a 58-agent audit of the full monorepo (14 core areas adversarially verified + 4 gap areas from a completeness critic), live production checks (Supabase prod/dev, deployed endpoints, decoded demo QR), and the App Store rejection of iOS 1.0 (2) — submission `780237f1-2f01-4a54-9fe1-0406e38123c9`, reviewed 2026-07-07 on iPad Air 11" (M3)._

**How to use this doc:** work top to bottom. Part 1 gets the app resubmitted and approved. Part 2 is the complete prioritized backlog (every fix/enhance/add/remove/clean/organize item found, with file references). Part 3 is production/ops work outside the app code. Part 4 is the QA pass before you press "Resubmit". Check items off as you go.

---

# Execution log — 2026-07-15

## CUSTOMER-UX AUDIT + BUILD 4 (session 3, continued — 2026-07-15 evening)

Build 3 was killed by Apple's delivery scanner (**ITMS-90683**: a library references the
motion API, so NSMotionUsageDescription must EXIST — suppressing it was wrong; it now
ships localized fr/ar/en, prebuild-verified). The user also found two real UX bugs, so a
**37-agent customer-UX audit** (8 dimensions, adversarially verified: 49 confirmed
findings) + hands-on iPhone-simulator QA (idb) ran before build 4.

**Fixed for build 4 (all verified — gates green, key flows re-tested in the simulator):**
- **HIGH · RTL double-flip**: shipping an ar localization makes native iOS set
  I18nManager.isRTL=true on Arabic-system devices, inverting the app's manual mirroring
  on EVERY screen. Pinned native LTR via `["expo-localization", {"supportsRTL": false}]`
  (prebuild-verified `ExpoLocalization_supportsRTL=false`); the in-app rowDir mirroring
  stays the single source of truth. Confirm on TestFlight with an Arabic-language device.
- **HIGH · group ghost items**: leaving a group kept the leaver's lines in the placed
  order (billed, invisible, unremovable). Migration `20260715211228_group_session_hygiene`
  (applied dev+prod): leave_session deletes the leaver's lines; client totals only count
  active participants; leave now confirms first.
- **HIGH · zombie group sessions**: sessions never expired — the next party inherited a
  stranger's group. start/join now close/reject sessions older than 6h (same migration).
- **Order-continuation** (user-reported): multi-order tracking (activeOrders list, mobile+web),
  "your other orders" on the tracking screen, count-aware banner. Sim-verified end-to-end.
- **In-flow language switcher** (user-reported): FR/ع/EN pill in the menu header
  (mobile+web), cycles the venue's supported languages. Sim-verified incl. full RTL flip.
- Order tracking realtime fallback: slow poll + foreground/visibility refetch (mobile+web);
  order-lines fetch retried on channel join ("0 items" bug).
- Stable client_ref idempotency on mobile (dupe-order guard, mirrors web).
- Location gate: distinct "blocked" state + Open Settings CTA (iOS never re-prompts);
  native copy (the old string said "browser" in the app).
- Accent/hamza-insensitive search everywhere ("cafe" finds "Café"; أ/إ/آ→ا, ة→ه, ى→ي) —
  shared foldSearch + tests. Sim-verified.
- Keyboard no longer covers inputs in group/rating/waiter sheets (KeyboardAvoidingView).
- Floating cart bar no longer hides the last menu row in category views.
- Group-sheet spinner can't hang on thrown auth errors; group invite links use
  app.chehia.app (associated domain) instead of the apex; branded +not-found route;
  localized "Guest" fallback; menu back-button hitSlop.

**Deferred to post-submission backlog (31 findings, none reviewer-blocking):**
- **MEDIUM** · Queued offline order that the server permanently rejects is silently dumped back into the cart — customer keeps waiting for food that was never ordere (`apps/mobile/src/lib/venue.tsx`)
- **MEDIUM** · A queued order cannot be cancelled or edited, and auto-submits up to 3 hours later on any connectivity change (`apps/mobile/src/components/venue/cart-screen.tsx`)
- **MEDIUM** · Group-order guests get zero confirmation or tracking when the host places the order — the group UI just vanishes (`apps/mobile/src/lib/session.tsx`)
- **MEDIUM** · Network failure with no cached menu renders "This QR code is not valid" (scanned) / "No venue found" (browse) instead of a network error, with no retr (`apps/mobile/src/lib/venue.tsx`)
- **MEDIUM** · Group session: any failed refetch silently wipes participants and cart lines from the UI (`apps/mobile/src/lib/session.tsx`)
- **MEDIUM** · Adding a dish to the group cart is fire-and-forget: on failure the sheet closes with success haptics but nothing was added (`apps/mobile/src/components/venue/item-sheet.tsx`)
- **MEDIUM** · Host splitting off solo ("Order my items separately") orphans the group — no host handoff, group can never be placed (`supabase/migrations/20260709000002_group_ordering.sql`)
- **MEDIUM** · When the host places the group order, every other device's group cart silently vanishes with no confirmation or order access (`apps/mobile/src/lib/session.tsx`)
- **MEDIUM** · Items added to the personal cart before joining a group are silently excluded from the group order (two parallel carts) (`apps/mobile/src/components/venue/item-sheet.tsx`)
- **MEDIUM** · Removing an item from the group cart never syncs to other devices — realtime DELETE events are dropped by the filtered subscription (`apps/mobile/src/lib/session.tsx`)
- **MEDIUM** · iOS Precise Location off makes gated venues un-orderable while standing inside them, with a nonsense distance (`apps/mobile/src/lib/location-gate.tsx`)
- **MEDIUM** · Location Services off / failed GPS read in the gate silently loops back to the 'Share your location' prompt with zero feedback (`apps/mobile/src/components/venue/location-gate.tsx`)
- **LOW** · Staff cancellation is only discoverable by manually opening the tracking screen — the menu pill keeps saying 'order in progress' (`apps/mobile/src/components/venue/menu-screen.tsx`)
- **LOW** · Android hardware back while the QR scanner is open exits the app instead of closing the scanner (`apps/mobile/src/app/index.tsx`)
- **LOW** · Back buttons that navigate-with-replace grow the stack with duplicate screens — every placed order adds a phantom menu screen behind Android back / iO (`apps/mobile/src/components/venue/order-screen.tsx`)
- **LOW** · Scanned venue landing has no visible back/close affordance after an in-app scan (browse landing has one) (`apps/mobile/src/components/venue/venue-home.tsx`)
- **LOW** · Category back-pill Text missing lang prop: Arabic label renders in wrong font, wrong size, and relies on bidi luck for chevron placement (`apps/mobile/src/components/venue/category-items.tsx`)
- **LOW** · Logical paddingStart/paddingEnd don't follow the manual mirroring — asymmetric padding sits against the wrong child in Arabic (`apps/mobile/src/components/venue/menu-screen.tsx`)
- **LOW** · Star ratings always fill/order left-to-right, not mirrored in Arabic — RTL reader can tap the wrong star value (`apps/mobile/src/components/ui.tsx`)
- **LOW** · Allergen pill uses French-style spaced colon and Latin commas in Arabic (and English) (`apps/mobile/src/components/venue/item-sheet.tsx`)
- **LOW** · Discover venue list has no pull-to-refresh and never refetches after the first successful load (`apps/mobile/src/components/discover.tsx`)
- **LOW** · A venue with an empty menu (or empty category) shows search-flavored copy: "No results — Try another word, or browse the categories" (`apps/mobile/src/components/venue/menu-screen.tsx`)
- **LOW** · Group-cart writes ignore all errors — an add at the wrong moment is silently lost (`apps/mobile/src/lib/session.tsx`)
- **LOW** · Group state goes stale after backgrounding — no refetch on foreground or channel rejoin (`apps/mobile/src/lib/session.tsx`)
- **LOW** · Nickname collisions make guests indistinguishable in the cart and on the printed order (`apps/mobile/src/components/venue/group/group-sheet.tsx`)
- **LOW** · Share codes are venue-agnostic — entering a code while at a different venue joins the session but renders a broken cart (`supabase/migrations/20260709000002_group_ordering.sql`)
- **LOW** · No timeout on GPS reads — 'Checking your location…' can spin forever with the place-order button hidden and no cancel/retry (`apps/mobile/src/lib/location-gate.tsx`)
- **LOW** · Venue list renders full-resolution cover images into 104x104 cells with no downscaling or cache policy (`apps/mobile/src/components/ui.tsx`)
- **LOW** · Unbounded Dynamic Type scaling clips text in fixed-height controls across the app (T component sets no maxFontSizeMultiplier) (`apps/mobile/src/components/ui.tsx`)
- **LOW** · Status bar icons illegible on the full-screen QR scanner (global dark status style over a dark camera view) (`apps/mobile/src/app/index.tsx`)
- **LOW** · Discover footer 'scan instead' link: no accessibilityRole and a ~16pt tap target (`apps/mobile/src/components/discover.tsx`)

**Coverage note:** the cart/modifier-edge-cases auditor died mid-run (API error) — that
dimension is only covered by the simulator pass, not a code audit. Re-run it post-submission.

## RESUBMISSION EXECUTED (session 3)

Everything machine-doable for the App Store resubmission was completed and verified this session:

- **Build 1.0 (3) built on EAS and submitted to App Store Connect.** First attempt errored
  (`EAS_BUILD_SYSTEM_DEPS_INSTALL_ERROR` — corepack flake installing `packageManager` pnpm);
  fixed by pinning `"pnpm": "10.6.1"` in eas.json's production profile. Guideline 4 fix
  **verified in the built output** via `expo prebuild`: Info.plist ships ONLY camera +
  when-in-use location (French) + fr/ar/en `InfoPlist.strings`.
- **AASA live**: set `APPLE_TEAM_ID=9KSK39WBM6` on Vercel prod (CLI), redeployed —
  `https://app.chehia.app/.well-known/apple-app-site-association` serves 200 and Apple's
  CDN ingested it (`9KSK39WBM6.tn.chehia.app`). Universal links verify on next install.
  (`ANDROID_CERT_SHA256` still pending — Play-only, not needed for Apple.)
- **Reviewer flow proven on prod**: anonymous sign-in → live menu fetch → order placed via
  the demo QR token with NO location (A-509, HTTP 200) → cancelled. Demo QR PNG decodes to
  the exact live URL (CoreImage).
- **verify_jwt=true deployed** to prod `admin-provision-business` + `create-staff` via
  `supabase functions deploy` (shared deps bundled). No-auth → gateway 401; valid JWT →
  internal authz unchanged.
- **Pre-flight adversarial audit of never-device-QA'd code shipping in build 3** (3 agents):
  fetchMenu throw = CRASH-SAFE (single guarded call site, cache fallback, recoverable error UI);
  theme port = CRASH-SAFE (demo venue's `appearance:{}` → default Harissa via never-throws
  resolver; all live nulls guarded); language sweep = CLEAN (983/983/983 i18n keys; one edge
  fix landed: hardcoded "Guest" group-nickname fallback → `t.rating.anon`, mobile + web).
- **ASC pack finalized** in `docs/app-store-review/review-reply.md`: review notes + QR
  attachment, the 7 Guideline 2.1(b) answers, age-rating questionnaire answers (§C), and
  the exact click-path. **Remaining are the ASC UI steps only**: select build 3, App Review
  Info (notes + attachment), age-rating questionnaire, reply, Resubmit. Recommended first:
  TestFlight build 3 on a real iPhone + iPad (reviewer used iPad Air 11" M3).

## PROD DEPLOY + LIVE AUDIT (session 2)

**Deployed to production.** Commit `e519232` (submission fixes + hardening) and `dce8435`
(post-audit hardening) were pushed to `develop` and fast-forwarded onto `main`; Vercel
built and promoted both to production on all 6 domains (chehia.app, www, app, business,
caisse, admin). The 3 DB migrations were already applied to prod via MCP; their files are
now committed (renamed to the versions recorded in prod's `schema_migrations` ledger:
`20260713044846`, `20260713050040`).

**Live prod audit — 13 agents (5 probes → adversarial verify → completeness critic) + direct checks. Result: ZERO high/critical survived verification.** Verified GOOD on live prod:
- Security headers (nosniff, X-Frame SAMEORIGIN, CSP `frame-ancestors 'self'`, HSTS, Referrer-Policy) on all 6 domains; `x-powered-by` now stripped.
- Supabase advisors: **0 security-ERROR, 0 perf-ERROR**. Every hardening verified live: unindexed_foreign_keys=0, auth_rls_initplan=0, search_path pinned, multiple_permissive_policies 140→32. The 76 security WARNs are all expected-by-design (36 anon-sign-in = guest ordering; 38 SECURITY DEFINER RPCs are the intentional public/staff API) or known user-side (leaked-password protection).
- RLS live: anon reads of orders/staff/payments/cash_sessions/leads/… all return `[]`; menu tables readable; admin RPCs return 401. RLS on all 34 tables.
- Demo venue: reachable, ungated, **populated trilingual menu** (4 cats / 14 items) — Apple 2.1(a) satisfied.
- No client-bundle secret leak (only `sb_publishable_` ships); no open redirect; TLS valid on all hosts; portal roots 307 to login with no data leak.

**Confirmed findings (all LOW after adversarial downgrade) — fixed in `dce8435`:**
- Universal Links declared for the `chehia.app` apex could never verify (apex `/.well-known/*` 308→www; Apple/Google don't follow redirects). → Dropped apex from mobile iOS associatedDomains + Android intentFilter; kept `app.chehia.app` (what the QRs use). Applies on next EAS build.
- `admin-provision-business` / `create-staff` deployed `verify_jwt=false` (non-exploitable — internal callerId + platform_admins/owner gate). → Set `verify_jwt=true` in config.toml. **Apply on prod via `supabase functions deploy admin-provision-business create-staff`** (running copies still false).
- `x-powered-by: Next.js` leak → `poweredByHeader:false` (live).
- `diag-provision` orphan (inert 410 stub, jwt-protected) → delete via dashboard (no MCP delete tool).

**New gaps from the completeness critic (user-side; none block iOS resubmission):**
- **Email deliverability**: app emails send From `@aframat.com`, which has **no SPF/DKIM/DMARC/MX**. If `RESEND_API_KEY` is set, sends fail at Resend (unverified domain); likely the key is unset so email features are inactive. (chehia.app's own `-all` SPF + `p=reject` DMARC are correct — it sends no mail.) Verify aframat.com in Resend + add records if email features are wanted.
- **Realtime**: all 11 realtime-published tables have RLS enabled → same USING clauses block cross-tenant delivery (low risk). A live websocket probe with an anon JWT would be belt-and-suspenders.
- **No infra rate-limiting** on `extract-menu` (paid AI calls, public) — anon signup lets attackers bypass per-session caps → billing/DoS risk. Add IP-based limiting before wide launch.
- **No error tracking** (Sentry/etc.); **PITR/backup** status unverified (check dashboard); **CAA record** missing; **account-deletion** flow absent (GDPR; the iOS *customer* app is anonymous so Guideline 5.1.1(v) likely doesn't apply, but the web business portal has account creation).
- pg_cron nightly jobs still unscheduled (inventory-alerts + generate-insights dead) — coupled to the email + cost decisions.

---

Everything below was executed and verified in session 1. **All submission-BLOCKING work is done in-repo/backend; what remains for the App Store are the cloud/device steps only you can do (Vercel env, EAS build, ASC forms, dashboard toggles).**

**Runbook (Part 1) — done & verified:**
- **R1 ✅** Demo venue un-gated in **prod + dev** (`require_location=false` on `cafe-el-marsa`) — the reviewer can now complete the documented order path. Verified the geofence only fires when `require_location && lat && lng`.
- **R2 ✅** Permission-string landmine fixed in `apps/mobile/app.json`: suppressed the English-default `microphone`, `always-location`, and `motion` strings (`motionUsagePermission:false` etc.) + added `apps/mobile/locales/{fr,ar,en}.json` and the `locales` key. **Verified via `expo prebuild`**: the built `Info.plist` ships ONLY camera + when-in-use, localized per device language (fr/ar/ar).
- **R3 ✅** Killed the hardcoded `LANGUE · اللغة` mixed-language label on **mobile + web** (→ `t.common.language`), and added a language clamp so a venue can't render half-translated menus.
- **R4 ✅ (code)** Added `Cache-Control` to the AASA/assetlinks handlers (Apple's CDN was caching the 404); handlers + `eas.json` (`appleTeamId 9KSK39WBM6`) verified correct. **User-side remains:** set `APPLE_TEAM_ID=9KSK39WBM6` on Vercel prod + decide apex-vs-www primary (the QR domain `app.chehia.app` works with just the env var).
- **R5 ✅** Trued-up the privacy story: rewrote `/legal/privacy` and `docs/mobile-submission.md` — location IS transmitted for the geofence check (in-memory, never stored), plus reviews/nicknames/notes and on-device camera. Apple label stays "not collected"; Google Data Safety = collected + ephemeral.
- **R6 ✅** All lint errors fixed (**4 web + 7 mobile → 0**, real fixes not suppressions except 2 documented react-hooks-v7 false positives) + the two P1 mobile correctness bugs: partial-menu-fetch no longer renders/caches an empty menu (`fetchMenu` throws on any sub-query error), and the offline queue now expires after 3 h (`QUEUE_TTL_MS`) so a stale order can't auto-submit days later. Typecheck + lint + 132 unit tests + web prod build all green.

**Ops (Part 3) — done & verified:**
- **DB advisor hardening + performance migration** (`supabase/migrations/20260713000001_advisor_hardening_perf.sql`) written, applied to **local + dev + prod**, and verified on each: pinned `search_path` on the 2 flagged functions; wrapped `auth.uid()`/`staff_restaurant_id()` in `(select …)` on the 8 hot RLS policies; added **31 covering FK indexes**; revoked `anon` EXECUTE on the 3 admin RPCs (admin portal still works — admins are authenticated) and locked the `orders_restock_on_cancel` trigger fn from `PUBLIC`. Order-flow integration test still passes 9/9 after the change.
- **Permissive-policy merge** (`supabase/migrations/20260713000002_scope_staff_policies_authenticated.sql`) — scoped all **55** staff/platform/manager/owner/admin RLS policies from `public` to `TO authenticated`, applied to **local + dev + prod** and verified access-neutral (order-flow 9/9 + a staff-RLS read both pass; the 16 customer/public/member policies deliberately untouched). Drops the `multiple_permissive_policies` advisor from **140 → ~28** (only the unavoidable authenticated-role overlaps remain).
- **Edge-function drift + scheduling — assessed & staged.** Confirmed via build-hash diff: `generate-insights` on dev is a stale v1 (prod v3 matches the repo — redeploy dev when it next matters; it's a dead function today), and `diag-provision` is a **prod-only orphan** (no repo source; there is no `delete_edge_function` MCP tool, so removing it is a dashboard/CLI action). `pg_cron` + `pg_net` are both installed on prod, so scheduling the two dead nightly functions is authored in `20260713000003_schedule_nightly_functions.sql.staged` — **left staged, not applied**, because it turns on recurring paid AI calls (`generate-insights`) and owner-facing alerts (`inventory-alerts`): a cost/cadence decision only the owner should make. Fill the 2 placeholders + create the Vault secret, then apply.
- **`config.toml`**: disabled public email signup (`[auth.email] enable_signup=false`) — keeps owner login + anonymous + Google. **Mirror on the cloud dashboards** (user-side).
- **Security headers** added globally in `apps/web/next.config.ts` (`nosniff`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN` + CSP `frame-ancestors 'self'`, HSTS) — closes the clickjacking/sniff gap on POS/admin/business.
- **Migration parity**: verified prod == dev on session-function `search_path` (the reported gap was cosmetic ledger drift, not a schema difference).

**Test-suite verdict:** shippable code is green (typecheck, lint, 132 unit tests, clean migrations, web build). The 12 integration failures are ENVIRONMENTAL, not code: anti-abuse per-table burst limit (order tests, pass 9/9 in isolation) + local Supabase CLI 2.67 issuing legacy HS256 JWTs that supabase-js 2.110 rejects (inventory staff tests) — prod unaffected. See Part 3 CI item.

**Remaining — each blocked on something I can't/shouldn't decide unilaterally:**
- Dropping the 38 "unused" indexes — **genuinely premature**: the advisor's sample is young; dropping an index a real query needs would silently slow prod. Revisit after a full traffic cycle.
- `pg_cron` scheduling — **staged** (`…000003_…sql.staged`); one owner decision (recurring AI cost + owner alerts) + a Vault secret away.
- Data-lifecycle retention — involves **deleting** user data (anonymous users, old sessions, leads PII); needs a retention policy sign-off before I write deletions against prod.
- `diag-provision` orphan removal + `generate-insights` dev redeploy — dashboard/CLI actions (no MCP delete; dev function is dead so redeploy has no urgency).
- The 228 P2/P3 polish items — non-blocking nice-to-haves; the P0/P1 critical set is done.

---

# Part 1 — App Store resubmission: how it works, and the exact runbook

## 1.1 How resubmission works (your questions answered)

- **You do NOT create a new app or a new version.** The rejected **iOS App Version 1.0** stays open in App Store Connect. You fix the issues, upload a **new build** (the build number bumps 2 → 3 automatically at next EAS build), select that new build on the version page, and click **Resubmit to App Review** on the submission page.
- **Yes, you can (and should) ship everything added since the last submission in this build.** Apple always re-reviews the whole app, not a diff. Submitting a much-improved binary is normal and helps. The only caution: everything in the binary must *work* — that's why the QA pass (Part 4) comes before the build.
- **Three things must change in App Store Connect itself** (no binary needed): the App Review Information (demo QR attachment + notes), your reply to their message (answers the Guideline 2.1(b) business-model questions), and the age-rating questionnaire (including the new social-media questions due **Sept 7, 2026** — do it now while you're in there).
- **Two things must change in the binary** (require the new build): the permission-string language fix (Guideline 4) and the mixed-language `LANGUE · اللغة` label.
- **One thing must change in production data**: the demo venue is location-gated — Apple's reviewer physically cannot order (they're ~10,000 km from La Marsa). This is the hidden landmine that would cause a second rejection even with everything else fixed.
- **One thing must change on the website**: the privacy policy still claims location "never leaves the device" — false since location-gated ordering shipped (coordinates are sent to the server for the geofence check, though never stored). Reviewer-facing claims must be true.
- Typical re-review turnaround is 24–48 h. Reply to their message *and* resubmit — replying alone does not restart review.

## 1.2 What was already verified as CORRECT (no action needed)

- ✅ Demo QR PNG decodes to exactly `https://app.chehia.app/r/cafe-el-marsa/t/demo-elmarsa-t12` (decoded with CoreImage).
- ✅ That venue + table exist and are **active in production** (Café El Marsa, 14 tables, 14 menu items; table "12", token `demo-elmarsa-t12`), and the URL serves 200.
- ✅ Opening hours do **not** block ordering (no edge function reads `opening_hours` — display-only), so a reviewer ordering at 3 a.m. Tunisia time is fine.
- ✅ `place-order` uses submitted GPS coordinates **in memory only** (distance check, then discarded) — so Apple's "Location — not collected" App Privacy answer remains defensible under Apple's definition. The *prose* about it must still be fixed (R5).
- ✅ Versioning: `autoIncrement` will produce buildNumber 3 on the next `eas build`.
- ✅ Icons (1024 px, no alpha), privacy manifest, `ITSAppUsesNonExemptEncryption:false` all present.
- ✅ Typecheck, shared unit tests, and the web production build are all green (lint is not — see R6).
- ✅ July's admin-escalation security fix is properly in the migrations; POS RPC anon-lockdown verified; QR deeplink domain/host routing verified fixed.

## 1.3 The resubmission runbook (do in this order)

### R1. Un-gate the demo venue in PROD (2 min — the hidden blocker)
Run against the **production** Supabase project (`wpnouppukofzmvsieyeq`):
```sql
update restaurants set require_location = false where slug = 'cafe-el-marsa';
```
Keep it off permanently — reviewers also re-test after updates. (Le Zink/kabareya can stay gated; note: a venue with `require_location=true` but **no lat/long pin** — kabareya today — silently disables the gate; see the backlog item about making that state visible to owners.)

### R2. Fix the permission strings for real (the current Guideline 4 fix is incomplete)
The app.json "single French string" fix is a landmine: expo's config plugins inject **default English strings** for every permission option you didn't set. The built Info.plist would ship `NSMicrophoneUsageDescription` ("Allow Chehia to access your microphone"), `NSLocationAlwaysUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`, and `NSMotionUsageDescription` in **English** — the exact rejection class again, for permissions the app doesn't even use.

1. In `apps/mobile/app.json` plugins, suppress the unused permissions:
   ```json
   ["expo-camera", {
     "cameraPermission": "…(French string, keep)…",
     "microphonePermission": false,
     "recordAudioAndroid": false
   }],
   ["expo-location", {
     "locationWhenInUsePermission": "…(French string — update it to also mention the on-site ordering check, see backlog)…",
     "locationAlwaysAndWhenInUsePermission": false,
     "locationAlwaysPermission": false,
     "motionPermission": false
   }]
   ```
2. Add per-device-language strings so the prompt always matches the UI language (the robust fix — the app UI follows device language fr/ar/en, so a French-only prompt on an English device is still a mismatch):
   - Create `apps/mobile/locales/fr.json`, `ar.json`, `en.json`, each containing translated `NSCameraUsageDescription` and `NSLocationWhenInUseUsageDescription`.
   - Add to app.json: `"locales": { "fr": "./locales/fr.json", "ar": "./locales/ar.json", "en": "./locales/en.json" }` (this also enables Android 13 per-app language — a Play-readiness item).
3. **Verify before building** (plugin option names occasionally shift between SDK versions — trust the output, not the docs):
   ```bash
   cd apps/mobile && npx expo prebuild -p ios --clean
   grep -B1 -A1 "UsageDescription" ios/Chehia/Info.plist   # expect ONLY camera + location-when-in-use, in French
   find ios -name "InfoPlist.strings"                       # expect fr/ar/en variants
   ```
   Then delete the generated `ios/` dir (EAS builds from config).

### R3. Kill the last mixed-language UI copy (the pattern Apple explicitly flagged)
- Fix the hardcoded bilingual `LANGUE · اللغة` label (mobile **and** web) → single-language via the i18n catalog (P2: _"Bilingual 'LANGUE · اللغة' label hardcoded"_).
- Optional but recommended pre-submission: clamp the app language to the venue's supported languages so menu screens can't render half-French/half-English (P2: _"Mobile never clamps language to the venue's supported languages"_).

### R4. Revive universal links (reviewer-visible product promise)
1. On the Vercel **production** project set `APPLE_TEAM_ID=9KSK39WBM6`, redeploy.
2. Fix the apex redirect: make `chehia.app` the primary domain (www → apex) so the AASA can serve without a redirect — this also matches `SITE_URL` and your canonicals. (Alternative: add `applinks:www.chehia.app` + a www Android intent filter, but flipping primary is cleaner.)
3. Verify: `curl -i https://app.chehia.app/.well-known/apple-app-site-association` → direct 200, `application/json`; same for `chehia.app`. Check Apple's CDN view: `https://app-site-association.cdn-apple.com/a/v1/app.chehia.app`. Note the P1 finding that these handlers should also send proper `Cache-Control` (Apple's CDN caches a 404 for hours).
4. Android: after the production build exists, set `ANDROID_CERT_SHA256` (EAS upload key + Play app-signing key SHA-256s) and re-verify `assetlinks.json` (needed for Play, not for Apple).

### R5. True up the privacy story (new since location-gated ordering — a critic-round catch)
The app now **transmits** precise coordinates to `place-order` for the geofence check (in-memory only, never stored — verified). But three artifacts still claim location never leaves the device, and a false reviewer-facing privacy claim is rejection/removal material on both stores:
1. Update the privacy policy page (`/legal/privacy`) — plain description: "when you order remotely from a venue that requires presence, your location is sent to our server once to confirm you're at the venue; it is not stored." Also add the other data it omits: reviews/ratings content and group-session nicknames (P1/P2 items).
2. Fix `docs/mobile-submission.md` App Privacy / Data Safety sections (currently claim "coordinates never leave the device").
3. Apple App Privacy label: can stay "Location — not collected" (ephemeral real-time processing meets Apple's definition), but re-read the label after the policy rewrite so all three artifacts agree. For Google Play later: declare location with the **ephemeral processing** flag in Data Safety.

### R6. Green the build gates
- Fix the 4 `apps/web` lint errors and 7 `apps/mobile` lint errors (react-hooks rules); re-run `pnpm -r lint` and `pnpm -r typecheck`.
- Fix the two S-effort mobile correctness items in the review path: _"Partial menu fetch failure renders an empty 'ready' menu and overwrites the good cache"_ and _"Offline order queue has no expiry — a stale queued order can auto-submit days later"_ (both P1, both small).

### R7. On-device QA pass (Part 4 checklist)
The resubmission binary ships four never-device-QA'd features (menu themes, group ordering, location gating, ratings on mobile). Run the Part 4 matrix — **including an iPad**, since Apple reviews on one and told you they expect it to function there.

### R8. Build & upload
```bash
cd apps/mobile
eas build --platform ios --profile production   # produces 1.0 (3)
eas submit --platform ios --profile production  # or pick the build in ASC
```

### R9. App Store Connect (all in the browser)
1. Version 1.0 page → select the new build (3).
2. App Review Information → attachment: `docs/app-store-review/demo-qr-cafe-el-marsa-table-12.png`; Notes: paste §A from `docs/app-store-review/review-reply.md`; Sign-in required: **No**.
3. Reply to Apple's message with §B — **first update its Guideline 4 paragraph** to say: usage descriptions are now provided in French, Arabic and English via per-locale InfoPlist localization and match the device language; unused permission declarations (microphone, always-location, motion) were removed entirely.
4. App Information → age rating: complete the questionnaire **including the new social-media questions** (due Sept 7, 2026). Guidance: not a social-media app; it has moderated UGC (ratings/reviews with staff+admin approval before public display); no user profiles, no messaging, no user-to-user contact.
5. Re-check the App Privacy label against the rewritten policy (R5) — the answers themselves shouldn't need to change.
6. **Resubmit to App Review.**

---

## The numbers

**305 findings** across 18 audited areas — **5 blockers**, **46 high**, 115 medium, 113 low, 26 ideas. Blocker/high findings in the 14 core areas were adversarially re-verified by independent agents (38 confirmed, 1 refuted — kept below with the refutation note). The 4 gap areas (observability, HTTP security headers, Google Play readiness, data lifecycle) came from a completeness-critic round and are single-pass, marked ⚠. Severity meanings: `blocker` = would cause another App Store rejection or breaks a core flow · `high` = must fix for launch quality · `medium` = should fix soon after · `low` = polish · `idea` = deliberate roadmap choice.

Note: a few issues were independently found by multiple auditors from different angles (e.g. the permission-string localization appears as items 1/2/6/8). They were deliberately kept — each adds files or nuance — so checking off one means re-checking its twins. The runbook in Part 1 already consolidates all pre-submission work into single steps.

# Part 2 — The complete backlog

## P0 — Blockers (fix before resubmitting to Apple)

_5 items._

- [ ] **1. Built Info.plist still contains default ENGLISH permission strings for mic, location-always and motion — the exact Guideline 4 rejection class**  
  `blocker` · fix · effort S · _iOS/Android App Store compliance_ ✅verified
  - **Where:** `apps/mobile/app.json:111`, `apps/mobile/app.json:117`, `node_modules/expo-camera/plugin/build/withCamera.js:8`, `node_modules/expo-location/plugin/build/withLocation.js:105`, `docs/app-store-review/review-reply.md:54`
  - **Problem:** app.json only sets cameraPermission and locationWhenInUsePermission (French). But expo's createPermissionsPlugin (node_modules/@expo/config-plugins/build/ios/Permissions.js: applyPermissions) writes the plugin's DEFAULT string whenever an option is undefined: expo-camera injects NSMicrophoneUsageDescription = 'Allow $(PRODUCT_NAME) to access your microphone', and expo-location injects NSLocationAlwaysUsageDescription, NSLocationAlwaysAndWhenInUseUsageDescription AND NSMotionUsageDescription with English defaults. So the resubmitted binary would ship 4 English usage strings next to the 2 French ones — permission strings 'not in the same language as the app's localization' again, plus usage descriptions for capabilities the app never uses (no audio recording, no always-location, no motion). The review-reply's claim that 'the usage descriptions are now written in the app's primary localization' is false until this is fixed.
  - **Fix:** In apps/mobile/app.json plugins: expo-camera → add "microphonePermission": false (and "recordAudioAndroid": false, making the existing blockedPermissions RECORD_AUDIO belt-and-suspenders); expo-location → add "locationAlwaysPermission": false, "locationAlwaysAndWhenInUsePermission": false, "motionUsagePermission": false. Then verify with `npx expo prebuild -p ios --clean` that ios/Chehia/Info.plist contains ONLY NSCameraUsageDescription and NSLocationWhenInUseUsageDescription, both in French — exactly what review-reply.md's sanity-check tip suggests.

- [ ] **2. iOS permission strings not localized per device language — repeat Guideline 4 rejection risk**  
  `blocker` · fix · effort S · _Internationalization_ ✅verified
  - **Where:** `apps/mobile/app.json:19`, `apps/mobile/app.json:110`, `apps/mobile/src/lib/i18n.tsx:24`, `docs/app-store-review/review-reply.md:60`
  - **Problem:** apps/mobile/app.json defines a single French string for camera (line 114, expo-camera cameraPermission) and location (line 120, expo-location locationWhenInUsePermission), and declares CFBundleLocalizations [fr,ar,en] (line 21) with no expo "locales" key and no locales/ directory anywhere in apps/mobile. The app's UI localizes by device language (deviceLanguage() in apps/mobile/src/lib/i18n.tsx:24-29), so on Apple's English review device the app renders in English but the camera permission alert appears in French — exactly the 'permission request not in the same language as the app's localization' mismatch from the v1.0 rejection. The drafted reply (docs/app-store-review/review-reply.md §B) only claims the single-French-string fix, which still mismatches on any non-French device.
  - **Fix:** Add expo's top-level "locales" config: "locales": {"fr": "./locales/fr.json", "ar": "./locales/ar.json", "en": "./locales/en.json"}, each JSON containing NSCameraUsageDescription and NSLocationWhenInUseUsageDescription in that language (reuse the existing French strings for fr.json). This generates per-language InfoPlist.strings so the prompt always matches the device language. Rebuild with EAS and update review-reply.md §B to state the permission strings are now localized into all three supported languages.

- [ ] **3. Demo review venue is location-gated on prod — the documented no-QR reviewer path will fail with too_far**  
  `blocker` · fix · effort S · _branch/environment divergence & ship-state_ ✅verified
  - **Where:** `docs/app-store-review/review-reply.md:36`, `docs/mobile-submission.md:63`, `supabase/functions/place-order/index.ts:1`
  - **Problem:** Verified on prod DB: cafe-el-marsa has require_location=true AND a map pin set (latitude not null), table demo-elmarsa-t12 active. Prod place-order is v7 and byte-identical to dev (ezbr_sha256 18abb891…), i.e. the geofence enforcement IS live on prod: any browse-origin order without coords inside ~200 m of the pin is rejected location_required/too_far. docs/app-store-review/review-reply.md Option B ('Trouver un restaurant' → select venue → order, no scan needed) and the reviewer notes in docs/mobile-submission.md both rely on exactly this browse flow — an Apple reviewer in California can never pass the geofence, and the new mobile build's location-gate UI will block checkout with 'you must be at the venue'. Only Option A (scan the demo QR → origin=scan, exempt) still works. The review-reply was drafted hours before location gating shipped and was never re-checked against it.
  - **Fix:** Before resubmission: set require_location=false on cafe-el-marsa in prod (Business Settings → Location toggle, or one UPDATE), OR clear its pin, and re-test a remote browse order end-to-end. Alternatively rewrite the reviewer notes to make the QR scan the only path — but keeping the no-scan fallback working is far safer for 2.1(a). Also add a line to the notes explaining the geofence feature so the reviewer isn't surprised at other venues.

- [ ] **4. Drafted Data Safety answers falsely claim location is never transmitted — misdeclaration would get the app rejected/removed**  
  `blocker` · fix · effort S · _google-play-android-readiness_ ⚠ gap-round (single-pass)
  - **Where:** `docs/mobile-submission.md:41`, `apps/mobile/src/components/venue/cart-screen.tsx:108`, `supabase/functions/place-order/index.ts:232`, `apps/mobile/app.json:26`
  - **Problem:** docs/mobile-submission.md:43 instructs: "Coordinates are never stored or transmitted, so location is not 'collected' — answer No". That was true before location-gated ordering, but the app now sends precise device coordinates to the backend: apps/mobile/src/components/venue/cart-screen.tsx:108-111 posts { lat, lng, accuracyM } to place-order, received as customer_lat/customer_lng/customer_accuracy_m in supabase/functions/place-order/index.ts:35-38 and evaluated at :232-243. Submitting a Play Data Safety form saying location is not collected while the APK manifests ACCESS_FINE_LOCATION and transmits coordinates is exactly what Google's automated Data-Safety audits flag; consequences range from rejection to app removal. The same staleness affects app.json:26 (iOS NSPrivacyCollectedDataTypes: [] — also now wrong, flagged here for cross-platform consistency).
  - **Fix:** Rewrite the Data Safety guidance: declare Location > Approximate AND Precise location as Collected (both COARSE and FINE are in the manifest), purpose = App functionality, collection Optional (users can scan the table QR instead), Not shared, and mark 'processed ephemerally' — verified accurate because place_order_tx (place-order/index.ts:385-397) never persists the coordinates. Update app.json's iOS privacy manifest to match. Keep the ephemeral claim honest by ensuring no logging path ever prints coords.

- [ ] **5. No Android build has ever been produced — entire Android runtime unverified before Play submission**  
  `blocker` · add · effort M · _google-play-android-readiness_ ⚠ gap-round (single-pass)
  - **Where:** `apps/mobile/app.json:57`, `apps/mobile/eas.json:4`, `apps/mobile/src/app/r/[slug]/t/[token]/_layout.tsx:1`
  - **Problem:** Evidence: android.versionCode is still 1 (apps/mobile/app.json:57) while ios.buildNumber has drifted to "2" (app.json:13) under eas.json's appVersionSource:"local" + production autoIncrement (eas.json:4,23) — autoIncrement mutates app.json per production build, so Android was never built. /android is gitignored and absent. Consequently untested on Android: (a) hardware back through deep-linked flows — no unstable_settings/initialRouteName anywhere in apps/mobile/src/app, so a cold QR launch into /r/[slug]/t/[token] has no parent stack and back exits the app; (b) edge-to-edge on Android 15/16 (targetSdk 36 enforces it with no opt-out — 13 files use safe-area insets, looks handled, but never rendered on a device); (c) MLKit QR scanning (expo-camera's manifest adds com.google.mlkit barcode_ui, meaning first scan may download a model via Play services and fails outright on Play-less devices — browse fallback exists but untested); (d) low-end camera scan performance.
  - **Fix:** Run `eas build --platform android --profile preview` now and QA on a physical low-end Android plus an Android 16 (API 36) emulator: cold-start QR deep link + back button, 3-button-nav bottom insets, scan → order → rating end-to-end, offline banner, group ordering. Add an expo-router anchor (unstable_settings.initialRouteName or explicit back handling) if back-exits-app from deep links is deemed wrong.


## P1 — High (fix before/with launch; several are pre-submission)

_46 items._

- [ ] **6. No per-device-language permission strings: implement expo "locales" (InfoPlist.strings for fr/ar/en)**  
  `high` · add · effort M · _iOS/Android App Store compliance_ ✅verified
  - **Where:** `apps/mobile/app.json:19`, `apps/mobile/app.json:100`, `apps/mobile/src/lib/i18n.tsx:24`
  - **Problem:** The app UI localizes to the device language (src/lib/i18n.tsx deviceLanguage() → fr/ar/en), and CFBundleLocalizations declares all three. If the reviewer's device is English, the app renders in English but the camera/location prompts appear in French — arguably the same mismatch Apple rejected. No locales/ directory or InfoPlist.strings exist anywhere in apps/mobile. The single-French-string approach is a gamble; the robust fix is expo's top-level "locales" config, which generates {fr,ar,en}.lproj/InfoPlist.strings so iOS shows the prompt in the device language automatically.
  - **Fix:** Add to app.json: "locales": { "fr": "./locales/fr.json", "ar": "./locales/ar.json", "en": "./locales/en.json" }, each file containing translated NSCameraUsageDescription and NSLocationWhenInUseUsageDescription (reuse the pre-rejection trilingual copy, split per file). Keep the French strings in the plugin options as the base/fallback values. Optionally add CFBundleAllowMixedLocalizations: true to ios.infoPlist. Verify via prebuild that the .lproj folders are generated.

- [ ] **7. Universal links / App Links are dead in production: AASA and assetlinks return 404 (env vars never set on Vercel)**  
  `high` · fix · effort S · _iOS/Android App Store compliance_ ✅verified
  - **Where:** `apps/web/src/app/.well-known/apple-app-site-association/route.ts:9`, `apps/web/src/app/.well-known/assetlinks.json/route.ts:8`, `docs/mobile-submission.md:20`
  - **Problem:** Live checks: https://app.chehia.app/.well-known/apple-app-site-association → 404 'Not configured' (route returns 404 until APPLE_TEAM_ID is set — it never was, despite docs/mobile-submission.md:21 listing it as a required step and the Team ID 9KSK39WBM6 being known since submission). https://chehia.app/.well-known/... → 308 redirect to www.chehia.app then 404. assetlinks.json → 404 (ANDROID_CERT_SHA256 unset). Result: scanning a table QR with the iOS Camera app (or tapping any chehia link) opens Safari instead of the installed app, and Android autoVerify app links will fail verification at install time. The in-app scanner path used in the review notes still works (it parses the URL itself), but universal links are a core part of the QR product promise.
  - **Fix:** Set APPLE_TEAM_ID=9KSK39WBM6 (and optionally APPLE_BUNDLE_ID) on the Vercel production project and redeploy; confirm 200 + application/json with no redirect on app.chehia.app. For Android, after the first Play build, set ANDROID_CERT_SHA256 to the EAS upload key + Play app-signing key fingerprints. Validate with Apple's CDN check (https://app-site-association.cdn-apple.com/a/v1/app.chehia.app) and `adb shell pm verify-app-links`.

- [ ] **8. Permission strings not localized per device language (exact Guideline 4 rejection cause)**  
  `high` · fix · effort S · _Mobile app user flows, UX completeness & feature parity_ ✅verified
  - **Where:** `apps/mobile/app.json:14`, `apps/mobile/app.json:60`
  - **Problem:** apps/mobile/app.json declares CFBundleLocalizations [fr, ar, en] but ships a single French string for both NSCameraUsageDescription (expo-camera plugin: "Chehia utilise l'appareil photo…") and NSLocationWhenInUseUsageDescription (expo-location plugin). There is no `locales` key in app.json (verified absent), so no InfoPlist.strings are generated per language. Apple's rejection said the permission request must be in the same language as the app's localization; a reviewer on an English/Arabic device will again see a French system prompt inside an English/Arabic-localized app.
  - **Fix:** Add expo `locales` config: `"locales": { "fr": "./locales/fr.json", "ar": "./locales/ar.json", "en": "./locales/en.json" }` with each file providing NSCameraUsageDescription and NSLocationWhenInUseUsageDescription (matching the dictionary tone in packages/shared/src/i18n). Keep the French plugin strings as the CFBundleDevelopmentRegion=fr fallback. Rebuild and verify the prompt language flips with the simulator language.

- [ ] **9. Offline order queue has no expiry — a stale queued order can auto-submit days later**  
  `high` · fix · effort S · _Mobile app user flows, UX completeness & feature parity_ ✅verified
  - **Where:** `apps/mobile/src/lib/venue.tsx:527`, `apps/mobile/src/lib/venue.tsx:546`, `apps/mobile/src/lib/venue.tsx:600`
  - **Problem:** When placeOrder's fetch throws, the cart is moved into an AsyncStorage queue (venue.tsx ~line 527) and auto-retried whenever the venue screens are next mounted online (effect at lines 600-604). The QueuedPayload has no timestamp and retryQueued (lines 546-591) never checks age. A customer who queued an order on flaky café Wi-Fi, gave up and left will silently fire that order at the kitchen the next time they open the same venue route — possibly days later — creating a phantom order they are expected to pay for at the counter. The activeOrder pointer got a 4h TTL (ACTIVE_ORDER_TTL_MS, line 117) but the far more dangerous queue did not.
  - **Fix:** Store `queuedAt` in QueuedPayload; on hydrate/retry, drop queued orders older than ~30-60 minutes and surface an "order expired, items returned to your cart" state (reuse the existing rejection path that folds lines back via addLineBase). Also consider requiring an explicit confirm if the retry happens more than a few minutes after queueing.

- [ ] **10. Partial menu fetch failure renders an empty 'ready' menu and overwrites the good cache**  
  `high` · fix · effort S · _Mobile app user flows, UX completeness & feature parity_ ✅verified
  - **Where:** `apps/mobile/src/lib/venue.tsx:133`, `apps/mobile/src/lib/venue.tsx:275`
  - **Problem:** fetchMenu (venue.tsx:133-174) destructures only `data` from its four parallel queries and ignores `error`. supabase-js returns {data:null, error} on network failures rather than throwing, so if fetchRestaurant succeeds but the categories/items queries time out, the bundle resolves with 0 categories and 0 items, state becomes "ready", the customer sees an empty menu (the "no results" empty state), AND the provider immediately writes this empty bundle over a previously good AsyncStorage cache (line 275-278), destroying the offline fallback for next time.
  - **Fix:** Check `error` on all four fetchMenu queries and throw `new Error("network")` on any failure (same contract fetchRestaurant uses at line 185), so the existing catch falls back to the cached bundle instead of caching emptiness.

- [ ] **11. Permission strings not localized per device language (Guideline 4 rejection cause)**  
  `high` · fix · effort S · _mobile codebase quality_ ✅verified
  - **Where:** `apps/mobile/app.json:19-23`, `apps/mobile/app.json:111-122`
  - **Problem:** app.json declares CFBundleDevelopmentRegion=fr and CFBundleLocalizations=[fr,ar,en] (app.json:20-21), but the expo-camera and expo-location config plugins supply a single French string each (app.json:114, 120). iOS shows that one French string regardless of device language — an English or Arabic device sees a mismatch, which is exactly what Apple rejected under Guideline 4 (the previous trilingual concatenation was replaced by French-only, which is still not device-language-matched). Declaring CFBundleLocalizations without providing localized resources also looks inconsistent to review. There is no `locales` key in app.json and no locales/ directory.
  - **Fix:** Add the expo `locales` field to app.json (e.g. "locales": {"fr": "./locales/fr.json", "ar": "./locales/ar.json", "en": "./locales/en.json"}) with NSCameraUsageDescription and NSLocationWhenInUseUsageDescription in each, so EAS generates per-language InfoPlist.strings. Keep the plugin strings as the French base. Verify on an English-language simulator that the camera prompt appears in English before resubmitting.

- [ ] **12. Group sessions never expire and start_session silently reuses the previous party's session**  
  `high` · fix · effort M · _web customer app_ ✅verified
  - **Where:** `supabase/migrations/20260709000002_group_ordering.sql:209`, `apps/web/src/app/r/_venue/group/session-provider.tsx:141`, `apps/web/src/app/r/_venue/group/group-cart.tsx:173`
  - **Problem:** order_sessions has no TTL/cleanup and start_session ('Reuse an existing live session on this table') returns any status-open session for the table. If a party starts a group and walks away without tapping 'Quitter', the session stays open forever: the next party tapping 'Commander ensemble' on the same table is silently joined into the strangers' session (sees their nicknames and cart lines), and the host-place button is permanently blocked because allReady requires the ghost participants' is_ready. There is no host 'remove participant' either (group-cart.tsx offers only leave/ready).
  - **Fix:** Add lazy expiry: in start_session/join_session, close sessions older than ~3h (or with no cart/participant activity for ~1h) before reuse; optionally add a host-only kick RPC and surface it in GroupCart. Also consider a pg_cron cleanup for open sessions past the TTL.

- [ ] **13. Non-host group members never see the placed order — it just vanishes for them**  
  `high` · fix · effort M · _web customer app_ ✅verified
  - **Where:** `apps/web/src/app/r/_venue/group/session-provider.tsx:81`, `supabase/migrations/20260709000002_group_ordering.sql:414`, `apps/web/src/app/r/_venue/group/group-cart.tsx:70`
  - **Problem:** order_sessions stores no order_id and place_order_tx only flips status to 'placed'. When the host places, every other member's realtime refetch sees status !== 'open' and silently drops them back to solo (session-provider.tsx:81-85) — no confirmation, no navigation, and no way to track the order (orders RLS is keyed to created_by, i.e. the host). Members are left staring at the menu with the group banner gone, unsure whether the order was placed at all.
  - **Fix:** Add order_id to order_sessions (set inside place_order_tx), extend orders/order_items RLS so active session participants can read the session's order, and in session-provider route members to `${basePath}/order/${orderId}` (via rememberOrder) when the session flips to 'placed'.

- [ ] **14. Stale client_ref settles the wrong (outdated) order after the ticket is edited**  
  `high` · fix · effort S · _Business portal_ ✅verified
  - **Where:** `apps/web/src/app/caisse/caisse-provider.tsx:357`, `apps/web/src/app/caisse/caisse-provider.tsx:376`, `supabase/migrations/20260710000004_pos_review_fixes.sql:58`
  - **Problem:** clientRefRef is only reset by clearTicket, not when ticket contents change (addToTicket/setTicketQty at caisse-provider.tsx:357-363). Scenario: placeOrder succeeds, settleOrder fails (network/500), cashier closes the tender sheet, edits the ticket (adds an item), and checks out again. placeOrder reuses the same client_ref; register_order_tx returns the ORIGINAL order as a duplicate (20260710000004_pos_review_fixes.sql:57-67), so the kitchen never receives the added item and settle charges the old total, while the on-screen/printed receipt is built from the NEW ticket lines with mismatched server amounts.
  - **Fix:** Invalidate clientRefRef.current (and settleRefRef) whenever the ticket lines/qty change, or key the ref to a hash of the ticket contents. Optionally have register-order reject a duplicate whose line digest differs.

- [ ] **15. Caisse cannot cold-start offline — 'offline-first' only works within a running session**  
  `high` · fix · effort M · _Business portal_ ✅verified
  - **Where:** `apps/web/src/app/caisse/caisse-provider.tsx:255`, `apps/web/public/caisse-sw.js:1`
  - **Problem:** The service worker caches the app shell, but CaisseProvider.load() (caisse-provider.tsx:255-344) fetches staff, restaurant, menu, tables, fiscal from Supabase on every boot. If the tablet reloads (crash, tab eviction, restart) during an outage, the staff query fails and state becomes 'error' — the register renders an error screen and the cashier cannot ring any sale, defeating the offline queue entirely.
  - **Fix:** Persist a snapshot of {staff, restaurant, menu, tables, serviceTable, fiscal} in IndexedDB/localStorage on every successful load, and boot from the snapshot (with an 'offline data' banner) when the network load fails and a cached session exists.

- [ ] **16. Offline fallback keyed only on navigator.onLine — failed requests while 'online' never queue**  
  `high` · fix · effort S · _Business portal_ ✅verified
  - **Where:** `apps/web/src/app/caisse/_register/tender-sheet.tsx:57`, `apps/web/src/app/caisse/caisse-provider.tsx:391`
  - **Problem:** TenderSheet.confirm branches on the `online` flag (tender-sheet.tsx:57). navigator.onLine is notoriously wrong (captive portal, router up but WAN down, flaky 4G): in that state placeOrder/settleOrder throw, the cashier gets a 'network' error and the sale is simply not recorded — no offer to store it in the offline queue. The offline-first guarantee silently depends on the browser firing the offline event.
  - **Fix:** When placeOrder/settleOrder fail with code 'network' (fetch threw), fall back to queueSale (or prompt 'Réseau indisponible — enregistrer hors-ligne ?'). Consider a lightweight ping to set `online` rather than trusting navigator.onLine alone.

- [ ] **17. Dead-lettered offline sales have no reconciliation UI**  
  `high` · add · effort M · _Business portal_ ✅verified
  - **Where:** `apps/web/src/app/caisse/_register/offline-queue.ts:95`, `apps/web/src/app/caisse/_register/register.tsx:48`
  - **Problem:** Sales the server permanently rejects (or that exceed 8 attempts) are moved to the 'failed-sales' IndexedDB store 'for the cashier to reconcile' (offline-queue.ts:95-107), and the banner shows a count (register.tsx:48-57) — but there is no screen anywhere to view, retry, export, or clear them. Cash was physically collected for these sales; they are currently invisible dead money that also permanently pins the warning banner.
  - **Fix:** Add a 'Ventes non synchronisées' sheet (from the banner) listing failed sales with lines/total/reason and actions: retry, print copy, discard-with-confirmation. Expose allFailed()/removeFailed() from offline-queue.ts.

- [ ] **18. No order cancellation, void, or refund anywhere in the portal or POS**  
  `high` · add · effort L · _Business portal_ ✅verified
  - **Where:** `apps/web/src/app/business/orders/page.tsx:290`, `apps/web/src/app/business/use-live-orders.ts:172`, `apps/web/src/app/business/caisse/reports.tsx:79`
  - **Problem:** The live orders board and kitchen can only advance status (accept → served); there is no cancel action even though the whole backend is ready: orders.status supports 'cancelled', restock_cancelled_order + trigger return inventory (20260708000001_inventory.sql:397+), refunds table exists (20260710000001:158-172), and reports.tsx:79 hardcodes `refunds = 0 // refunds UI not yet issued`. A mistaken/abandoned order can never be removed: it inflates today's revenue, stats, and inventory depletion, and a settled sale can never be refunded.
  - **Fix:** Add 'Annuler' on order cards (owner/manager, with confirm + reason) writing status='cancelled', and a minimal refund flow (owner/manager) inserting into refunds via a guarded RPC so Z-reports and cash_session_report pick it up.

- [ ] **19. Owner/manager can self-upgrade plan and mutate platform-owned restaurant columns via direct PostgREST update**  
  `high` · fix · effort M · _Platform admin surface_ ✅verified
  - **Where:** `supabase/migrations/20260701000001_core_schema.sql:342`, `supabase/migrations/20260707000001_reviews.sql:152`, `apps/web/src/app/business/onboarding/page.tsx:66`
  - **Problem:** RLS policy "staff update own restaurant" (20260701000001_core_schema.sql:342-346) allows an owner/manager to UPDATE any column of their restaurants row. There is no column-level restriction and no guard trigger (only restaurants_updated_at exists). A venue owner can issue a raw PostgREST PATCH to set plan='pro' (free upgrade — plan is the only billing state the platform has), change slug (breaking every printed QR code and the admin's canonical /r/ link), or flip is_active / onboarding_completed_at. The onboarding wizard legitimately needs is_active + onboarding_completed_at writes (onboarding/page.tsx:66-68), but plan and slug are platform-admin-owned.
  - **Fix:** Add a BEFORE UPDATE trigger on restaurants (same pattern as reviews_staff_hide_only in 20260707000001_reviews.sql:152) that raises unless is_platform_admin() or auth.uid() is null when NEW.plan or NEW.slug is distinct from OLD — keeping the onboarding writes working. Apply to prod and dev.

- [ ] **20. Inventory auto-depletion dropped from customer orders in final place_order_tx**  
  `high` · fix · effort S · _database schema & security_ ✅verified
  - **Where:** `supabase/migrations/20260709000002_group_ordering.sql:379`, `supabase/migrations/20260708000001_inventory.sql:689`, `supabase/functions/place-order/index.ts:385`
  - **Problem:** Migration 20260708000001 (inventory) added a best-effort `perform public.deplete_inventory_for_order(...)` block to place_order_tx. Migration 20260709000002 (group ordering) then DROPPED the 8-arg function and recreated it with 11 args — without the depletion call. The place-order edge function does not call deplete_inventory_for_order either. Result: all customer orders (QR scan, browse, group, solo split) no longer deplete linked stock, never raise low-stock/out-of-stock notifications, and never trigger auto-86. Only POS register_order_tx (which kept the call) still depletes. The restock-on-cancel trigger still fires but finds no 'sale' movements, so it no-ops. This silently breaks the shipped inventory feature for the app's primary ordering flow.
  - **Fix:** New migration re-defining the 11-arg place_order_tx with the best-effort depletion sub-block (identical to register_order_tx's: begin/perform deplete_inventory_for_order(v_order.id, p_created_by)/exception when others then raise warning/end) inserted after the order_items insert. Add an integration test that places a customer order for a recipe-linked item and asserts a 'sale' stock_movement exists.

- [ ] **21. Group-session path bypasses require_qr and the server-enforced geofence entirely**  
  `high` · fix · effort M · _database schema & security_ ✅verified
  - **Where:** `supabase/migrations/20260709000002_group_ordering.sql:171`, `supabase/functions/place-order/index.ts:211`, `supabase/migrations/20260705000001_discovery_and_geo.sql:36`
  - **Problem:** start_session (20260709000002:171-243) accepts a bare p_table_id — table UUIDs are publicly enumerable via list_venue_tables(slug) — with no require_qr or location check. place-order then hardcodes `const origin = fromSession ? "scan" : ...` (index.ts:213), so ALL session orders skip both the require_qr gate (line 215) and the geofence gate (lines 226-243). Exploit: anonymous sign-in → start_session(p_table_id) from anywhere → insert session_cart_lines via direct RLS → place solo split with session_id → order accepted and stamped origin='scan', hiding its remote provenance from staff. This defeats the location-gated-ordering feature (documented as 'server-enforced') and the per-venue require_qr kill switch. Bonus abuse: the attacker occupies the table's single live session slot (unique index order_sessions_one_live_per_table) and becomes host of the session genuine QR-scanning diners are auto-joined into. Note no app code currently calls start_session with p_table_id (web/mobile pass p_qr_token only), so the path can be restricted without breaking clients.
  - **Fix:** Record provenance on order_sessions (e.g. started_from_qr boolean set true only for the p_qr_token path); in start_session reject the p_table_id path when the venue has require_qr or require_location set (or drop the p_table_id parameter entirely since nothing uses it); in place-order treat orders from non-QR sessions as origin 'browse' so the require_qr + geofence gates apply.

- [ ] **22. staff.pin_hash readable by all venue staff — register PIN offline-brute-forceable**  
  `high` · fix · effort S · _database schema & security_ ✅verified
  - **Where:** `supabase/migrations/20260710000002_staff_pin.sql:8`, `supabase/migrations/20260701000001_core_schema.sql:330`
  - **Problem:** 20260710000002 added pin_hash to public.staff. The SELECT policy "staff read own profile" (core schema :330-331) grants row access to EVERY colleague's staff row (`restaurant_id = staff_restaurant_id()`), and "platform read all staff" exposes it to admins; the default table-level SELECT grant includes all columns. A PIN is only 4-6 digits (≤1.11M candidates) and gen_salt('bf') uses default cost 6, so a waiter can SELECT the owner's pin_hash via PostgREST and crack it offline in minutes — defeating the exact threat the PIN exists for (protecting the till on a shared tablet from other staff).
  - **Fix:** Column-scope the grant: `revoke select on public.staff from authenticated; grant select (id, restaurant_id, auth_uid, role, display_name, is_active, created_at) on public.staff to authenticated;` — or move pin_hash to a separate policy-less table touched only by the SECURITY DEFINER set/verify functions. Optionally raise bcrypt cost (gen_salt('bf', 10)) and add attempt throttling in verify_my_pin.

- [ ] **23. Geofence and require_qr fully bypassable via group-ordering sessions**  
  `high` · fix · effort M · _Supabase edge functions_ ✅verified
  - **Where:** `supabase/functions/place-order/index.ts:213`, `supabase/migrations/20260709000002_group_ordering.sql:171`, `supabase/migrations/20260705000001_discovery_and_geo.sql:36`
  - **Problem:** place-order treats every session-based order as origin "scan" (place-order/index.ts:213: `const origin = fromSession ? "scan" : ...`), which skips BOTH the require_qr gate (line 215) and the server-side location gate (lines 226-243). But start_session (20260709000002_group_ordering.sql:171-243) accepts a bare p_table_id with no qr_token, no geofence check, and no require_qr check, and table ids are publicly enumerable via list_venue_tables (20260705000001_discovery_and_geo.sql:36-51, granted to anon). So any remote anonymous user can: list_venue_tables → start_session(table_id) (they become host), insert session_cart_lines via RLS, set_session_ready, then place-order with place_mode "group" — a fully remote order with zero presence proof, even at venues that set require_qr=true or require_location=true. This defeats the entire server-enforced promise of the location-gated ordering feature.
  - **Fix:** Either (a) require presence at session creation: make start_session accept table_id only together with a location proof, and re-check restaurant.require_qr (reject token-free start when set); or (b) stop classifying session orders as scan: record how the session was started (qr vs table_id) on order_sessions, and in place-order apply the same require_qr/geofence gates when the session was started token-free. Add an integration test that a token-free session order is rejected for a require_qr venue.

- [ ] **24. No CI pipeline at all — no .github/workflows directory exists**  
  `high` · add · effort M · _testing & CI_ ✅verified
  - **Where:** `package.json:8-11`, `.github/workflows (missing)`
  - **Problem:** The repo has no .github directory, no GitHub Actions, no pre-commit hooks, nothing. `pnpm -r lint / typecheck / test` exist as root scripts but nothing runs them automatically. This is how the integration suite silently rotted (see burst-limit finding): tests exist but nobody executes them on push. For an app heading to App Store 'final form' with money-handling POS code, unreviewed-by-machine merges to develop/main are the single biggest process risk.
  - **Fix:** Add .github/workflows/ci.yml triggered on PRs and pushes to develop/main, with concurrency cancel-in-progress. Jobs: (1) static — pnpm/action-setup@v4 (pnpm 10.6.1) + setup-node@v4 (node 20, cache: pnpm), `pnpm install --frozen-lockfile`, `pnpm -r lint`, `pnpm -r typecheck`, `pnpm --filter @chehia/shared test`; (2) web-build — `pnpm --filter @chehia/web build` with placeholder NEXT_PUBLIC_SUPABASE_URL/ANON_KEY env (catches Next.js RSC/build errors typecheck misses); (3) integration — supabase/setup-cli@v1, `supabase start` (applies migrations + seed.sql and serves edge functions at /functions/v1), export SUPABASE_URL + anon key from `supabase status -o env` into the job env, `pnpm --filter @chehia/integration test`; (4) edge-functions — denoland/setup-deno@v2 + `deno check supabase/functions/*/index.ts`. Total ~40 lines of YAML; the integration job is the one that would have caught the current breakage.

- [ ] **25. Integration suite very likely red: per-table burst limit (4 orders/90s) conflicts with hardening cap test that fires 6 orders at table T12**  
  `high` · fix · effort M · _testing & CI_ ✅verified
  - **Where:** `packages/integration/src/hardening.test.ts:61`, `supabase/functions/place-order/index.ts:261`, `packages/integration/src/order-flow.test.ts:36`
  - **Problem:** supabase/functions/place-order/index.ts:261-269 returns 429 rate_limited once a table has >=4 orders in the last 90 seconds (added in commit 2c21291 'order abuse controls'). packages/integration/src/hardening.test.ts:61-73 ('caps open orders per customer session at 5') places 6 consecutive orders on T12 and expects the first five to be 200 — but the three earlier tests in the same file (hardening.test.ts:15-59) already create 4 orders on T12 seconds before, so the loop's very first call should hit the table burst limit and return 429, failing the assertion. The tests predate the limit (2d5fdd1) and were never updated. Cascade risk: the burst check runs BEFORE item/modifier validation (place-order index.ts:246-270 vs items load at :272+), so order-flow.test.ts expectations of 400 missing_required_modifier / 409 item_unavailable / 200 pricing can all come back 429 when run within 90s of the hardening file. I could not execute the suite (read-only audit) so verify with one run of `pnpm test:integration` — but statically the conflict is unambiguous.
  - **Fix:** Fix both sides: (a) give the abuse tests their own isolation — seed 2-3 dedicated test tables (e.g. demo-elmarsa-t13/t14) and use a fresh table per rate-limit test, and/or have hardening tests advance prior orders to 'served' via staffClient so they leave the open-order window; (b) for the per-session cap test specifically, the 6-order loop inherently violates the 4-per-90s table limit — either spread lines across two tables or add an env-gated bypass (e.g. RATE_LIMIT_TABLE_WINDOW_MS override read from Deno.env, set only in supabase/config.toml local functions env) so the cap-of-5 behavior stays testable. Then wire the suite into CI so drift like this fails the build.

- [ ] **26. Group ordering has zero tests: 8 SQL RPCs + the place-order fromSession path are completely uncovered**  
  `high` · add · effort M · _testing & CI_ ✅verified
  - **Where:** `supabase/migrations/20260709000002_group_ordering.sql:171-379`, `supabase/functions/place-order/index.ts:150-172`
  - **Problem:** Migration 20260709000002_group_ordering.sql defines start_session, join_session, set_session_ready, set_session_nickname, leave_session, gen_session_code, clean_nickname, is_session_member and a rewritten place_order_tx, plus 3 new tables (order_sessions, session_participants, session_cart_lines) with RLS. place-order/index.ts:150-172 has a whole fromSession branch (reads session_cart_lines, solo vs group placeMode, skips the per-table burst limit). Nothing in packages/integration touches any of it (grep for group_session/join_group/start_session: no hits; cart.test.ts's 'group' matches are modifier groups). This is a multi-user state machine with security surface (session codes are capabilities, membership gates cart reads) — the highest-risk untested feature in the repo.
  - **Fix:** Add packages/integration/src/group-ordering.test.ts covering: start_session returns a join code; join_session with valid/bogus/expired code; clean_nickname sanitization; non-member cannot select session_cart_lines (RLS); set_session_ready round-trip; leave_session (incl. host leaving); place-order with session_id in 'group' mode aggregates all participants' lines and in 'solo' mode only the caller's; a session order is exempt from the per-table burst limit (place-order index.ts:259-260 claims this — assert it); empty session cart returns 400 empty_cart.

- [ ] **27. Caisse POS money path untested: register_order_tx, settle_order_tx, cash sessions, PIN, shifts, and the anon-lockdown migration have no coverage**  
  `high` · add · effort M · _testing & CI_ ✅verified
  - **Where:** `supabase/migrations/20260710000004_pos_review_fixes.sql:28`, `supabase/migrations/20260710000001_pos_money_fiscal.sql:382-460`, `supabase/migrations/20260710000005_pos_rpc_anon_lockdown.sql:28`, `supabase/functions/register-order`, `supabase/functions/settle-order`
  - **Problem:** Migrations 20260710000001-5 define register_order_tx, settle_order_tx (rewritten in ...0004_pos_review_fixes.sql:28,114), open_cash_session, close_cash_session, cash_session_report, set_my_pin/verify_my_pin/my_pin_is_set, clock_in/clock_out/my_open_shift, and ...0005 revokes EXECUTE from anon/public on all POS RPCs. Zero integration tests exist for any of it (grep register-order/settle-order in packages/integration: no hits). This is the code that counts real cash: settle idempotency, tender/change math, cash-drawer variance at session close, and the anon lockdown are all unverified — and the offline queue's whole correctness story ('both idempotent, so a re-drain can't double-post') rests on the untested idempotency of these two RPCs.
  - **Fix:** Add packages/integration/src/pos.test.ts: (1) anon + anonymous-customer clients get permission errors on every POS RPC (locks in migration ...0005); (2) staff registers an order with frozen lines then settles it — totals, payment row, change math; (3) replay register-order with the same client_ref and settle-order with the same settle_ref/paid_at → same order id, no duplicate payment (this is the offline-drain guarantee); (4) register replays FROZEN prices even after the menu price changes mid-flight; (5) open_cash_session → sales → close_cash_session: cash_session_report expected-vs-counted variance is correct; (6) set_my_pin then verify with right/wrong PIN; cross-tenant staff cannot settle another venue's order.

- [ ] **28. apps/web lint fails: 4 errors (react-hooks/purity + react-hooks/refs)**  
  `high` · fix · effort M · _Build health: does the repo build clean right now_ ✅verified
  - **Where:** `apps/web/src/app/caisse/_register/cash-drawer.tsx:174`, `apps/web/src/app/caisse/caisse-provider.tsx:732`, `apps/web/src/app/caisse/caisse-provider.tsx:674`, `apps/web/src/app/r/_venue/cart-screen.tsx:113`, `apps/web/src/app/r/_venue/rating-sheet.tsx:36`
  - **Problem:** Run directly (`pnpm --filter @chehia/web lint`), eslint exits 1 with 4 errors. (1) caisse/_register/cash-drawer.tsx 174:35 — `Date.now()` called during render of ShiftSection to compute shift duration (react-hooks/purity); the displayed duration also never ticks, it only updates on unrelated re-renders. (2) caisse/caisse-provider.tsx 732:36 — react-hooks/refs flags reading `value` during render; `value` is the useMemo context value (line 674) which closes over callbacks (placeOrder/settleOrder) that read clientRefRef/settleRefRef (lines 376-414), so the compiler taints the memo as ref-derived. (3) r/_venue/cart-screen.tsx 113:3 — `submitRef.current = submit` assigned during render (the 'latest ref' pattern, intentional per the comment about idempotent auto-retry, but it violates the rule as written). (4) r/_venue/rating-sheet.tsx 36:8 — `if (!clientRef.current) clientRef.current = crypto.randomUUID()`; the rule only permits the lazy-init pattern with an explicit `== null` check on a null-initialized ref.
  - **Fix:** cash-drawer.tsx: compute the duration in state driven by a 1-minute interval effect (also fixes the frozen duration display). rating-sheet.tsx: change the ref to `useRef<string | null>(null)` and use `if (clientRef.current == null) clientRef.current = crypto.randomUUID()` — the rule explicitly allows that form. cart-screen.tsx: move `submitRef.current = submit` into a `useEffect(() => { submitRef.current = submit; })`, or use a small useLatest helper implemented with an effect. caisse-provider.tsx: the memo itself is fine — the taint comes from ref-reading callbacks; ensure those refs are only read inside the event-handler callbacks (they are) and if the rule still fires after the other fixes, add a targeted eslint-disable with a justification comment rather than leaving the whole package red.

- [ ] **29. SHIP PLAN (ordered) — the only undeployed surface is the mobile app; sequence everything toward EAS build 3**  
  `high` · organize · effort L · _branch/environment divergence & ship-state_ ✅verified
  - **Where:** `docs/app-store-review/review-reply.md:101`, `apps/mobile/eas.json:1`, `apps/mobile/app.json:1`
  - **Problem:** Deploy-state matrix, verified against Vercel + Supabase MCP: (1) a9eb57c Caisse POS — web (caisse.* + /business/caisse), 5 migrations (pos_money_fiscal, staff_pin, staff_shifts, pos_review_fixes, pos_rpc_anon_lockdown) + register-order/settle-order edge fns: ALL applied/deployed to dev AND prod, Vercel prod READY. (2) b5ccacf location gating — web + mobile + migration location_gating + place-order enforcement: migration on dev+prod, web live, place-order v7 live on PROD too (sha matches dev; memory note claiming prod enforcement was pending is stale). (3) e09b828 mobile themes+group-ordering port — mobile-only, ships via EAS not Vercel; in NO store build. (4) ce1c36b install prompts — web-only, live on prod. PLAN: 1) sync local main (git fetch && git branch -f main origin/main) — nothing to merge; 2) prod hygiene: un-gate cafe-el-marsa (blocker above), delete diag-provision fn, reconcile generate-insights; 3) set APPLE_TEAM_ID + ANDROID_CERT_SHA256 on Vercel so AASA/assetlinks serve; 4) mobile pre-build code: expo ios 'locales' permission-string localization, per-theme status-bar style, decide supportsTablet; 5) on-device QA pass (list in separate finding); 6) eas build --platform ios --profile production (autoIncrement → build 3) → eas submit → ASC: attach demo QR PNG, fill §A notes, post §B reply, resubmit; 7) independent of the store: caisse thermal-printer/drawer hardware QA + caisse SW cold-boot verify on prod; 8) housekeeping: refresh docs+memory, align migration ledgers, add CI.
  - **Fix:** Execute in this order; steps 2–4 are cheap and must land BEFORE the EAS build so the resubmission binary and the prod environment are consistent. Do not fast-forward anything else to main until the mobile QA in step 5 passes.

- [ ] **30. Pending on-device QA inventory blocking the EAS build (unQA'd features would ship in the resubmission binary)**  
  `high` · add · effort L · _branch/environment divergence & ship-state_ ✅verified
  - **Where:** `apps/mobile/src/lib/theme.ts:1`, `apps/mobile/src/lib/session.tsx:1`, `apps/mobile/src/lib/location-gate.tsx:1`, `apps/mobile/src/components/venue/location-gate.tsx:1`
  - **Problem:** The resubmission build will carry every unverified mobile change at once: (a) e09b828 — runtime venue theming (esp. dark 'nocturne'; known gap: no per-theme status-bar style so dark themes get dark icons on dark background), 5 category-landing layouts + subcategories + RTL, two-device group-session realtime sync, solo-split ordering; (b) b5ccacf mobile location gate — idle/locating/ok/far/denied/unsupported states, coords persisted into the offline queue, discover 'order here' badge; (c) ratings sheet post-served flow (shipped to prod backend 2026-07-06 but never run in a release build); (d) still-open runtime smoke from 2026-07-04: camera permission flows, RTL rendering, near-me prompt; (e) Apple reviewed on iPad Air 11" M3 — the app is supportsTablet:false (iPhone compatibility mode) and has never been checked on an iPad simulator. Caisse (web-only by design) separately needs real-hardware QA: ESC/POS WebUSB print + cash-drawer kick, and service-worker cold-boot on prod.
  - **Fix:** Run a scripted QA pass on iOS simulator (idb automation per chehia-project-setup memory) + one physical device + iPad Air simulator in compatibility mode, covering the list above, BEFORE eas build. Track results; fix the status-bar gap first since it is already known. Caisse hardware QA can run in parallel — it does not gate the App Store.

- [ ] **31. Mobile app has zero crash reporting — a production crash on a customer/reviewer device leaves no trace**  
  `high` · add · effort M · _observability-ops-readiness_ ⚠ gap-round (single-pass)
  - **Where:** `apps/mobile/package.json:5`, `apps/mobile/src/app/_layout.tsx:27`, `apps/mobile/app.json:100`
  - **Problem:** apps/mobile/package.json has no @sentry/react-native, sentry-expo, expo-insights, or any telemetry dep; apps/mobile/src/app/_layout.tsx mounts no error boundary and no ErrorUtils.setGlobalHandler; a grep for console.error/console.warn across apps/mobile/src returns ZERO hits — even caught failures are invisible. In a release build, any uncaught JS error is fatal: the app closes instantly with no branded screen and the only artifact is an opt-in Apple crash log whose native frames don't contain the JS stack. Given the App Store rejection was reproduced on an iPad Air the team doesn't own, resubmitting build 3 blind means a reviewer-side crash cannot be diagnosed. There is also no expo-updates/EAS Update channel (absent from package.json and app.json), so even after diagnosing a JS bug the only remedy is a full store review cycle.
  - **Fix:** Ship @sentry/react-native (sentry-expo is deprecated) with its config plugin in EAS build 3: init in _layout.tsx, wrap the Stack in Sentry's error boundary (or an expo-router ErrorBoundary export) showing a branded trilingual retry screen, and upload source maps via the EAS build hook. Consider adding expo-updates at the same time so JS-level incident fixes don't need a store review. Verify crash symbolication with a deliberate test crash in a preview build before submitting.

- [ ] **32. No server or client error on the web app ever reaches an operator — no instrumentation.ts, no onRequestError, no Sentry, no log drain**  
  `high` · add · effort M · _observability-ops-readiness_ ⚠ gap-round (single-pass)
  - **Where:** `apps/web/next.config.ts:1`, `apps/web/src/app/layout.tsx:1`
  - **Problem:** apps/web has no instrumentation.ts and next.config.ts contains no error-reporting wiring; grep for console.error across apps/web/src returns zero hits and no telemetry package is installed. There is no vercel.json (no log drain, no cron, no config). Consequence: a server exception in any RSC/route, a client exception in the business portal, or a failed Supabase call surfaces only in Vercel's runtime logs, which nobody watches and which expire quickly (1 h on Hobby, ~1 day on Pro without a drain). The team literally cannot answer 'did any café hit an error yesterday?'.
  - **Fix:** Add @sentry/nextjs: instrumentation.ts with the onRequestError hook for server errors, client init for browser errors, and alert rules to a Telegram/Slack 'Chehia Ops' channel. Cheaper interim: a 20-line instrumentation.ts whose onRequestError POSTs {route, digest, message} to a webhook. If on Vercel Pro, also enable Observability error-rate notifications and a log drain for retention.

- [ ] **33. Business portal, Caisse, and admin have no error.tsx and there is no global-error.tsx — crashes show Next's unbranded English error page**  
  `high` · fix · effort M · _observability-ops-readiness_ ⚠ gap-round (single-pass)
  - **Where:** `apps/web/src/app/r/[slug]/(browse)/error.tsx:6`, `apps/web/src/app/caisse/layout.tsx:1`, `apps/web/src/app/not-found.tsx:1`
  - **Problem:** The only error boundaries in apps/web are the two customer-venue ones (apps/web/src/app/r/[slug]/(browse)/error.tsx and .../t/[token]/error.tsx). An uncaught render error anywhere under /business, /caisse, /admin, or /app (discovery) shows Next's default 'Application error: a client-side exception has occurred' white page — unbranded, English-only, with no retry — on the paying-business surface, including the POS mid-service. A root-layout error similarly falls through because there is no global-error.tsx. These boundaries are also the natural client-side reporting hook, so their absence doubles as an observability gap.
  - **Fix:** Add error.tsx for the /business, /caisse, /admin, and /app segments (Caisse's must preserve the offline-queue context and offer 'reprendre la caisse') plus a root global-error.tsx, all reusing the existing trilingual VenueError pattern; call the error reporter from each boundary's useEffect.

- [ ] **34. Caisse dead-lettered cash sales exist only in device-local IndexedDB — collected money can vanish with no server record, no reconciliation UI, and nobody paged**  
  `high` · add · effort L · _observability-ops-readiness_ ⚠ gap-round (single-pass)
  - **Where:** `apps/web/src/app/caisse/_register/offline-queue.ts:96`, `apps/web/src/app/caisse/caisse-provider.tsx:478`, `apps/web/src/app/caisse/_register/register.tsx:48`
  - **Problem:** When the offline drain hits a permanent 4xx or MAX_ATTEMPTS=8 (apps/web/src/app/caisse/caisse-provider.tsx:478–512), the sale — for which cash was already physically collected — is moved to the 'failed-sales' IndexedDB store (offline-queue.ts:96) on that one browser. The only surfacing is a count in a banner (register.tsx:48–53); there is no screen to view, export, retry, or manually re-enter failed sales, they are excluded from the cash-session Z-report (drawer will count over vs. records with no explanation), no server-side copy exists, and no human is alerted. Browser storage eviction (Safari ITP, user clearing site data, tablet replacement) silently destroys both pending and failed sales. Realistic trigger: owner deactivates a table or a staff account while the register is offline → every queued sale dead-letters as unknown_table/not_staff.
  - **Fix:** Three layers: (1) on dead-letter, fire-and-forget POST the full frozen sale to a server-side caisse_sync_failures table via a service endpoint that accepts anything (so the record survives the device); (2) build a 'Ventes non synchronisées' reconciliation screen in the Caisse (list, reason, retry, export CSV, mark-resolved) and include the failed total as a labelled discrepancy line in the cash-session report; (3) alert the ops webhook when a venue accumulates any dead-lettered sale. Also alert/pause at high attempt counts instead of only at 8.

- [ ] **35. Edge-function money paths fail with console.error only — no alert webhook, and Supabase log retention is ~1 day**  
  `high` · add · effort M · _observability-ops-readiness_ ⚠ gap-round (single-pass)
  - **Where:** `supabase/functions/place-order/index.ts:405`, `supabase/functions/register-order/index.ts:277`, `supabase/functions/settle-order/index.ts:113`, `supabase/functions/submit-review/index.ts:167`, `supabase/functions/_shared/cors.ts:1`
  - **Problem:** Every revenue-critical failure is logged to console and dropped: place-order tx failure (supabase/functions/place-order/index.ts:405) loses a customer order; register-order tx failure (register-order/index.ts:277) loses a counter sale; settle-order tx failure (settle-order/index.ts:113) records an order but not its payment; submit-review tx failure (submit-review/index.ts:167) drops a review; submit-lead failures drop sales leads; call-waiter failures leave a customer waiting. Supabase function logs are dashboard-only with ~1-day retention on lower tiers and no alerting, so a systematic breakage (e.g., a migration renaming place_order_tx args) would go unnoticed until a café complains — every 500 in that window is lost revenue with no record of what was attempted.
  - **Fix:** Add supabase/functions/_shared/report.ts: a fire-and-forget fetch to ALERT_WEBHOOK_URL (Telegram/Slack) with {function, code, message, restaurant_id}; call it at every errorResponse(..., 500) site and wrap each handler in a top-level try/catch that reports uncaught throws. Set the secret on both projects. Longer term, also write failed payloads to an ops table so lost orders can be replayed.

- [ ] **36. generate-insights and inventory-alerts depend on a cron that is not committed anywhere — the features may silently never run**  
  `high` · fix · effort M · _observability-ops-readiness_ ⚠ gap-round (single-pass)
  - **Where:** `supabase/config.toml:395`, `supabase/functions/inventory-alerts/index.ts:70`, `README.md:157`, `docs/inventory.md:67`
  - **Problem:** Both functions authenticate via x-cron-secret and are documented as 'invoked by cron' (supabase/config.toml:395, 424; inventory-alerts/index.ts:70–75), but there is NO cron.schedule in any migration, no pg_cron extension setup, no vercel.json cron, and no .github/workflows at all. README.md:157 and docs/inventory.md:67–81 relegate scheduling to a manual dashboard step with no way to verify it was done on prod (wpnouppukofzmvsieyeq) or dev. If it wasn't, nightly insights and low-stock email digests simply never fire — and even if it was, a cron that stops (secret rotated, pg_net failure, function renamed) fails silently forever.
  - **Fix:** Commit a migration that enables pg_cron + pg_net and schedules both functions (secret read from Vault), so the schedule is reproducible per environment. Add a dead-man switch: each successful run pings a healthchecks.io check (free), which pages the ops channel if a night is missed. Have each run's summary (venues processed, emails sent, errors) posted to the ops webhook.

- [ ] **37. No backup/PITR/restore documentation for either Supabase project — a POS with an undefined RPO**  
  `high` · add · effort M · _observability-ops-readiness_ ⚠ gap-round (single-pass)
  - **Where:** `docs/inventory.md:70`, `README.md:150`, `apps/mobile/eas.json:26`
  - **Problem:** grep for backup/PITR/restore across docs/, README.md, and supabase/config.toml finds nothing (the only 'restore' hit is about stock restocking, README.md:118). The repo never states which plan prod (wpnouppukofzmvsieyeq) is on: on Free there are NO backups at all; on Pro, daily backups give a worst-case 24-hour RPO — meaning a café's entire live order day (orders, payments, cash_sessions — real collected money) can be unrecoverable. There is no restore runbook, no statement of RPO/RTO, and no second copy of the data outside Supabase. Schema is reproducible from supabase/migrations, but the data is not.
  - **Fix:** Verify prod's plan and enable PITR (RPO ≈ 2 min) before real cafés run their tills on it; write docs/ops/backup-restore.md covering: plan/PITR status for both projects, the exact dashboard/CLI restore procedure, what a restore does to Realtime/edge functions/secrets, and a quarterly restore drill into a scratch project. Add an independent nightly pg_dump (GitHub Action with the connection string in secrets) to encrypted storage as an off-provider copy.

- [ ] **38. No uptime monitoring or incident runbook for any of the four SPOFs (three Vercel hosts + Supabase)**  
  `high` · add · effort M · _observability-ops-readiness_ ⚠ gap-round (single-pass)
  - **Where:** `apps/web/src/app/.well-known/apple-app-site-association/route.ts:1`, `README.md:159`
  - **Problem:** chehia.app, app.chehia.app (every printed QR resolves here), business.chehia.app (order dashboard + Caisse), and the Supabase API/Realtime are each a single point of failure, and nothing checks any of them — docs/ contains only app-store-review/, google-auth.md, inventory.md, mobile-submission.md; there is no vercel.json, no health endpoint (the only route handlers are the two .well-known files), and no runbook. An outage during Friday lunch service would be discovered by café phone calls, and there is no documented response: who is on call, how to check Vercel vs Supabase status, how to tell cafés to fall back to paper.
  - **Fix:** Minimal setup (≈1 hour, free tier): (1) add /api/health in apps/web that does a 1-row anon Supabase read, exercising both Vercel and the DB; (2) BetterStack/UptimeRobot checks on the three hosts + /api/health + one edge-function OPTIONS ping, 1–3 min interval, alerting phone + the ops Telegram channel; (3) docs/ops/runbook.md: escalation contact, status.vercel.com / status.supabase.com triage order, known failure modes (Realtime down → refresh dashboard; Supabase down → Caisse keeps selling offline, customer QR ordering is down — inform venues), and a post-incident checklist including draining Caisse queues.

- [ ] **39. No Content-Security-Policy on any surface; XSS equals full staff/admin takeover because sessions live in localStorage**  
  `high` · add · effort M · _web-http-security-headers-host-scoping_ ⚠ gap-round (single-pass)
  - **Where:** `apps/web/next.config.ts:13`, `apps/web/src/proxy.ts:19`, `apps/web/src/lib/supabase.ts:49`, `apps/web/src/app/business/settings/location-picker.tsx:114`
  - **Problem:** There is no CSP anywhere: apps/web/next.config.ts:13 has no headers() config, there is no vercel.json, and apps/web/src/proxy.ts:19-59 sets no response headers. Meanwhile apps/web/src/lib/supabase.ts:49-57 creates the browser client with persistSession:true (supabase-js default localStorage — the declared @supabase/ssr cookie flow is never used), so the business owner's and platform admin's access+refresh tokens sit in localStorage as sb-<ref>-auth-token, readable by any injected script. The customer surfaces render venue-controlled strings (menu names, categories, order notes) and the portal renders customer-supplied review text, so an injection anywhere on a shared origin exfiltrates staff sessions; the Caisse PIN lock is client-side state and offers no protection against script. External origins are few and known: the two Supabase projects (https + wss), OSM tiles at *.tile.openstreetmap.org (apps/web/src/app/business/settings/location-picker.tsx:114), and self-hosted next/font — so a tight connect-src/img-src is actually achievable here.
  - **Fix:** Add a CSP in proxy.ts (it already runs on every page route and knows the host). Start Report-Only for a week, then enforce: default-src 'self'; script-src 'self' 'unsafe-inline' (Next's inline runtime; migrate to nonces later); style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org; connect-src 'self' https://wpnouppukofzmvsieyeq.supabase.co https://sxmbqwldtqkkmlfbjyzc.supabase.co wss://wpnouppukofzmvsieyeq.supabase.co wss://sxmbqwldtqkkmlfbjyzc.supabase.co; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'. Tighten connect-src per deploy env (prod bundle only needs the prod project).

- [ ] **40. POS register, admin panel and business portal are clickjackable — no X-Frame-Options or frame-ancestors**  
  `high` · add · effort S · _web-http-security-headers-host-scoping_ ⚠ gap-round (single-pass)
  - **Where:** `apps/web/src/proxy.ts:19`, `apps/web/next.config.ts:13`
  - **Problem:** No response anywhere carries X-Frame-Options or a frame-ancestors directive (no headers() in apps/web/next.config.ts, no vercel.json, nothing in apps/web/src/proxy.ts). Any site can iframe business.chehia.app/caisse, /admin, or /business and overlay UI to make a logged-in cashier/owner/admin click real buttons — the register mutates money-bearing state (orders, payments, shifts) and the admin panel provisions businesses. Vercel does not add frame protection for you.
  - **Fix:** Set Content-Security-Policy: frame-ancestors 'none' plus X-Frame-Options: DENY (legacy fallback) on every response, in proxy.ts or next.config headers(). This is a two-line change independent of the full CSP rollout — ship it first.

- [ ] **41. proxy.ts remaps only '/': /admin, /business, /caisse and /auth are served on the customer host, apex, www, and every Vercel preview URL**  
  `high` · fix · effort M · _web-http-security-headers-host-scoping_ ⚠ gap-round (single-pass)
  - **Where:** `apps/web/src/proxy.ts:41`, `apps/web/src/proxy.ts:61`, `apps/web/src/lib/supabase.ts:93`
  - **Problem:** apps/web/src/proxy.ts:41-58 returns NextResponse.next() for every non-root path regardless of host, by design ('Only the ROOT path is remapped per host'). Consequences in production: (1) app.chehia.app/admin/login, chehia.app/caisse, www.chehia.app/business/login all render and work — staff who log in on the customer origin put their staff session token into localStorage on the origin with the largest untrusted-content attack surface, exactly where an XSS hurts most (see CSP finding); (2) plausible-looking phishing URLs on the trusted customer domain (app.chehia.app/admin/login) render the real login screen; (3) the Supabase OAuth redirect allowlist must stay wide open to four-plus origins because signInWithGoogle (apps/web/src/lib/supabase.ts:93-101) uses window.location.origin; (4) preview deployments expose all portals publicly with prod-identical UI. The matcher (proxy.ts:61-66) correctly exempts .well-known/sitemap/robots, so host scoping added here won't break AASA.
  - **Fix:** In proxy.ts, when process.env.VERCEL_ENV === 'production', scope prefixes to their hosts: /admin only on admin.chehia.app (or your chosen admin host), /business and /caisse only on business.chehia.app (+ caisse.chehia.app), /auth only on the portal hosts, and /r + /app + landing on apex/app. Rewrite wrong-host requests to the not-found page (404, not redirect, so the surfaces are undiscoverable). Keep current path-based behavior for preview/localhost. Then shrink the Supabase redirect-URL allowlist to just the real portal origins.

- [ ] **42. AASA / assetlinks handlers have no Cache-Control and 404 silently when build-time env is missing — Apple's CDN caches the failure**  
  `high` · fix · effort S · _web-http-security-headers-host-scoping_ ⚠ gap-round (single-pass)
  - **Where:** `apps/web/src/app/.well-known/apple-app-site-association/route.ts:6`, `apps/web/src/app/.well-known/assetlinks.json/route.ts:5`, `apps/mobile/app.json:15`
  - **Problem:** apps/web/src/app/.well-known/apple-app-site-association/route.ts:6-12 returns 404 'Not configured' unless APPLE_TEAM_ID is set, and Response.json() with no explicit Cache-Control. The GET handler uses no request APIs, so Next prerenders it at build time — whatever APPLE_TEAM_ID was at build is frozen into the deploy, and a missing var means production publishes a 404 with default caching. Apple's swcd CDN fetches AASA roughly once per day-to-week per device and caches negatives, so a 404 window prolongs the already-broken universal-link situation well past the fix. Same pattern in assetlinks.json/route.ts:5-12 for Android App Links. Content-Type (application/json) and payload shape (appIDs teamId.tn.chehia.app, components /r/*) are correct and match apps/mobile/app.json (bundleIdentifier tn.chehia.app, applinks:chehia.app + applinks:app.chehia.app); the proxy matcher correctly exempts .well-known so the file is reachable on both associated hosts.
  - **Fix:** 1) Verify APPLE_TEAM_ID (and ANDROID_CERT_SHA256 once EAS keys exist) are set in Vercel production env and that the deployed https://app.chehia.app/.well-known/apple-app-site-association returns 200 JSON today. 2) Return the payload with explicit headers { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600, must-revalidate' } and give the 404 branch 'Cache-Control: no-store' so a misconfigured deploy isn't cached. 3) Consider failing the production build (throw during build) when APPLE_TEAM_ID is absent instead of silently serving 404, since universal links are core to the QR flow Apple will review.

- [ ] **43. Full Play Data Safety enumeration is documented nowhere — several collected data types beyond location**  
  `high` · add · effort M · _google-play-android-readiness_ ⚠ gap-round (single-pass)
  - **Where:** `docs/mobile-submission.md:41`, `supabase/functions/submit-review/index.ts:133`, `apps/mobile/src/lib/session.tsx:171`, `apps/mobile/src/components/venue/rating-sheet.tsx:195`
  - **Problem:** docs/mobile-submission.md:41-46 covers only orders + location + camera, and docs/app-store-review/ is Apple-only. The actual Play Data Safety form must declare: (1) Location — precise + approximate, collected, ephemeral, optional (see blocker above); (2) Personal info > Name — optional reviewer first name (apps/mobile/src/components/venue/rating-sheet.tsx:195 → supabase/functions/submit-review/index.ts:19,133 stores up to 40 chars) and group-order nicknames (apps/mobile/src/components/venue/group/group-sheet.tsx:124-139 → src/lib/session.tsx:171-190, persisted in session_participants); (3) Other user-generated content — review comments (rating-sheet.tsx:171) and free-text order notes (place-order/index.ts:388, up to 500 chars, stored); (4) Purchases > Purchase history — order contents/table/timestamps stored per anonymous session; (5) Device or other IDs — the anonymous Supabase auth user id + client_ref persisted in AsyncStorage and attached to every order. Camera frames are processed on-device only → correctly NOT declared. Security section: encrypted in transit (yes, HTTPS), deletion via contact@aframat.com, no user-created account so the account-deletion-URL requirement doesn't apply.
  - **Fix:** Write a docs/play-submission.md with the exact Data Safety answers above (category, collected/shared, ephemeral, optional/required, purpose) so the form can be filled accurately and consistently with the privacy policy. Keep it in sync with the Apple App Privacy answers.

- [ ] **44. Privacy policy omits location transmission, reviews, and group nicknames — must match the Data Safety form**  
  `high` · fix · effort S · _google-play-android-readiness_ ⚠ gap-round (single-pass)
  - **Where:** `apps/web/src/app/legal/privacy/page.tsx:23`, `apps/mobile/src/app/about.tsx:40`
  - **Problem:** apps/web/src/app/legal/privacy/page.tsx:23-29 lists only orders, staff accounts, contact requests and localStorage. It says nothing about: device location sent to verify presence for remote orders (the geofence feature), review ratings/comments/first names, group-session nicknames, or camera usage (on-device only). Google cross-checks the Data Safety form against the linked privacy policy (this URL is what app.json's About screen and the Play listing will point to, apps/mobile/src/app/about.tsx:40); a policy that contradicts or omits declared collection is itself a violation. It also affects the Apple resubmission, since the same URL is the App Privacy policy link.
  - **Fix:** Add sections: 'Position de l'appareil' (transmitted only when ordering remotely at a venue that requires presence; used solely for the distance check; never stored), 'Avis' (note optionnelle, prénom optionnel, modérés par l'établissement), 'Commandes de groupe' (pseudonyme visible par les autres participants), and camera-on-device wording. Consider AR/EN versions since the app ships those languages.

- [ ] **45. CAMERA permission without uses-feature required=false filters camera-less devices off Play despite a working no-camera flow**  
  `high` · add · effort S · _google-play-android-readiness_ ⚠ gap-round (single-pass)
  - **Where:** `node_modules/expo-camera/plugin/build/withCamera.js:29`, `apps/mobile/app.json:87`, `apps/mobile/src/app/index.tsx:51`
  - **Problem:** expo-camera 57.0.0 only adds the permission: node_modules/expo-camera/android/src/main/AndroidManifest.xml declares uses-permission CAMERA, and its config plugin (node_modules/expo-camera/plugin/build/withCamera.js:29-33) adds no <uses-feature>. Android therefore implies android.hardware.camera AND android.hardware.camera.autofocus with required=true, so Google Play hides the app from devices without a back camera — Chromebooks, many tablets, front-camera-only devices. That's wasted reach: the browse flow (apps/mobile/src/app/index.tsx:152-158 'Find a restaurant') delivers the full order experience with zero camera, and the scan screen already degrades gracefully on denial (index.tsx:51-64 cameraBlocked → Settings + browse fallback).
  - **Fix:** Add a tiny config plugin (withAndroidManifest) in apps/mobile that injects <uses-feature android:name="android.hardware.camera" android:required="false"/> and <uses-feature android:name="android.hardware.camera.autofocus" android:required="false"/>. After the first AAB upload, confirm in Play Console > Device catalog that Chromebooks/tablets are not excluded.

- [ ] **46. Play Console launch prerequisites undocumented: App access notes, IARC rating, target audience, 512px icon, 1024x500 feature graphic**  
  `high` · add · effort M · _google-play-android-readiness_ ⚠ gap-round (single-pass)
  - **Where:** `docs/mobile-submission.md:15`, `docs/app-store-review/review-reply.md:1`, `apps/mobile/eas.json:26`
  - **Problem:** docs/mobile-submission.md:15 covers only 'create the app + service account'; everything else Play requires before review is unwritten and no assets exist in the repo: (1) App content > App access — Play's equivalent of the Apple reviewer notes (docs/app-store-review/review-reply.md is Apple-only): declare 'all functionality available without special access' and paste the demo path (Find a restaurant → Café El Marsa, plus the demo QR PNG); this also lets Google's pre-launch robo-crawler exercise the flow, so the demo venue must exist in the PROD Supabase project the production build points at (eas.json:26). (2) Content rating (IARC questionnaire) → Everyone. (3) Target audience — pick 18+ (or 13+) and do NOT tick appeal-to-children, else Families policy applies. (4) Ads declaration: none. (5) Store listing assets: 512×512 icon, 1024×500 feature graphic (mandatory), ≥2 phone screenshots, 7"/10" tablet screenshots (recommended — tablets are not excludable on Play); none exist under apps/mobile/assets. (6) Default listing language fr-FR with ar and en localizations.
  - **Fix:** Create docs/play-submission.md walking through each Play Console section with paste-ready FR/AR/EN copy (the store-listing text at docs/mobile-submission.md:32-39 is a good base), and produce the icon/feature-graphic/screenshot assets once an Android build exists.

- [ ] **47. Personal Play accounts require a 12-tester / 14-day closed test before production — verify account type now**  
  `high` · add · effort S · _google-play-android-readiness_ ⚠ gap-round (single-pass)
  - **Where:** `docs/mobile-submission.md:15`, `apps/mobile/eas.json:38`
  - **Problem:** Google Play requires personal developer accounts created after Nov 13, 2023 to run a closed test with at least 12 opted-in testers continuously for 14 days before they can apply for production access. docs/mobile-submission.md:15 mentions only the $25 account creation, and eas.json:38-41 targets the internal track (max 100 testers, fine as the first upload) — but internal-track time does NOT count toward the closed-testing requirement. If the Chehia account is (or will be) a personal account, this adds a hard 2+ week runway plus tester recruitment before any public launch; organization accounts are exempt.
  - **Fix:** Confirm whether the Play account is personal or organization. If personal, plan: internal track for smoke test → promote to a closed track immediately → recruit 12+ testers (staff of pilot cafés are ideal) → start the 14-day clock in parallel with iOS resubmission. Document this timeline in docs/play-submission.md.

- [ ] **48. Verified App Links dead until ANDROID_CERT_SHA256 exists — scanned QR codes open the browser, not the app (checklist carry-over)**  
  `high` · fix · effort S · _google-play-android-readiness_ ⚠ gap-round (single-pass)
  - **Where:** `apps/web/src/app/.well-known/assetlinks.json/route.ts:6`, `apps/mobile/app.json:65`, `docs/mobile-submission.md:20`
  - **Problem:** Previously flagged, recorded here because it belongs on the Play pre-launch checklist with its Android consequence spelled out: app.json:68 sets autoVerify:true, but apps/web/src/app/.well-known/assetlinks.json/route.ts:6 serves nothing until ANDROID_CERT_SHA256 is set on Vercel. On Android 12+, failed verification means https://chehia.app/r/... and app.chehia.app links NEVER open the app — every table QR scanned with the system camera goes to the mobile web app instead of the installed app, silently killing the native app's core acquisition flow. The fingerprints only exist after the first EAS Android build (upload key) and Play app-signing enrollment (app-signing key), so this is inherently post-first-build work that is easy to forget. Related: the over-matching pathPrefix '/r' (app.json:73) was already reported separately.
  - **Fix:** After the first Android build: `eas credentials -p android` for the upload-key SHA-256, Play Console > Setup > App signing for the app-signing SHA-256, set both (comma-separated) as ANDROID_CERT_SHA256 on Vercel for chehia.app and app.chehia.app, then verify with `adb shell pm get-app-links tn.chehia.app`. Add this to the release checklist in docs.

- [ ] **49. No pg_cron anywhere: zero data retention AND the two nightly functions (generate-insights, inventory-alerts) never fire — one migration fixes all of it**  
  `high` · add · effort M · _data-lifecycle-retention-growth_ ⚠ gap-round (single-pass)
  - **Where:** `supabase/functions/generate-insights/index.ts:233`, `supabase/functions/inventory-alerts/index.ts:70`, `supabase/migrations/20260701000001_core_schema.sql:226`
  - **Problem:** grep for pg_cron|cron.schedule across supabase/ returns nothing. Consequences: (a) generate-insights (supabase/functions/generate-insights/index.ts:233-238, expects x-cron-secret) and inventory-alerts (supabase/functions/inventory-alerts/index.ts:70-75) are dead code in production — no insights, no low-stock digests; (b) no table is ever cleaned: waiter_calls, ai_insights, ai_extractions, ai_menu_imports, notifications, order_sessions/participants/cart_lines, leads and anonymous auth.users all grow forever. Growth per active venue/day at ~150 orders: orders ~150, order_items ~400, payments ~150, stock_movements ~300 (biggest ledger, ~110k rows/yr/venue), waiter_calls ~30, ai_insights up to 9 (3 cards x 3 languages, each embedding the full metrics jsonb), sessions ~10 + 30 participants + 60 cart lines, plus ~tens of new permanent anonymous auth.users. Retention matrix: KEEP FOREVER (fiscal/master data — Tunisian accounting docs need 10yr): restaurants, staff, tables, categories/items/modifiers, restaurant_fiscal, orders, order_items, payments, refunds, order_discounts, cash_movements, cash_sessions, receipt_sequences (bounded: 1 row/venue/yr), staff_shifts, reviews, inventory_items, item_ingredients. DELETE-AFTER-N: waiter_calls 90d; ai_insights 90d (dashboard reads only latest 3 — apps/web/src/app/business/stats/page.tsx:52-57); ai_extractions 180d (rate limit only needs a 10-min window — extract-menu/index.ts:34-35); ai_menu_imports 180d; notifications 90d (or read+30d); order_sessions+cascade 30d after close; anonymous auth.users 30d with zero orders; leads: anonymize/delete per the leads finding. ARCHIVE-AFTER-N (idea): stock_movements 24mo.
  - **Fix:** Add one migration, e.g. supabase/migrations/2026XXXXXXXXXX_pg_cron_retention.sql: (1) `create extension if not exists pg_cron;` + `create extension if not exists pg_net;`. (2) Store the function URL + INSIGHTS_CRON_SECRET in Vault, then `select cron.schedule('nightly-insights','15 2 * * *', $$select net.http_post(url:=…/functions/v1/generate-insights, headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='cron_secret')), body:='{}'::jsonb)$$);` and the same at '0 3 * * *' for inventory-alerts (pg_cron runs in UTC; 02:15 UTC ≈ 03:15 Africa/Tunis). (3) A `public.data_retention_tick()` SECURITY DEFINER function scheduled daily ('30 3 * * *') doing: close stale group sessions (status in ('open','placing') and created_at < now()-interval '12 hours'); delete closed/placed order_sessions older than 30d (cascades participants + cart_lines; first `create index orders_session_idx on orders(session_id) where session_id is not null` so the FK SET NULL doesn't seq-scan orders); delete waiter_calls > 90d; delete ai_insights where generated_for < current_date - 90; delete ai_extractions > 180d; delete ai_menu_imports > 180d; delete notifications > 90d; batch-delete anonymous users (see anon-user finding). Wrap each statement so one failure doesn't abort the rest.

- [ ] **50. Anonymous auth.users rows are permanent and unbounded — every new device/browser that orders mints one forever, inflating the billable MAU metric**  
  `high` · add · effort M · _data-lifecycle-retention-growth_ ⚠ gap-round (single-pass)
  - **Where:** `apps/web/src/lib/supabase.ts:75`, `apps/mobile/src/lib/supabase.ts:33`, `supabase/migrations/20260701000001_core_schema.sql:178`, `supabase/migrations/20260707000001_reviews.sql:21`, `supabase/migrations/20260709000002_group_ordering.sql:41`
  - **Problem:** apps/web/src/lib/supabase.ts:75 and apps/mobile/src/lib/supabase.ts:33 call supabase.auth.signInAnonymously(). Mitigating: the call is lazy (only at cart/waiter-call/rating/group-join time — apps/web/src/app/r/_venue/cart-screen.tsx:61, waiter-sheet.tsx:44, rating-sheet.tsx:65, group/session-provider.tsx:104), not on page view. But QR-scanning walk-ins ARE the business model: every distinct browser profile, cleared-localStorage visit, or private-browsing session that acts creates a new permanent auth.users row (plus auth.sessions/refresh_tokens rows). After 12 months a modest 20-venue deployment plausibly holds 100k+ anonymous users, all counting toward Supabase's MAU billing when active and bloating auth queries/dashboard. There is no cleanup anywhere. FK behavior verified for safe deletion: orders.created_by (core_schema.sql:178) and waiter_calls.created_by (core_schema.sql:215) are ON DELETE SET NULL — order history survives; ai_extractions.requested_by and stock_movements.created_by are SET NULL; session_participants.auth_uid has NO FK (group_ordering.sql:41) so deletes never error; BUT reviews.created_by is ON DELETE CASCADE (20260707000001_reviews.sql:21) — deleting a user with approved reviews silently deletes the reviews and drops the venue's public rating (the aggregate trigger recomputes on DELETE). Since submit-review requires an owned served order, review ⇒ order, so the criterion 'zero orders' also guarantees zero reviews.
  - **Fix:** Add to data_retention_tick() the Supabase-documented anonymous-user sweep, batched to avoid long locks: `delete from auth.users u where u.is_anonymous and u.created_at < now() - interval '30 days' and not exists (select 1 from public.orders o where o.created_by = u.id) and u.id in (select id from auth.users where is_anonymous and created_at < now() - interval '30 days' limit 1000);` (loop or run daily; 30 days comfortably exceeds the 30-day review window in platform_reviews_config). Optionally a second, longer tier (e.g. 12-18 months inactive even WITH orders) — if adopted, first migrate reviews.created_by to ON DELETE SET NULL (drop NOT NULL) so cascades can't erase public ratings. Document that a deleted user's device transparently re-mints a session on next action.

- [ ] **51. Group-ordering sessions never expire — an abandoned 'open' session is re-served to the NEXT customers at that table (stale strangers' cart lines included), and session rows grow forever**  
  `high` · fix · effort S · _data-lifecycle-retention-growth_ ⚠ gap-round (single-pass)
  - **Where:** `supabase/migrations/20260709000002_group_ordering.sql:22`, `supabase/migrations/20260709000002_group_ordering.sql:210`, `supabase/migrations/20260709000002_group_ordering.sql:415`, `supabase/migrations/20260709000002_group_ordering.sql:65`
  - **Problem:** order_sessions has no TTL (20260709000002_group_ordering.sql:22-31): a session only closes when the last participant explicitly calls leave_session() or a placement flips it. People who just close the browser leave the session 'open' forever. Because of the one-live-per-table unique index (group_ordering.sql:34-35) and start_session()'s reuse logic (`select id … where table_id = … and status in ('open','placing')`, group_ordering.sql:210-211), tomorrow's customers at that table are silently joined into YESTERDAY'S session, seeing stale participants and stale cart lines from strangers — a correctness/privacy problem, not just growth. Growth angle: order_sessions, session_participants, and session_cart_lines rows are never deleted; group placement (place_order_tx p_place_mode='group', group_ordering.sql:415-421) flips status to 'placed' but does NOT delete the session_cart_lines, so every placed group order permanently retains its full cart-line set (~60 lines/venue/day). All three tables are also in the realtime publication (group_ordering.sql:76-78). orders.session_id (group_ordering.sql:65-66) has NO index, so a future bulk delete of sessions will seq-scan orders once per session for the ON DELETE SET NULL.
  - **Fix:** In data_retention_tick(): (1) `update order_sessions set status='closed', closed_at=now() where status in ('open','placing') and created_at < now() - interval '12 hours';` — this alone fixes the stale-reuse bug; (2) `delete from order_sessions where status in ('closed','placed') and coalesce(closed_at, created_at) < now() - interval '30 days';` (cascades participants + cart lines); (3) `create index orders_session_idx on public.orders (session_id) where session_id is not null;` before any deletes. Consider also deleting a session's cart lines at group placement time inside place_order_tx (they are already snapshotted into order_items).


## P2 — Medium (should fix; schedule right after submission)

_115 items._


### iOS/Android App Store compliance

- [ ] **52. chehia.app apex 308-redirects to www.chehia.app — AASA on the apex can never serve, and www is missing from associatedDomains + Android intent filters**  
  `medium` · fix · effort S · _iOS/Android App Store compliance_
  - **Where:** `apps/mobile/app.json:15`, `apps/mobile/app.json:65`, `apps/web/src/lib/site.ts:6`
  - **Problem:** Vercel's domain config redirects the apex to www (curl: chehia.app/ → 308 https://www.chehia.app/). Apple requires the AASA file to be served with 200 directly, no redirects — so `applinks:chehia.app` in app.json can never activate as configured. Meanwhile `applinks:www.chehia.app` is absent from associatedDomains and www.chehia.app is absent from the Android intentFilters hosts, so any /r/... link that lands on www (which is where every apex link ends up) will never open the app. This also contradicts apps/web/src/lib/site.ts SITE_URL='https://chehia.app' used as the SEO canonical.
  - **Fix:** Preferred: flip the Vercel primary domain so chehia.app is primary and www redirects to it (matches SITE_URL/sitemap canonicals and lets the apex AASA serve). Alternatively add applinks:www.chehia.app to associatedDomains and a www.chehia.app entry to the Android intentFilters. Either way, re-verify all three hosts' AASA after fixing the env vars.

- [ ] **53. iPad compatibility mode asserted in the review reply but never QA'd — Apple explicitly reviewed on iPad Air 11" M3**  
  `medium` · enhance · effort M · _iOS/Android App Store compliance_
  - **Where:** `apps/mobile/app.json:14`, `docs/app-store-review/review-reply.md:60`, `apps/mobile/src/app/index.tsx:77`
  - **Problem:** supportsTablet:false + orientation:portrait means the app runs in iPhone compatibility mode on iPad, which Apple permits, but the rejection note said apps downloadable on iPad must function as expected there, and review-reply.md §B asserts 'it also runs and functions on iPad in iPhone-compatibility mode' without anyone having verified it. Code review is reassuring — no Dimensions.get/useWindowDimensions assumptions, flex-based layouts, safe-area insets used, camera via expo-camera which works in compat mode — but the QR-scan camera flow, the 240px scan frame overlay, and keyboard/RTL behavior should be eyeballed on a real or simulated iPad before resubmitting.
  - **Fix:** Run the production-like build on an iPad simulator (browse flow) and once on a physical iPad if available (camera flow). If it looks cramped, consider a fast-follow supportsTablet:true release (requires iPad screenshots in ASC and layout QA) — not needed for this resubmission. Keep the honest one-line justification already in the reply.

- [ ] **54. Resubmission versioning works but is fragile: local appVersionSource + autoIncrement mutates app.json at build time**  
  `medium` · enhance · effort S · _iOS/Android App Store compliance_
  - **Where:** `apps/mobile/eas.json:4`, `apps/mobile/eas.json:23`, `apps/mobile/app.json:13`, `apps/mobile/app.json:57`
  - **Problem:** ios.buildNumber is "2" — the rejected build. eas.json has cli.appVersionSource:"local" and autoIncrement:true on the production profile, so the next `eas build --profile production` bumps app.json to buildNumber 3 (and android versionCode 2) and writes the file locally — Apple's new-build requirement is satisfied automatically. But this relies on the bumped app.json being committed after every build (a forgotten commit on another machine reuses numbers) and triggers interactive prompts in CI. Note android versionCode (1) and ios buildNumber (2) have already drifted, which local-source autoIncrement perpetuates.
  - **Fix:** Either accept and document 'commit app.json after every production build' in review-reply.md's Build section, or switch to "appVersionSource": "remote" (EAS stores/increments versions server-side; run `eas build:version:set` once to seed ios=2/android=1 so the next build is 3/2).

- [ ] **55. Privacy manifest declares zero collected data while submission docs say orders+session are collected — align manifest, ASC label, and docs**  
  `medium` · fix · effort S · _iOS/Android App Store compliance_
  - **Where:** `apps/mobile/app.json:26`, `docs/mobile-submission.md:42`
  - **Problem:** app.json privacyManifests has NSPrivacyCollectedDataTypes: [] and NSPrivacyTracking: false. docs/mobile-submission.md:42 says App Privacy answer is 'order contents + table (linked to an anonymous session id)'. Order contents sent to your server are plausibly 'Purchase History' (collected, not linked to identity, App Functionality) in Apple's taxonomy. If the ASC nutrition label declares any collection, the empty manifest contradicts it (and vice versa if the label says 'Data Not Collected'). Apple is increasingly cross-checking manifests against labels. The required-reason API entries (UserDefaults CA92.1, FileTimestamp C617.1, SystemBootTime 35F9.1, DiskSpace E174.1) look correct for AsyncStorage/Expo.
  - **Fix:** Decide the canonical answer once: if you declare Purchase History (not linked, app functionality) in ASC, add the matching NSPrivacyCollectedDataTypes entry (NSPrivacyCollectedDataTypePurchaseHistory, linked=false, tracking=false, purpose App Functionality). If you keep 'Data Not Collected', get comfortable that anonymous-session orders qualify as not-collected (they likely don't, since they're stored server-side). Update docs to match whichever you pick.

- [ ] **56. Pre-resubmission To-Do: demo venue must exist and be active in PROD (QR itself is verified correct)**  
  `medium` · add · effort S · _iOS/Android App Store compliance_
  - **Where:** `docs/app-store-review/review-reply.md:45`, `docs/app-store-review/demo-qr-cafe-el-marsa-table-12.png`, `packages/shared/src/deeplink.ts:27`, `apps/mobile/src/app/index.tsx:159`
  - **Problem:** I decoded docs/app-store-review/demo-qr-cafe-el-marsa-table-12.png with CoreImage: it encodes exactly https://app.chehia.app/r/cafe-el-marsa/t/demo-elmarsa-t12, matching the review notes, parseTableUrl's regex, the mobile route file structure (src/app/r/[slug]/t/[token]/), and the web route (live URL returns HTTP 200). review-reply.md:45 itself flags the remaining dependency: the venue 'cafe-el-marsa' with table token 'demo-elmarsa-t12' must be active with a real menu in the PRODUCTION Supabase project, or the reviewer scans into an 'invalid' state. Also note the mobile __DEV__ demo shortcut button (index.tsx:159) correctly won't appear in the production build, so the QR/browse paths are the only reviewer entries.
  - **Fix:** Before clicking Resubmit: open the decoded URL on a phone against prod and place a test order end-to-end; verify the venue appears in 'Trouver un restaurant' (Option B fallback). Seed it via admin portal or SQL if missing.

- [ ] **57. To-Do: App Store Connect age-rating questionnaire update due Sept 7 2026 — and decide the UGC answer given ratings/reviews**  
  `medium` · add · effort S · _iOS/Android App Store compliance_
  - **Where:** `docs/mobile-submission.md:38`
  - **Problem:** Apple's expanded age-rating questionnaire (new social-media/UGC questions) must be answered by Sept 7 2026 or the app becomes unsubmittable. Nothing in the repo tracks this. Relevant wrinkle: the shipped ratings & reviews feature is user-generated content surfaced to other users (admin-approval moderation already exists, which is the right answer for Guideline 1.2), so the questionnaire's UGC questions should be answered 'yes, with pre-moderation' rather than 'no UGC' — inconsistent answers vs visible app behavior is a rejection vector.
  - **Fix:** Add a dated To-Do to docs/mobile-submission.md; when completing the questionnaire, declare UGC=yes with human pre-moderation (admin approval), no user-to-user communication, no ads. Expected outcome remains 4+/Everyone.


### Mobile app user flows, UX completeness & feature parity

- [ ] **58. Network failure with no cache shows 'invalid QR' instead of a network error**  
  `medium` · fix · effort M · _Mobile app user flows, UX completeness & feature parity_
  - **Where:** `apps/mobile/src/lib/venue.tsx:296`, `apps/mobile/src/components/venue/venue-home.tsx:31`
  - **Problem:** VenueProvider's load catch falls back to the cached bundle, but when no cache exists it sets state "invalid" (venue.tsx:296). VenueHome then renders t.landing.invalidQr ("Ce code QR n'est pas valide") for the scanned flow or t.discover.noResults for browse (venue-home.tsx:31-63). A first-time customer scanning a perfectly valid QR on flaky café Wi-Fi is told the QR is broken — and there is no retry affordance, only "back to scan". The dictionary already has t.errors.network/networkBody for this case.
  - **Fix:** Add a third VenueState (e.g. { status: "error" }) set when the load threw (vs. resolved null), and render a network-error screen with a Retry button in VenueHome; keep "invalid" only for genuine not-found.

- [ ] **59. Keyboard covers inputs in RatingSheet, GroupSheet and WaiterSheet on iOS**  
  `medium` · fix · effort S · _Mobile app user flows, UX completeness & feature parity_
  - **Where:** `apps/mobile/src/components/venue/rating-sheet.tsx:170`, `apps/mobile/src/components/venue/group/group-sheet.tsx:124`, `apps/mobile/src/components/venue/waiter-sheet.tsx:128`
  - **Problem:** Three bottom-anchored Modals contain TextInputs but no KeyboardAvoidingView: RatingSheet's comment + name inputs (rating-sheet.tsx:170-210, at the very bottom of the sheet), GroupSheet's nickname/code inputs (group-sheet.tsx:124-149) and WaiterSheet's "other" note (waiter-sheet.tsx:128-147). On iOS the keyboard slides over the bottom sheet, hiding both the input being typed into and the submit CTA — a first-order flow break for rating submission and group join. CartScreen already wraps in KeyboardAvoidingView (cart-screen.tsx:140), so the pattern exists in-repo.
  - **Fix:** Wrap each sheet's content in KeyboardAvoidingView (behavior="padding" on iOS), as cart-screen.tsx does, and verify the submit button stays visible with the keyboard up on a small iPhone and iPad compatibility mode.

- [ ] **60. Group order placement strands non-host guests with no link to the placed order**  
  `medium` · enhance · effort L · _Mobile app user flows, UX completeness & feature parity_
  - **Where:** `apps/mobile/src/lib/session.tsx:104`, `apps/mobile/src/components/venue/group/group-cart.tsx:52`
  - **Problem:** When the host places the group order, the session status flips and every other member's realtime refetch drops session to null (session.tsx:104-106); GroupCart then returns null (group-cart.tsx:52), so guests' sheet silently vanishes with no confirmation, no order number and no way to track the shared order or know what to pay. Only the host is navigated to tracking. The web app has the identical gap, so this is a shared design hole rather than a porting bug — but on a table of 4 it means 3 people get zero feedback that the order went in.
  - **Fix:** Persist the placed order id on order_sessions (e.g. placed_order_id column returned in the session select) so members' refetch can detect "placed" and navigate/offer a link to `${basePath}/order/{id}` (order RLS may need to admit session participants), or at minimum show a "the host placed the group order" confirmation state instead of silently closing.

- [ ] **61. Parity gap: no pre-submit cart reconcile (web has reconcileNow)**  
  `medium` · fix · effort S · _Mobile app user flows, UX completeness & feature parity_
  - **Where:** `apps/mobile/src/lib/venue.tsx:341`, `apps/mobile/src/components/venue/cart-screen.tsx:92`, `apps/web/src/app/r/_venue/cart-screen.tsx:82`
  - **Problem:** Web's cart calls reconcileNow() before placing (apps/web/src/app/r/_venue/cart-screen.tsx:82, venue-provider.tsx:238) to re-price lines and drop vanished items against the live menu. Mobile reconciles exactly once per mount post-hydration (venue.tsx:341-358, reconciledRef) and never again, even though realtime item updates keep mutating bundle.items. A customer who lingers on the menu/cart while the venue edits prices or 86's an item sees a displayed total that differs from what the server charges, or hits an avoidable item_unavailable rejection at submit.
  - **Fix:** Port reconcileNow to the mobile VenueProvider and call it at the top of CartScreen.submit (and when the cart screen gains focus), surfacing the same "cart updated" notice as web when lines changed.

- [ ] **62. Cached (offline) menu never refreshes when connectivity returns**  
  `medium` · fix · effort S · _Mobile app user flows, UX completeness & feature parity_
  - **Where:** `apps/mobile/src/lib/venue.tsx:262`, `apps/mobile/src/lib/venue.tsx:401`
  - **Problem:** The venue load effect runs once per mount (venue.tsx:262-302). If the app cold-starts offline it serves the cached bundle (fromCache=true), which also disables the realtime items subscription (readyRestaurantId guard, line 401) and cart reconciliation (line 343). When Wi-Fi comes back, the customer stays on the stale menu — stale prices, stale availability — until they navigate out of the venue and back. The provider already tracks `online` via NetInfo, so the trigger exists.
  - **Fix:** In VenueProvider, when `online` flips true while state.fromCache is true, re-run the network load (and keep the cached view until it succeeds).

- [ ] **63. Queued-order outcome is invisible outside the cart screen**  
  `medium` · enhance · effort M · _Mobile app user flows, UX completeness & feature parity_
  - **Where:** `apps/mobile/src/lib/venue.tsx:573`, `apps/mobile/src/components/venue/cart-screen.tsx:51`, `apps/mobile/src/components/venue/menu-screen.tsx:193`
  - **Problem:** The auto-retry of a queued order runs in VenueProvider on reconnect (venue.tsx:600-604). If the server permanently rejects it (item sold out, table gone), the lines are silently folded back into the cart (venue.tsx:573-580) — but the only UI for the queue (banner + error copy) lives in CartScreen. A customer sitting on the menu screen after queueing believes their order was sent; nothing tells them it bounced. Success is similarly quiet unless the cart happens to be open (queuedPlacedOrderId navigation, cart-screen.tsx:51-57), though rememberOrder does at least surface the active-order pill on the menu.
  - **Fix:** Show a queued-order chip on MenuScreen (next to the active-order banner) reflecting queued/placed/rejected, or fire a haptic + inline banner when the background retry resolves either way.

- [ ] **64. Parity gap: venue landing lacks the active-order banner web shows**  
  `medium` · add · effort S · _Mobile app user flows, UX completeness & feature parity_
  - **Where:** `apps/mobile/src/components/venue/venue-home.tsx:270`, `apps/web/src/app/r/_venue/venue-home.tsx:72`
  - **Problem:** Web's VenueHome renders ActiveOrderBanner (apps/web/src/app/r/_venue/venue-home.tsx:72) so a customer who re-scans the QR or reopens the venue landing immediately sees "return to your order". Mobile's VenueHome has no such banner — the affordance only exists on MenuScreen (menu-screen.tsx:193-223). A customer who cold-starts back into the landing after backgrounding must first tap through to the menu to find their in-flight order.
  - **Fix:** Render the same activeOrder pill in mobile VenueHome between the table card and the language switch, reusing the MenuScreen block.

- [ ] **65. Location purpose string omits the geofenced-ordering use**  
  `medium` · fix · effort S · _Mobile app user flows, UX completeness & feature parity_
  - **Where:** `apps/mobile/app.json:70`, `apps/mobile/src/lib/location-gate.tsx:78`
  - **Problem:** locationWhenInUsePermission says location is used "pour afficher les cafés et restaurants à proximité", but the app also uses location to verify the customer is physically at a venue before allowing a remote order (location-gate.tsx request(), coords sent to place-order in venue.tsx:477-487). Apple expects purpose strings to cover all uses; an incomplete string is a soft 5.1.1 risk, especially now that reviewers are already scrutinizing this app's permission UX.
  - **Fix:** Extend the string (in all three locales once the locales fix lands) to mention both discovery and on-site order verification, e.g. "…afficher les restaurants à proximité et confirmer que vous êtes sur place pour commander."

- [ ] **66. No production in-app demo path for the App Review reviewer**  
  `medium` · add · effort S · _Mobile app user flows, UX completeness & feature parity_
  - **Where:** `apps/mobile/src/app/index.tsx:159`, `docs/app-store-review/review-reply.md`
  - **Problem:** The one-tap demo entry (Café El Marsa · Table 12 → /r/cafe-el-marsa/t/demo-elmarsa-t12) is gated behind __DEV__ (index.tsx:159-167), so the store build's reviewer path is exactly: read review notes → display docs/app-store-review/demo-qr-cafe-el-marsa-table-12.png on a second screen → scan. That works (the scanned flow needs no account, bypasses the location gate, and the whole order loop is anonymous), but it is fragile: if the reviewer skips the notes they land on a scanner + a discovery list of real Tunisian venues where remote ordering to real kitchens is possible (browse flow) unless each venue enabled require_location. Guideline 2.1(a) was already raised once.
  - **Fix:** Two options: (a) surface the demo venue prominently in discovery (e.g. a pinned "Try the demo" card in production, or always-visible demo button on the scan home), and/or (b) ensure the review notes include both the QR image and a literal fallback: open "Find a restaurant" → Café El Marsa → Table 12. Separately confirm the demo venue + token exist and are active in the prod database, and consider what protects real venues from reviewer/stranger test orders in the browse flow.


### mobile codebase quality

- [ ] **67. iPad behavior unverified; supportsTablet:false while Apple reviews on iPad Air 11" M3**  
  `medium` · fix · effort M · _mobile codebase quality_ ✅verified
  - **Where:** `apps/mobile/app.json:14`, `apps/mobile/src/app/index.tsx:66-110`
  - **Problem:** app.json:14 sets supportsTablet:false, so the app runs on iPad in iPhone-compatibility mode. Apple's rejection explicitly noted apps downloadable on iPad must function as expected there, and the reviewer used an iPad Air 11" M3. Compatibility mode is permitted, but the QR camera flow, bottom-sheet modals (maxHeight percentages), and the 280px venue hero have never been QA'd in the letterboxed iPad window, and the permission-language issue above compounds on the review device.
  - **Fix:** Either (a) keep supportsTablet:false but explicitly QA the full scan→order→track flow on an iPad Air simulator in compatibility mode, or (b) set supportsTablet:true and verify layouts at tablet sizes (the flex-based layouts will mostly stretch; the two-column card grid and 240px scan frame need a look). Option (a) is the smallest change for resubmission; document the choice in docs/app-store-review/.

- [ ] **68. First-time scan with no connectivity shows "Invalid QR" instead of a network error**  
  `medium` · fix · effort S · _mobile codebase quality_
  - **Where:** `apps/mobile/src/lib/venue.tsx:279-297`, `apps/mobile/src/components/venue/venue-home.tsx:31-63`
  - **Problem:** VenueProvider's load effect treats every thrown fetch error as a cache-fallback case; when there is no cached menu (a customer's very first scan at a venue with bad café Wi-Fi), it sets state "invalid" (venue.tsx:279-297). VenueHome then renders t.landing.invalidQr — "this QR code is invalid" — for what is actually a network failure, with no retry affordance (venue-home.tsx:31-63). fetchRestaurant/fetchScannedBundle already distinguish network throws from genuine not-found (venue.tsx:176-212), so the information is available; it is discarded at the state level. The dictionary already has t.errors.network/networkBody copy used by the order screen.
  - **Fix:** Add a third state (e.g. { status: "error" }) set when the fetch threw and no cache existed, and render network copy + a Retry button in VenueHome (mirroring the discover.tsx loadError pattern at discover.tsx:251-266). Keep "invalid" only for genuine not-found.

- [ ] **69. No production error boundary — an uncaught render error hard-crashes the app**  
  `medium` · add · effort S · _mobile codebase quality_
  - **Where:** `apps/mobile/src/app/_layout.tsx:27`, `apps/mobile/src/lib/venue.tsx:703-708`
  - **Problem:** No route exports ErrorBoundary and the root layout has no error handling (grep for ErrorBoundary across src/ returns nothing). Expo Router's default error boundary is development-only; in a release build an uncaught exception in any screen (e.g. an unexpected shape in a cached bundle, or useVenue()'s deliberate throw at venue.tsx:705 if a guard is ever missed) crashes to the springboard. For an app being scrutinized by App Review, one crash on the reviewer's device is a rejection.
  - **Fix:** Export an ErrorBoundary from src/app/_layout.tsx (branded "something went wrong" screen with a retry that calls the provided retry()), and optionally per-venue-flow boundaries in the two [slug] layouts. This is ~30 lines including trilingual copy already available in t.errors.

- [ ] **70. React Compiler experiment enabled with the babel plugin undeclared in any package.json**  
  `medium` · fix · effort S · _mobile codebase quality_
  - **Where:** `apps/mobile/app.json:124-127`, `apps/mobile/package.json:38-42`
  - **Problem:** app.json:126 sets experiments.reactCompiler:true. babel-plugin-react-compiler@1.0.0 is present only via pnpm's automatic peer installation (it appears in pnpm-lock.yaml but in no package.json in the repo), so the toolchain works today by accident of lockfile state — a fresh install with different pnpm settings, or a lockfile regeneration, can silently drop it and change build output. Separately, the compiler on React Native is still an experiment; the codebase already hand-memoizes everything (useMemo/useCallback throughout venue.tsx, session.tsx), so the compiler's upside here is small relative to the risk of a miscompile shipping in the store build.
  - **Fix:** At minimum add babel-plugin-react-compiler to apps/mobile devDependencies to pin it explicitly. Consider disabling the experiment for the v1.0 store submission (the app is fully hand-memoized) and re-enabling after approval when you can soak-test it.

- [ ] **71. Menu/venue photos use bare RN Image: no disk cache, no downscaling, no transition**  
  `medium` · enhance · effort S · _mobile codebase quality_
  - **Where:** `apps/mobile/src/components/ui.tsx:314-362`, `apps/mobile/src/components/venue/menu-screen.tsx:116-144`
  - **Problem:** PhotoPlaceholder renders remote photos with react-native <Image> (ui.tsx:352-359). Business-uploaded photos are served at original resolution; a 60-item menu in the 2-column cards layout decodes dozens of full-size images with only the OS HTTP cache behind them — memory pressure and visible pop-in on mid-range Android devices, re-downloads on revisit (bad on café Wi-Fi, which the offline work otherwise treats as hostile). The FlatList itself is well tuned (menu-screen.tsx:117-124), so images are the remaining performance smell.
  - **Fix:** Swap the inner <Image> for expo-image (memory+disk cache, automatic downscaling to the layout size, recyclingKey, placeholder transition). It is a drop-in change confined to PhotoPlaceholder since every photo in the app goes through it.

- [ ] **72. Zero tests for mobile-only logic (offline queue, cache versioning, reconcile, deep-link scan)**  
  `medium` · add · effort M · _mobile codebase quality_
  - **Where:** `apps/mobile/src/lib/venue.tsx:500-604`, `apps/mobile/src/lib/venue.tsx:262-358`, `apps/mobile/src/lib/session.tsx:113-145`
  - **Problem:** apps/mobile has no test files and no test script. packages/shared is tested, but the most failure-prone logic is mobile-only: the offline queue with idempotency keys and TRANSIENT_ORDER_ERRORS re-queue/hand-back branches (venue.tsx:500-604), MENU_CACHE_VERSION cache invalidation (venue.tsx:130, 275-297), browse-table restore/drop on reconcile (venue.tsx:340-358), and session restore (session.tsx:113-145). These are exactly the paths that broke web ("web loses orders offline" from the prior UX audit) and they currently regress silently.
  - **Fix:** Extract the queue/retry decision logic and cache (de)serialization into pure functions (they are nearly pure already) and unit-test them with vitest/jest — no React Native runtime needed. Cover: queue on throw, re-queue on transient code, hand-back+merge on permanent rejection, stale cache version discard, stale tableId drop.


### web customer app

- [ ] **73. Queued offline order and its idempotency key don't survive refresh — duplicate order possible**  
  `medium` · fix · effort M · _web customer app_
  - **Where:** `apps/web/src/app/r/_venue/cart-screen.tsx:35`, `apps/web/src/app/r/_venue/cart-screen.tsx:59`, `apps/web/src/app/r/_venue/cart-screen.tsx:101`, `apps/web/src/app/r/_venue/cart-screen.tsx:290`
  - **Problem:** The prior 'web loses orders offline' bug is mostly fixed (cart persists in localStorage), but cart-screen keeps `queued` and clientRefRef (the place-order idempotency key) in memory only. Consequences: (1) the UI promise 'envoyée automatiquement au retour du réseau' breaks if the customer refreshes or navigates away — the queued banner and auto-resubmit are gone; (2) worse, if the original request actually reached the server but the response was lost, a refresh discards the client_ref, so the retry submits with a NEW uuid and can create a duplicate order — exactly what client_ref exists to prevent. Note also the submit button is disabled while offline, so a customer who was offline from the start can never even reach the queued state.
  - **Fix:** Persist {clientRef, queued: true} next to the cart (e.g. chehia.pending.<cartKey>) before the fetch, restore both on hydrate, clear on confirmed success; allow submit while offline to enter the queued state directly.

- [ ] **74. No service worker for the customer surface — any offline refresh dead-ends mid-meal**  
  `medium` · fix · effort M · _web customer app_
  - **Where:** `apps/web/public/caisse-sw.js:1`, `apps/web/src/app/caisse/caisse-provider.tsx:629`, `apps/web/src/app/r/_venue/offline-banner.tsx:7`
  - **Problem:** Only the caisse registers a service worker (caisse-sw.js, gated to caisse.* hostname). The customer app (app.chehia.app + /r/*) has none, so on flaky café Wi-Fi a refresh or navigation while offline shows the browser's error page — menu, cart and the live order-tracking screen are all unreachable even though the cart/order pointer live in localStorage. For a market where connectivity is the stated concern (offline banner, queued orders), this is the missing half of the story, and it also weakens the PWA install pitch.
  - **Fix:** Ship a small app-shell SW for the customer origin modeled on caisse-sw.js (network-first with cache fallback for same-origin GETs, never touching Supabase), registered on app.* and the venue routes.

- [ ] **75. A venue with zero items shows loading skeletons forever instead of an empty state**  
  `medium` · fix · effort S · _web customer app_
  - **Where:** `apps/web/src/app/r/_venue/menu-screen.tsx:95`, `apps/web/src/app/r/_venue/menu-screen.tsx:174`
  - **Problem:** menu-screen computes `menuLoading = items.length === 0 && !search.trim()` and renders skeleton cards. But items arrive with the SSR bundle — there is no client-side loading phase — so this state only ever triggers for a genuinely empty menu (e.g. a venue mid-onboarding), which then spins skeletons indefinitely with no message and no way to understand what's happening.
  - **Fix:** Replace the fake loading branch with an explicit empty-menu state ('Le menu arrive bientôt' + call-waiter affordance); skeletons aren't needed since data is server-loaded.

- [ ] **76. Privacy policy omits geolocation, reviews and anonymous-session data the app now collects**  
  `medium` · fix · effort S · _web customer app_
  - **Where:** `apps/web/src/app/legal/privacy/page.tsx:20`, `apps/web/src/app/r/_venue/cart-screen.tsx:64`, `apps/web/src/app/r/_venue/rating-sheet.tsx:66`
  - **Problem:** The location gate sends customer_lat/customer_lng/customer_accuracy_m to the place-order function (cart-screen.tsx:64-70), discovery reads device location, and ratings collect an optional name + free-text comment — none of which appear in /legal/privacy (it lists only orders, staff accounts, contact requests and localStorage). Anonymous auth identifiers (Supabase anonymous users) are also unmentioned. This page is what App Store metadata will link as the privacy policy, so it must match actual data practices (and Apple's privacy nutrition labels).
  - **Fix:** Add sections covering: device location (purpose = on-site verification, whether coordinates are stored or only checked), ratings/reviews (pseudonymous name + comment, moderation), and anonymous session identifiers. Keep it in sync with the App Store privacy labels.

- [ ] **77. Universal links stay dead until APPLE_TEAM_ID is set — AASA returns 404 by design**  
  `medium` · add · effort S · _web customer app_
  - **Where:** `apps/web/src/app/.well-known/apple-app-site-association/route.ts:7`, `apps/mobile/app.json:15`
  - **Problem:** The apple-app-site-association route intentionally 404s when APPLE_TEAM_ID is unset. That's a sensible guard, but it means universal links (the core QR → app handoff, applinks:chehia.app + applinks:app.chehia.app in the mobile app.json) will silently not work at launch unless someone remembers to set APPLE_TEAM_ID (+ optionally APPLE_BUNDLE_ID) in the Vercel production environment. Nothing currently surfaces this as a launch checklist item.
  - **Fix:** Set APPLE_TEAM_ID/APPLE_BUNDLE_ID in Vercel prod before the next App Store submission, then verify https://app.chehia.app/.well-known/apple-app-site-association and https://chehia.app/... return the association (remember Apple's CDN caches it). Add this to the prod-ship checklist doc.

- [ ] **78. Legal pages are French-only in a trilingual (fr/ar/en) product**  
  `medium` · enhance · effort M · _web customer app_
  - **Where:** `apps/web/src/app/legal/privacy/page.tsx:1`, `apps/web/src/app/legal/terms/page.tsx:1`
  - **Problem:** privacy and terms are hardcoded French with no language switch and no Arabic (RTL) or English versions, while the whole customer app is trilingual and Arabic is a primary audience. Apple reviewers will read the English-less privacy page too.
  - **Fix:** Either move the legal copy into the i18n dictionary and render via I18nProvider (with dir handling), or add /legal/privacy?lang= variants; at minimum add an English version for App Store review.

- [ ] **79. No loading.tsx for venue routes + redundant/sequential server queries block first paint**  
  `medium` · enhance · effort S · _web customer app_
  - **Where:** `apps/web/src/app/r/_venue/loader.ts:71`, `apps/web/src/app/r/[slug]/t/[token]/layout.tsx:14`, `apps/web/src/app/app/page.tsx:16`
  - **Problem:** There is no loading.tsx anywhere: on slow 3G the /r/[slug] and /app routes show a blank page while the server runs its queries. loadScannedVenue is 3 sequential round trips (restaurant → resolve_table → 4-way menu batch), and generateMetadata performs a second, duplicate restaurant fetch per request. /app also has no error.tsx (a thrown server error renders Next's unbranded default).
  - **Fix:** Add loading.tsx skeletons for /r/[slug] segments and /app; parallelize loadRestaurant + resolve_table with Promise.all; wrap the restaurant fetch in React cache() so generateMetadata and the layout share one query; add an /app error boundary.

- [ ] **80. Adding an item in a group session gives no visible feedback (and errors are swallowed)**  
  `medium` · enhance · effort S · _web customer app_
  - **Where:** `apps/web/src/app/r/_venue/item-sheet.tsx:97`, `apps/web/src/app/r/_venue/group/session-provider.tsx:195`, `apps/web/src/app/r/_venue/group/group-entry.tsx:33`
  - **Problem:** In a group session, ItemSheet routes the add to the shared cart and closes — but the persistent bottom cart bar only reflects the personal cart, so nothing on screen changes; the customer can't tell the add worked without opening the group sheet. The session insert's failure (offline, RLS, closed session) is also fire-and-forget (`void addLine(...)`, and addLine silently no-ops when myParticipantId is null after being dropped from a session).
  - **Fix:** Show a confirmation (toast or a count badge on the GroupEntry banner fed by my session lines) after a group add, and surface insert failures with a retry message instead of void-ing the promise.

- [ ] **81. Zero web test coverage; integration suite skips group ordering and the geofence**  
  `medium` · add · effort L · _web customer app_
  - **Where:** `packages/integration/src/order-flow.test.ts:1`, `apps/web/src/app/r/_venue/venue-provider.tsx:110`, `apps/web/src/app/r/_venue/group/session-provider.tsx:1`
  - **Problem:** apps/web has no unit/component tests at all, and packages/integration has no tests touching start_session/join_session/place_mode or the customer_lat/too_far/location_required paths — the two newest, most state-heavy features (group ordering, location gate) are entirely untested. Shared cart logic is tested, but the web-only logic (cart hydration/reconcile-on-error, queued resubmit, session restore) is not.
  - **Fix:** Add integration tests for the group RPC lifecycle (start/join/ready/place group+solo/stale-session) and place-order geofence codes; add a few vitest tests for venue-provider hydration and cart-screen error-code branching (item_unavailable → reconcile, unknown_table, too_far).


### Business portal

- [ ] **82. Cash sales settle with no open drawer session and vanish from every Z-report**  
  `medium` · fix · effort S · _Business portal_
  - **Where:** `apps/web/src/app/caisse/_register/tender-sheet.tsx:51`, `supabase/migrations/20260710000004_pos_review_fixes.sql:175`, `apps/web/src/app/caisse/_register/register.tsx:93`
  - **Problem:** settle_order_tx attaches the payment to the open cash session if one exists, else null (20260710000004:175-187). The tender sheet never checks that a session is open (only a status dot in the header, register.tsx:93). A cashier who forgets to open the drawer books cash sales that appear in no Z-report; expected cash and over/short for the day are wrong, which undermines the whole drawer-accountability feature.
  - **Fix:** In TenderSheet, when method='cash' and cashSession is null, block (or warn) and deep-link to the open-drawer dialog. Optionally auto-attach late-synced offline payments to the session open at sale time.

- [ ] **83. Offline sale timestamps discarded on replay — wrong fiscal date, year and Z-session attribution**  
  `medium` · fix · effort M · _Business portal_
  - **Where:** `apps/web/src/app/caisse/caisse-provider.tsx:489`, `apps/web/src/app/caisse/_register/offline-queue.ts:39`, `supabase/functions/register-order/index.ts:95`
  - **Problem:** PendingSale.at (offline-queue.ts:39) is never transmitted: drainQueue posts register-order/settle-order without it, so the order's created_at/paid_at and the fiscal number's year are stamped at SYNC time (settle_order_tx uses now()). An offline sale from Dec 31 synced Jan 1 gets next year's sequence; sales from yesterday's outage post into today's cash session (or none), corrupting drawer variance. The printed provisional receipt shows the true sale time, the fiscal record another.
  - **Fix:** Send captured_at with offline replays; store it on the order (e.g. sold_at) and use it for reporting/session attribution, keeping paid_at as sync time for audit. At minimum document the divergence for the accountant.

- [ ] **84. drainQueue has no concurrency guard — parallel drains race deadLetter vs retry**  
  `medium` · fix · effort S · _Business portal_
  - **Where:** `apps/web/src/app/caisse/caisse-provider.tsx:479`, `apps/web/src/app/caisse/caisse-provider.tsx:603`
  - **Problem:** drainQueue is triggered by both the 'online' event and the state==='ready' effect (caisse-provider.tsx:603-624) and can run concurrently (also across multiple open tabs sharing one IndexedDB). Two drains iterate the same snapshot: one can deadLetter a sale (moving it to failed-sales) while the other's bump() re-puts it into pending-sales — the sale then exists in both stores and retries forever. Server idempotency prevents double-charging, but counts and the failed store become wrong.
  - **Fix:** Add an in-flight flag/promise so only one drain runs at a time, and make bump()/deadLetter re-read the store (skip if the sale no longer exists). Consider navigator.locks for cross-tab exclusion.

- [ ] **85. Settings/fiscal/appearance saves ignore errors — false '✓ Enregistré' on failure**  
  `medium` · fix · effort S · _Business portal_
  - **Where:** `apps/web/src/app/business/settings/page.tsx:92`, `apps/web/src/app/business/caisse/fiscal-settings.tsx:87`, `apps/web/src/app/business/appearance/appearance-studio.tsx:85`, `apps/web/src/app/business/onboarding/page.tsx:63`
  - **Problem:** SettingsPage.save() discards the supabase update result and always flashes 'saved' (settings/page.tsx:92-106) — a network failure or RLS rejection silently loses venue profile, hours, geofence and require_qr changes. FiscalSettings.save() and AppearanceStudio.save() at least don't show success on error, but show no error message at all (fiscal-settings.tsx:87-106, appearance-studio.tsx:85-94). Onboarding finish() has the same pattern (onboarding/page.tsx:63-72).
  - **Fix:** Check the returned error on every save; show the shared error chip and keep the form dirty. Extract a small useSave() helper to standardize the pattern.

- [ ] **86. ESC/POS encoder strips Arabic entirely — blank item names on thermal receipts**  
  `medium` · fix · effort M · _Business portal_
  - **Where:** `apps/web/src/app/caisse/_register/escpos.ts:17`, `apps/web/src/app/caisse/_register/util.ts:8`
  - **Problem:** escpos.ts ascii() removes every non-ASCII character (escpos.ts:17-19). A venue whose menu items are named only in Arabic (common in Tunisia) prints receipts whose lines read '2x' with no name at all — a legally-relevant fiscal receipt with unidentifiable items. The register's txt() falls back to fr then first value, so an ar-only name goes straight into ascii() and vanishes.
  - **Fix:** Prefer a Latin-script name when one exists (fr/en) before flattening; where none exists, transliterate or raster-render the line as a bitmap (GS v 0) instead of dropping it. At minimum keep digits/price and print a placeholder like 'Article'.

- [ ] **87. Register lock is cosmetic — a page refresh bypasses it, and there is no auto-lock**  
  `medium` · fix · effort S · _Business portal_
  - **Where:** `apps/web/src/app/caisse/caisse-provider.tsx:244`, `apps/web/src/app/caisse/_register/lock-screen.tsx:12`
  - **Problem:** locked is in-memory state defaulting to false (caisse-provider.tsx:244); LockScreen is just an overlay. Anyone at the tablet can F5/relaunch the PWA and get an unlocked register with the staff session still valid — the PIN (bcrypt-hashed server-side, properly done) protects nothing in practice. There is also no idle auto-lock, which is the actual walk-away scenario.
  - **Fix:** Persist the locked flag (localStorage keyed by staff id), start locked when hasPin is true, and add an idle timer (e.g. lock after N minutes without interaction, configurable).

- [ ] **88. Staff lifecycle management missing: no deactivate, role change, or password reset**  
  `medium` · add · effort M · _Business portal_
  - **Where:** `apps/web/src/app/business/settings/page.tsx:331`, `apps/web/src/app/business/login/page.tsx:19`
  - **Problem:** Settings can only ADD staff (settings/page.tsx:414-516) and list them read-only (331-355). When an employee leaves, there is no way to deactivate their account or rotate credentials; when someone forgets their password there is no 'mot de passe oublié' on the business login (login/page.tsx) and no owner-side reset. For a multi-staff POS handling cash, offboarding is a security requirement, not polish.
  - **Fix:** Add per-row actions (owner/manager, guarded server-side): toggle is_active, change role, regenerate starter password via the create-staff function (or a new reset-staff function), plus a forgot-password email flow on the login page.

- [ ] **89. Live orders board can silently go stale — no refetch on realtime resubscribe**  
  `medium` · fix · effort S · _Business portal_
  - **Where:** `apps/web/src/app/business/use-live-orders.ts:133`, `apps/web/src/app/business/notifications-bell.tsx:51`
  - **Problem:** useLiveOrders subscribes to postgres_changes but passes no status callback (use-live-orders.ts:133-170): events fired during a websocket drop/reconnect (flaky café wifi, tablet sleep) are lost and nothing reloads, so the board shows old orders until a manual refresh — for the core order-taking flow. NotificationsBell already does this correctly (`subscribe((status) => status === 'SUBSCRIBED' && reload())`, notifications-bell.tsx:51-53).
  - **Fix:** Mirror the bell: reload on every SUBSCRIBED status, add a visibilitychange/focus reload, and optionally a 30-60s polling fallback plus a 'reconnecting' indicator when the channel is down.

- [ ] **90. Non-manager cashier at a venue without a 'Comptoir' table cannot sell walk-in/takeaway**  
  `medium` · fix · effort S · _Business portal_
  - **Where:** `apps/web/src/app/caisse/caisse-provider.tsx:317`, `apps/web/src/app/caisse/caisse-provider.tsx:372`
  - **Problem:** The Comptoir service table is auto-created only when role is owner/manager (caisse-provider.tsx:317-329). A waiter signing into the register at a venue where it doesn't exist yet gets serviceTable=null; every comptoir/emporter checkout fails with no_table, surfaced as 'choose a table' (tender-sheet errorLabel) — a confusing dead end for the exact person most likely to be on the till.
  - **Fix:** Create the service table server-side (in register-order when missing, or at venue provisioning/onboarding) instead of client-side and role-gated; show a specific error if it's still missing.

- [ ] **91. 'Comptoir' POS plumbing leaks into customer-facing tables UI and floor plan**  
  `medium` · fix · effort S · _Business portal_
  - **Where:** `apps/web/src/app/business/tables/page.tsx:102`, `apps/web/src/app/business/orders/page.tsx:105`, `apps/web/src/app/business/tables/print/page.tsx:63`
  - **Problem:** The service table is a normal row in `tables`, so it appears in Tables & QR as a printable 'Table Comptoir' QR card (tables/page.tsx grid + print page prints it with all cards), and on the orders floor plan as a tile rendered 'TComptoir' (orders/page.tsx:105 prefixes 'T'). Printing and laminating a QR for the counter pseudo-table, or reading 'TComptoir' as a table, is confusing and looks broken.
  - **Fix:** Flag the service table (zone='__service' or a boolean column) and exclude it from the tables page, print sheet, and floor plan; render counter orders in a dedicated 'Comptoir' rail instead.

- [ ] **92. Tables management is half-finished: prompt()-based add, no rename/zone/deactivate/QR-rotation**  
  `medium` · enhance · effort M · _Business portal_
  - **Where:** `apps/web/src/app/business/tables/page.tsx:48`
  - **Problem:** Adding tables uses two window.prompt() dialogs (tables/page.tsx:48-66) — jarring against the rest of the design system and unlocalizable. There is no way to rename a table, edit its zone, deactivate/delete it, reorder, or regenerate a leaked qr_token. Venues change floor layouts constantly; today the only recourse is SQL.
  - **Fix:** Replace prompt() with a proper dialog and add per-table edit (label, zone, active) + 'régénérer le QR' (with a warning that printed cards must be reprinted).

- [ ] **93. Item editor allows min_select > max_select — item becomes permanently unorderable**  
  `medium` · fix · effort S · _Business portal_
  - **Where:** `apps/web/src/app/business/menu/item-editor.tsx:213`, `apps/web/src/app/business/menu/item-editor.tsx:435`
  - **Problem:** Group min/max inputs are clamped independently (item-editor.tsx:435-459; save clamps only max >= 1 at 213-217). Setting min=3, max=1 saves fine, but then no selection can satisfy both bounds: place-order/register-order reject every order for that item with missing_required_modifier/too_many_modifiers — the customer just sees an opaque failure.
  - **Fix:** On save, clamp max_select = max(max_select, min_select) (or validate with an inline error). Consider the same guard as a DB check constraint.

- [ ] **94. Hardcoded-French surfaces break the trilingual promise (Caisse reports/fiscal, print page, portal error screens, register chrome)**  
  `medium` · enhance · effort M · _Business portal_
  - **Where:** `apps/web/src/app/business/caisse/fiscal-settings.tsx:14`, `apps/web/src/app/business/caisse/reports.tsx:10`, `apps/web/src/app/business/caisse/page.tsx:13`, `apps/web/src/app/business/portal-provider.tsx:156`, `apps/web/src/app/caisse/_register/util.ts:8`, `apps/web/src/app/business/tables/print/page.tsx:57`
  - **Problem:** Fully untranslated: business/caisse/page.tsx (tabs, 'Réservé au propriétaire…'), fiscal-settings.tsx (entire form), reports.tsx (all labels), tables/print/page.tsx ('Imprimer / Print'), portal-provider.tsx no-staff/error/setup screens (156-231). The register's util.txt() always resolves item names in French even when the cashier switches the register to AR/EN (util.ts:8-12), and receipt orderType labels ('Comptoir', 'À emporter', 'Sur place') are hardcoded in two places (tender-sheet.tsx:83, caisse-provider.tsx:572). table-sheet.tsx:14 has aria-label="Fermer" hardcoded. The dictionaries themselves are complete (fr/ar/en key counts match), so this is purely wiring.
  - **Fix:** Move these strings into t.portal.* / t.caisse.* (keys pattern already exists), pass the active lang to txt(), and centralize orderType labels in the dictionary.

- [ ] **95. Business portal unusable on phones — fixed sidebar, no responsive collapse**  
  `medium` · enhance · effort L · _Business portal_
  - **Where:** `apps/web/src/app/business/sidebar.tsx:36`, `apps/web/src/app/business/orders/page.tsx:56`, `apps/web/src/app/business/portal-shell.tsx:31`
  - **Problem:** PortalShell renders a permanent 218px sidebar (sidebar.tsx:36) with no breakpoint behavior; orders page pairs a fixed 352px card column with the floor plan (orders/page.tsx:56-58); several pages assume desktop widths. Yet the portal ships an install-to-home banner for mobile (portal-shell.tsx:34) — the exact users it invites get a cramped, sideways-scrolling UI. Tunisian owners will predominantly check orders from a phone.
  - **Fix:** Add a mobile breakpoint: collapsible sidebar (hamburger/bottom tabs), stack the orders columns, and audit each page at 390px width.


### Platform admin surface

- [ ] **96. Public email/password signup still enabled (pending item from July security audit)**  
  `medium` · fix · effort S · _Platform admin surface_ ✅verified
  - **Where:** `supabase/config.toml:163`, `supabase/config.toml:198`, `supabase/config.toml:203`, `supabase/migrations/20260706000003_harden_admin_allowlist_trigger.sql:31`
  - **Problem:** The 2026-07 security audit's remaining action — disable public email signup — is still open. supabase/config.toml has enable_signup = true (line 163) and [auth.email] enable_signup = true (line 198) with enable_confirmations = false (line 203), and per the audit memory the hosted prod project also still auto-confirms email signups. The web app never calls signUp() (verified: no signUp usage in apps/), owners/staff are created server-side via admin.auth.admin.createUser, customers are anonymous, and admins use Google — so the open /auth/v1/signup endpoint serves no product purpose. Risks: account squatting (an attacker pre-registers a future owner's email, making admin-provision-business fail with email_taken and forcing manual cleanup) and it was the enabling half of the now-fixed admin-escalation vector (defence-in-depth). Important nuance: disabling the GLOBAL enable_signup would break the admin_allowlist flow (a new admin's first Google sign-in INSERTs into auth.users, which global disable blocks) and anonymous customer sign-ins — only the email provider's signup must be disabled.
  - **Fix:** In the Supabase dashboard for BOTH prod (wpnouppukofzmvsieyeq) and dev (sxmbqwldtqkkmlfbjyzc): Authentication → Providers → Email → disable sign-ups (leave global signup, anonymous sign-ins, and Google enabled). Mirror locally by setting [auth.email] enable_signup = false in supabase/config.toml. Also enable leaked-password protection while there (advisor WARN noted in the audit memory).

- [ ] **97. admin_allowlist only links admins at auth.users INSERT — no backfill, no sync, no revocation path**  
  `medium` · fix · effort M · _Platform admin surface_
  - **Where:** `supabase/migrations/20260705000006_admin_allowlist.sql:60`, `supabase/migrations/20260706000003_harden_admin_allowlist_trigger.sql:39`
  - **Problem:** link_allowlisted_admin() is an AFTER INSERT trigger, so it only fires when a brand-new auth user is created. Consequences: (1) adding an email to admin_allowlist for someone who has ALREADY signed in once (or was pre-created via createUser) never grants admin — silent no-op; (2) Supabase's identity linking of a Google identity onto an existing same-email account does not INSERT into auth.users, so that path never links either; (3) deleting an allowlist row does NOT revoke the platform_admins row — there is no de-provisioning mechanism at all. The admin-provisioning memory claims "a backfill statement in the migration links already-existing users too", but 20260705000006_admin_allowlist.sql contains no backfill statement — the doc and the code disagree, which is exactly how a future admin grant silently fails.
  - **Fix:** Add a migration with (a) a SECURITY DEFINER sync function that upserts platform_admins for confirmed Google users matching admin_allowlist and (optionally) deletes platform_admins rows whose email left the allowlist, callable via service role; (b) run the backfill once. Document the revocation runbook (delete from platform_admins). Fix the admin-provisioning memory note.

- [ ] **98. No audit logging of any admin action; platform_reviews_config.updated_by never populated**  
  `medium` · add · effort M · _Platform admin surface_
  - **Where:** `apps/web/src/app/admin/reviews-config.tsx:41`, `apps/web/src/app/admin/page.tsx:56`, `supabase/functions/admin-provision-business/index.ts:134`, `supabase/migrations/20260707000001_reviews.sql:232`
  - **Problem:** Nothing records who did what on the admin surface: venue activate/deactivate (admin/page.tsx:56-61 direct table update), review approve/reject/hide (reviews-moderation.tsx:50-64), bulk approve-all, lead status changes, global config edits, and venue/owner provisioning all leave no trail. platform_reviews_config even has an updated_by uuid column designed for this (20260707000001_reviews.sql:~232) but ReviewsConfig.save() updates only the 5 setting fields so updated_by stays null forever (reviews-config.tsx:38-45). admin-provision-business logs nothing about which admin provisioned which venue. For a multi-tenant platform with multiple admins this is a real operational and accountability gap.
  - **Fix:** Create an admin_audit_log table (actor auth_uid, action, target_type, target_id, payload jsonb, created_at) written by a small SECURITY DEFINER helper; call it from the moderation/toggle paths (or via triggers on restaurants.is_active, reviews.status, leads.status when is_platform_admin()). At minimum: set updated_by: (await auth.getUser()).id in ReviewsConfig.save() and console/DB-log the caller uid + venue id in admin-provision-business.

- [ ] **99. Admin cannot recover/reset an owner's credentials — starter password is shown exactly once**  
  `medium` · add · effort M · _Platform admin surface_
  - **Where:** `apps/web/src/app/admin/create-business.tsx:93`, `supabase/functions/admin-provision-business/index.ts:102`, `apps/web/src/app/business/login/page.tsx:27`
  - **Problem:** admin-provision-business returns the generated owner password once (create-business.tsx result screen). If the admin closes the modal without copying (backdrop click closes it instantly, create-business.tsx:93), or the owner loses the password before first login, there is no recovery: no admin UI or edge function to reset a staff/owner password, no password-reset email flow on /business/login (no "forgot password" link), and SMTP isn't configured. The only recourse is manual dashboard surgery. This will be a recurring real-world support case for non-technical Tunisian café owners.
  - **Fix:** Add an admin-reset-staff-password edge function (platform-admin gated, service role admin.auth.admin.updateUserById with a fresh generatePassword() + must_change_password=true) and surface it on the venue detail page next to a staff roster. Also consider a confirm step before dismissing the one-time credentials screen.

- [ ] **100. Admin venue page is missing core management: profile/plan editing, staff roster, items, delete/archive**  
  `medium` · add · effort L · _Platform admin surface_
  - **Where:** `apps/web/src/app/admin/venues/[id]/page.tsx:27`, `apps/web/src/app/admin/page.tsx:188`, `supabase/migrations/20260709000001_menu_appearance_and_subcategories.sql:76`
  - **Problem:** /admin/venues/[id] offers only Appearance and a category/subcategory tree. Missing for actually operating the platform: (1) editing venue name/city/slug/plan after creation — plan can never be changed post-provisioning from any UI; (2) per-venue staff list (RLS "platform read all staff" exists and is unused by the UI); (3) item-level menu editing — admin has full RLS manage rights on items (20260709000001:76-78) but the UI exposes none of it, so white-glove menu setup for a non-technical owner is impossible from the admin side; (4) no delete/archive venue; (5) no link to preview the venue's live menu (/r/{slug} is shown as plain text on the list, admin/page.tsx:188-191).
  - **Fix:** Extend the venue detail page with an Infos tab (name/city/plan/slug with the guard from the plan finding making admin the only plan writer), a Staff tab (list + reset-password action), reuse the business menu item editor components (they already take restaurant as a prop — AppearanceStudio/CategoryEditor pattern proves this works), and make the /r/{slug} text a link.

- [ ] **101. No platform metrics, venue health, or billing/subscription state — admin can't run the business**  
  `medium` · add · effort L · _Platform admin surface_
  - **Where:** `supabase/migrations/20260704000001_platform_admin_and_onboarding.sql:82`, `apps/web/src/app/admin/page.tsx:16`, `supabase/migrations/20260701000001_core_schema.sql:38`
  - **Problem:** The dashboard shows only lifetime order/table/staff counts per venue (admin_venue_overview). There is no platform-wide order volume or GMV trend, no per-venue recency signal (last_order_at, orders last 7d) to spot churning venues, no pending-review or new-lead count badges on the tabs, and no billing model at all: restaurants.plan is a bare text column (core_schema.sql:38) with no subscription table (started_at/renews_at/status/trial), so "businesses subscribe via web portal" has no state to track who owes what since when. This is the biggest gap between the current admin surface and a platform someone can operate commercially.
  - **Fix:** Short term: extend admin_venue_overview with orders_7d and last_order_at; add a platform-stats RPC (venues active, orders today/7d, GMV 7d) rendered as header stat tiles; show pending-review and new-lead counts on the tab labels. Medium term: add a subscriptions table (venue, plan, status, current_period_end, notes) managed from the venue Infos tab.

- [ ] **102. Onboarding Profile and Hours steps fire a DB write on every keystroke**  
  `medium` · fix · effort S · _Platform admin surface_
  - **Where:** `apps/web/src/app/business/onboarding/page.tsx:212`, `apps/web/src/app/business/onboarding/page.tsx:325`, `apps/web/src/app/business/onboarding/stock-step.tsx:241`
  - **Problem:** ProfileStep persists via useEffect(() => () => { void save(); }, [save]) (onboarding/page.tsx:212-216) intending save-on-unmount, but save's identity changes on every field change, so React runs the cleanup (an UPDATE restaurants + refreshRestaurant() full refetch) on every keystroke of name/address/city/phone and every language/location toggle. HoursStep has the identical pattern (onboarding/page.tsx:325-329). Effects: a burst of racing UPDATEs (last-write-wins between overlapping requests can persist a stale intermediate value), pointless network chatter on café Wi-Fi, and a portal-wide restaurant refetch per keystroke.
  - **Fix:** Keep latest values in a ref and register the unmount-save effect once with an empty dep array (reading from the ref), or save on field blur like StockStep does (stock-step.tsx:241).

- [ ] **103. Admin panels render misleading empty states and silent no-ops on query failure**  
  `medium` · enhance · effort S · _Platform admin surface_
  - **Where:** `apps/web/src/app/admin/page.tsx:47`, `apps/web/src/app/admin/leads-panel.tsx:28`, `apps/web/src/app/admin/reviews-moderation.tsx:39`, `apps/web/src/app/admin/page.tsx:56`
  - **Problem:** All three admin data loaders coalesce errors to []: admin/page.tsx:47-50 (admin_venue_overview → "no venues" empty card on a network/RLS failure), leads-panel.tsx:28-31, reviews-moderation.tsx:39-44. All mutation paths also ignore errors: toggleActive (admin/page.tsx:56-61), review setStatus/approveAll (reviews-moderation.tsx:50-64), lead setStatus (leads-panel.tsx:37-42) — a failed update just reloads and the button silently appears to do nothing. An admin on flaky Wi-Fi could read "Aucun établissement" as data loss, or believe a review was approved when it wasn't.
  - **Fix:** Track the error from each query/mutation; show the existing retry-card pattern (admin-provider.tsx:100-118) for load failures and a toast/inline message for mutation failures. It's a mechanical change across the three panels.

- [ ] **104. Onboarding can activate a venue with zero tables and finish() ignores errors**  
  `medium` · enhance · effort S · _Platform admin surface_
  - **Where:** `apps/web/src/app/business/onboarding/page.tsx:63`, `apps/web/src/app/business/onboarding/page.tsx:595`
  - **Problem:** The wizard's last two steps (Tables, Staff) are skippable and finish() (onboarding/page.tsx:63-72) sets is_active=true + onboarding_completed_at unconditionally, ignoring the update result. A venue can go live with 0 tables — no QR codes exist, so the core scan-to-order flow is dead while discovery shows the venue as open. Menu is the only validated step (NextButton gates step 2). Additionally, if the UPDATE fails (offline), the success screen still shows and the owner believes they are live.
  - **Fix:** Check the update error in finish() and surface a retry. Before finishing with 0 tables, show a warning ("no QR tables yet — customers can't order") with an explicit confirm; reuse the existing tables count already loaded in TablesStep.


### database schema & security

- [ ] **105. restaurants public policy exposes order_seq (venue order volume) and internal config to anon**  
  `medium` · fix · effort M · _database schema & security_
  - **Where:** `supabase/migrations/20260701000001_core_schema.sql:309`, `supabase/migrations/20260702000001_atomic_orders_and_metrics.sql:9`
  - **Problem:** "public read restaurants" (using is_active) is row-level only; the default column grant lets any anonymous caller run GET /rest/v1/restaurants?select=order_seq,plan,require_qr,require_location,geofence_radius_m,inventory_alerts_enabled,onboarding_completed_at. order_seq is each venue's lifetime order count — the exact competitive-intel leak the per-tenant sequence redesign (20260702000001) was meant to stop platform-wide, now re-exposed per venue. Geofence/require_qr settings also tell an attacker precisely which venues have anti-abuse off.
  - **Fix:** Column-scope the anon/authenticated SELECT grant on restaurants to the customer-facing fields (slug, name, tagline_i18n, address, city, phone, languages, default_language, logo_url, cover_url, currency, opening_hours, latitude, longitude, rating_avg, rating_count, reviews_enabled, appearance, is_active), or serve customers from a dedicated public view. Verify web/mobile customer apps only read those fields first.

- [ ] **106. session_cart_lines UPDATE policy missing the guards its INSERT policy has**  
  `medium` · fix · effort M · _database schema & security_
  - **Where:** `supabase/migrations/20260709000002_group_ordering.sql:132`, `supabase/functions/place-order/index.ts:180`
  - **Problem:** The insert policy checks (a) participant belongs to caller AND matches line's session, (b) session status='open', (c) item belongs to the session's venue. The update policy (:132-137) checks only participant ownership. A member can therefore UPDATE item_id to another venue's item (group placement then fails with unknown_item at place-order/index.ts:286 — unfixable grief for the host), re-point session_id at a different session whose UUID they know (injecting their lines into another table's group bill), or keep editing lines after the session is placing/placed. Additionally there is no cap on lines per participant: inserting >50 lines makes the group order permanently fail place-order's too_many_lines check — another grief vector.
  - **Fix:** Mirror the full insert WITH CHECK on the update policy (participant/session consistency + session open + item in venue), forbid changing session_id/participant_id, and add a per-participant line cap (e.g. reject insert when the participant already has 20 lines, via trigger or policy subquery).

- [ ] **107. "staff manage *" WITH CHECK clauses omit the owner/manager role gate — waiters/kitchen can INSERT menu rows and tables**  
  `medium` · fix · effort S · _database schema & security_
  - **Where:** `supabase/migrations/20260701000001_core_schema.sql:349`, `supabase/migrations/20260701000001_core_schema.sql:373`
  - **Problem:** For INSERT, only WITH CHECK applies. The FOR ALL policies on categories, items, modifier_groups, modifiers, and tables put staff_has_role(['owner','manager']) in USING but only `restaurant_id = staff_restaurant_id()` in WITH CHECK. Any active staff — including waiter and kitchen roles — can therefore INSERT menu items, categories, modifiers, and even tables rows (choosing an arbitrary qr_token, since the column accepts a supplied value) for their venue via PostgREST, despite being unable to SELECT/UPDATE/DELETE them. Tenant boundary holds, but the intra-venue role model is broken on insert.
  - **Fix:** New migration recreating the five policies with the identical role-checked expression in WITH CHECK as in USING (the later inventory/fiscal policies already do this correctly — copy that pattern).

- [ ] **108. settle_order_tx can stamp fiscal numbers on cancelled orders; paid orders can be cancelled with no guard**  
  `medium` · fix · effort M · _database schema & security_
  - **Where:** `supabase/migrations/20260710000004_pos_review_fixes.sql:143`, `supabase/migrations/20260710000004_pos_review_fixes.sql:21`, `supabase/migrations/20260708000001_inventory.sql:437`
  - **Problem:** settle_order_tx (final version, 20260710000004:143-197) checks only paid_at for idempotency — it never checks orders.status, so a cancelled order can be settled, consuming a gap-free fiscal number and recording a payment against a void sale. Conversely, the `grant update (status)` to authenticated (:25) lets any staff flip a PAID order to 'cancelled': the orders_inventory_restock trigger restocks stock, but the payment row and fiscal number remain — books no longer balance and there is no refund record (the refunds table has no write path at all). For a fiscal/POS layer this is an integrity hole.
  - **Fix:** In settle_order_tx raise on `v_order.status = 'cancelled'`. Add a BEFORE UPDATE trigger on orders rejecting status→'cancelled' when paid_at is not null (until a real refund flow exists), or auto-create a refund row inside a cancel_paid_order_tx.

- [ ] **109. refunds, order_discounts and cash_movements are schema-only — no write path or UI exists**  
  `medium` · add · effort L · _database schema & security_
  - **Where:** `supabase/migrations/20260710000001_pos_money_fiscal.sql:127`, `supabase/migrations/20260710000001_pos_money_fiscal.sql:436`, `apps/web/src/app/business/caisse/reports.tsx:78`
  - **Problem:** The three POS tables (20260710000001:127-172) have read policies but no RPC, no edge function, and no client UI writes them (reports.tsx:78 hardcodes `const refunds = 0; // refunds UI not yet issued`). Yet close_cash_session's expected-cash formula (:436-444) already subtracts cash_movements and refunds, and cash_session_report reports refund totals — values that can never be non-zero. Half-finished feature: a real café day includes paid-outs and refunds, so drawer reconciliation will not match reality, and the 'complete final form' goal implies these flows must exist (or the dead schema should be trimmed until they do).
  - **Fix:** Either build the missing flows (record_cash_movement RPC + refund_order_tx SECURITY DEFINER function with owner/manager gate, plus Caisse UI), or remove the tables and the formula terms until the feature is actually built. Building is preferable — the schema and reconciliation math are already correct.

- [ ] **110. config.toml: public email signup still enabled with confirmations off; 6-char password minimum**  
  `medium` · fix · effort S · _database schema & security_
  - **Where:** `supabase/config.toml:163`, `supabase/config.toml:197`, `supabase/config.toml:169`, `supabase/migrations/20260706000003_harden_admin_allowlist_trigger.sql:32`
  - **Problem:** config.toml has enable_signup=true, [auth.email] enable_signup=true, enable_confirmations=false, minimum_password_length=6. The 20260706000003 migration's own header says: 'Independent of this migration, also close email/password signup or enable email confirmations + captcha' — and the July security-audit backlog lists 'disable public email signup' as pending. The admin-escalation is closed by the provider gate, but open unconfirmed signup still allows spam account creation and registering auth users under emails the attacker does not own (blocking the real owner's later email/password signup), and 6-char staff passwords are weak for accounts that control a venue's money and menu. config.toml only governs local, but it models the intended posture and the hosted projects reportedly mirror it.
  - **Fix:** Set [auth.email] enable_signup=false locally (staff are provisioned via admin-provision-business/create-staff; admins via Google OAuth; customers via anonymous sign-in — nothing needs public email signup), raise minimum_password_length to 10, and make the same change in both hosted Supabase dashboards. Add captcha if signup must stay open.

- [ ] **111. Public reviews policy exposes created_by, order_id, client_ref and moderated_by to anon**  
  `medium` · fix · effort S · _database schema & security_
  - **Where:** `supabase/migrations/20260707000001_reviews.sql:192`
  - **Problem:** "public read approved reviews" (20260707000001:192-193) is row-scoped only; anon can SELECT all columns of approved reviews via PostgREST, including created_by (the customer's anonymous auth uid — enables correlating one customer's reviews across venues and orders), order_id, client_ref, and moderated_by (identifies which admin approved). The customer apps use the shaped RPCs (venue_rating_summary/item_reviews), so nothing needs the raw columns publicly.
  - **Fix:** Column-scope the SELECT grant on reviews for anon (rating, sentiment, comment, customer_name, created_at, item_id, restaurant_id, status), or drop the public table policy entirely and serve public reads only through the two SECURITY DEFINER RPCs.


### Supabase edge functions

- [ ] **112. call-waiter ignores venue require_qr/require_location settings on the token-free path**  
  `medium` · fix · effort S · _Supabase edge functions_
  - **Where:** `supabase/functions/call-waiter/index.ts:34`, `supabase/functions/call-waiter/index.ts:51`
  - **Problem:** call-waiter accepts a bare table_id (index.ts:34-49) and only checks table/restaurant is_active — it never reads require_qr or require_location. A venue that explicitly configured "scan the QR to interact" can still have any remote anonymous user ring waiter calls to its tables from anywhere. Mitigations exist (unique open-call-per-table index, 5 open calls per user at index.ts:64-71) but the per-user cap is defeated by rotating anonymous sessions, so a whole floor can be lit up once per table remotely.
  - **Fix:** Mirror place-order's policy: when the caller supplies table_id instead of qr_token, reject if restaurant.require_qr, and apply the same geofence check when require_location is set (accept customer_lat/lng in the payload). Keep the existing caps as defence-in-depth.

- [ ] **113. register-order offline replay trusts captured_subtotal blindly (negative/mismatched totals possible)**  
  `medium` · fix · effort S · _Supabase edge functions_
  - **Where:** `supabase/functions/register-order/index.ts:156`, `supabase/functions/register-order/index.ts:100`
  - **Problem:** In the offline replay branch (register-order/index.ts:168-170), `total = Number.isInteger(input.captured_subtotal) ? input.captured_subtotal! : sum(lines)`. Number.isInteger(-5000) is true, so a buggy or malicious staff client can record an order whose total_millimes is negative or wildly different from the sum of its captured lines, corrupting revenue stats and the fiscal amount later collected by settle-order (which trusts order.total_millimes). Captured line item_ids are UUID-validated but never checked to exist or belong to the venue (index.ts:100-107): a nonexistent id makes the tx fail with an opaque 500 (FK violation), and another venue's item id is silently accepted into order_items. unit_price_millimes also has no upper bound (int overflow → 500).
  - **Fix:** Clamp/validate: require captured_subtotal >= 0 and equal (or within a small tolerance) to the recomputed sum of captured lines, else fall back to the computed sum; cap unit_price_millimes (e.g. <= 10,000,000); verify all captured item_ids exist in the venue's items table and return a 4xx (not a tx 500) when they don't.

- [ ] **114. extract-menu rate limit is porous: fire-and-forget audit insert and failed calls never counted**  
  `medium` · fix · effort S · _Supabase edge functions_
  - **Where:** `supabase/functions/extract-menu/index.ts:246`, `supabase/functions/extract-menu/index.ts:313`
  - **Problem:** The 8-per-10-min-per-venue limit (extract-menu/index.ts:246-258) is backed by ai_extractions rows, but the row is inserted (a) only AFTER a successful Anthropic call — every ai_failed attempt still burns Opus vision spend yet never increments the counter, allowing unlimited retries of expensive failing requests — and (b) via a floating promise (`void admin.from("ai_extractions").insert(...).then(...)` at index.ts:314-327). Supabase Edge Runtime may freeze the isolate right after the response is returned; background work needs EdgeRuntime.waitUntil, so the audit row (and thus the rate limit itself) can be silently dropped even on success. There is also a check-then-act race allowing N concurrent requests past the check.
  - **Fix:** Insert the audit row BEFORE the Anthropic call (status column: pending → ok/failed, updating token counts after), and simply `await` the insert — it is a single fast DB write. That fixes all three problems (failures counted, no waitUntil dependency, and the pre-insert closes most of the race).

- [ ] **115. submit-lead per-IP rate limit trusts a client-spoofable x-forwarded-for entry**  
  `medium` · fix · effort S · _Supabase edge functions_
  - **Where:** `supabase/functions/submit-lead/index.ts:47`, `supabase/functions/submit-lead/index.ts:59`
  - **Problem:** The code takes the FIRST entry of x-forwarded-for (submit-lead/index.ts:47). Clients can prepend arbitrary values to XFF, so the "real guard" per-IP cap of 8/hour (index.ts:60-64, and the comment on line 59 calling it the real guard) is bypassable by rotating a fake XFF header on every request. The attacker still hits the global 300/hour cap, but that budget then blocks legitimate leads (DoS on the contact form) and 300 junk rows + Resend emails/hour go through. The stored `ip` column also becomes attacker-controlled garbage.
  - **Fix:** Use the last (proxy-appended) XFF entry or a platform-set header instead of entry [0] — in Supabase Edge Functions the trustworthy client IP is the one appended by the platform's proxy (also compare with x-real-ip). Treat requests with unparsable IPs as rate-limited rather than uncounted.

- [ ] **116. Nightly functions (generate-insights, inventory-alerts) have no codified schedule — dead in practice unless manually wired**  
  `medium` · add · effort M · _Supabase edge functions_
  - **Where:** `supabase/functions/generate-insights/index.ts:226`, `supabase/functions/inventory-alerts/index.ts:65`, `README.md:157`
  - **Problem:** Neither function is invoked from any app code (grep confirms 0 references), and no migration, config, or CI file creates a pg_cron/pg_net schedule. README.md:157 and docs/inventory.md:67 say to "schedule via pg_cron + pg_net on prod" as a manual step. If that step was never done (nothing in the repo proves it was), Chehia Intelligence insights and the low-stock email digest silently never run in prod — the features exist but produce nothing.
  - **Fix:** Add a migration that creates the pg_cron jobs (guarded so it no-ops locally where pg_net/secrets are absent), storing the function URL + cron secret in Vault or a config table; or at minimum verify on prod that the jobs exist and document their exact definition in the repo. Also validate the optional restaurant_id body param as a UUID before passing it to .eq().

- [ ] **117. settle-order will settle cancelled orders and stamp them with fiscal numbers**  
  `medium` · fix · effort S · _Supabase edge functions_
  - **Where:** `supabase/functions/settle-order/index.ts:57`, `supabase/migrations/20260710000004_pos_review_fixes.sql:114`
  - **Problem:** settle-order loads the order (settle-order/index.ts:57-64) and settle_order_tx (20260710000004_pos_review_fixes.sql) checks only paid_at — neither checks order.status. A cancelled order can be "paid", consuming a number from the gap-free receipt sequence and marking paid_at on an order that was voided, which pollutes the fiscal audit trail the whole receipt_sequences design exists to protect.
  - **Fix:** In settle_order_tx, raise (e.g. 'order_cancelled') when v_order.status = 'cancelled' (and map it to a 409 in the edge function), or explicitly document that cancelled orders are settleable and why.

- [ ] **118. Per-user abuse caps are bypassable by rotating anonymous sessions**  
  `medium` · enhance · effort M · _Supabase edge functions_
  - **Where:** `supabase/functions/place-order/index.ts:247`, `supabase/functions/call-waiter/index.ts:64`
  - **Problem:** All customer-side limits key on created_by (place-order/index.ts:247-257 six orders/5min; place_order_tx's 5-open-orders cap; call-waiter's 5 open calls). Anonymous sign-in mints a fresh uid for free, so a scripted attacker gets unlimited budget; only the per-table 4-orders/90s burst cap (place-order/index.ts:260-270) — skipped entirely for session orders — is identity-independent. For a require_qr venue physical presence bounds abuse, but for browse-enabled venues an attacker inside the geofence (or exploiting the session bypass above) can flood the kitchen.
  - **Fix:** Add an identity-independent layer: a per-restaurant orders/minute ceiling (cheap: one more count on orders), and/or per-IP limiting at the edge (x-forwarded-for last hop). Consider extending the per-table burst cap to session orders with a higher threshold instead of skipping it.

- [ ] **119. No integration tests for register-order, settle-order, submit-review, submit-lead, extract-menu, geofence, or session flows**  
  `medium` · add · effort L · _Supabase edge functions_
  - **Where:** `packages/integration/src/order-flow.test.ts:17`, `packages/integration/src/hardening.test.ts:14`
  - **Problem:** packages/integration covers place-order (validation, pricing, idempotency, caps) and call-waiter well, but there are zero tests for: the caisse money path (register-order normal + offline replay, settle-order timbre/TVA/rounding/fiscal numbering/idempotency), submit-review's ownership/window/dedup rules, submit-lead's honeypot + rate limits, extract-menu's owner gate, the location gate (location_required / too_far / qr_required responses), and group-session placement (host-only, not_ready, session_not_placeable). These are exactly the paths where regressions cost money or trust.
  - **Fix:** Add integration suites: pos-flow.test.ts (register+settle incl. replay and cancelled-order settle), reviews.test.ts, location-gate.test.ts (venue with pin + require_location: no coords → 403 location_required, far coords → 403 too_far, near coords → success), and sessions.test.ts (incl. the bypass regression test from the first finding).


### Internationalization

- [ ] **120. Bilingual 'LANGUE · اللغة' label hardcoded in the shipping mobile app (and web) — the exact mixed-language pattern Apple flagged**  
  `medium` · fix · effort S · _Internationalization_ ✅verified
  - **Where:** `apps/mobile/src/components/venue/venue-home.tsx:286`, `apps/web/src/app/r/_venue/venue-home.tsx:120`, `packages/shared/src/i18n/fr.ts:26`
  - **Problem:** The venue home language-switcher section header concatenates French and Arabic in one string: apps/mobile/src/components/venue/venue-home.tsx:286 (`LANGUE · اللغة`) and apps/web/src/app/r/_venue/venue-home.tsx:120. This is in the customer app the reviewer will exercise (it's on the venue landing screen of the demo flow). The catalog already has common.language ("Langue"/"اللغة"/"Language"), so this is the only remaining multi-language-at-once copy in the mobile UI.
  - **Fix:** Replace both literals with {t.common.language} (uppercase via styling if desired). Keep the per-language endonym buttons themselves (Français/العربية/English) — endonyms in a language picker are conventional and not a rejection risk.

- [ ] **121. Mobile never clamps language to the venue's supported languages → mixed-language menu screens**  
  `medium` · fix · effort M · _Internationalization_ ✅verified
  - **Where:** `apps/mobile/src/lib/i18n.tsx:31`, `apps/mobile/src/lib/venue.tsx:48`, `apps/web/src/app/r/_venue/venue-provider.tsx:272`, `supabase/seed.sql:86`
  - **Problem:** Mobile uses one global language (AsyncStorage chehia.lang, initial = device language; apps/mobile/src/lib/i18n.tsx:22-38) and ignores restaurant.default_language and restaurant.languages entirely (no reference in apps/mobile/src/lib/venue.tsx). If the stored/device language is 'en' and a venue only supports fr+ar, the chrome renders English while every menu item falls back to French via tr() (packages/shared/src/types.ts:209) — a persistently mixed-language screen. Web avoids this on first visit because VenueProvider seeds per-slug storage from default_language (apps/web/src/app/r/_venue/venue-provider.tsx:272-275) and its switcher only offers restaurant.languages, but mobile's switcher writes the global key, so one venue's choice leaks into venues that don't support it. This also matters for review: if the demo venue's languages were ever narrowed, the English-device reviewer would see English chrome over French content.
  - **Fix:** When inside a venue context on mobile, resolve the effective language as: stored lang if included in restaurant.languages, else restaurant.default_language. Either scope venue language per-slug (mirroring web's chehia.lang.<slug> key) or clamp at the venue provider level. Also verify the prod demo venue (cafe-el-marsa) keeps languages [fr,ar,en] with complete translations (seed.sql is fully trilingual).

- [ ] **122. Business Caisse settings/reports pages are 100% hardcoded French while the register itself is localized**  
  `medium` · fix · effort M · _Internationalization_
  - **Where:** `apps/web/src/app/business/caisse/page.tsx:16`, `apps/web/src/app/business/caisse/reports.tsx:10`, `apps/web/src/app/business/caisse/fiscal-settings.tsx:118`
  - **Problem:** The caisse register (apps/web/src/app/caisse/_register/*) properly uses useI18n + t.caisse.*, but its back-office pages don't: apps/web/src/app/business/caisse/page.tsx:16,26 ("Réservé au propriétaire ou au gérant", tabs "Rapports"/"Fiscalité"), reports.tsx:10-11,117-151 (METHOD_LABEL map, "TVA collectée", "Aucune vente sur cette période", "Clôtures de caisse (Z)", table headers), and fiscal-settings.tsx:118-196 (every label, placeholder, and the "Enregistré ✓" toast). An Arabic- or English-language portal user gets a fully French page inside an otherwise localized portal. reports.tsx:147 also uses physical `text-left` instead of the logical `text-start` used everywhere else.
  - **Fix:** Move these strings into the caisse.* / portal.* catalog sections (the catalog already has caisse.tender.* method names to reuse for METHOD_LABEL) and switch reports.tsx:147 to text-start. If French-only is a deliberate slice-1 decision, at minimum say so in a comment and track it — but the register chrome being localized while its settings aren't is inconsistent either way.

- [ ] **123. Portal/admin gate screens (no-access, error, setup-pending) hardcoded French despite catalog keys existing**  
  `medium` · fix · effort S · _Internationalization_
  - **Where:** `apps/web/src/app/business/portal-provider.tsx:162`, `apps/web/src/app/business/portal-provider.tsx:186`, `apps/web/src/app/business/portal-provider.tsx:217`, `apps/web/src/app/admin/admin-provider.tsx:84`
  - **Problem:** apps/web/src/app/business/portal-provider.tsx:162-227 renders "Accès non autorisé", "Ce compte n'est rattaché…", "Se déconnecter", "Une erreur est survenue", "Réessayer", "Configuration en cours" as literals because these states render outside the I18nProvider (mounted only at line 206/255 for the ready state). Same pattern in apps/web/src/app/admin/admin-provider.tsx:84-113. The catalog already contains auth.noAccessTitle/noAccessBody (used correctly in apps/web/src/app/auth/callback/page.tsx:113-116), errors.generic, common.retry, and auth.signOut equivalents.
  - **Fix:** Wrap the whole provider return (including error/no-staff/pending branches) in I18nProvider with storageKey chehia.portal.lang so the gate screens use t.auth.noAccessTitle, t.errors.generic, t.common.retry etc. — the stored language is available before staff/restaurant data loads.

- [ ] **124. Web trilingual fallback screens (404, venue error boundaries, InvalidQr) — deliberate, but InvalidQr is inconsistently half-French**  
  `medium` · enhance · effort M · _Internationalization_
  - **Where:** `apps/web/src/app/r/_venue/invalid-qr.tsx:16`, `apps/web/src/app/r/[slug]/(browse)/error.tsx:22`, `apps/web/src/app/r/[slug]/t/[token]/error.tsx:22`, `apps/web/src/app/not-found.tsx:20`
  - **Problem:** Four web screens intentionally concatenate three languages because the visitor language is unknown: apps/web/src/app/not-found.tsx:11-26 (also its 'Restaurants' CTA is French-ordered trilingual), apps/web/src/app/r/[slug]/(browse)/error.tsx:11-22 and r/[slug]/t/[token]/error.tsx (identical duplicates, 'Réessayer · أعد المحاولة · Retry'), and apps/web/src/app/r/_venue/invalid-qr.tsx:16-36. This is acceptable on web (Apple doesn't review it), but InvalidQr is internally inconsistent: title is trilingual while the guidance paragraph ('Demandez au personnel…') and both CTAs are French-only — an Arabic-only guest hitting a dead QR gets no usable instructions. Mobile correctly uses single-language t.landing.invalidQr/invalidQrBody (apps/mobile/src/components/venue/venue-home.tsx:37-40), so parity exists in the catalog.
  - **Fix:** For the venue error boundaries and InvalidQr (client or client-convertible components), read the persisted language (chehia.lang.<slug> from the URL slug, falling back to chehia.lang) and render a single language via getDictionary — keeping trilingual only for the truly language-blind root 404. At minimum, make InvalidQr's body and CTAs trilingual too so no reader is stranded. Also dedupe the two byte-identical error.tsx files into one shared component.

- [ ] **125. Web customer surfaces don't share language persistence: discover choice doesn't carry into venues**  
  `medium` · enhance · effort M · _Internationalization_
  - **Where:** `apps/web/src/app/r/_venue/venue-provider.tsx:272`, `apps/web/src/components/i18n-provider.tsx:26`, `apps/web/src/app/landing.tsx:12`, `apps/web/src/app/app/discover.tsx:26`
  - **Problem:** Landing and discover persist to global 'chehia.lang' (apps/web/src/app/landing.tsx:12, apps/web/src/app/app/discover.tsx:26), but each venue uses a per-slug key 'chehia.lang.<slug>' seeded from the venue's default_language (apps/web/src/app/r/_venue/venue-provider.tsx:274). A guest who switches to Arabic on /app then opens a French-default venue is flipped back to French and must re-pick Arabic at every venue. There is also no browser-language detection anywhere on web — I18nProvider initial defaults to 'fr' (apps/web/src/components/i18n-provider.tsx:28) with no navigator.language / Accept-Language fallback, so Arabic-preferring browsers always start in French.
  - **Fix:** In VenueProvider, resolve initial language as: per-slug stored value → global chehia.lang if included in restaurant.languages → restaurant.default_language. On landing/discover, seed the initial value from navigator.languages (clamped to fr/ar/en) when nothing is stored. Consider mirroring the value into a cookie so SSR can render the right language/dir on first paint.


### testing & CI

- [ ] **126. Server-side geofence enforcement in place-order is untested (client-side geo math is unit-tested, the security check is not)**  
  `medium` · add · effort S · _testing & CI_ ✅verified
  - **Where:** `supabase/functions/place-order/index.ts:220-243`, `supabase/functions/place-order/index.ts:43-45`, `packages/shared/src/__tests__/geo.test.ts`, `supabase/migrations/20260711000001_location_gating.sql`
  - **Problem:** packages/shared/src/__tests__/geo.test.ts covers distanceMeters/withinGeofence/clampGeofence client-side, but the actual enforcement — place-order/index.ts:220-243: require_location venues reject table_id orders without coords (403 location_required), reject out-of-radius coords (403 too_far), clamp radius to 20-5000m, and skip the check entirely for scanned-QR orders — has no integration test. This is the feature's security boundary (the client check is bypassable; only the server check matters), it shipped to prod, and the edge function carries its own duplicated distanceMeters copy (index.ts:43-45, comment 'Kept in sync with @chehia/shared's geo.ts') with nothing guarding against drift.
  - **Fix:** Seed one venue (or flip Le Zink in a test via adminClient) with require_location=true + a pin, then add tests: table_id order with no coords → 403 location_required; coords 10km away → 403 too_far; coords inside radius+slack → 200; qr_token order from far away → 200 (QR proves presence); invalid lat 999 → 403. For the duplicated haversine, add matching golden-value assertions (same two coordinate pairs, same expected metres) in geo.test.ts and — since Deno can't import the pnpm package — a tiny `deno test` next to the function, or extract the constant test vectors into a comment-linked pair so drift is at least detectable.

- [ ] **127. Caisse offline queue drain logic is untested and lives inside React component code**  
  `medium` · add · effort M · _testing & CI_
  - **Where:** `apps/web/src/app/caisse/_register/offline-queue.ts:1-107`, `apps/web/package.json:5-11`
  - **Problem:** apps/web/src/app/caisse/_register/offline-queue.ts is a clean pure-ish IndexedDB module (frozen-price replay, dead-lettering to failed-sales, attempts counter) whose header comment promises strong guarantees ('a re-drain can't double-post or double-charge... never retried forever, never silently lost') — none of which are tested. The drain loop itself (deciding transient-retry vs permanent dead-letter per server error) lives in the register component/provider, untestable as written. apps/web has no test runner at all, so even this eminently unit-testable module has nowhere to run.
  - **Fix:** Add vitest to @chehia/web (test script + vitest.config with environment: 'node' and fake-indexeddb for the queue). Extract the drain decision (given a PendingSale + a register/settle response → 'remove' | 'retry' | 'dead-letter') into a pure function in offline-queue.ts and test: permanent 4xx (deleted item, inactive venue) → dead-letter with reason; network failure → attempts++ and kept; success → removed; drain preserves client_ref/settle_ref across retries (idempotency keys never regenerate); sales drain oldest-first (allSales sort at :73). Pair with the POS integration idempotency tests (separate finding) to close the loop end-to-end.

- [ ] **128. import_menu_draft RPC and extract-menu edge function untested despite an offline-testable design**  
  `medium` · add · effort S · _testing & CI_
  - **Where:** `supabase/migrations/20260706000002_import_menu_draft.sql`, `supabase/functions/extract-menu`, `packages/shared/src/__tests__/menu-import.test.ts`
  - **Problem:** packages/shared/src/__tests__/menu-import.test.ts nicely covers parseMenuPrice and validateDraft, but the server half — the import_menu_draft RPC (migration 20260706000002) that turns a draft into real categories/items, and the extract-menu function which per README:79 'uses a deterministic template fallback without an API key — fully testable offline' — has zero integration coverage. Tenant-scoping of the import (can Zink's owner import into El Marsa?) and millimes conversion on write are unverified.
  - **Fix:** Add integration tests: owner imports a small draft → categories + items appear with correct price_millimes and i18n names; re-import behavior (duplicate handling) matches whatever the RPC promises; cross-tenant import attempt fails; kitchen-role import fails; extract-menu without MENU_EXTRACT_MODEL/API key returns the deterministic template (assert its shape) so the whole scan-a-menu flow has a CI-safe smoke test.

- [ ] **129. Reviews system (shipped to prod) has no integration tests: submit-review function and 8 RLS policies uncovered**  
  `medium` · add · effort S · _testing & CI_
  - **Where:** `supabase/migrations/20260707000001_reviews.sql:192-240`, `supabase/functions/submit-review`
  - **Problem:** Migration 20260707000001_reviews.sql defines the reviews table with 8 policies (public reads approved only, customer reads own, staff read/hide venue reviews, platform manage) plus platform_reviews_config, and there's a submit-review edge function — memory notes say this SHIPPED TO PROD, yet packages/integration has no reviews test. The moderation boundary (pending reviews must be invisible to the public) is exactly the kind of policy that regresses silently.
  - **Fix:** Add packages/integration/src/reviews.test.ts: anonymous customer submits via submit-review → row exists with pending status; anon select sees zero pending reviews and only approved ones; author can read their own pending review; venue staff can read + hide but not approve; cross-tenant staff sees nothing; double-submit throttling if the function implements it.

- [ ] **130. Edge functions (12 Deno functions, the security core) are never typechecked or linted by any script**  
  `medium` · add · effort S · _testing & CI_
  - **Where:** `supabase/functions/place-order/index.ts`, `package.json:5-16`
  - **Problem:** supabase/functions/* contains 12 functions including place-order (450+ lines of pricing/validation/rate-limiting) but no package.json script, no `deno check`, no deno.json lint config, and no Deno tests anywhere (find for *test* under supabase/: nothing). A type error in an edge function surfaces only at deploy or runtime. `pnpm -r typecheck` covers web/mobile/shared TS only.
  - **Fix:** Add a root script `"check:functions": "deno check supabase/functions/*/index.ts"` (plus a minimal supabase/functions/deno.json with the import map if needed) and run it in the CI edge-functions job. Optionally add `deno test` unit tests for pure helpers in place-order (distanceMeters, input validation) which need no database.

- [ ] **131. packages/integration has no tsconfig.json, no typecheck script, no lint — its test files are never typechecked anywhere**  
  `medium` · fix · effort S · _testing & CI_
  - **Where:** `packages/integration/package.json:1-20`, `packages/integration/src/helpers.ts:49`
  - **Problem:** packages/integration/package.json has only a `test` script; there is no tsconfig.json in the package, so `pnpm -r typecheck` (which runs only where the script exists) silently skips it and vitest transpiles the tests via esbuild without type-checking. Type drift between tests and the database.types.ts / supabase-js API goes unnoticed until runtime — notice the tests already lean on `any` (helpers.ts:49 returns `json: any`).
  - **Fix:** Add packages/integration/tsconfig.json (extend the shared base, types: ["vitest/globals"], strict) and a `"typecheck": "tsc --noEmit"` script so `pnpm -r typecheck` covers it; add a lint script alongside. Consider typing callFunction's json as unknown with per-test narrowing, or generate response types from the functions' shared error shape.

- [ ] **132. Remaining untested edge functions: create-staff, admin-provision-business, submit-lead, generate-insights, inventory-alerts**  
  `medium` · add · effort M · _testing & CI_
  - **Where:** `supabase/functions/create-staff`, `supabase/functions/admin-provision-business`, `supabase/functions/submit-lead`, `supabase/migrations/20260705000004_leads_ip.sql`
  - **Problem:** Of the 12 edge functions, only place-order and call-waiter have integration coverage. Untested: create-staff (privilege-granting — who can create staff, role escalation limits), admin-provision-business (the July security audit's admin-escalation fix lives on this boundary), submit-lead (has IP rate limiting per migration 20260705000004_leads_ip.sql), generate-insights, inventory-alerts (cron). The two provisioning functions are security-sensitive: a regression re-opens the exact hole hot-fixed in the 2026-07 audit.
  - **Fix:** Priority order: (1) create-staff — owner can create kitchen staff for own venue, kitchen cannot create staff, no one can create staff for another tenant, cannot self-assign owner/admin roles; (2) admin-provision-business — non-allowlisted authenticated user gets 403 (regression test for the admin-escalation fix); (3) submit-lead — accepts once, rate-limits repeats from same IP. generate-insights/inventory-alerts can be smoke-only.


### Build health: does the repo build clean right now

- [ ] **133. apps/mobile lint fails: 7 errors from react-hooks compiler rules**  
  `medium` · fix · effort M · _Build health: does the repo build clean right now_ ✅verified
  - **Where:** `apps/mobile/src/components/venue/category-landing.tsx:62`, `apps/mobile/src/components/venue/category-landing.tsx:77`, `apps/mobile/src/components/venue/category-landing.tsx:107`, `apps/mobile/src/components/venue/category-landing.tsx:136`, `apps/mobile/src/components/venue/category-landing.tsx:167`, `apps/mobile/src/components/venue/category-landing.tsx:204`
  - **Problem:** `pnpm -r lint` exits 1 in @chehia/mobile (expo lint) with 7 errors. (1) react-hooks/static-components x5 in category-landing.tsx: a local `const Heading = () => (...)` is declared inside the component render (line 62:19) and instantiated as <Heading /> at lines 77:10, 107:10, 136:10, 167:10, 204:8 — a component created during render is remounted (state/identity reset) every render. (2) react-hooks/set-state-in-effect x2: discover.tsx 69:10 calls setLoadError(true) synchronously from the effect-driven load path, and group/group-entry.tsx 26:7 calls setJoinCode(code) + setSheet(true) directly inside a useEffect body reacting to the ?s= deep-link param, causing cascading renders.
  - **Fix:** In category-landing.tsx, hoist Heading out of the component (pass lang/isRtl/t.menu.browseByCategory as props) or inline it as a plain JSX variable `const heading = (...)` like the neighboring `chevron` — a non-component JSX element doesn't trip the rule. In group-entry.tsx, derive the sheet-open state from params during render (e.g. initialize state lazily from params.s, or compute `const deepLinkCode = typeof params.s === 'string' && !session ? params.s : undefined` and render the sheet from that) instead of setState in the effect. In discover.tsx, restructure the effect per the rule's guidance (e.g. track load status in a single state set from the async continuation, or use a reducer). Re-run `pnpm --filter @chehia/mobile lint` until 0 errors.

- [ ] **134. pnpm -r lint bails on first failure, hiding apps/web lint errors**  
  `medium` · enhance · effort S · _Build health: does the repo build clean right now_
  - **Where:** `package.json:10`
  - **Problem:** `pnpm -r lint` runs packages sequentially and aborts at the first failure (ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL in @chehia/mobile), so the 4 apps/web lint errors are invisible from the root command — anyone running the documented root `lint` script sees only mobile output and can wrongly conclude web is clean. Same risk applies to any future CI wiring that uses the root script.
  - **Fix:** Change the root script to `pnpm -r --no-bail lint` (and consider `--aggregate-output`) so every package lints and all failures are reported in one run; same for `typecheck` and `test` root scripts.

- [ ] **135. @chehia/integration package has no typecheck or lint scripts — silently skipped by all quality gates**  
  `medium` · add · effort S · _Build health: does the repo build clean right now_
  - **Where:** `packages/integration/package.json`, `packages/shared/package.json`
  - **Problem:** packages/integration/package.json defines only `test` (vitest run). `pnpm -r typecheck` reports 'Scope: 4 of 5 workspace projects' but only shared/mobile/web actually run tsc; integration test code is never typechecked (vitest strips types via esbuild without checking) and never linted, so type drift against database.types.ts or shared types in the integration suite goes unnoticed until the Docker-based tests are actually run.
  - **Fix:** Add `"typecheck": "tsc --noEmit"` (with a tsconfig if missing) and a lint script to packages/integration so the root recursive commands cover it. Similarly, packages/shared has no lint script — add one if you want `pnpm -r lint` to actually cover the shared code.


### repository hygiene & organization

- [ ] **136. docs/mobile-submission.md contradicts the shipped App Store rejection fixes**  
  `medium` · fix · effort S · _repository hygiene & organization_ ✅verified
  - **Where:** `docs/mobile-submission.md:7`, `docs/mobile-submission.md:19`, `apps/mobile/app.json:114`, `apps/mobile/eas.json:35`
  - **Problem:** The submission guide is the doc the user will follow for the imminent resubmission, and it is now wrong on the exact points Apple rejected. docs/mobile-submission.md:7 claims app.json has "trilingual camera and when-in-use location usage strings" — but apps/mobile/app.json:114 and :120 now (correctly, post-rejection) have single French strings, and re-following the doc would reintroduce the Guideline 4 violation. It also says ios.buildNumber is "1" (app.json:13 says "2"), and docs/mobile-submission.md:19 says ascAppId is "intentionally omitted" while apps/mobile/eas.json:35 now has "ascAppId": "6787508673". It also doesn't mention the new docs/app-store-review/ materials, CFBundleLocalizations, or the supportsTablet/iPad question.
  - **Fix:** Rewrite the stale sections of docs/mobile-submission.md to match current app.json/eas.json (French-only permission strings + CFBundleLocalizations, buildNumber auto-increment, filled submit block), link to docs/app-store-review/review-reply.md as the active resubmission runbook, and add a note about the pending decision on expo `locales`/InfoPlist.strings device-language localization and supportsTablet.

- [ ] **137. README.md is four epics stale; deploy checklist omits 5 of 11 edge functions**  
  `medium` · fix · effort M · _repository hygiene & organization_
  - **Where:** `README.md:24`, `README.md:69`, `README.md:154`, `README.md:186`, `supabase/functions/`
  - **Problem:** README.md was last committed 2026-07-06 (inventory commit) and predates Caisse POS, location gating, group ordering, menu themes, and install prompts. Concrete inaccuracies: README.md:154-156 says "the five edge functions" then names six, while supabase/functions/ contains eleven — extract-menu, register-order, settle-order, submit-lead, and submit-review are absent from both the layout section (README.md:24-27) and the Supabase deploy checklist, so someone following the README would not deploy them. README.md:186-187 ("Known gaps (deliberate)") still lists reviews as intentionally out of scope even though ratings/reviews shipped to prod. README.md:69 hardcodes "96 unit tests" (11 test files now exist, incl. appearance/geo/menu-art/menu-import added later). No mention of business.chehia.app/caisse, /business/inventory bell docs, location-gated ordering, or the docs/ folder at all.
  - **Fix:** Refresh README: regenerate the edge-function list from supabase/functions/, add Caisse POS / location gating / group ordering / ratings to the architecture notes, drop or update the Known-gaps section, remove the hardcoded test count, and add a short 'Docs' section linking docs/*.md and docs/app-store-review/.

- [ ] **138. No documentation for Caisse POS and location-gated ordering (the two newest shipped systems)**  
  `medium` · add · effort M · _repository hygiene & organization_
  - **Where:** `docs/`, `apps/web/src/app/caisse/`, `supabase/migrations/20260710000001_pos_money_fiscal.sql`, `supabase/migrations/20260711000001_location_gating.sql`
  - **Problem:** docs/ has google-auth.md, inventory.md, mobile-submission.md and app-store-review/, but nothing for the two most operationally complex features already deployed to prod: the offline-first Caisse POS (apps/web/src/app/caisse/ — offline queue, register-order/settle-order edge functions, ESC/POS thermal printing, fiscal settings, staff PINs/shifts across 5 migrations) and location-gated ordering (geofence enforcement, Leaflet pin, 20260711000001_location_gating.sql). Inventory got a doc when it shipped; these did not, so operational knowledge (cron secrets, printer setup, geofence radius semantics, offline-queue recovery) lives only in commit messages and code.
  - **Fix:** Add docs/pos-caisse.md and docs/location-gating.md following the docs/inventory.md template (what it does / portal touchpoints / edge functions & auth / deploy checklist / tests).

- [ ] **139. packages/integration is silently excluded from `pnpm typecheck` (no tsconfig, no typecheck script)**  
  `medium` · add · effort S · _repository hygiene & organization_
  - **Where:** `packages/integration/package.json:6`, `package.json:12`, `README.md:71`
  - **Problem:** packages/integration/package.json:6-8 defines only a `test` script and the package has no tsconfig.json (only package.json, src/, vitest.config.ts). Root `pnpm typecheck` = `pnpm -r typecheck` (package.json:12), and pnpm -r silently skips workspaces lacking the script — so the 6 integration test files (hardening, inventory, order-flow, rls, storage + helpers) are never typechecked, and README.md:71's claim "pnpm typecheck — all workspaces" is false. Type errors in these security-critical tests only surface at vitest runtime, and only when the local Supabase stack is running.
  - **Fix:** Add packages/integration/tsconfig.json (strict, matching packages/shared) and a "typecheck": "tsc --noEmit" script so `pnpm -r typecheck` covers it.


### dependency health & supply chain

- [ ] **140. Edge functions import @anthropic-ai/sdk with no version pin**  
  `medium` · fix · effort S · _dependency health & supply chain_
  - **Where:** `supabase/functions/extract-menu/index.ts:10`, `supabase/functions/generate-insights/index.ts:9`, `supabase/functions/_shared/admin.ts:4`
  - **Problem:** supabase/functions/extract-menu/index.ts:10 and supabase/functions/generate-insights/index.ts:9 both do `import Anthropic from "npm:@anthropic-ai/sdk"` with no version specifier. Deno resolves this to the latest published version at deploy time (currently 0.111.0), so every redeploy can silently pick up a new — possibly breaking or compromised — SDK release with no lockfile protecting you. The other 10 supabase-js imports are pinned only to the major (`npm:@supabase/supabase-js@2`), which is looser than the exact 2.110.0 the apps use but at least major-stable.
  - **Fix:** Pin the Anthropic SDK to an exact version (`npm:@anthropic-ai/sdk@0.111.0`) in both functions, and consider tightening supabase-js edge imports to `npm:@supabase/supabase-js@2.110.0` so edge deploys are reproducible and match the client version. Redeploy both AI functions after pinning.

- [ ] **141. 2 moderate audit vulnerabilities: postcss 8.4.31 (via next) and uuid 7.0.3 (via expo tooling)**  
  `medium` · fix · effort S · _dependency health & supply chain_
  - **Where:** `apps/web/package.json:17`, `apps/mobile/package.json:14`, `pnpm-lock.yaml`
  - **Problem:** `pnpm audit --prod` reports exactly two moderate findings, no high/critical: (1) postcss <8.5.10 XSS via unescaped </style> in stringify output (GHSA-qx2v-qp2m-jg93), pulled in as next@16.2.10 > postcss@8.4.31 — build-time CSS processing, not shipped code, and the lockfile already has a clean postcss@8.5.16 alongside it for tailwind; (2) uuid <11.1.1 buffer bounds check (GHSA-w5hq-g745-h8pq) at uuid@7.0.3 via expo > @expo/cli > @expo/config-plugins > xcode — purely prebuild/CLI tooling (182 paths, all under expo tooling; the `.` path is an artifact of node-linker=hoisted). Neither is exploitable in the running apps, but they will keep tripping audits.
  - **Fix:** Add a pnpm override for postcss (`pnpm.overrides: {"postcss@<8.5.10": ">=8.5.10"}` in the root package.json) and verify `next build` still passes; or wait for a Next 16.2.x patch that bumps its pinned postcss. Leave uuid alone — forcing 7→11 across the `xcode` package risks breaking expo prebuild for zero runtime benefit; re-check after the next Expo SDK patch and document it as accepted build-time risk.

- [ ] **142. Mobile deps drifted behind Expo SDK 57 patch releases right before App Store resubmission**  
  `medium` · enhance · effort S · _dependency health & supply chain_
  - **Where:** `apps/mobile/package.json:14`, `apps/mobile/package.json:26`, `apps/mobile/package.json:31`
  - **Problem:** The mobile app is on SDK 57 (current major — good), but several packages are behind their SDK-57 patch releases: expo 57.0.1→57.0.4, expo-router 57.0.2→57.0.4, expo-camera 57.0.0→57.0.1, expo-constants 57.0.2→57.0.3, expo-linking 57.0.1→57.0.2, expo-splash-screen 57.0.1→57.0.2, react/react-dom 19.2.3→19.2.7, react-native-reanimated 4.5.0→4.5.1, react-native-svg 15.15.4→15.15.5, react-native-screens 4.25.2→4.26.0, react-native-safe-area-context 5.7.0→5.8.0, react-native-worklets 0.10.0→0.10.2. Patch releases of reanimated/screens/worklets in a fresh SDK frequently fix crashes and layout bugs — including iPad-specific ones, and the rejection review device is an iPad Air 11" M3 running the app in iPhone-compatibility mode.
  - **Fix:** Before cutting the resubmission EAS build, run `npx expo install --check` (accept the SDK-recommended versions) and `npx expo-doctor`, then re-run the on-device QA pass. These are patch-level, low-risk updates — do them before the store build rather than after.


### branch/environment divergence & ship-state

- [ ] **143. Universal links are dead in prod: AASA/assetlinks not served (env vars missing) and apex 308-redirects**  
  `medium` · fix · effort M · _branch/environment divergence & ship-state_ ✅verified
  - **Where:** `apps/mobile/app.json:14`, `docs/mobile-submission.md:27`, `apps/web/src/proxy.ts:1`
  - **Problem:** app.json declares applinks:chehia.app + applinks:app.chehia.app and the Android autoVerify intent filter, but live checks show: https://app.chehia.app/.well-known/apple-app-site-association → 404 body 'Not configured' (the route's response when APPLE_TEAM_ID is unset on Vercel, per docs/mobile-submission.md), https://www.chehia.app/... → 404, and https://chehia.app/... → 308 redirect to www (Apple's CDN requires a direct 200, no redirect). ANDROID_CERT_SHA256 is likewise unset. Consequence: scanning the printed table QR with the iOS Camera app opens Safari (the web app — which does work, /r/cafe-el-marsa/t/demo-elmarsa-t12 returns 200) instead of deep-linking into the installed native app, and Android App Links verification fails. This is a half-finished feature that undermines the core scan→native-app flow once the app is on the store.
  - **Fix:** Set APPLE_TEAM_ID=9KSK39WBM6 and ANDROID_CERT_SHA256 (EAS upload key + Play signing key SHA-256s, available after the first EAS build) on the chehia-web Vercel project; make the well-known route serve 200 on the apex (bypass the www redirect for /.well-known/*). Verify with curl and Apple's CDN checker before submission so field QA can cover camera-app scans.

- [ ] **144. Guideline-4 fix is the minimal version: permission strings are French-only with no per-language InfoPlist localization; supportsTablet decision unreviewed**  
  `medium` · enhance · effort S · _branch/environment divergence & ship-state_ ✅verified
  - **Where:** `apps/mobile/app.json:96`, `docs/app-store-review/review-reply.md:54`
  - **Problem:** apps/mobile/app.json now has single-French cameraPermission/locationWhenInUsePermission strings and CFBundleLocalizations [fr, ar, en] — this addresses the literal rejection (trilingual concatenated string) and matches the drafted reply. But the app UI follows device language: a reviewer on an English or Arabic device will see an English/Arabic app with FRENCH permission dialogs — the same 'permission language does not match app localization' complaint could be re-cited. The robust fix (expo ios locales / InfoPlist.strings supplying localized NSCameraUsageDescription + NSLocationWhenInUseUsageDescription per language) is not implemented. Additionally supportsTablet remains false while Apple explicitly tested on iPad Air 11" M3 and noted iPad apps 'must function as expected' — compatibility mode is permitted, but this has never been verified on an iPad.
  - **Fix:** Before the EAS build: add expo's `locales` config (e.g. "locales": {"fr": "./locales/fr.json", "ar": "./locales/ar.json", "en": "./locales/en.json"}) with localized permission strings, then confirm via `npx expo prebuild -p ios --clean` that InfoPlist.strings are generated per language. Keep supportsTablet:false (defensible, stated in the reply draft) but smoke-test on an iPad Air simulator; consider supportsTablet:true as a post-approval enhancement.

- [ ] **145. Edge-function drift between environments: generate-insights differs dev vs prod; orphan diag-provision runs only on prod with no repo source**  
  `medium` · clean · effort S · _branch/environment divergence & ship-state_
  - **Where:** `supabase/functions/generate-insights/index.ts:1`, `supabase/config.toml:397`
  - **Problem:** Supabase MCP list_edge_functions shows: (a) generate-insights prod v3 sha d3347122… ≠ dev v1 sha 9259c02d… — the two environments run different code for the same function and it is unknown which (if either) matches supabase/functions/generate-insights in the repo; (b) diag-provision (v3, verify_jwt=true) exists ONLY on prod, created 2026-07-04 during the admin-provisioning debugging, and has NO corresponding directory under supabase/functions/ — unreviewed, unversioned code deployed on production. All other functions are byte-identical across dev/prod (place-order, register-order, settle-order, call-waiter, submit-lead, submit-review, extract-menu, inventory-alerts, admin-provision-business, create-staff).
  - **Fix:** Redeploy generate-insights from the repo to BOTH projects so repo==dev==prod, and delete diag-provision from prod (it was a one-off diagnostic; if it is still needed, commit its source to supabase/functions/ first). Add a quick sha-comparison script to catch future drift.

- [ ] **146. Local main is 4 commits behind origin/main — the local repo misrepresents ship state**  
  `medium` · organize · effort S · _branch/environment divergence & ship-state_
  - **Where:** `docs/mobile-submission.md:1`
  - **Problem:** git branch -vv: local main is at 3881957 '[origin/main: behind 4]' while origin/main and develop are both at ce1c36b. The four 'develop-only' commits (a9eb57c, e09b828, b5ccacf, ce1c36b) were each pushed/fast-forwarded straight to origin/main (confirmed by Vercel deployments building githubCommitRef main for each) without the local main ref ever being updated. Anyone (or any agent) inspecting the local repo — including this audit's own premise — concludes prod is missing four features when it is not, and a future local `git checkout main && git merge develop && git push` would be a confusing no-op-or-conflict.
  - **Fix:** Run `git fetch && git branch -f main origin/main` (or checkout main and `git pull --ff-only`) to resync. Going forward, update local main whenever main is fast-forwarded remotely, or stop keeping a long-lived local main checkout.

- [ ] **147. Migration ledger drift: cloud versions/names diverge from repo files, dev and prod ledgers differ from each other, and one hot-applied migration is in neither**  
  `medium` · organize · effort M · _branch/environment divergence & ship-state_
  - **Where:** `supabase/migrations/20260709000002_group_ordering.sql:93`, `supabase/migrations/20260706000003_harden_admin_allowlist_trigger.sql:1`
  - **Problem:** Because deploys go through MCP apply_migration with apply-time versions and ad-hoc names, three ledgers now disagree: repo filenames (20260701000001_core_schema…20260711000001_location_gating), prod ledger (mix of styles, e.g. version 20260703022559 named '20260705000001_discovery_and_geo' next to short names like 'leads'), and dev ledger (different versions AND an extra entry session_functions_search_path 20260707204446 that prod lacks — functionally harmless: I verified on prod that gen_session_code/clean_nickname DO have proconfig search_path=public, because prod applied the already-hardened group_ordering file; the pos-pivot memory's '⚠️ prod still missing session_functions_search_path' is stale). Separately, repo migration 20260706000003_harden_admin_allowlist_trigger (the critical security fix) appears in NEITHER cloud ledger — it was hot-applied via SQL. Net risk: any future `supabase db push` (the documented fallback path in ratings memory) would attempt to re-apply the entire history; most files are not idempotent (CREATE TABLE, ALTER ADD COLUMN) and would error or, worse, partially apply.
  - **Fix:** Decide the authoritative mechanism and document it in the repo (README or CLAUDE.md): 'cloud schema changes go ONLY via MCP apply_migration; never db push'. Optionally run `supabase migration repair` per project to stamp the repo versions as applied so the ledgers converge. Add a read-only drift check (list_migrations vs ls supabase/migrations) to run before every deploy.

- [ ] **148. docs/mobile-submission.md actively contradicts the shipped state — including describing the exact rejected permission-string pattern as a feature**  
  `medium` · clean · effort S · _branch/environment divergence & ship-state_
  - **Where:** `docs/mobile-submission.md:15`, `docs/mobile-submission.md:20`, `docs/mobile-submission.md:22`
  - **Problem:** The doc (last refreshed before the rejection) claims: 'trilingual camera and when-in-use location usage strings' (line ~15) — that trilingual string is precisely what Apple rejected under Guideline 4 and it has since been replaced by single-French strings; 'ios.buildNumber "1"' (now 2, and build 3 is next); 'ascAppId is intentionally omitted' (eas.json now has ascAppId 6787508673); 'Still to do: create the App ID tn.chehia.app and an app record' (done 2026-07-04). Several memory notes are similarly stale: location-gated-ordering.md says prod place-order enforcement is pending (it is deployed, v7 sha-identical to dev); develop-ahead-of-prod.md says app./business./admin.chehia.app are NXDOMAIN (all four subdomains incl. caisse now resolve via Vercel CNAMEs); pos-pivot memory says prod is missing the search_path backfill (verified present). Anyone executing these docs verbatim would take wrong actions during the resubmission.
  - **Fix:** Refresh docs/mobile-submission.md to match app.json/eas.json reality (single-FR strings + planned locales fix, buildNumber, ascAppId, ASC record done) and update the three memory files' deploy-state lines. Keep docs/app-store-review/review-reply.md as the single source for the resubmission and have mobile-submission.md defer to it.


### observability-ops-readiness

- [ ] **149. Adding a crash SDK invalidates the current 'zero data collected' privacy posture — labels and docs must change in lockstep**  
  `medium` · organize · effort S · _observability-ops-readiness_
  - **Where:** `apps/mobile/app.json:24`, `docs/mobile-submission.md:44`
  - **Problem:** apps/mobile/app.json declares NSPrivacyTracking:false and NSPrivacyCollectedDataTypes:[] (lines 24–27), and docs/mobile-submission.md explicitly answers App Privacy with 'Tracking: none. No ads, no third-party analytics/SDKs.' If Sentry (or any crash reporter) ships in build 3, those become false statements: the ASC App Privacy questionnaire must add Diagnostics → Crash Data (and Performance Data if tracing is enabled), 'not linked to identity', 'not used for tracking'; the app.json privacy manifest should gain the corresponding NSPrivacyCollectedDataTypes entries (Sentry bundles its own PrivacyInfo.xcprivacy which Xcode merges, but the app-level declaration and the ASC answers are the developer's responsibility). An inconsistent label vs. binary is itself a rejection vector on a resubmission that is already under Guideline-2.1 scrutiny.
  - **Fix:** In the same commit that adds the crash SDK: update app.json privacyManifests with CrashData/PerformanceData collected-data entries, rewrite the App Privacy / Data Safety section of docs/mobile-submission.md, and update the ASC questionnaire before submitting build 3. Disable Sentry's PII defaults (sendDefaultPii off, no IP storage) to keep the 'not linked to identity' answer truthful.

- [ ] **150. No detection of orders stuck in 'pending' — a sleeping staff tablet means customers order into a void**  
  `medium` · add · effort M · _observability-ops-readiness_
  - **Where:** `supabase/functions/place-order/index.ts:385`, `supabase/functions/inventory-alerts/index.ts:111`
  - **Problem:** place-order creates the order and returns success to the customer; delivery to staff relies entirely on the business dashboard's Realtime subscription being alive. If the tablet is asleep, the browser tab crashed, or Realtime degrades, orders accumulate unseen — the customer was told 'order sent', waits, and leaves. Nothing server-side watches order age; no venue or platform alert exists for 'order pending > N minutes'. For an order-only product this is the primary money-losing failure mode and it is currently invisible to everyone.
  - **Fix:** Add a pg_cron job (every 5 min) that selects orders in status pending older than ~10 min and (a) posts venue+order_number to the ops webhook, (b) optionally emails the venue's alert recipients (venue_alert_recipients RPC already exists). Pair with a dashboard-side heartbeat so the platform can also alert when a venue with recent order history has had no connected staff dashboard during opening hours.

- [ ] **151. No CI at all — nothing gates typecheck/tests/lint before a Vercel production deploy or an EAS build**  
  `medium` · add · effort S · _observability-ops-readiness_
  - **Where:** `package.json:1`, `packages/integration/package.json:1`
  - **Problem:** .github/workflows does not exist. Vercel builds whatever is pushed; a broken commit on the production branch ships to paying cafés with no typecheck, no packages/shared unit tests, and no packages/integration run in front of it. The repo has real test suites (packages/shared/src/__tests__, packages/integration) that only run when someone remembers to run them locally. This is the cheapest observability there is — catching the regression before it needs monitoring.
  - **Fix:** Add .github/workflows/ci.yml: pnpm install, turbo-style parallel typecheck (web, mobile, shared), shared unit tests, lint; run on every PR and on pushes to develop/main. Gate Vercel production promotion on the check (Vercel Git integration honors GitHub checks). Integration tests can stay manual/nightly since they need a Supabase stack.


### web-http-security-headers-host-scoping

- [ ] **152. Baseline hardening headers absent: Permissions-Policy, Referrer-Policy, X-Content-Type-Options, explicit HSTS**  
  `medium` · add · effort S · _web-http-security-headers-host-scoping_
  - **Where:** `apps/web/src/proxy.ts:19`, `apps/web/src/app/r/_venue/use-location-gate.ts:62`, `apps/web/src/app/app/discover.tsx:47`
  - **Problem:** No response sets Permissions-Policy despite the customer app and portal using geolocation (apps/web/src/app/r/_venue/use-location-gate.ts:62, apps/web/src/app/app/discover.tsx:47, apps/web/src/app/business/settings/location-picker.tsx:201); no Referrer-Policy (full URL paths of portal/admin pages leak to OSM tile servers and any future external link targets on older browsers); no X-Content-Type-Options: nosniff on app responses; and HSTS is only whatever Vercel injects by default (max-age=63072000, no includeSubDomains, no preload — and platform-implicit rather than owned by the repo). Verify with curl -sI https://business.chehia.app.
  - **Fix:** In the same proxy.ts headers block: Permissions-Policy: geolocation=(self), camera=(), microphone=(), payment=(), usb=(); Referrer-Policy: strict-origin-when-cross-origin; X-Content-Type-Options: nosniff; Strict-Transport-Security: max-age=63072000; includeSubDomains (add preload only after confirming every chehia.app subdomain is HTTPS-only forever).

- [ ] **153. robots.ts omits /caisse and /auth, and no surface emits a noindex signal (Disallow alone does not prevent indexing)**  
  `medium` · fix · effort S · _web-http-security-headers-host-scoping_
  - **Where:** `apps/web/src/app/robots.ts:8`, `apps/web/src/app/business/layout.tsx:6`, `apps/web/src/app/caisse/layout.tsx:5`, `apps/web/src/app/admin/layout.tsx:1`
  - **Problem:** apps/web/src/app/robots.ts:8 disallows only /admin, /business and /r/ — the POS register (/caisse) and the OAuth callback (/auth) are crawlable on every host. Worse, robots Disallow only blocks crawling: externally-linked /admin or /business/login URLs can still appear in Google's index (URL-only listings) because nothing sends noindex — the business layout (apps/web/src/app/business/layout.tsx:6) and caisse layout (apps/web/src/app/caisse/layout.tsx:5) export metadata without robots:{index:false}, and the admin layout (apps/web/src/app/admin/layout.tsx:1) is a client component that cannot export metadata at all.
  - **Fix:** Add '/caisse' and '/auth' to the disallow list, and — since proxy.ts already sees every page request — set 'X-Robots-Tag: noindex, nofollow' on responses for the /admin, /business, /caisse and /auth prefixes (this covers the client-component admin layout too and works on every host). Optionally also add robots:{index:false} to the business/caisse layout metadata for defense in depth.

- [ ] **154. Caisse service worker is gated to a host the POS doesn't run on, and its root scope would cache authenticated portal HTML**  
  `medium` · fix · effort M · _web-http-security-headers-host-scoping_
  - **Where:** `apps/web/src/app/caisse/caisse-provider.tsx:631`, `apps/web/public/caisse-sw.js:21`, `apps/web/src/proxy.ts:48`
  - **Problem:** apps/web/src/app/caisse/caisse-provider.tsx:631 registers /caisse-sw.js only when location.hostname starts with 'caisse.', but the POS is live at business.chehia.app/caisse (per proxy.ts:48-52 business.* redirects to /caisse-adjacent portal, and the deployment notes say the register ships at business.chehia.app/caisse) — so the offline-first promise silently never activates where cashiers actually use it. If the gate were simply widened, a second problem appears: the worker lives at the origin root so its scope is '/', and its fetch handler (apps/web/public/caisse-sw.js:21-33) caches EVERY same-origin GET into Cache Storage — on a shared POS tablet that would persist authenticated /business portal HTML and keep controlling non-POS surfaces of the origin.
  - **Fix:** Serve the worker under the /caisse path (e.g. a route handler at /caisse/sw.js, or keep the public file and send 'Service-Worker-Allowed: /caisse' from proxy.ts) and register it with { scope: '/caisse' }; gate registration on pathname (already inside the caisse provider) rather than hostname so it works on business.chehia.app/caisse, caisse.chehia.app and previews alike. In the fetch handler, only cache requests whose URL path is /caisse* or /_next/static/*.

- [ ] **155. Preview deployments are publicly reachable with prod-identical UI wired to the dev backend**  
  `medium` · enhance · effort S · _web-http-security-headers-host-scoping_
  - **Where:** `apps/web/src/proxy.ts:12`, `apps/web/src/lib/supabase.ts:14`
  - **Problem:** Every Vercel preview URL serves the full app — landing, customer flow, business portal, admin, Caisse — because proxy.ts deliberately leaves path routing open off-production, and apps/web/src/lib/supabase.ts:14-17 hardcodes the dev project credentials selected on any preview build. Anyone who obtains a preview URL (leaked link, CI log, referrer) can drive Google sign-in and edge functions against the dev backend and see dev data with a pixel-perfect Chehia UI. Vercel stamps previews with X-Robots-Tag: noindex by default, but that is not access control.
  - **Fix:** Enable Vercel Deployment Protection (Standard Protection / Vercel Authentication) for preview deployments on the project; keep production public. Then prune any *.vercel.app wildcard entries from the Supabase auth redirect-URL allowlist that were added to make preview OAuth work, or replace them with the protection-bypass flow for automated tests.


### google-play-android-readiness

- [ ] **156. First Play submission cannot go through eas submit — the initial AAB must be uploaded manually**  
  `medium` · organize · effort S · _google-play-android-readiness_
  - **Where:** `apps/mobile/eas.json:38`, `docs/mobile-submission.md:29`
  - **Problem:** eas.json:38-41 configures submit.production.android (service account + internal track), but the Google Play Developer API — which eas submit uses — cannot create the first release of a brand-new app: the very first AAB has to be uploaded by hand in the Play Console UI before API submissions work. docs/mobile-submission.md:29 presents `eas submit --platform android` as the path, which will fail with a confusing API error on the first attempt. Also note the service account needs to be granted access to the app in Play Console > Users and permissions after the app record exists.
  - **Fix:** Document the bootstrap sequence: create app record → upload first AAB manually to internal testing → grant the service account release permissions → from then on `eas submit --platform android --profile production` works.

- [ ] **157. Android 16 ignores the portrait lock on large screens — tablet/Chromebook layouts untested and unexcludable**  
  `medium` · fix · effort M · _google-play-android-readiness_
  - **Where:** `apps/mobile/app.json:6`, `apps/mobile/src/app/index.tsx:76`
  - **Problem:** app.json:6 locks orientation to portrait, and unlike iOS (supportsTablet:false) Play has no way to exclude tablets/Chromebooks — the app WILL be installable there and Google's pre-launch report runs on tablets. With targetSdk 36 (node_modules/react-native/gradle/libs.versions.toml:4), Android 16 ignores orientation/resizability restrictions on displays ≥600dp: the app will be rendered in landscape and in freeform/split windows regardless of the portrait lock. Screens are flex/inset based so they may mostly reflow, but the fixed 240px scan-frame overlay (apps/mobile/src/app/index.tsx:76-77), bottom sheets, and the menu grid have never been seen at tablet widths or landscape aspect ratios.
  - **Fix:** Include a tablet (e.g. Pixel Tablet API 36 emulator) in Android QA, in landscape and split-screen. Fix anything broken rather than fighting the lock — Google explicitly removed the opt-out for targetSdk 36. This doubles as progress on Apple's iPad expectation from the rejection.

- [ ] **158. predictiveBackGestureEnabled:false is a deprecated opt-out, and menu-screen's BackHandler breaks once predictive back is on**  
  `medium` · enhance · effort M · _google-play-android-readiness_
  - **Where:** `apps/mobile/app.json:64`, `apps/mobile/src/components/venue/menu-screen.tsx:66`
  - **Problem:** app.json:64 opts out of predictive back (maps to android:enableOnBackInvokedCallback="false"). With targetSdk 36, Android 16 enables predictive back by default; the manifest opt-out is still honored but deprecated, slated for removal in a future Android release, and flagged in Play pre-launch reports. Compounding it, apps/mobile/src/components/venue/menu-screen.tsx:66-73 intercepts hardware back via BackHandler.addEventListener("hardwareBackPress") — that legacy callback stops firing entirely once the OnBackInvokedCallback path is active, so the category→landing back behavior would silently break the day the opt-out dies (or if a user forces predictive back in developer options).
  - **Fix:** Plan the migration now rather than at Android 17: remove predictiveBackGestureEnabled:false, verify react-native-screens 4.25 predictive-back animations through the venue stack, and replace the BackHandler intercept with navigation-state-driven handling (e.g. make the selected category a route or use expo-router's usePreventRemove/beforeRemove pattern).

- [ ] **159. RTL on Android relies on iOS-only writingDirection — Arabic bidi rendering unverified on Android**  
  `medium` · fix · effort M · _google-play-android-readiness_
  - **Where:** `apps/mobile/src/lib/theme.ts:112`, `apps/mobile/src/components/venue/offline-banner.tsx:33`
  - **Problem:** The app deliberately avoids I18nManager.forceRTL and mirrors per-render (apps/mobile/src/lib/theme.ts:112-118): rowDir() flips flexDirection and textDir() sets textAlign + writingDirection. But writingDirection is an iOS-only text style in React Native — on Android it is silently ignored, leaving Arabic text with only textAlign:'right' plus the platform's per-paragraph bidi heuristics. Mixed-direction strings (prices like '12,500 DT' inside Arabic sentences, Latin venue names, parenthesized counts, the '·' separators used across screens) are exactly where Android's first-strong-character heuristic mis-orders punctuation and numbers. Since no Android build has ever run, none of the AR screens have been seen on Android.
  - **Fix:** During Android QA, sweep every screen in Arabic. Where ordering breaks, wrap interpolated LTR fragments in Unicode bidi isolates (⁨…⁩) or prepend RLM (‏) in the shared i18n formatters (packages/shared) so both platforms benefit; keep the render-time mirroring approach otherwise.

- [ ] **160. Unused reanimated/worklets/gesture-handler native libs inflate the AAB and the 16KB-compliance surface**  
  `medium` · remove · effort S · _google-play-android-readiness_
  - **Where:** `apps/mobile/package.json:29`, `apps/mobile/package.json:36`
  - **Problem:** react-native-reanimated 4.5.0, react-native-worklets 0.10.0 and react-native-gesture-handler 2.32.0 (apps/mobile/package.json:29,36) have zero imports anywhere in apps/mobile/src (verified by grep). Reanimated + worklets ship sizeable C++ .so libraries per ABI, directly inflating Play download size and adding to the set of native libs that must stay 16KB-page-aligned (a hard Play requirement for apps targeting Android 15+; the current versions are compliant, but every future dep bump re-opens the question). expo-router's Stack needs only react-native-screens + safe-area-context, not these.
  - **Fix:** Remove the three packages (and confirm expo-router doesn't lazily require them — `expo start` will error loudly if it does; expo doctor also detects it). If any future feature needs animations, re-add deliberately. After the first Android build, check the AAB's lib/ for stragglers and run Play Console's 16KB compatibility check under App bundle explorer.

- [ ] **161. Symbol-glyph UI (⌖ ⌕ ⚑ ✕ ⌄ …) risks tofu on Android OEM font stacks (carry-over, Android angle)**  
  `medium` · fix · effort M · _google-play-android-readiness_
  - **Where:** `apps/mobile/src/app/index.tsx:104`, `apps/mobile/src/components/ui.tsx:426`, `apps/mobile/src/components/discover.tsx:1`
  - **Problem:** Already flagged generically; the Android-specific risk: buttons and status marks are Unicode symbols rendered through Manrope/IBM Plex Arabic (e.g. ✕ close in apps/mobile/src/app/index.tsx:104 and src/components/ui.tsx:426, plus ⌖ ⌕ ⌃ ⌄ ⚑ ★ ‹ › across discover.tsx, menu-screen.tsx, order-screen.tsx, venue-home.tsx). When a glyph is missing from the loaded font, Android falls back through Roboto → Noto; U+2315 (⌕) and U+2316 (⌖) are absent from Roboto and from many OEM/low-end Noto subsets, rendering as tofu boxes precisely on the budget Android devices common in the Tunisian market. iOS masks this because SF fallback covers them.
  - **Fix:** Replace the symbol glyphs with small react-native-svg icons (react-native-svg 15.15.4 is already a dependency and already used for the brand marks in ui.tsx) — at minimum for ⌖, ⌕, ⚑ and the chevrons. Verify on a physical low-end Android during the first QA pass.


### data-lifecycle-retention-growth

- [ ] **162. item-photos storage bucket only ever grows: zero .remove() calls in the codebase — every photo replace, item delete, or venue churn orphans objects forever**  
  `medium` · fix · effort M · _data-lifecycle-retention-growth_
  - **Where:** `apps/web/src/app/business/menu/item-editor.tsx:151`, `apps/web/src/app/business/menu/category-editor.tsx:57`, `apps/web/src/app/business/settings/page.tsx:58`, `supabase/migrations/20260703000002_storage_item_photos.sql:8`
  - **Problem:** All three upload sites generate a fresh `<restaurant_id>/<uuid>.<ext>` path with upsert:false and never delete the previous object: apps/web/src/app/business/menu/item-editor.tsx:151, apps/web/src/app/business/menu/category-editor.tsx:57, apps/web/src/app/business/settings/page.tsx:58 (logo/cover). grep for `.remove(` across apps/web/src finds only Leaflet map cleanup — no storage deletion exists anywhere. Deleting an item/category/restaurant row also leaves its objects. At the 5MB-per-file cap (20260703000002_storage_item_photos.sql:8-10) an owner who iterates on 30 item photos a few times orphans hundreds of MB per venue; storage is a metered Supabase cost. Staff DO have a delete policy on their own folder (storage_item_photos.sql:33-39), so the fix is purely client + a sweep.
  - **Fix:** Two-part fix: (1) client-side, after a successful replacement upload, call storage.from('item-photos').remove([oldPath]) parsed from the previous public URL (best-effort); (2) codify an orphan sweep in the retention migration — a monthly pg_cron job running e.g. `delete from storage.objects o where o.bucket_id='item-photos' and o.created_at < now() - interval '7 days' and not exists (select 1 from public.items i where i.photo_url like '%' || o.name) and not exists (select 1 from public.categories c where coalesce(c.image_url,'') like '%' || o.name) and not exists (select 1 from public.restaurants r where coalesce(r.logo_url,'') like '%' || o.name or coalesce(r.cover_url,'') like '%' || o.name);` (verify the exact referencing columns; the 7-day grace protects in-flight edits). Run it monthly, not daily — it scans the objects table.

- [ ] **163. leads retains PII (name, email, phone, IP) forever with no retention policy — legal exposure under Tunisian data-protection law**  
  `medium` · add · effort S · _data-lifecycle-retention-growth_
  - **Where:** `supabase/migrations/20260705000003_leads.sql:8`, `supabase/migrations/20260705000004_leads_ip.sql:4`, `supabase/functions/submit-lead/index.ts:59`
  - **Problem:** public.leads (20260705000003_leads.sql:8-21) stores name, business_name, email, phone, city, free-text message, plus the submitter's IP address (20260705000004_leads_ip.sql:4) — added purely for rate limiting (submit-lead/index.ts:59-63 caps 8/IP/hour and 300 global/hour). Nothing ever deletes or anonymizes these rows. Tunisia's Organic Law 2004-63 (and the platform's own credibility with restaurateur prospects) requires retention proportional to purpose: the IP has zero value after the 1-hour rate window, and a lead that went to status='closed' has no business value after the sales cycle ends. The status column ('new'/'contacted'/'closed', leads.sql:18) already gives the lifecycle hook.
  - **Fix:** In data_retention_tick(): (1) null the IP once it can no longer feed the rate limiter: `update public.leads set ip = null where ip is not null and created_at < now() - interval '7 days';` (the per-IP check only looks back 1 hour); (2) delete closed leads after 12 months and any lead after 24 months: `delete from public.leads where (status = 'closed' and updated_at < now() - interval '12 months') or created_at < now() - interval '24 months';`. If historical lead-volume stats matter, aggregate counts into a tiny stats row before deleting.

- [ ] **164. Stale open orders never auto-cancel: the kitchen board query is unbounded over status in ('new','preparing','ready') and 5 forgotten orders permanently brick a repeat customer's device**  
  `medium` · fix · effort S · _data-lifecycle-retention-growth_
  - **Where:** `apps/web/src/app/business/use-live-orders.ts:76`, `supabase/migrations/20260709000002_group_ordering.sql:424`, `supabase/functions/place-order/index.ts:248`
  - **Problem:** Two lifecycle consequences of orders that staff never advance: (1) apps/web/src/app/business/use-live-orders.ts:76-81 fetches ALL orders in ('new','preparing','ready') with no time bound — a venue that doesn't religiously mark orders served accumulates ancient rows on the live board (and PostgREST will eventually silently truncate at max_rows, which the code itself warns about for order_items at use-live-orders.ts:104-105); (2) place_order_tx's abuse cap (20260709000002_group_ordering.sql:424-429) counts open orders per created_by — since the anon uid persists in localStorage, a regular customer whose 5 old orders were never served/cancelled is PERMANENTLY unable to order from their phone ('too_many_open_orders'), with no recovery path short of clearing site data. The same stale rows also feed the per-5-min and per-table rate-limit counts in place-order/index.ts:248-270 (those are time-windowed, so unaffected — only the open-order cap is).
  - **Fix:** Add to data_retention_tick(): `update public.orders set status='cancelled' where status = 'new' and created_at < now() - interval '12 hours';` and consider `status in ('preparing','ready') and created_at < now() - interval '24 hours'` → 'served' (venue never confirmed; pay-at-counter means money was handled offline). The existing orders_status_idx (restaurant_id, status) keeps this cheap. This simultaneously bounds the live board, unbricks repeat customers, and keeps 'today' stats honest.

- [ ] **165. Caisse failed-sales dead-letter store (IndexedDB) has a count badge but no UI to view, retry, or clear — permanently-rejected money records accumulate invisibly on one device**  
  `medium` · add · effort M · _data-lifecycle-retention-growth_
  - **Where:** `apps/web/src/app/caisse/_register/offline-queue.ts:96`, `apps/web/src/app/caisse/caisse-provider.tsx:485`, `apps/web/src/app/caisse/_register/register.tsx:48`
  - **Problem:** Offline sales that the server permanently rejects are moved to the 'failed-sales' IndexedDB store with a reason (apps/web/src/app/caisse/_register/offline-queue.ts:96-99, called from caisse-provider.tsx:485,500,511). The register shows a count badge when failedCount > 0 (apps/web/src/app/caisse/_register/register.tsx:48), and offline-queue.ts:9-10 promises they are 'for the cashier to reconcile — never silently lost'. But the module only exports failedCount() — there is no function to LIST failed sales, no reconcile screen, no retry, and no purge. In practice: cash was collected, the sale will never reach the books, the cashier sees an ever-growing red number they can do nothing about, and the records die with the browser profile. Over 12 months this is both a data-loss trap (fiscal receipts missing for collected cash) and unbounded client-side growth.
  - **Fix:** Add allFailed()/removeFailed()/requeueFailed() to offline-queue.ts and a small reconcile panel in the Caisse (list each failed sale: time, total, lines, failed_reason; actions: retry (re-enqueue with same client_ref — server idempotency makes this safe), export/print for manual fiscal entry, dismiss). Also purge dismissed/failed rows older than e.g. 90 days.

- [ ] **166. ai_insights appends up to 9 rows per venue per day forever, each duplicating the full metrics jsonb — only the latest 3 rows are ever read**  
  `medium` · enhance · effort S · _data-lifecycle-retention-growth_
  - **Where:** `supabase/functions/generate-insights/index.ts:283`, `supabase/migrations/20260702000001_atomic_orders_and_metrics.sql:238`, `supabase/migrations/20260701000001_core_schema.sql:236`, `apps/web/src/app/business/stats/page.tsx:52`
  - **Problem:** generate-insights writes 3 cards x up to 3 languages per venue per run, and each row embeds the complete Metrics object (orders_by_hour, orders_by_weekday, top_items…) in the metrics jsonb column (supabase/functions/generate-insights/index.ts:283-292; core_schema.sql:236-247). replace_insights only deletes rows for the SAME (restaurant_id, generated_for) day (20260702000001_atomic_orders_and_metrics.sql:238-239), so every previous day accumulates: ~3.3k rows/venue/yr, each several KB — tens of MB/yr per venue of pure duplication. The only consumer reads `order by generated_for desc limit 3` for one language (apps/web/src/app/business/stats/page.tsx:52-57). Once pg_cron makes the function actually run nightly (see top finding), this becomes the fastest-growing jsonb table.
  - **Fix:** Two cheap wins: (1) retention — `delete from public.ai_insights where generated_for < current_date - 90;` in data_retention_tick() (keep 90 days in case a history view is ever built); (2) stop duplicating metrics 9x — write the metrics jsonb on only one row per (venue, day) or normalize into a tiny ai_insight_metrics table keyed by (restaurant_id, generated_for).


## P3 — Low (polish backlog)

_113 items._


### iOS/Android App Store compliance

- [ ] **167. Android intent filter pathPrefix "/r" over-matches (e.g. /robots.txt)**  
  `low` · fix · effort S · _iOS/Android App Store compliance_
  - **Where:** `apps/mobile/app.json:73`, `apps/mobile/app.json:78`
  - **Problem:** Both intentFilters entries use pathPrefix "/r", which is a raw string prefix on Android — it matches /robots.txt, /reviews, /r-anything, offering to open the app for URLs it can't handle (expo-router would land on a not-found for them).
  - **Fix:** Change both data entries to pathPrefix "/r/" (QRs encode /r/{slug}/t/{token}, so nothing legitimate is lost).

- [ ] **168. apps/mobile/LICENSE is Expo's own MIT license (650 Industries) — starter cruft in a PUBLIC repo**  
  `low` · remove · effort S · _iOS/Android App Store compliance_
  - **Where:** `apps/mobile/LICENSE:1`
  - **Problem:** The LICENSE file is copied verbatim from the Expo template ('Copyright (c) 2015-present 650 Industries, Inc.'). The repo AfraMAT/chehia is public (verified via gh), so this file publicly misattributes the app's copyright and implies the proprietary app is MIT-licensed by Expo.
  - **Fix:** Delete it, or replace with the project's actual license/copyright (e.g. 'Copyright AfraMAT — all rights reserved' if the code isn't meant to be open source; consider whether the repo should be private at all).

- [ ] **169. Doc drift: mobile-submission.md and README contradict the current eas.json/app.json state**  
  `low` · organize · effort S · _iOS/Android App Store compliance_
  - **Where:** `docs/mobile-submission.md:7`, `docs/mobile-submission.md:19`, `apps/mobile/README.md:5`, `apps/mobile/eas.json:35`
  - **Problem:** docs/mobile-submission.md:19 says ascAppId 'is intentionally omitted' but eas.json:35 now has "ascAppId": "6787508673"; the doc's 'What's already done' section still says ios.buildNumber "1" (it's 2) and 'trilingual camera and location usage strings' (now single French — the very thing that was rejected). apps/mobile/README.md:5 says 'one permission (camera...)' but the app also requests when-in-use location. Stale docs will mislead the next resubmission.
  - **Fix:** Refresh both docs after landing the Guideline 4 fixes: current build numbers, locales-based permission strings, ascAppId present, two permissions (camera + optional location).

- [ ] **170. eas.json hygiene: Apple ID email committed in a public repo; node version pinned only for production**  
  `low` · clean · effort S · _iOS/Android App Store compliance_
  - **Where:** `apps/mobile/eas.json:24`, `apps/mobile/eas.json:34`
  - **Problem:** eas.json commits appleId abbesmoez22@gmail.com and appleTeamId to a public repo — not secret, but a phishing/social-engineering surface; EAS reads EXPO_APPLE_ID from env as an alternative. The committed Supabase publishable keys are fine by design (RLS is the trust boundary, and supabase.ts documents this). "node": "20.18.0" is pinned only in the production profile, so dev/preview cloud builds can silently use a different Node and diverge.
  - **Fix:** Optionally move appleId to the EXPO_APPLE_ID env var; duplicate the node pin (or hoist shared config via a base profile with "extends") across all three build profiles.


### Mobile app user flows, UX completeness & feature parity

- [ ] **171. iPad compatibility mode unverified despite Apple's explicit iPad-function requirement**  
  `low` · fix · effort M · _Mobile app user flows, UX completeness & feature parity_ ✅verified
  - **Where:** `apps/mobile/app.json:14`
  - **Problem:** Apple reviewed on iPad Air 11" M3 and noted apps downloadable on iPad must function as expected; the app keeps supportsTablet:false (iPhone compatibility mode) and portrait-only. The layouts are flex/inset-based and should scale (scan overlay 240px frame, bottom sheets, FlatLists are all relative), but nothing in the repo shows an iPad QA pass, and the rejection makes iPad behavior a review-critical surface: camera QR scan, expo-location reads, bottom-sheet modals, and keyboard behavior in compatibility mode all need explicit verification.
  - **Fix:** Run the full flow (scan → order → track → rate, group ordering, discovery + near-me) on the iPad Air 11" simulator/hardware in compatibility mode and record it for the review notes. Longer-term consider supportsTablet:true with proper iPad screenshots, but only after layout QA — compatibility mode is acceptable to Apple if it works.

- [ ] **172. Scanned-flow menu/cart/order routes render a blank screen while loading**  
  `low` · fix · effort S · _Mobile app user flows, UX completeness & feature parity_
  - **Where:** `apps/mobile/src/app/r/[slug]/t/[token]/menu.tsx:14`, `apps/mobile/src/app/r/[slug]/t/[token]/cart.tsx:13`, `apps/mobile/src/app/r/[slug]/t/[token]/order/[orderId].tsx:14`
  - **Problem:** The scanned-flow routes return `null` while state is loading (t/[token]/menu.tsx:14, t/[token]/cart.tsx:13, t/[token]/order/[orderId].tsx:14), whereas the browse-flow equivalents render VenueHome's spinner. On a cold-start deep link straight to a menu URL (group share link `…/menu?s=CODE`) or an order URL, the customer stares at a blank cream screen for the whole venue fetch — on slow 3G that's several seconds of apparent freeze.
  - **Fix:** Mirror the browse routes: render VenueHome (spinner + invalid handling) instead of null while !ready.

- [ ] **173. MenuScreen back button unguarded on empty navigation stack**  
  `low` · fix · effort S · _Mobile app user flows, UX completeness & feature parity_
  - **Where:** `apps/mobile/src/components/venue/menu-screen.tsx:152`
  - **Problem:** The menu header's brand-mark back button calls router.back() (menu-screen.tsx:152). On a cold-start deep link directly into the menu route (group share link), the stack has nothing to pop — expo-router either no-ops or warns, leaving the customer with a dead button and no way to reach the venue landing.
  - **Fix:** Use `router.canGoBack() ? router.back() : go(basePath, "replace")` so the button always lands somewhere sensible.

- [ ] **174. 'Open until' ignores whether the venue is currently open; no weekly hours view**  
  `low` · enhance · effort M · _Mobile app user flows, UX completeness & feature parity_
  - **Where:** `apps/mobile/src/components/venue/venue-home.tsx:71`, `apps/web/src/app/r/_venue/venue-home.tsx:20`
  - **Problem:** closingTime (venue-home.tsx:71-75) just splits today's opening_hours entry and always prints "· Ouvert jusqu'à {h}" — at 06:00 before opening it still claims the venue is open until tonight's close, overnight ranges (e.g. 18:00-02:00) are mishandled, and there is no way to see the full week's hours anywhere in the app. The web app shares the identical logic, so this is not a parity gap, but for the requested venue-open-hours check it's the one real weakness.
  - **Fix:** Compare now against the open-close range (handling overnight wrap), render "Closed · opens at {h}" when outside it, and consider an expandable weekly-hours row on the venue landing.

- [ ] **175. No pull-to-refresh on discovery (or menu)**  
  `low` · enhance · effort S · _Mobile app user flows, UX completeness & feature parity_
  - **Where:** `apps/mobile/src/components/discover.tsx:268`
  - **Problem:** Discover loads venues once on mount (discover.tsx:68-70); the only refresh path is the error-state retry button. No RefreshControl exists anywhere in the app (verified by grep). A customer keeping the app open sees stale venue lists/ratings, and the menu similarly has no manual refresh.
  - **Fix:** Add RefreshControl to the discovery FlatList (re-run load()) and optionally to the menu screens (re-run the venue load).

- [ ] **176. Group nickname defaults to hardcoded English 'Guest'**  
  `low` · clean · effort S · _Mobile app user flows, UX completeness & feature parity_
  - **Where:** `apps/mobile/src/components/venue/group/group-sheet.tsx:52`
  - **Problem:** group-sheet.tsx:52 falls back to the literal "Guest" when the nickname field is empty; in a French/Arabic session other participants then see an English word in the participant list. Web has the same literal (apps/web group-sheet.tsx:41).
  - **Fix:** Add a t.group.defaultName dictionary key (Invité / ضيف / Guest) and use it on both surfaces.

- [ ] **177. Group cart hides chosen modifiers and silently drops failed in-group adds**  
  `low` · enhance · effort M · _Mobile app user flows, UX completeness & feature parity_
  - **Where:** `apps/mobile/src/components/venue/group/group-cart.tsx:164`, `apps/mobile/src/components/venue/item-sheet.tsx:91`
  - **Problem:** Two related group-flow soft spots: (1) group cart lines render only item name × qty × price (group-cart.tsx:164-190) — modifier choices (size, sugar, extras) that affect both the kitchen ticket and the price are invisible to the host before placing; (2) in a group session ItemSheet fires `void addLine(...)` and closes immediately (item-sheet.tsx:91), so a failed insert (dropped connection) loses the line with zero feedback. Web shares issue (1).
  - **Fix:** Render modifierLabels under each group-cart line (data is available via groupsByItem), and await addLine in ItemSheet with an inline error state before closing.

- [ ] **178. Unicode glyphs used as icons risk tofu on some Android fonts**  
  `low` · enhance · effort M · _Mobile app user flows, UX completeness & feature parity_
  - **Where:** `apps/mobile/src/components/discover.tsx:228`, `apps/mobile/src/components/venue/location-gate.tsx:31`, `apps/mobile/src/components/venue/order-screen.tsx:454`
  - **Problem:** The UI leans on unusual codepoints as icons: ⌕ (U+2315) for search, ⌖ for location/near-me, ⚑ for the too-far flag, ⌃/⌄ for the collapsible chevron (discover.tsx:189,228; menu-screen.tsx:245; venue-home.tsx:251; location-gate.tsx:31-58; order-screen.tsx:454). Coverage for these varies across Android OEM fonts and older devices — they can render as tofu boxes, degrading key affordances (the search and near-me buttons).
  - **Fix:** Replace the icon-bearing glyphs with small react-native-svg icons (the dependency is already installed and ZelligeMark shows the pattern).

- [ ] **179. Stars component invisible to screen readers; item-card label omits rating**  
  `low` · enhance · effort S · _Mobile app user flows, UX completeness & feature parity_
  - **Where:** `apps/mobile/src/components/ui.tsx:12`, `apps/mobile/src/components/venue/item-card.tsx:56`
  - **Problem:** Stars (ui.tsx:12-30) renders raw ★★★★★ text with no accessibilityLabel — VoiceOver reads "star star star star star" or the overlay twice; where it appears without the numeric text (none currently, but the component allows it) the rating is lost. ItemCard's otherwise-thorough a11yLabel (item-card.tsx:56-59) includes price/popular/sold-out but not the rating that sighted users see.
  - **Fix:** Give Stars `accessibilityLabel={formatRating(value)} / 5` (and hide the raw text), and append the rating to ItemCard's a11yLabel when rating_count > 0.

- [ ] **180. About/Privacy only reachable from the scan home; no Terms link**  
  `low` · organize · effort S · _Mobile app user flows, UX completeness & feature parity_
  - **Where:** `apps/mobile/src/app/about.tsx:37`, `apps/mobile/src/app/index.tsx:168`, `apps/mobile/src/components/discover.tsx:281`
  - **Problem:** The About & Privacy screen (about.tsx) is linked solely from the scan-home footer (index.tsx:168-177). A user who enters via discovery (/app) or lives inside a venue flow never encounters it, and the screen links only the privacy policy — the web app also has /legal/terms which mobile omits. Apple accepts App Store Connect metadata for the privacy URL, so this is polish, not compliance.
  - **Fix:** Add the about link to the discovery footer (next to "scan instead") and a Terms row on the About screen mirroring the privacy row.

- [ ] **181. Zero test coverage for the riskiest mobile client logic (offline queue / reconcile / provider)**  
  `low` · add · effort M · _Mobile app user flows, UX completeness & feature parity_
  - **Where:** `apps/mobile/src/lib/venue.tsx:500`, `packages/shared/src/__tests__`
  - **Problem:** apps/mobile has no test files at all (no __tests__, no *.test.*). The VenueProvider concentrates the app's most failure-prone logic — offline queueing with idempotency keys, transient-vs-permanent rejection handling, cache versioning, cart hydration/reconciliation, browse-table restore — and none of it is exercised outside manual QA. packages/shared covers the pure helpers (deeplink, cart math) but not this orchestration layer.
  - **Fix:** Extract the queue/retry decision logic into pure functions in packages/shared (they're nearly framework-free already) and unit-test the matrix: fetch-throw → queued, transient code → stays queued, permanent code → lines merged back, TTL expiry (once added), cache-version mismatch → miss.


### mobile codebase quality

- [ ] **182. randomUUID() duplicated three times in mobile (and ~8 more times in web) instead of living in shared**  
  `low` · clean · effort S · _mobile codebase quality_
  - **Where:** `apps/mobile/src/lib/venue.tsx:67-73`, `apps/mobile/src/lib/session.tsx:70-76`, `apps/mobile/src/components/venue/rating-sheet.tsx:17-22`, `apps/mobile/src/components/venue/category-landing.tsx:12-16`, `apps/mobile/src/components/venue/category-items.tsx:9-13`
  - **Problem:** The identical Math.random RFC4122 helper is copy-pasted in venue.tsx:68-73, session.tsx:71-76, and rating-sheet.tsx:17-22, and the same pattern recurs in at least 8 files in apps/web (caisse-provider, cart-screen, session-provider, rating-sheet, menu editors…). packages/shared has no uuid helper. Any future hardening (e.g. switching mobile to expo-crypto's cryptographically random randomUUID) must be done in 11 places. The chunk() helper is similarly duplicated in category-landing.tsx:12-16 and category-items.tsx:9-13 (and likely mirrors web).
  - **Fix:** Add a `randomUUID()` (and `chunk()`) to packages/shared/src/utils and replace all copies. Optionally have mobile pass through expo-crypto when available; Math.random is acceptable for idempotency keys as the comments note, but one definition should make that decision.

- [ ] **183. Edge-function fetch boilerplate (auth header + apikey + JSON) repeated in four places**  
  `low` · clean · effort S · _mobile codebase quality_
  - **Where:** `apps/mobile/src/lib/venue.tsx:452-498`, `apps/mobile/src/lib/venue.tsx:606-637`, `apps/mobile/src/lib/session.tsx:252-286`, `apps/mobile/src/components/venue/rating-sheet.tsx:54-85`
  - **Problem:** The ensureCustomerSession → getSession → fetch(functionsUrl(...), { Authorization, apikey, Content-Type }) sequence is written out in venue.tsx submitCart (468-489), venue.tsx callWaiter (620-632), session.tsx place (259-273), and rating-sheet.tsx submit (58-76). Each copy re-implements header assembly and error-shape parsing slightly differently (submitCart parses {error:{code}}, callWaiter only checks response.ok).
  - **Fix:** Add a `callEdgeFunction(name, body): Promise<{ok, status, json}>` helper next to functionsUrl in src/lib/supabase.ts that ensures the session, attaches headers, and normalizes JSON/non-JSON responses; keep per-caller error-code mapping where it is.

- [ ] **184. Group deep link: leaving a session immediately reopens the join sheet**  
  `low` · fix · effort S · _mobile codebase quality_
  - **Where:** `apps/mobile/src/components/venue/group/group-entry.tsx:22-29`
  - **Problem:** GroupEntry's effect (group-entry.tsx:23-29) opens the join sheet whenever `params.s` is set and there is no session, with [params.s, session] as deps. A customer who joined via a ?s=CODE link and later taps "Leave" in GroupCart gets session→null, the effect re-fires (the URL param never clears), and the join sheet pops open again uninvited — an annoying loop for exactly the deep-linked users the feature targets.
  - **Fix:** Track consumption in a ref (e.g. handledCodeRef) or clear the `s` param with router.setParams after the first open, so the effect fires once per incoming code rather than on every session→null transition.

- [ ] **185. Hardcoded UI strings bypass the i18n dictionary**  
  `low` · fix · effort S · _mobile codebase quality_
  - **Where:** `apps/mobile/src/components/venue/menu-screen.tsx:160`, `apps/mobile/src/components/venue/venue-home.tsx:285-287`, `apps/mobile/src/components/venue/group/group-sheet.tsx:52`
  - **Problem:** Three user-visible strings are hardcoded: (1) menu-screen.tsx:160 renders language names via an inline ternary ("Français"/"العربية"/"English") instead of LANGUAGE_LABELS from @chehia/shared (already imported elsewhere); (2) venue-home.tsx:286 hardcodes the section label "LANGUE · اللغة" — no English, and it ignores the active language; (3) group-sheet.tsx:52 defaults an empty nickname to the English "Guest" in all three languages. All other copy correctly flows through the typed Dictionary.
  - **Fix:** Use LANGUAGE_LABELS[lang] in menu-screen; add a dictionary key (or reuse an existing one) for the language-section label; add t.group.guestFallback (or similar) for the default nickname, mirroring whatever apps/web does.

- [ ] **186. Leftover Expo-template LICENSE file claims the app is MIT under 650 Industries copyright**  
  `low` · remove · effort S · _mobile codebase quality_
  - **Where:** `apps/mobile/LICENSE:1-5`
  - **Problem:** apps/mobile/LICENSE is the stock create-expo-app template license: "The MIT License (MIT) — Copyright (c) 2015-present 650 Industries, Inc. (aka Expo)". It neither reflects the app's ownership (AfraMAT) nor its intended licensing, and a tracked LICENSE at the package root is the kind of thing legal/review diligence trips on. (This is the only stray template file: there is no proxy.ts or other cruft at the mobile root.)
  - **Fix:** Delete the file, or replace it with the repository's actual license/proprietary notice if the monorepo has one.

- [ ] **187. Several dependencies are never imported: reanimated/worklets/gesture-handler (native bloat), react-dom/react-native-web**  
  `low` · clean · effort M · _mobile codebase quality_
  - **Where:** `apps/mobile/package.json:26-36`, `apps/mobile/app.json:96-99`
  - **Problem:** grep across src/ shows no imports of react-native-reanimated, react-native-worklets, react-native-gesture-handler, expo-system-ui, react-dom, or react-native-web. Reanimated 4 + worklets add meaningful native binary size and build time for zero direct use; react-dom/react-native-web only matter if the Expo web target (package.json "web" script, app.json web block) is actually shipped — the customer web app is apps/web, so it almost certainly is not. Caveats: expo-router pulls some of these as peers (gesture-handler for certain navigators; expo-linking/expo-constants are genuinely required), so removal must be validated. expo-font IS used (useFonts) and expo-web-browser is used in about.tsx.
  - **Fix:** Run `npx expo-doctor` and a test build after removing reanimated/worklets/expo-system-ui; drop react-dom/react-native-web + the "web" script and app.json web block if the Expo web target is not shipped. Keep gesture-handler only if expo-router complains. Do this after store approval — not worth destabilizing the resubmission build.

- [ ] **188. AsyncStorage accumulates unbounded per-venue state (menu bundles, carts, queues, order pointers, rating flags)**  
  `low` · enhance · effort S · _mobile codebase quality_
  - **Where:** `apps/mobile/src/lib/venue.tsx:108-117`, `apps/mobile/src/lib/venue.tsx:273-278`, `apps/mobile/src/components/venue/order-screen.tsx:128-138`
  - **Problem:** Every venue/table visited writes a full menu bundle (categories+items+modifiers+tables) under chehia.menu.*, plus chehia.cart.*, chehia.queue.*, chehia.order.*, chehia.session.*, and a chehia.rated.* flag per order (venue.tsx:110-113, 275-278; order-screen.tsx:131). Nothing is ever pruned except the 4h order pointer and version-mismatched cache entries. A customer who browses many venues carries every menu forever; AsyncStorage on Android has a 6MB default cursor limit and large getItem reads slow cold start.
  - **Fix:** Store a written-at timestamp (already present for menus) and lazily prune entries older than e.g. 14 days on app start, or cap chehia.menu.* to the N most recent venues. Rated flags can be folded into the order pointer entry.

- [ ] **189. Submit button disabled while offline, so the offline order queue can never be entered deliberately**  
  `low` · enhance · effort S · _mobile codebase quality_
  - **Where:** `apps/mobile/src/components/venue/cart-screen.tsx:379-389`, `apps/mobile/src/lib/venue.tsx:522-538`
  - **Problem:** CartScreen disables the place-order CTA when NetInfo reports offline (cart-screen.tsx:386 `disabled={submitting || !online}`), matching web (apps/web cart-screen.tsx:290). But placeOrder's carefully built P8 path — queue the cart with an idempotency key, auto-retry on reconnect — is only reachable when NetInfo says online yet fetch throws (flaky Wi-Fi). A customer with airplane-mode-level offline sees a dead button with no explanation instead of "we'll send it when you're back online", which the queue+banner UX already handles beautifully.
  - **Fix:** Product decision: either allow tapping submit while offline and route straight to the queue (the banner copy t.offline.queued already explains it), or keep the disabled button but add a one-line hint under it using t.errors.network so the dead button is explained. Keep mobile and web consistent either way.

- [ ] **190. Hardcoded endpoints and hosts are deliberate but scattered (prod Supabase fallback, SHARE_HOST, privacy URL)**  
  `low` · organize · effort S · _mobile codebase quality_
  - **Where:** `apps/mobile/src/lib/supabase.ts:14-18`, `apps/mobile/src/components/venue/group/group-cart.tsx:13`, `apps/mobile/src/app/about.tsx:40`
  - **Problem:** Three hardcoded network constants: (1) supabase.ts:14-15 embeds the PROD Supabase URL + publishable key as the release default — this is acceptable (publishable keys are public by design, RLS is the boundary, and the comment + README document the override chain), but it also means a local dev run with a missing/renamed .env silently writes to production; (2) group-cart.tsx:13 hardcodes SHARE_HOST="https://chehia.app" for group invite links; (3) about.tsx:40 hardcodes the privacy URL (verified: apps/web/src/app/legal/privacy exists). None are bugs, but they are three separate places to touch if the domain or project ever changes.
  - **Fix:** Keep the committed publishable keys (explicitly fine). Add a `if (__DEV__ && !process.env.EXPO_PUBLIC_SUPABASE_URL) console.warn(...)` guard in supabase.ts so a dev pointing at prod is loud, and centralize SHARE_HOST + the legal URL into a small src/lib/config.ts (or a shared constant, since web needs the same host).

- [ ] **191. discover venue query select("*") exposes all restaurant columns to anonymous clients**  
  `low` · enhance · effort M · _mobile codebase quality_
  - **Where:** `apps/mobile/src/components/discover.tsx:46-66`
  - **Problem:** discover.tsx:48-58 selects * from restaurants for anonymous users — deliberately, per the in-code comment, to survive backends where the ratings columns don't exist. The trade-off is that internal columns (plan, phone, onboarding_completed_at, inventory_alerts_enabled, full opening_hours, geofence settings) ride along to every anonymous client. Not a vulnerability today (rows are already public-readable active venues, and RLS governs rows not columns here), but it grows silently as business-side columns are added to the table.
  - **Fix:** Longer term, expose a `discovery_venues` view (or RPC) with exactly the customer-facing columns and point both web and mobile discovery at it; that removes the schema-drift motivation for select("*") too. Backend change, so schedule with the next migration batch.


### web customer app

- [ ] **192. PWA manifest lacks 192/512px icons — Android/Chrome one-tap install can never fire**  
  `low` · fix · effort S · _web customer app_ ❌REFUTED (see note)
  - **Where:** `apps/web/src/app/manifest.ts:15`, `apps/web/src/components/use-install.ts:89`, `apps/web/src/components/install-banner.tsx:90`
  - **Problem:** manifest.ts lists only favicon.ico (any), a 32x32 /icon and a 180x180 /apple-icon. Chrome's installability criteria require at least a 192x192 (and 512x512 for splash) icon, so beforeinstallprompt never fires, canPrompt in use-install.ts stays false, and the 'Ajouter maintenant' one-tap install button shipped in the latest commit (install-banner.tsx) is dead on Android/desktop Chrome — users only ever see the fallback hint text. There is also no maskable icon, so even a manual add gets a white-boxed icon on Android.
  - **Fix:** Add icon-192 and icon-512 routes (ImageResponse, like apple-icon.tsx) or static PNGs, list them in manifest.ts with purpose 'any' and a 'maskable' variant, then verify beforeinstallprompt fires in Chrome DevTools Lighthouse/Application panel.
  - **Verifier note:** Code facts verified: all three manifests (apps/web/src/app/manifest.ts, public/business.webmanifest, public/caisse.webmanifest) top out at a 180x180 purpose-'any' PNG (/apple-icon, served by app/apple-icon.tsx as ImageResponse PNG), with no 192/512 or maskable icons. However, the headline claim is wrong: Chrome does NOT require 192x192 for installability. Current Chromium source (components/webapps/browser/installable/installable_evaluator.cc) enforces kMinimumPrimaryIconSizeInPx = 144 for an IconPurpose::ANY icon; the 180x180 PNG passes, all other criteria (name, start_url, display standalone) are met, and a service worker is no longer required. So beforeinstallprompt should fire, canPrompt becomes true, and the 'Ajouter maintenant' one-tap button is not dead — the '192 required / install can never fire' causal chain and high severity are refuted. What remains true and worth fixing as polish: missing 512px icon degrades the Android splash screen, 180px gets upscaled on high-DPI launchers, missing maskable icon gets letterboxed on Android adaptive launchers, and Lighthouse flags the manifest (Lighthouse audits 192/512 even though Chrome enforces 144). Recommendation to add 192/512 + maskable variants is still valid, but severity is low (cosmetic), not high.

- [ ] **193. Menu photos and venue covers bypass all image optimization and have no intrinsic size**  
  `low` · enhance · effort M · _web customer app_
  - **Where:** `apps/web/src/components/ui.tsx:163`, `apps/web/src/app/r/_venue/venue-home.tsx:36`, `apps/web/src/components/menu-art.tsx:161`
  - **Problem:** PhotoPlaceholder renders a raw <img> (eslint-disabled no-img-element) with no width/height and no next/image, so full-resolution Supabase-storage uploads are shipped to phones (the 290px venue cover, every item photo), and missing dimensions invite CLS. On a menu with many photographed items this is the dominant page-weight cost on 3G.
  - **Fix:** Use next/image (fill + sizes) for venue covers and item photos, or append Supabase render/transform parameters (width/quality) to storage URLs and set explicit width/height attributes.

- [ ] **194. Bottom sheets don't move or trap focus (keyboard/screen-reader users stay behind the overlay)**  
  `low` · enhance · effort M · _web customer app_
  - **Where:** `apps/web/src/app/r/_venue/item-sheet.tsx:57`, `apps/web/src/app/r/_venue/table-picker.tsx:16`, `apps/web/src/app/r/_venue/rating-sheet.tsx:45`
  - **Problem:** ItemSheet, TablePicker, WaiterSheet, RatingSheet, GroupSheet and GroupCart set role=dialog/aria-modal and restore focus on close, but never move focus into the sheet on open and don't trap Tab, so keyboard focus and screen-reader reading order remain on the obscured page. Escape/backdrop-close and focus-restore are already done — this is the missing third piece.
  - **Fix:** On open, focus the sheet container (tabIndex={-1}) or first control, and add a simple focus trap (or use a <dialog>/focus-trap utility) shared by all sheets.

- [ ] **195. Category drill-down pollutes browser history**  
  `low` · fix · effort S · _web customer app_
  - **Where:** `apps/web/src/app/r/_venue/menu-screen.tsx:63`, `apps/web/src/app/r/_venue/menu-screen.tsx:209`
  - **Problem:** Entering a category pushes a history state; leaving via the in-app 'back to categories' button does not pop it, so the stale entry lingers and the hardware/browser back button needs an extra press (and repeated drill-ins stack more entries). The popstate listener is also removed when selectedRootId changes, so mixed navigation sequences behave inconsistently.
  - **Fix:** In onBack, call history.back() when a state was pushed (letting the popstate handler clear selection), or use replaceState instead of pushState.

- [ ] **196. Order-screen stall timer is never cleared once the order loads**  
  `low` · clean · effort S · _web customer app_
  - **Where:** `apps/web/src/app/r/_venue/order-screen.tsx:73`, `apps/web/src/app/r/_venue/order-screen.tsx:66`
  - **Problem:** The 7s stall backstop fires unconditionally (if not cancelled) and sets loadStalled=true even after a successful load; it's invisible today only because the stalled UI is gated on !order, but it leaves latent wrong state and re-arms on every reloadKey bump.
  - **Fix:** clearTimeout(stallTimer) inside fetchOrder's success path (or gate the timer callback on the current order state via a ref).

- [ ] **197. unknown_table error leaves the dead table attached to the cart**  
  `low` · enhance · effort S · _web customer app_
  - **Where:** `apps/web/src/app/r/_venue/cart-screen.tsx:84`, `apps/web/src/app/r/_venue/venue-provider.tsx:215`
  - **Problem:** When place-order returns unknown_table (table deactivated between pick and submit in the browse flow), the screen shows the error but keeps the stale tableId/table chip; the customer has to figure out they must tap 'changer' themselves, and a blind retry fails identically.
  - **Fix:** On unknown_table: clear the cart's tableId and table state and auto-open the TablePicker.

- [ ] **198. Stored language applied only after hydration — Arabic users get a French flash every load**  
  `low` · enhance · effort S · _web customer app_
  - **Where:** `apps/web/src/components/i18n-provider.tsx:37`, `apps/web/src/app/layout.tsx:64`
  - **Problem:** I18nProvider initializes from the SSR-safe default (venue default_language or fr) and only reads localStorage in a useEffect, so returning ar/en users see a French first paint and a layout direction flip on every page load.
  - **Fix:** Set lang/dir before hydration with a tiny inline script in the root layout (reading the chehia.lang key), or accept SSR French but at least apply dir synchronously via a beforeInteractive script to avoid the RTL flip.

- [ ] **199. Discovery over-fetches: select("*") ships every restaurant column to every visitor**  
  `low` · enhance · effort S · _web customer app_
  - **Where:** `apps/web/src/app/app/page.tsx:18`, `apps/web/src/app/r/_venue/loader.ts:14`
  - **Problem:** The /app discovery query selects * from restaurants (full appearance/settings/opening_hours JSON for every active venue) purely for a list card needing ~10 fields. The in-code justification (reviews migration might be missing in prod) is obsolete now that ratings shipped to prod. Same pattern in loadRestaurant.
  - **Fix:** Switch to an explicit column list (id, slug, name, tagline_i18n, city, address, cover_url, latitude, longitude, geofence_radius_m, rating_avg, rating_count) to cut payload and stop implicitly exposing future columns.

- [ ] **200. Session-provider dead code and duplicated place() branches**  
  `low` · clean · effort S · _web customer app_
  - **Where:** `apps/web/src/app/r/_venue/group/session-provider.tsx:271`, `apps/web/src/app/r/_venue/group/session-provider.tsx:234`
  - **Problem:** SessionProvider destructures `restaurant` only to `void restaurant;` it at the bottom (a lint hack), and place()'s group/solo branches are byte-identical (both setSession(null); persist(null)) under a comment implying they differ.
  - **Fix:** Drop restaurant from the useVenue() destructure and collapse the if/else into one unconditional cleanup.

- [ ] **201. 'Open until' is naive about hours format, current-day logic and server timezone**  
  `low` · enhance · effort S · _web customer app_
  - **Where:** `apps/web/src/app/r/_venue/venue-home.tsx:20`
  - **Problem:** venue-home splits opening_hours[day] on '-' and always shows the closing time, even when the venue is currently closed or the string is malformed; being a client component rendered on the server, the day is computed in the server's timezone (UTC on Vercel) so near midnight the SSR text can differ from the client's (hydration text mismatch) and show the wrong day's hours.
  - **Fix:** Parse hours defensively, compare against the current time to show 'Ouvert jusqu'à HH:MM' vs 'Fermé — ouvre à HH:MM', and compute in Africa/Tunis explicitly (or defer rendering to after mount).

- [ ] **202. Verified fixed: QR deeplink domain consistency and host routing are now correct**  
  `low` · organize · effort S · _web customer app_
  - **Where:** `apps/web/src/lib/site.ts:14`, `apps/web/src/proxy.ts:30`, `docs/app-store-review/review-reply.md:34`
  - **Problem:** For the record against the prior audit: printed QRs encode app.chehia.app (qrOrigin → APP_URL), the /r routes resolve on every host so legacy chehia.app/r/... codes keep working, proxy.ts canonicalizes /app to the subdomain only in production and correctly skips metadata/well-known paths, and mobile associatedDomains cover both chehia.app and app.chehia.app — matching the demo QR in docs/app-store-review (https://app.chehia.app/r/cafe-el-marsa/t/demo-elmarsa-t12). No action needed beyond the AASA env-var item reported separately.
  - **Fix:** Close the old 'QR deeplink domain mismatch' finding; keep site.ts as the single source of truth for origins.


### Business portal

- [ ] **203. Offline replay trusts captured_subtotal and cross-venue item ids without consistency checks**  
  `low` · fix · effort S · _Business portal_
  - **Where:** `supabase/functions/register-order/index.ts:156`
  - **Problem:** register-order's replay path accepts any integer captured_subtotal without verifying it equals the sum of captured lines (index.ts:168-170; a negative value is only stopped by the DB check constraint → opaque 500 → dead-letter), and captured line item_ids are not validated as belonging to the venue (only UUID shape), so foreign item ids can be written into order_items. Requires an authenticated staff token, so impact is limited to messy/inconsistent fiscal records from a buggy or tampering client.
  - **Fix:** Reject replays where captured_subtotal != sum(lines) or any item_id is not from the venue; return a distinct error code so the sale dead-letters with a clear reason.

- [ ] **204. No portal entry point to the register (caisse.chehia.app)**  
  `low` · add · effort S · _Business portal_
  - **Where:** `apps/web/src/app/business/sidebar.tsx:15`, `apps/web/src/app/business/caisse/page.tsx:22`
  - **Problem:** The sidebar 'Caisse' item opens reports/fiscal only; nothing in the portal links to the actual register surface. Staff must know the caisse.chehia.app URL (or /caisse path) by word of mouth — poor discoverability for the flagship POS feature.
  - **Fix:** Add an 'Ouvrir la caisse' button (sidebar or /business/caisse header) linking to the register, using location.hostname to pick subdomain vs path in dev/preview.

- [ ] **205. queueSale failure shows the wrong error ('choose a table') for IndexedDB failures**  
  `low` · fix · effort S · _Business portal_
  - **Where:** `apps/web/src/app/caisse/_register/tender-sheet.tsx:59`, `apps/web/src/app/caisse/caisse-provider.tsx:523`
  - **Problem:** When the offline enqueue fails (private-mode/quota IndexedDB errors, or missing staff/restaurant), TenderSheet maps every failure to t.caisse.errors.noTable (tender-sheet.tsx:59-63), telling the cashier to pick a table when the actual problem is that the sale could not be stored locally — and the cash may already be in the drawer.
  - **Fix:** Return a reason code from queueSale ({ok:false, code:'storage'|'no_table'}) and show a distinct 'impossible d'enregistrer hors-ligne' message.

- [ ] **206. Menu photo import allows 0-price items through silently**  
  `low` · enhance · effort S · _Business portal_
  - **Where:** `apps/web/src/app/business/menu/menu-import.tsx:192`, `apps/web/src/app/business/menu/menu-import.tsx:425`
  - **Problem:** doImport maps unparsed prices to 0 (menu-import.tsx:192 `parseMenuPrice(it.priceText) ?? 0`); the review UI marks empty prices with only a warning border. An owner who misses one field publishes an item customers can order for free — and the caisse will happily ring it at 0.
  - **Fix:** Block import while kept items have empty/zero prices (or require an explicit 'importer quand même' confirmation listing the affected items).

- [ ] **207. No staff visibility or controls for group ordering sessions**  
  `low` · add · effort M · _Business portal_
  - **Where:** `supabase/migrations/20260709000002_group_ordering.sql:33`, `apps/web/src/app/business/orders/page.tsx:249`
  - **Problem:** Staff RLS grants read on order_sessions, and order/kitchen cards show a 👥 badge, but the portal has no view of live group sessions and no way to close a stuck one. The schema allows only one live session per table (unique index) and start_session auto-joins any existing live session, and no expiry mechanism exists in 20260709000002_group_ordering.sql — a session abandoned in 'open' means the next unrelated party at that table silently joins the previous group's cart.
  - **Fix:** Add a staff 'force close session' action (RPC setting status='closed', owner/manager) surfaced from the floor plan tile, and/or a server-side TTL that expires idle open sessions.

- [ ] **208. Ratings moderation: hidden reviews cannot be restored, no owner response**  
  `low` · enhance · effort S · _Business portal_
  - **Where:** `apps/web/src/app/business/ratings/page.tsx:55`, `apps/web/src/app/business/ratings/page.tsx:159`
  - **Problem:** The business can hide an approved review (ratings/page.tsx:55-60) but there is no un-hide — a mis-tap permanently buries a good review (only fixable by platform admin/SQL). There is also no owner-reply capability, which is table stakes for a reviews feature.
  - **Fix:** Add 'Ré-afficher' on hidden reviews (update status back to approved) and consider a response field surfaced in the customer app.

- [ ] **209. Menu page lacks load error/loading state; item reorder no-ops on duplicate sort_order**  
  `low` · enhance · effort S · _Business portal_
  - **Where:** `apps/web/src/app/business/menu/page.tsx:47`, `apps/web/src/app/business/menu/page.tsx:112`
  - **Problem:** MenuManagementPage.reload() ignores query errors — on failure the page just renders an empty menu with no retry (menu/page.tsx:47-58), indistinguishable from 'no menu yet'. moveItem swaps sort_order values (112-122), which is a permanent no-op when two siblings share the same sort_order (possible after imports or same-valued inserts).
  - **Fix:** Track a loading/error state with retry on the menu page; in moveItem, renumber the whole category (0..n) when duplicates are detected.

- [ ] **210. Orphaned uploads: replaced/deleted photos never removed from storage**  
  `low` · clean · effort M · _Business portal_
  - **Where:** `apps/web/src/app/business/menu/item-editor.tsx:140`, `apps/web/src/app/business/settings/page.tsx:51`, `apps/web/src/app/business/menu/category-editor.tsx:48`
  - **Problem:** Item photos, category images and venue covers upload a new random path each time (item-editor.tsx:140-160, category-editor.tsx:48-65, settings/page.tsx:51-64) and the old object is never deleted — nor when the item itself is deleted. The item-photos bucket accretes unbounded orphans, all publicly readable.
  - **Fix:** Delete the previous storage object after a successful replacement/removal (best-effort), or add a periodic cleanup job comparing bucket contents to referenced URLs.

- [ ] **211. settle-order accepts cash tendered below the amount due**  
  `low` · fix · effort S · _Business portal_
  - **Where:** `supabase/functions/settle-order/index.ts:94`
  - **Problem:** The server clamps change to >= 0 but never validates tendered_millimes >= amount (settle-order/index.ts:94-97); only the client blocks under-tendering (canConfirm). A modified client can record a cash payment 'tendered 0' against a full amount — the payment row still books the full amount so totals stay right, but the tendered/rendu audit trail is nonsense.
  - **Fix:** Reject cash settles where tendered < amount (or null it and record amount as tendered) server-side.

- [ ] **212. Duplicate/conflicting Tailwind classes left from design passes**  
  `low` · clean · effort S · _Business portal_
  - **Where:** `apps/web/src/app/business/orders/page.tsx:39`, `apps/web/src/app/business/kitchen/page.tsx:120`, `apps/web/src/app/business/stats/page.tsx:177`, `apps/web/src/app/business/menu/item-editor.tsx:315`
  - **Problem:** Several class strings contain contradictory duplicates whose winner depends on stylesheet order, e.g. orders/page.tsx:39 'pt-4.5 … pt-5', :56 'gap-4.5 … gap-5', :77 'p-4.5 … p-5'; kitchen/page.tsx:66 'gap-4.5 … gap-5', :120 'p-4.5 … p-4'; stats/page.tsx:177 and :229 'p-4.5 … p-4'; item-editor.tsx:315 'p-4.5 … p-5'.
  - **Fix:** Sweep with eslint-plugin-tailwindcss (no-contradicting-classname) or a one-off grep and keep the intended value.


### Platform admin surface

- [ ] **213. Admin login treats a transient membership-check failure as "not an admin" and signs the user out**  
  `low` · fix · effort S · _Platform admin surface_
  - **Where:** `apps/web/src/app/admin/login/page.tsx:41`, `apps/web/src/app/admin/admin-provider.tsx:43`
  - **Problem:** After a successful password sign-in, admin/login/page.tsx:41-51 checks platform_admins with maybeSingle() but discards the error: a network/DB failure yields row=null, which signs the legitimate admin out and shows t.admin.notAdmin. The AdminProvider was explicitly built to distinguish error from not-admin (admin-provider.tsx:43-50) — the login page predates that care.
  - **Fix:** Destructure the error; on error show a generic retry message without signing out, and only sign out + show notAdmin when the query genuinely returned no row.

- [ ] **214. Admin venue detail spins forever for an unknown or deleted venue id**  
  `low` · fix · effort S · _Platform admin surface_
  - **Where:** `apps/web/src/app/admin/venues/[id]/page.tsx:31`, `apps/web/src/app/admin/venues/[id]/page.tsx:62`
  - **Problem:** venues/[id]/page.tsx:31-34 sets restaurant to null when the id doesn't resolve, and the render at lines 62-68 shows an infinite spinner whenever restaurant is null — there is no distinction between loading and not-found, and query errors are also swallowed.
  - **Fix:** Track a loaded flag; when loaded && !restaurant render a "venue not found" card with a back-to-/admin link.

- [ ] **215. Hardcoded French strings in admin/portal guard screens bypass i18n**  
  `low` · clean · effort S · _Platform admin surface_
  - **Where:** `apps/web/src/app/admin/admin-provider.tsx:84`, `apps/web/src/app/business/portal-provider.tsx:162`, `apps/web/src/app/business/portal-provider.tsx:217`
  - **Problem:** The not-admin and error cards in admin-provider.tsx:84-93 and 100-115 ("Accès non autorisé", "Ce compte n'a pas accès…", "Se déconnecter", "Une erreur est survenue", "Réessayer") and the equivalent no-staff / setup-in-progress screens in portal-provider.tsx:162-176 and 217-227 are literal French, while every other admin string is properly trilingual (fr/ar/en verified present in packages/shared/src/i18n/*). An Arabic-preferring staff member hitting the "Configuration en cours" wait screen gets French only. These screens render outside I18nProvider, which is why they were hardcoded.
  - **Fix:** Wrap the guard screens in a minimal I18nProvider (the language storage key is readable before auth resolves) or use a tiny static trilingual map for these five strings.

- [ ] **216. ReviewsConfig accepts invalid values and hides half the config columns**  
  `low` · enhance · effort S · _Platform admin surface_
  - **Where:** `apps/web/src/app/admin/reviews-config.tsx:104`, `supabase/migrations/20260707000001_reviews.sql:224`
  - **Problem:** reviews-config.tsx:104,116 parse with Number(...) || 0, and the min/max input attributes don't constrain typed values — an admin can save max_comment_len=0 or review_window_days=0; platform_reviews_config has no CHECK constraints on these (20260707000001_reviews.sql:224-231), and window 0 would make every review submission fall outside the window in submit-review. Also min_comment_len and cooldown_hours exist in the table but are absent from the UI — either dead columns or a missing feature.
  - **Fix:** Clamp on save (e.g., max_comment_len 40–2000, review_window_days 1–365) and add matching CHECK constraints; expose min_comment_len/cooldown_hours in the UI or drop the columns.

- [ ] **217. admin-provision-business accepts unbounded slug length**  
  `low` · fix · effort S · _Platform admin surface_
  - **Where:** `supabase/functions/admin-provision-business/index.ts:64`, `supabase/functions/_shared/admin.ts:38`
  - **Problem:** SLUG_RE (functions/_shared/admin.ts:38) validates characters but not length; slugify() slices to 60 only when the slug is auto-derived. A caller-supplied 500-char slug passes validation (admin-provision-business/index.ts:64) and lands in the restaurants row and every printed QR URL. The web UI's slugify caps at 60 (create-business.tsx:15) but the function is the trust boundary.
  - **Fix:** Reject slugs longer than 60 chars in admin-provision-business (and cap name/city lengths while there).

- [ ] **218. Moderation queue: no pending-count badge, 500-row cap without pagination, approve-all scope**  
  `low` · enhance · effort S · _Platform admin surface_
  - **Where:** `apps/web/src/app/admin/reviews-moderation.tsx:57`, `supabase/migrations/20260707000001_reviews.sql:456`
  - **Problem:** admin_reviews_moderation caps at 500 rows (20260707000001_reviews.sql:456) with no pagination; the Moderation tab shows no pending count so an admin must click through to see if work is waiting; approveAll (reviews-moderation.tsx:57-64) approves only loaded rows, which silently diverges from "all" past 500 pending. Fine at current scale, misleading at target scale.
  - **Fix:** Add a pending count to the tab label (cheap head-count query), and either paginate or have approve-all run a status-scoped UPDATE via a gated RPC.

- [ ] **219. /admin has no server-side route protection or host scoping (client-guard + RLS only)**  
  `low` · enhance · effort M · _Platform admin surface_
  - **Where:** `apps/web/src/app/admin/layout.tsx:7`, `apps/web/next.config.ts:13`, `apps/web/src/app/robots.ts:8`
  - **Problem:** There is no middleware.ts in apps/web; all /admin pages are client components guarded by AdminProvider after hydration. Data is safe (RLS + self-gated RPCs verified across all admin queries), so this is defense-in-depth, not a hole. The admin shell is also served on every host — chehia.app/admin, app.chehia.app/admin, business.chehia.app/admin — since next.config.ts has no host-based routing. robots.ts already disallows /admin.
  - **Fix:** Optional hardening for final form: a Next middleware that (a) 404s /admin on the customer hosts and (b) redirects to /admin/login when no Supabase auth cookie/localStorage marker is present. Low priority given the RLS posture.

- [ ] **220. No lead deletion — PII accumulates indefinitely**  
  `low` · add · effort S · _Platform admin surface_
  - **Where:** `supabase/migrations/20260705000003_leads.sql:33`, `apps/web/src/app/admin/leads-panel.tsx:37`
  - **Problem:** leads stores name/email/phone/message PII with only select+update policies for admins (20260705000003_leads.sql:33-38) and no delete policy or UI. Closed leads keep their PII forever with no purge path short of service-role SQL.
  - **Fix:** Add a "platform admins delete leads" policy and a delete button on closed leads (or a scheduled purge of closed leads older than N months).


### database schema & security

- [ ] **221. Menus of inactive/deactivated venues remain publicly readable**  
  `low` · fix · effort S · _database schema & security_
  - **Where:** `supabase/migrations/20260701000001_core_schema.sql:315`, `supabase/migrations/20260704000001_platform_admin_and_onboarding.sql:27`
  - **Problem:** items, modifier_groups and modifiers use `for select using (true)`; categories gate only their own is_active. Deactivating a venue (or a venue still mid-onboarding, is_active=false by default since 20260704000001) hides the restaurants row but leaves its full menu — names, descriptions, prices — enumerable by anon across all tenants (GET /rest/v1/items?select=*).
  - **Fix:** Gate the public menu policies on the parent restaurant being active, e.g. `using (exists (select 1 from restaurants r where r.id = restaurant_id and r.is_active))` — staff/admin policies already cover the portal's needs for inactive venues. Index on restaurants(id, is_active) already effectively exists via PK.

- [ ] **222. gen_session_code off-by-one: '9' never generated; non-crypto random for a capability code**  
  `low` · fix · effort S · _database schema & security_
  - **Where:** `supabase/migrations/20260709000002_group_ordering.sql:147`
  - **Problem:** The alphabet 'ABCDEFGHJKMNPQRSTUVWXYZ23456789' is 31 characters but `1 + floor(random() * 30)` indexes only positions 1-30, so the final character '9' can never appear in a share code, silently shrinking the code space, and pg random() is not cryptographically secure for what is a join capability.
  - **Fix:** Use `1 + floor(random() * 31)::int` (or better, derive characters from gen_random_bytes) so the whole alphabet is used with crypto-strength randomness.

- [ ] **223. Group sessions never expire — an abandoned open session squats the table indefinitely**  
  `low` · enhance · effort M · _database schema & security_
  - **Where:** `supabase/migrations/20260709000002_group_ordering.sql:22`, `supabase/migrations/20260709000002_group_ordering.sql:246`
  - **Problem:** order_sessions has no TTL/cleanup: a session stays 'open' forever unless every participant calls leave_session or an order is placed. Combined with the one-live-session-per-table unique index, an abandoned session (customer closed the tab without leaving) means every later group at that table is silently joined into a stale session with ghost participants whose is_ready=false blocks group placement. Also join_session share-code guessing has no per-caller attempt limit (mitigated in practice by the 30/hr anonymous sign-in rate limit and 30^6 code space).
  - **Fix:** Add a cleanup path: treat sessions older than e.g. 3h as closed (either a scheduled function, or opportunistically in start_session: close any live session on the table whose created_at is stale before creating a new one). Optionally track a failed-join counter per uid.

- [ ] **224. New and seeded venues get no restaurant_fiscal row (backfill was migration-time only)**  
  `low` · fix · effort S · _database schema & security_
  - **Where:** `supabase/migrations/20260710000001_pos_money_fiscal.sql:550`, `supabase/functions/admin-provision-business/index.ts:82`, `supabase/seed.sql:47`
  - **Problem:** 20260710000001 seeds a forfait fiscal profile only for venues existing at migration time. admin-provision-business inserts restaurants + staff but never restaurant_fiscal, and on a fresh local reset the seed venues are created after migrations, so they also lack profiles. settle-order degrades gracefully (maybeSingle + forfait defaults), but the Caisse fiscal settings screen starts from a phantom row and the migration's own comment promises 'the register has a config to read'.
  - **Fix:** Create the profile at venue creation: either an AFTER INSERT trigger on restaurants inserting a default restaurant_fiscal row, or an explicit insert in admin-provision-business plus one in seed.sql.

- [ ] **225. Dead global order_number_seq default remains on orders; seed bumps both venues' order_seq**  
  `low` · clean · effort S · _database schema & security_
  - **Where:** `supabase/migrations/20260701000001_core_schema.sql:167`, `supabase/seed.sql:364`, `supabase/seed.sql:273`
  - **Problem:** orders.order_number still defaults to 'A-' || nextval('public.order_number_seq') (the global cross-tenant sequence replaced in 20260702000001); every real path overrides it via the _tx functions, but any direct insert (seed demo orders, manual SQL) silently consumes the deprecated global counter. seed.sql:364 also runs `update public.restaurants set order_seq = 500` with no WHERE clause, bumping Le Zink to 500 as well; and the seeded historical analytics orders carry totals uncorrelated with their line items, so demo dashboards don't cross-foot.
  - **Fix:** Drop the column default and the order_number_seq sequence in a cleanup migration (make order_number NOT NULL with no default; _tx functions always supply it). Scope the seed's order_seq update to the El Marsa venue and derive seeded totals from the generated lines.

- [ ] **226. Repo/hosted migration drift hint + ungoverned session helper grants**  
  `low` · organize · effort S · _database schema & security_
  - **Where:** `supabase/migrations/20260710000005_pos_rpc_anon_lockdown.sql:7`, `supabase/migrations/20260709000002_group_ordering.sql:88`
  - **Problem:** 20260710000005's header cites 'the existing pattern (session_functions_search_path, ...)' — no migration by that name exists in supabase/migrations/, suggesting a hot-applied hosted migration was never committed (the July audit was noted as 'hot-applied to prod+dev'), so `supabase db reset` locally may not match production. Separately, is_session_member/gen_session_code/clean_nickname retain the default PUBLIC EXECUTE grant; is_session_member is SECURITY DEFINER and anon-callable via /rpc (harmless — returns membership for the caller's own uid — but it is exactly the advisor warning class the lockdown migration says it closes).
  - **Fix:** Diff hosted schemas against the repo (supabase db diff --linked on both projects) and commit any missing migrations. Add the three session helpers to the revoke-from-anon list for advisor hygiene.

- [ ] **227. Verified good: admin-escalation fix, POS column lockdown, demo seed alignment**  
  `low` · organize · effort S · _database schema & security_
  - **Where:** `supabase/migrations/20260706000003_harden_admin_allowlist_trigger.sql:39`, `supabase/migrations/20260710000004_pos_review_fixes.sql:21`, `supabase/seed.sql:193`, `docs/app-store-review/review-reply.md:45`
  - **Problem:** Positive confirmations worth recording: (1) the critical admin-allowlist escalation fix IS committed as 20260706000003 with all three gates (non-anonymous, email_confirmed_at, raw_app_meta_data provider='google' — client-unforgeable) and platform_admins has no client-writable policy, so no similar escalation pattern remains; (2) the POS blocker fix (20260710000004) correctly column-scopes client UPDATE on orders to status only, and the only client-side orders update found writes exactly { status }; (3) qr_token exposure is closed (resolve_table capability RPC, list_venue_tables never returns tokens); (4) receipt_sequences and admin_allowlist are fully client-inaccessible; (5) seed.sql matches docs/app-store-review exactly — active venue cafe-el-marsa with 14 tables and token demo-elmarsa-t12 for the reviewer QR (https://app.chehia.app/r/cafe-el-marsa/t/demo-elmarsa-t12) — the remaining action is only confirming the same rows exist in the PRODUCTION project, as review-reply.md:45 already instructs.
  - **Fix:** No code change; keep the review-reply.md prod-verification step on the App Store submission checklist.


### Supabase edge functions

- [ ] **228. Concurrent duplicate client_ref returns 500 instead of the idempotent order**  
  `low` · fix · effort S · _Supabase edge functions_
  - **Where:** `supabase/functions/place-order/index.ts:398`, `supabase/functions/register-order/index.ts:275`
  - **Problem:** Idempotency is check-then-insert: the pre-check (place-order/index.ts:90-112) and the in-tx SELECT both run before INSERT, so two concurrent submissions with the same client_ref both pass and the loser hits the unique index orders_client_ref_unique → 23505 → generic "db_error" 500 (place-order/index.ts:398-407, register-order/index.ts:275-278). An offline caisse replaying a queue with retries can plausibly double-fire; the client then sees a scary error though the order exists (a later retry does return duplicate:true, so no double-charge — just a confusing failure).
  - **Fix:** In both functions, on txError with code 23505 (or message containing the client_ref index name), re-query by client_ref and return the existing order with duplicate:true.

- [ ] **229. Ignored errors on modifier_groups/modifiers queries can skip required-modifier validation**  
  `low` · fix · effort S · _Supabase edge functions_
  - **Where:** `supabase/functions/place-order/index.ts:294`, `supabase/functions/register-order/index.ts:193`
  - **Problem:** place-order/index.ts:294-301 and register-order/index.ts:193-200 destructure only { data: groups } / { data: modifiers } and ignore errors. On a transient DB failure, groups is null → groupsByItem is empty → the min_select loop (place-order/index.ts:351-362) sees no groups and lets an order for an item with REQUIRED modifiers through at base price with no selections; alternatively selected modifiers all fail as unknown_modifier (409) — a misleading error. Rare, but it silently degrades pricing/validation instead of failing loudly.
  - **Fix:** Check both query errors and return db_error 500 like the items query does (place-order/index.ts:278-281).

- [ ] **230. place-order writes origin='browse' in a separate non-atomic UPDATE after the transaction**  
  `low` · fix · effort S · _Supabase edge functions_
  - **Where:** `supabase/functions/place-order/index.ts:411`, `supabase/migrations/20260709000002_group_ordering.sql:436`
  - **Problem:** The browse tag is applied by a second UPDATE after place_order_tx commits (place-order/index.ts:411-413). If the isolate dies or the update errors (error is not checked), a remote order is permanently labelled 'scan' — staff lose the ability to distinguish remote orders, which is the point of the tag. Realtime subscribers may also see the row flip after initial delivery.
  - **Fix:** Pass p_origin into place_order_tx (like register_order_tx already does) and set it in the INSERT; drop the post-hoc UPDATE.

- [ ] **231. Non-string note/nickname fields crash with an unhandled TypeError (500)**  
  `low` · fix · effort S · _Supabase edge functions_
  - **Where:** `supabase/functions/place-order/index.ts:375`, `supabase/functions/register-order/index.ts:264`, `supabase/functions/call-waiter/index.ts:79`
  - **Problem:** `(input.note ?? "").slice(0, 500)` and similar assume strings. If a client sends note: 123 or note: {} (place-order/index.ts:375, 388; register-order/index.ts:264; call-waiter/index.ts:79), .slice/.replace throws, and Deno.serve returns an opaque 500 with a stack in the logs instead of a 400. Same for participant_nickname (place-order/index.ts:376). submit-review already does this correctly with .toString() (submit-review/index.ts:132-133).
  - **Fix:** Coerce: `String(input.note ?? "").slice(0, 500)` at every slice site, or reject non-string types in validation.

- [ ] **232. .env.example is missing most of the env vars the functions actually read**  
  `low` · clean · effort S · _Supabase edge functions_
  - **Where:** `supabase/functions/.env.example:1`, `supabase/functions/extract-menu/index.ts:30`, `supabase/functions/inventory-alerts/index.ts:70`
  - **Problem:** supabase/functions/.env.example lists only ANTHROPIC_API_KEY, INSIGHTS_MODEL, INSIGHTS_CRON_SECRET. Not documented: MENU_EXTRACT_MODEL (extract-menu/index.ts:30), RESEND_API_KEY, LEADS_TO, LEADS_FROM (submit-lead/index.ts:81-84), INVENTORY_CRON_SECRET, INVENTORY_FROM (inventory-alerts/index.ts:70,96). A fresh deploy following the example will silently run menu extraction on the default model and never send lead/inventory emails.
  - **Fix:** Add all read env vars to .env.example with comments (and note which are optional). Keep MENU_EXTRACT_MODEL's default documented.

- [ ] **233. require_location=true with no pin silently disables the gate**  
  `low` · enhance · effort S · _Supabase edge functions_
  - **Where:** `supabase/functions/place-order/index.ts:226`, `supabase/migrations/20260711000001_location_gating.sql:17`
  - **Problem:** The location gate only runs when latitude/longitude are set (place-order/index.ts:226-231). Migration 20260711000001 defaults require_location to true, so every venue that hasn't pinned its spot believes it's protected while remote browse orders flow unchecked. The code comment acknowledges this, but nothing surfaces it to the owner.
  - **Fix:** Decide the fail mode: either reject browse orders for require_location venues without a pin (strict), or keep the permissive behavior but add a prominent portal warning/checklist item ("remote-order protection inactive until you pin your location"). Server-side strictness is safer given require_qr exists as the opt-out.

- [ ] **234. extract-menu Anthropic call has no explicit timeout below the edge wall-clock limit**  
  `low` · enhance · effort S · _Supabase edge functions_
  - **Where:** `supabase/functions/extract-menu/index.ts:275`, `supabase/functions/extract-menu/index.ts:286`
  - **Problem:** A non-streaming Opus vision call with 4 images and max_tokens 16000 (extract-menu/index.ts:280-301) can run several minutes; the SDK default timeout is 10 minutes, while Supabase Edge Functions are killed at the platform wall-clock limit (150s on free plans, 400s paid). If the platform kills the isolate mid-call, the client gets a generic gateway error instead of the friendly ai_failed message, and spend is still incurred.
  - **Fix:** Construct the client with an explicit timeout safely under the platform ceiling (e.g. new Anthropic({ apiKey, timeout: 120_000 }) — TS SDK timeouts are in ms) so failures surface as the handled ai_failed 502; consider reducing max_tokens or splitting >2-image scans into batches if real menus approach the limit.

- [ ] **235. Raw auth error messages passed through to clients on user-create failures**  
  `low` · fix · effort S · _Supabase edge functions_
  - **Where:** `supabase/functions/create-staff/index.ts:62`, `supabase/functions/admin-provision-business/index.ts:110`
  - **Problem:** create-staff/index.ts:62-69 and admin-provision-business/index.ts:110-118 return `cErr.message` verbatim in the user_create_failed 500 response. GoTrue admin errors can describe internal validation/config details; the callers are trusted staff/admins, so impact is low, but it is inconsistent with every other function's opaque error style.
  - **Fix:** Log cErr server-side (console.error) and return a fixed message; keep only the already-handled duplicate-email branch specific.

- [ ] **236. CORS allows any origin on privileged functions**  
  `low` · enhance · effort S · _Supabase edge functions_
  - **Where:** `supabase/functions/_shared/cors.ts:2`
  - **Problem:** _shared/cors.ts:2 sets Access-Control-Allow-Origin: * for every function, including admin-provision-business, create-staff, register-order, and settle-order. Auth is bearer-token based so this is not CSRF-exploitable, but it lets any website drive the privileged endpoints with a stolen/phished token from the victim's browser context, and it disables the browser-origin defence layer for free.
  - **Fix:** For business/admin functions, reflect an allowlist (business.chehia.app, admin origin, localhost dev) instead of *; keep * only for the customer/public functions called from arbitrary PWA install contexts if needed.

- [ ] **237. Geofence math duplicated between edge function and packages/shared with no drift guard**  
  `low` · clean · effort S · _Supabase edge functions_
  - **Where:** `supabase/functions/place-order/index.ts:43`, `packages/shared`
  - **Problem:** distanceMeters + GEOFENCE_ACCURACY_SLACK_M are copy-pasted into place-order (index.ts:43-54) because edge functions can't import @chehia/shared. The comment says 'kept in sync' but nothing enforces it — a future tweak to the shared geo.ts (e.g. slack 100→50) would silently diverge client UX from server enforcement.
  - **Fix:** Add a tiny unit test in packages/shared that asserts identical outputs for a table of fixtures against a copied constant set, or move the canonical constants into a generated file both sides consume; at minimum cross-reference the two files in comments both directions (only place-order has the note).

- [ ] **238. Arabic-only venue names slugify to empty and fail provisioning with a misleading error**  
  `low` · fix · effort S · _Supabase edge functions_
  - **Where:** `supabase/functions/_shared/admin.ts:42`, `supabase/functions/admin-provision-business/index.ts:63`
  - **Problem:** slugify() strips everything outside [a-z0-9] after NFD (admin.ts:42-50), so a venue named only in Arabic (e.g. "قهوة الياسمين") produces an empty slug; admin-provision-business then fails SLUG_RE with "Slug must be lowercase letters, numbers and dashes" (index.ts:63-64) even though the admin never typed a slug. For a product whose primary market writes Arabic, this is a real onboarding papercut.
  - **Fix:** When slugify(name) is empty, fall back to a generated slug (e.g. 'venue-' + short random suffix) instead of erroring, and let the admin edit it; or transliterate Arabic before slugifying.


### Internationalization

- [ ] **239. ~30 dead catalog keys across all three dictionaries (~90 lines), signaling dropped or half-finished UI copy**  
  `low` · clean · effort S · _Internationalization_
  - **Where:** `packages/shared/src/i18n/fr.ts:1`, `packages/shared/src/i18n/ar.ts:4`, `packages/shared/src/i18n/en.ts:4`
  - **Problem:** Key-usage analysis (leaf-name grep over web+mobile+shared, excluding dynamic-access families like t.allergens[a] which are used) finds these never referenced anywhere: group.joinTitle, group.shareTitle, group.copyLink, group.waitingForOthers, group.soloHint, group.leaveConfirm, group.yourItems, group.emptyCartHint, group.addFromMenu; waiter.alreadyOpen; offline.offlineMenu, offline.viewQueue; portal.orders.cancelOrder; portal.menu.unpublished, portal.menu.publish; portal.tables.scans, portal.tables.scanToOrder, portal.tables.scanToOrderEn; portal.ratings.average, portal.ratings.totalReviews, portal.ratings.reported; portal.inventory.colProduct/colStock/colStatus/colThreshold/parHint; portal.notifications.view; hours.copyToAll; admin.reviewDish; onboarding.welcome/welcomeBody/stepDone/needCategory/addStaffCta/waitingTitle/waitingBody/stockTurnOffNote; install.caisse.installed; location.business.searchAddress; location.discover.hereLabel; home.demoNote; common.yes. Each exists in triplicate (fr/ar/en). Some (group.*, onboarding.*) look like copy written for UI that was later built differently; home.demoNote suggests an unshipped 'demo venue' badge.
  - **Fix:** Delete the confirmed-dead keys from fr.ts/ar.ts/en.ts (the Dictionary type keeps the three files in sync automatically), or wire up the ones that were intended for real UI (e.g. home.demoNote as a demo-venue badge in discover, portal.tables.scanToOrder* on the printed table card — see separate finding). Re-run the leaf-name check before deleting to rule out dynamic access.

- [ ] **240. SSR always emits <html lang="fr"> — wrong announced language for Arabic/English sessions until hydration**  
  `low` · fix · effort M · _Internationalization_
  - **Where:** `apps/web/src/app/layout.tsx:65`, `apps/web/src/components/i18n-provider.tsx:44`
  - **Problem:** apps/web/src/app/layout.tsx:65 hardcodes lang="fr" on <html>; the real language/dir is applied only in a client effect after hydration (apps/web/src/components/i18n-provider.tsx:44-47). Screen readers and search engines see French for Arabic venues on first paint, and stored-language users get a visible language flash on every load. The inner wrapper's dir is correct at SSR when the provider initial is the venue default, so this is mainly the <html> element and the stored-preference case.
  - **Fix:** Persist the language choice in a cookie alongside localStorage and read it in the root layout (all venue routes are already force-dynamic) to set lang/dir server-side; or at minimum set an inline pre-hydration script that applies documentElement.lang/dir from storage before first paint to eliminate the flash.

- [ ] **241. Arabic headings on web fall out of the Arabic typeface (font-display is Latin-only Bricolage)**  
  `low` · fix · effort S · _Internationalization_
  - **Where:** `apps/web/src/app/globals.css:123`, `apps/web/src/app/layout.tsx:6`, `apps/web/src/app/r/_venue/cart-screen.tsx:133`
  - **Problem:** globals.css sets the Arabic family only on the base: [dir="rtl"] { font-family: var(--font-arabic) } (apps/web/src/app/globals.css:123-125), but dozens of translated headings use the .font-display utility → Bricolage Grotesque loaded with subsets:["latin"] (apps/web/src/app/layout.tsx:6-11). Arabic glyphs are absent from Bricolage, so headings like t.cart.empty, t.menu.noResults, tr(name_i18n) (e.g. apps/web/src/app/r/_venue/cart-screen.tsx:133, category-items.tsx:67, item-sheet.tsx:127) render in the browser's generic sans-serif instead of IBM Plex Sans Arabic — visibly off-brand next to body text. Mobile gets this right via displayFace(lang) (apps/mobile/src/lib/theme.ts:138).
  - **Fix:** Add [dir="rtl"] .font-display { font-family: var(--font-arabic); } (optionally with a slight size/leading adjustment mirroring mobile's sizeFor bump) so Arabic display text uses bold Plex Arabic, matching the mobile design system.

- [ ] **242. Star-rating fractional fill anchored with physical left-0 — fills from the wrong end in RTL**  
  `low` · fix · effort S · _Internationalization_
  - **Where:** `apps/web/src/components/ui.tsx:207`
  - **Problem:** apps/web/src/components/ui.tsx:207: the gold overlay in Stars uses className="absolute left-0 top-0" with a percentage width. In an RTL (Arabic) context the stars read right-to-left, so a 4.3 rating shows its partial star at the reading START instead of the end — the fill direction contradicts the reading direction. This is one of only two physical-direction classes in the whole web app (the codebase otherwise consistently uses ps/pe/ms/me/start/end logical utilities — 60+ occurrences).
  - **Fix:** Change left-0 to start-0 (inset-inline-start) so the fill flips automatically under dir=rtl. Verify visually on the venue ratings strip in Arabic.

- [ ] **243. Mobile discover section label rendered without lang prop — Arabic text gets Latin font and no RTL bidi**  
  `low` · fix · effort S · _Internationalization_
  - **Where:** `apps/mobile/src/components/discover.tsx:245`, `apps/mobile/src/components/ui.tsx:443`
  - **Problem:** apps/mobile/src/components/discover.tsx:245 renders {t.discover.nearbyLabel / allLabel}.toUpperCase() in a <T> without lang={lang}. T defaults to lang="fr" (apps/mobile/src/components/ui.tsx:445), so in Arabic this localized label misses faceFor('ar') (falls back to system font instead of Plex Arabic), the +10% Arabic size bump, and writingDirection:'rtl' bidi protection (apps/mobile/src/components/ui.tsx:468-475). All other no-lang <T> usages are glyphs/digits/prices and are fine. (.toUpperCase() is also a no-op for Arabic — harmless but consider applying it only for Latin languages.)
  - **Fix:** Pass lang={lang} at discover.tsx:245. Optionally add a lint-style convention: any <T> whose children include t.* or tr(...) must pass lang.

- [ ] **244. Caisse money()/txt() hardcode French formatting even though the register chrome is now trilingual**  
  `low` · enhance · effort M · _Internationalization_
  - **Where:** `apps/web/src/app/caisse/_register/util.ts:8`, `apps/web/src/app/business/caisse/reports.tsx:10`, `apps/web/src/app/caisse/_register/escpos.ts:14`
  - **Problem:** apps/web/src/app/caisse/_register/util.ts:14-17 formats every register price as millimesToDisplay(m,"fr") + currencyLabel("fr"), and txt() defaults item names to French — a documented slice-1 decision (util.ts:4-6, 'Arabic register chrome is a later pass'). But the register chrome IS localized now (every _register component calls useI18n and the caisse.* catalog section is fully translated in ar/en), so an Arabic-language caisse shows Arabic labels with 'TND' instead of 'د.ت' and French item names. Same for reports.tsx:10. The ESC/POS printed receipt staying French/ASCII (escpos.ts:14,105-125) is a legitimate printer constraint and can stay.
  - **Fix:** Thread the active lang from useI18n into money()/txt() call sites (32 usages across 7 files) or convert them to hooks/helpers taking lang; keep escpos.ts French-only with a comment noting the CP437 printer constraint. Update the stale comment block in util.ts once done.

- [ ] **245. Handful of hardcoded aria-labels and small UI literals bypass the catalog**  
  `low` · fix · effort S · _Internationalization_
  - **Where:** `apps/web/src/app/caisse/_register/table-sheet.tsx:14`, `apps/web/src/app/business/menu/page.tsx:275`, `apps/web/src/components/ui.tsx:183`, `apps/web/src/app/business/menu/item-editor.tsx:336`, `apps/mobile/src/components/venue/menu-screen.tsx:160`
  - **Problem:** Stragglers found by grep: apps/web/src/app/caisse/_register/table-sheet.tsx:14 aria-label="Fermer" (t.common.close exists); apps/web/src/app/business/menu/page.tsx:275,284 aria-label="up"/"down" (English, in a French-first portal; t.common.increase/decrease exist); apps/web/src/components/ui.tsx:183 aria-label="loading" (t.common.loading exists); apps/web/src/app/contact-form.tsx:66 English honeypot aria-label reachable by screen readers; apps/web/src/app/business/menu/item-editor.tsx:336 and apps/mobile/src/components/venue/menu-screen.tsx:160 re-implement the language endonym ternary instead of using shared LANGUAGE_LABELS (packages/shared/src/i18n/index.ts:20).
  - **Fix:** Replace each literal with the existing catalog key / LANGUAGE_LABELS constant. These are 10-minute fixes that close out the 'no user-facing string outside the catalog' invariant for screen-reader users too.

- [ ] **246. Printed table card hardcodes its trilingual copy while matching catalog keys sit unused**  
  `low` · clean · effort S · _Internationalization_
  - **Where:** `apps/web/src/app/business/tables/table-card.tsx:30`, `packages/shared/src/i18n/fr.ts:440`
  - **Problem:** apps/web/src/app/business/tables/table-card.tsx:30-34 hardcodes 'Scannez pour commander' / 'امسح واطلب من طاولتك' / 'SCAN TO ORDER' on the printable A6 card, while portal.tables.scanToOrder and portal.tables.scanToOrderEn exist in all three catalogs and are referenced nowhere (the Arabic line has no key at all). Trilingual print copy is the right product call for a physical artifact any guest may read — but the strings should have one source of truth.
  - **Fix:** Either source the three lines from the catalog (add portal.tables.scanToOrderAr or read fr/ar/en dictionaries directly since the card is deliberately trilingual) or delete the two orphaned keys; pick one, don't keep both.

- [ ] **247. Mobile horizontal rails and utility rows don't mirror in Arabic**  
  `low` · enhance · effort S · _Internationalization_
  - **Where:** `apps/mobile/src/components/venue/category-landing.tsx:171`, `apps/mobile/src/components/venue/category-items.tsx:94`, `apps/mobile/src/components/venue/menu-screen.tsx:271`
  - **Problem:** Mobile implements RTL manually (no I18nManager; textAlign/rowDir(lang)/chevron flips/PhotoPlaceholder mirroring are done per component, which is the right architecture for an in-app language switcher). Eight raw flexDirection:"row" spots don't flip: the horizontal category rails (apps/mobile/src/components/venue/category-landing.tsx:171, category-items.tsx:94, menu-screen.tsx:271) still start from the left in Arabic, and the language-pill rows (discover.tsx:132, venue-home.tsx:288) keep LTR order. StarInput/sentiment/stepper rows (ui.tsx:35,65,269) are symmetric widgets and fine as-is.
  - **Fix:** For the three category rails, either reverse the data array when isRtl or set flexDirection:'row-reverse' on the content container so browsing starts from the reading side. Language pill order staying fixed is defensible (matches web's dir="ltr" pills) — leave those.

- [ ] **248. Generalize the placeholder-parity test to all catalog keys**  
  `low` · add · effort S · _Internationalization_
  - **Where:** `packages/shared/src/__tests__/i18n.test.ts:32`
  - **Problem:** packages/shared/src/__tests__/i18n.test.ts:32-36 checks {min} survival for exactly one key (order.remaining). My full-catalog diff found zero placeholder mismatches today across all 983 keys, but nothing prevents a future ar/en edit from dropping a {n}/{name}/{qty} placeholder — TypeScript can't catch that, and interpolate() would render a literal '{qty}' to users.
  - **Fix:** Extend the test to walk every key in fr and assert the sorted set of /\{\w+\}/ placeholders matches in ar and en (the collectKeys helper is already there). ~10 lines; turns a silent runtime bug class into a CI failure.


### testing & CI

- [ ] **249. packages/shared has an eslint.config.mjs but no lint script — root `pnpm -r lint` silently skips it**  
  `low` · fix · effort S · _testing & CI_
  - **Where:** `packages/shared/package.json:14-17`, `packages/shared/eslint.config.mjs`
  - **Problem:** packages/shared/eslint.config.mjs exists, but package.json (scripts: typecheck, test only) has no `lint`, so the root `lint: pnpm -r lint` runs eslint for web and mobile only. The config is dead weight and shared — the package every surface depends on — is the one package never linted.
  - **Fix:** Add `"lint": "eslint src"` to packages/shared/package.json (and eslint + config deps to devDependencies if not hoisted). Verify `pnpm -r lint` now runs 3 packages.

- [ ] **250. Root `pnpm test` requires a running local Supabase stack (it recurses into integration), so the default test command fails cold**  
  `low` · enhance · effort S · _testing & CI_
  - **Where:** `package.json:9`, `packages/integration/src/setup.ts:1-6`
  - **Problem:** Root scripts: `test` = `pnpm -r test` which runs BOTH @chehia/shared (pure unit) and @chehia/integration (needs `supabase start`). Anyone — or any CI job — running plain `pnpm test` without the stack gets connection failures, and there's no fail-fast message. test:unit / test:integration exist but `test` is the discoverable default.
  - **Fix:** Make root `test` unit-only (`pnpm --filter @chehia/shared test`), keep `test:integration` explicit, and add a beforeAll guard in packages/integration/src/setup.ts that pings SUPABASE_URL/health and throws 'Local Supabase not running — pnpm db:start' for a clear failure. Alternatively keep `pnpm -r test` but add `test:all` semantics — either way, document it in README.

- [ ] **251. menu-tree.ts (category/subcategory tree used by both web and mobile menus) has no unit tests**  
  `low` · add · effort S · _testing & CI_
  - **Where:** `packages/shared/src/menu-tree.ts:19-47`
  - **Problem:** packages/shared/src/menu-tree.ts (buildCategoryTree, descendantCategoryIds, nodeItemCount) is the one shared module in packages/shared/src with logic but no __tests__ file. Its orphan-parent rule ('a category whose parent is absent is treated as top-level so its items never disappear') is a subtle invariant that both menu screens depend on.
  - **Fix:** Add __tests__/menu-tree.test.ts: nested sort_order ordering at both levels; orphaned child (inactive/missing parent) promoted to root; nodeItemCount sums own + children ids; empty input. ~30 minutes.

- [ ] **252. README test documentation is stale (claims 96 unit tests; static count is ~113) and omits newer suites**  
  `low` · clean · effort S · _testing & CI_
  - **Where:** `README.md:69-74`
  - **Problem:** README.md:69 says '96 unit tests (money, cart, reconcile, i18n parity, status machine, deep links, reviews, inventory)' — the shared suite now has ~113 static test cases across 11 files including appearance, geo, menu-art, and menu-import which the list omits. Minor, but stale numbers in docs erode trust in the rest of the README.
  - **Fix:** Drop the hardcoded count ('unit tests for money, cart, i18n parity, geo, menu import…') or regenerate it; mention that integration tests require `pnpm db:start` right next to the command.

- [ ] **253. Integration tests are all coupled to one seeded table (T12) and rely on cross-file seed state — fragile for parallel or partial runs**  
  `low` · enhance · effort S · _testing & CI_
  - **Where:** `packages/integration/src/helpers.ts:20`, `packages/integration/vitest.config.ts:8`, `supabase/seed.sql:241`
  - **Problem:** Every order-placing test uses T12_TOKEN (helpers.ts:20); vitest fileParallelism:false is correctly set (vitest.config.ts) but the shared-table design is what makes the rate-limit conflict unfixable without restructuring, and rerunning the suite twice within 90s compounds the table's order count. The kitchen-role test (rls.test.ts:101) depends on the seeded 'preparing' order (seed.sql:241) — fine after `db reset`, but nothing in the test harness enforces or documents a reset-before-run.
  - **Fix:** Seed 3-4 additional demo tables reserved for tests (or create per-file tables via adminClient in beforeAll and delete in afterAll), and add a note + optional `pretest` hint that the suite assumes a freshly seeded stack (`pnpm db:reset`). In the CI integration job, `supabase start` on a clean runner gives this for free.


### Build health: does the repo build clean right now

- [ ] **254. Mobile lint warnings: unused import and duplicate @chehia/shared imports**  
  `low` · clean · effort S · _Build health: does the repo build clean right now_
  - **Where:** `apps/mobile/src/components/venue/table-picker.tsx:5`, `apps/mobile/src/lib/theme.ts:10`, `apps/mobile/src/lib/theme.ts:11`
  - **Problem:** Three eslint warnings in apps/mobile: table-picker.tsx 5:10 imports `colors` from @/lib/theme but never uses it (@typescript-eslint/no-unused-vars); lib/theme.ts lines 10-11 import from '@chehia/shared' twice — one value import block and a separate `import type { Language }` — triggering import/no-duplicates twice.
  - **Fix:** Drop `colors` from the table-picker import; merge the two shared imports in theme.ts into one statement using inline `type` specifiers (`import { ..., type Language } from "@chehia/shared"`). One is auto-fixable with `expo lint --fix`.

- [ ] **255. Local Node 20 triggers supabase-js deprecation warnings throughout the web build**  
  `low` · enhance · effort S · _Build health: does the repo build clean right now_
  - **Where:** `package.json:19`
  - **Problem:** The web production build succeeds but the log repeats '⚠️ Node.js 20 and below are deprecated and will no longer be supported in future versions of @supabase/supabase-js' roughly a dozen times (once per build worker). Local Node is v20.19.5 and root package.json engines is `">=20"`. Not a failure today, but a future supabase-js upgrade could drop Node 20 support and break the build.
  - **Fix:** Move local dev and any CI/Vercel build image to Node 22 LTS and bump engines to `">=22"` (verify the Vercel project's Node setting matches).

- [ ] **256. Everything else is green: typecheck, shared unit tests, and web production build all pass**  
  `low` · organize · effort S · _Build health: does the repo build clean right now_
  - **Where:** `apps/web/.env.local`, `packages/shared/package.json`
  - **Problem:** Verified on develop as of this audit: `pnpm -r typecheck` passes cleanly for @chehia/shared, @chehia/mobile and @chehia/web (tsc --noEmit, zero errors). `pnpm --filter @chehia/shared test` passes 132/132 tests across 11 files in ~0.4s. `pnpm --filter @chehia/web build` (Next.js 16.2.10 Turbopack) compiles in ~2.7s, passes the in-build TypeScript pass, and prerenders all 31 routes using the existing apps/web/.env.local — no missing environment variables. Lint is the only failing gate in the repo right now.
  - **Fix:** No action needed beyond the lint fixes above; once mobile and web lint are at 0 errors, the full `pnpm -r typecheck && pnpm -r lint && pnpm test:unit && pnpm build:web` pipeline is green and could be enforced in CI.


### repository hygiene & organization

- [ ] **257. Design artifacts tracked in triplicate under "Chehia app UIUX design/" (~250 KB duplicated + stray .thumbnail binary)**  
  `low` · organize · effort S · _repository hygiene & organization_
  - **Where:** `Chehia app UIUX design/uploads/chehia-playbook.md`, `Chehia app UIUX design/design_handoff_chehia/design_reference/`, `Chehia app UIUX design/.thumbnail`, `chehia-playbook.md`, `README.md:8`
  - **Problem:** chehia-playbook.md exists three times byte-identical: repo root, "Chehia app UIUX design/uploads/chehia-playbook.md", and "Chehia app UIUX design/design_handoff_chehia/chehia-playbook.md" (verified with diff). Every design_reference file (Chehia Design.dc.html 148 KB, support.js 60 KB, android-frame.jsx, browser-window.jsx) is also tracked twice — once at the folder root and once under design_handoff_chehia/design_reference/. A binary ".thumbnail" file is tracked too. The folder name contains spaces and only README.md:8 references it. Keeping the design source in-repo is fine (it is the canonical "Harissa & Sidi Bou" reference), but one copy is enough.
  - **Fix:** Consolidate to a single canonical copy at docs/design/ (design canvas HTML + support files + one chehia-playbook.md), git rm the duplicates and .thumbnail, and update the README link. This also removes the space-laden top-level folder name.

- [ ] **258. Merged feature branch feat/menu-customization-group-ordering not deleted (local + origin)**  
  `low` · clean · effort S · _repository hygiene & organization_
  - **Problem:** `git branch --merged develop` shows feat/menu-customization-group-ordering fully merged (PR #1, commit 3881957), and `git log develop..feat/...` is empty, yet the branch still exists both locally and as origin/feat/menu-customization-group-ordering. Stale merged branches invite accidental commits and confuse the Vercel preview list.
  - **Fix:** Run `git branch -d feat/menu-customization-group-ordering` and `git push origin --delete feat/menu-customization-group-ordering` (and enable GitHub's "Automatically delete head branches" setting).

- [ ] **259. apps/web/README.md is untouched create-next-app boilerplate**  
  `low` · fix · effort S · _repository hygiene & organization_
  - **Where:** `apps/web/README.md:1`
  - **Problem:** apps/web/README.md is the stock create-next-app template ("bootstrapped with create-next-app", npm/yarn/bun run instructions, Geist font blurb, Vercel marketing links) with zero Chehia content, while apps/mobile/README.md is a proper, accurate app README. The web app is the larger surface (4 subdomains, POS, admin) and has no README of its own.
  - **Fix:** Replace with a short real README mirroring apps/mobile/README.md's structure: host-routing map (src/proxy.ts), backend selection (VERCEL_ENV), local dev, and quality gates — or delete it and let the root README carry it.

- [ ] **260. apps/mobile/LICENSE is Expo's template MIT license (copyright 650 Industries)**  
  `low` · remove · effort S · _repository hygiene & organization_
  - **Where:** `apps/mobile/LICENSE:3`
  - **Problem:** apps/mobile/LICENSE:3 reads "Copyright (c) 2015-present 650 Industries, Inc. (aka Expo)" — it is the Expo starter template's own license file left in place, which nominally MIT-licenses your proprietary app under Expo's copyright. No other package in the monorepo carries a LICENSE and no package.json declares a license field, so this lone file is both wrong and inconsistent.
  - **Fix:** Delete apps/mobile/LICENSE (the repo is private/proprietary). If you want explicitness, add "license": "UNLICENSED" to the root package.json instead of per-app license files.

- [ ] **261. Root .gitignore lacks the credential/cert patterns that only exist in apps/mobile/.gitignore**  
  `low` · enhance · effort S · _repository hygiene & organization_
  - **Where:** `.gitignore:4`, `apps/mobile/.gitignore:36`, `apps/web/.gitignore:34`
  - **Problem:** play-service-account.json / *-service-account.json, *.p8, *.p12, *.jks, *.key, *.mobileprovision and *.pem are ignored only via apps/mobile/.gitignore:31-38, and .env* catch-all only via apps/web/.gitignore:34. The root .gitignore covers .env/.env.local/.env*.local but not e.g. a plain .env.production or a service-account JSON dropped at the repo root or in supabase/ during an eas/gcloud session. All currently sensitive files on disk (apps/web/.env.local, apps/mobile/.env) are correctly ignored — this is defense-in-depth, not an active leak.
  - **Fix:** Add to the root .gitignore: `*-service-account.json`, `play-service-account.json`, `*.pem`, `*.p8`, `*.p12`, `*.jks`, `*.mobileprovision`, and consider widening `.env` to `.env*` with `!.env.example`.

- [ ] **262. Root `pnpm test` fails on any machine without the local Supabase stack**  
  `low` · enhance · effort S · _repository hygiene & organization_
  - **Where:** `package.json:11`, `packages/integration/src/setup.ts`
  - **Problem:** package.json:11 `test` = `pnpm -r test`, which runs @chehia/shared unit tests AND @chehia/integration tests; the latter require `supabase start` (Docker) and fail otherwise. The repo already has the right granular scripts (test:unit, test:integration at package.json:17-18), so the umbrella script is a trap for CI or a fresh clone.
  - **Fix:** Point root `test` at `pnpm test:unit` (fast, hermetic) and keep `test:integration` explicit; or add a supabase-is-running preflight in packages/integration/src/setup.ts with a clear skip message.

- [ ] **263. Stray `example` ignore pattern in apps/mobile/.gitignore**  
  `low` · clean · effort S · _repository hygiene & organization_
  - **Where:** `apps/mobile/.gitignore:43`
  - **Problem:** apps/mobile/.gitignore:43 contains the bare pattern `example` (Expo template leftover), which silently ignores ANY file or directory named `example` anywhere under apps/mobile — e.g. a future src/lib/example.ts helper or an example/ fixtures dir would just never show up in git status.
  - **Fix:** Delete the `example` line.

- [ ] **264. chehia-playbook.md (21 KB market research) lives at the repo root**  
  `low` · organize · effort S · _repository hygiene & organization_
  - **Where:** `chehia-playbook.md`, `README.md:7`
  - **Problem:** The original market-research/product-spec playbook sits at the repo root next to README.md, untouched since the initial commit, and is duplicated twice inside "Chehia app UIUX design/" (see the design-folder finding). Root should hold only README + tooling config; historical spec docs belong under docs/.
  - **Fix:** Move to docs/design/chehia-playbook.md (as the single canonical copy) and fix the README.md:7 link. Suggested final docs/ tree: docs/{google-auth.md, inventory.md, pos-caisse.md, location-gating.md, mobile-submission.md, app-store-review/, design/{chehia-playbook.md, design-reference/}}.


### dependency health & supply chain

- [ ] **265. @supabase/ssr declared in web but never imported**  
  `low` · remove · effort S · _dependency health & supply chain_
  - **Where:** `apps/web/package.json:14`, `apps/web/src/lib/supabase.ts:1`
  - **Problem:** apps/web/package.json:14 declares `@supabase/ssr@^0.12.0`, but no file under apps/web imports it — all Supabase access goes through plain `createClient` from @supabase/supabase-js in apps/web/src/lib/supabase.ts (client-side localStorage sessions by design, plus a cookie-less server client for public reads). The package sits unused in the dependency tree and misleadingly suggests server-side cookie auth exists.
  - **Fix:** Remove `@supabase/ssr` from apps/web/package.json (and lockfile via `pnpm install` when next touching deps). If server-rendered authed pages are ever wanted, re-add it deliberately with the middleware/cookie plumbing it requires.

- [ ] **266. Available major upgrades that are risky pre-submission — defer deliberately**  
  `low` · organize · effort M · _dependency health & supply chain_
  - **Where:** `apps/mobile/package.json:10`, `apps/mobile/package.json:29`, `apps/mobile/package.json:41`
  - **Problem:** `pnpm outdated -r` shows majors available that should NOT be taken before the App Store resubmission: @react-native-async-storage/async-storage 2.2.0→3.1.1 and react-native-gesture-handler 2.32.0→3.0.2 (both native modules; SDK 57 recommends the 2.x lines — jumping majors risks build/runtime breakage days before review), typescript 5.9.3/6.0.3→7.0.2, eslint 9.39.4→10.7.0, @types/node 20.19.43→26.1.1 (dev-only, churn without user benefit right now).
  - **Fix:** Explicitly defer all of these until after App Store approval, then take the native-module majors together with the next Expo SDK bump (expo install manages them). Take TS/eslint/@types/node majors as a separate dev-tooling PR with a full `pnpm -r typecheck && pnpm -r lint` pass.

- [ ] **267. React version skew between web (19.2.4) and mobile (19.2.3), inconsistent pinning style**  
  `low` · clean · effort S · _dependency health & supply chain_
  - **Where:** `apps/web/package.json:19`, `apps/mobile/package.json:26`, `packages/integration/package.json`
  - **Problem:** The lockfile carries both react@19.2.3/react-dom@19.2.3 (mobile, exact-pinned) and react@19.2.4/react-dom@19.2.4 (web, exact-pinned); latest patch is 19.2.7. Since the two apps are separate bundles there is no runtime conflict, but the skew is accidental, and web's package.json mixes exact pins (next, react) with carets (everything else) with no stated policy. supabase-js is also one patch behind (2.110.0→2.110.2) in all three consumers, and vitest 4.1.9→4.1.10 in shared/integration.
  - **Fix:** Align both apps on the same react patch (web can go to 19.2.7 now; mobile's react version should come from `expo install --check`), bump supabase-js to 2.110.2 everywhere in one change, and adopt a simple written policy: exact pins for framework-critical packages (next, react, expo-managed natives), caret for the rest.

- [ ] **268. TypeScript major version split across the workspace**  
  `low` · clean · effort S · _dependency health & supply chain_
  - **Where:** `apps/mobile/package.json:41`, `packages/shared/package.json`, `apps/web/package.json`
  - **Problem:** web/shared/integration resolve typescript 5.9.3 (^5 / ^5.7.0) while mobile uses ~6.0.3. packages/shared ships raw .ts source consumed by both apps, so the same shared code is typechecked under TS 5.x in web/shared and TS 6.x in mobile — results can diverge (one app's typecheck passing does not guarantee the other's), which has already bitten similar monorepos on strictness changes between majors.
  - **Fix:** When convenient (post-submission), align the whole workspace on one TypeScript major — the one Expo SDK 57 supports (6.x) — via a root devDependency or syncpack, and run `pnpm -r typecheck` to shake out differences.

- [ ] **269. node-linker=hoisted trades pnpm's isolation for Metro compatibility — phantom-dependency risk**  
  `low` · organize · effort S · _dependency health & supply chain_
  - **Where:** `.npmrc:1`
  - **Problem:** .npmrc:1 sets `node-linker=hoisted`, which is effectively required for Expo/Metro monorepos but flattens node_modules for the entire workspace, including apps/web. That removes pnpm's strict-isolation guarantee, so any package can silently import undeclared (phantom) dependencies that happen to be hoisted — a class of bug that surfaces only when an unrelated dep bump re-shuffles the tree. It is also why `pnpm audit` reports odd paths like `. > uuid@7.0.3`.
  - **Fix:** Keep the setting (Metro needs it), but add an occasional `knip` or `depcheck` pass (could live in the CI job above) to catch undeclared imports and unused deps — it would have flagged the unused @supabase/ssr automatically.


### branch/environment divergence & ship-state

- [ ] **270. Release process invariant broken: unQA'd mobile code fast-forwarded to main; develop/main distinction now meaningless**  
  `low` · organize · effort S · _branch/environment divergence & ship-state_
  - **Where:** `docs/mobile-submission.md:1`
  - **Problem:** e09b828 (mobile port, explicitly 'NOT on main — needs on-device QA first' per its own memory note) and b5ccacf's mobile half were pushed to origin/main anyway when the later web commits were fast-forwarded (main is a linear pointer; you cannot ship ce1c36b without carrying e09b828). No harm resulted — Vercel builds only apps/web and mobile ships via EAS from an explicit checkout — but the 'main == QA'd/prod' invariant is gone, PR flow stopped after PR #1 (subsequent commits are direct pushes with unverified signatures), and the branch model is now de-facto trunk-based with a vestigial develop.
  - **Fix:** Pick one model and write it down: either (a) trunk-based — retire develop, gate mobile releases on EAS profiles/tags instead of branches; or (b) restore develop→main-after-QA and only fast-forward main when every touched surface is QA'd. Given EAS builds pin their own commit, (a) is simpler and matches actual behavior. Tag store submissions (e.g. ios-build-3) so binaries map to commits.


### web-http-security-headers-host-scoping

- [ ] **271. sitemap.xml and robots.txt are served identically on every host, emitting apex URLs from portal hosts**  
  `low` · enhance · effort S · _web-http-security-headers-host-scoping_
  - **Where:** `apps/web/src/app/sitemap.ts:7`, `apps/web/src/app/robots.ts:6`, `apps/web/src/proxy.ts:61`
  - **Problem:** apps/web/src/app/sitemap.ts:7-14 and robots.ts are static metadata routes, so business.chehia.app/sitemap.xml and app.chehia.app/sitemap.xml both exist and list chehia.app + app.chehia.app URLs, and every host's robots.txt points at https://chehia.app/sitemap.xml. Cross-host sitemap references via robots.txt are technically valid, and the path-based Disallow rules do apply on every host, so this is mostly cosmetic — but it advertises the portal host's existence and is one more surface that behaves differently from the mental model of 'four separate sites'.
  - **Fix:** Host-gate the SEO artifacts in proxy.ts: rewrite /sitemap.xml to a 404 on non-apex hosts (the matcher currently exempts sitemap.xml/robots.txt — remove them from the exemption or add a dedicated matcher entry), or leave robots.txt everywhere but make the business/caisse/admin hosts serve a blanket 'Disallow: /'.

- [ ] **272. X-Powered-By: Next.js header disclosed on every response**  
  `low` · clean · effort S · _web-http-security-headers-host-scoping_
  - **Where:** `apps/web/next.config.ts:13`
  - **Problem:** apps/web/next.config.ts:13 never sets poweredByHeader: false, so every HTML/route response advertises the framework. Trivial fingerprinting aid; costless to remove.
  - **Fix:** Add poweredByHeader: false to nextConfig in apps/web/next.config.ts.


### google-play-android-readiness

- [ ] **273. No locales config: Android 13 per-app language missing (and it's the robust fix for Apple's Guideline 4)**  
  `low` · add · effort S · _google-play-android-readiness_
  - **Where:** `apps/mobile/app.json:100`, `apps/mobile/src/lib/i18n.tsx:1`
  - **Problem:** app.json has no top-level `locales` key. On Android 13+ the app therefore ships no android:localeConfig, so Chehia doesn't appear under Settings > System > App languages even though it fully supports fr/ar/en via the in-app switcher (src/lib/i18n.tsx). Unlike iOS, Android permission dialogs don't show developer strings, so the App-Store Guideline 4 problem has no Android equivalent — but the same `locales` map (fr/ar/en JSON files with the camera/location usage strings) is what generates iOS InfoPlist.strings per language, i.e. the robust fix for the Apple rejection, and Expo generates the Android localeConfig from it too.
  - **Fix:** Add `"locales": { "fr": "./locales/fr.json", "ar": "./locales/ar.json", "en": "./locales/en.json" }` with localized NSCameraUsageDescription/NSLocationWhenInUseUsageDescription, killing two birds: Apple Guideline 4 device-language matching and Android 13 per-app language listing.

- [ ] **274. Version hygiene: local autoIncrement mutates app.json and lets platform versions drift**  
  `low` · enhance · effort S · _google-play-android-readiness_
  - **Where:** `apps/mobile/eas.json:4`, `apps/mobile/app.json:13`, `apps/mobile/app.json:57`
  - **Problem:** eas.json:4 sets cli.appVersionSource "local" with production autoIncrement (eas.json:23): each production build rewrites app.json (ios.buildNumber already bumped to "2", android.versionCode untouched at 1), requiring a commit after every build and letting the two platforms drift independently. Harmless functionally (Play only needs monotonically increasing versionCode per AAB) but noisy and easy to forget to commit, which then breaks reproducibility of what was shipped.
  - **Fix:** Switch to `"appVersionSource": "remote"` so EAS tracks buildNumber/versionCode server-side and app.json stays clean; keep `version` (1.0.0) as the only human-managed value.

- [ ] **275. RECORD_AUDIO blocking works but the plugin knob is cleaner; root .gitignore lacks the service-account pattern**  
  `low` · clean · effort S · _google-play-android-readiness_
  - **Where:** `apps/mobile/app.json:92`, `apps/mobile/app.json:112`, `.gitignore:1`, `apps/mobile/.gitignore:30`
  - **Problem:** Two hygiene items: (1) app.json:92-94 uses blockedPermissions to strip RECORD_AUDIO, which expo-camera adds by default; the plugin supports `"recordAudioAndroid": false` in its config (node_modules/expo-camera/plugin/build/withCamera.js:8,32) so the permission is never emitted in the first place — less to explain in Play's permissions declaration. (2) play-service-account.json is safely ignored via apps/mobile/.gitignore (patterns `play-service-account.json`, `*-service-account.json`, `*.jks`) and git history is clean (verified), but the root .gitignore has no service-account/keystore patterns — a key accidentally saved at repo root or under apps/web would be committable.
  - **Fix:** Add `"recordAudioAndroid": false` to the expo-camera plugin config (keep blockedPermissions as belt-and-braces or drop it), and add `*-service-account.json` + `*.jks` to the root .gitignore.


### data-lifecycle-retention-growth

- [ ] **276. events analytics table is dead: created with RLS policies and an index, but zero writers and zero readers anywhere in the codebase**  
  `low` · remove · effort S · _data-lifecycle-retention-growth_
  - **Where:** `supabase/migrations/20260701000001_core_schema.sql:226`, `supabase/migrations/20260701000001_core_schema.sql:411`
  - **Problem:** public.events (20260701000001_core_schema.sql:226-234) plus its 'staff read events'/'staff insert events' policies (core_schema.sql:411-415) exist, but grepping all of apps/web/src, apps/mobile/src, packages/*/src and supabase/functions finds no .from("events") anywhere — nothing inserts, nothing reads. Insights metrics come from insights_metrics() over orders, not events. It contributes no growth today precisely because it's dead, but it is schema cruft that a future auditor must re-verify, and the insert policy is an open (if harmless) write surface for staff clients.
  - **Fix:** Either drop the table + policies in the next migration, or actually wire it up (scan/menu-view funnel events were presumably the intent) — in which case add it to the retention matrix at 90 days with a delete in data_retention_tick(). Don't leave it half-existing.

- [ ] **277. waiter_calls, notifications, ai_extractions, ai_menu_imports retained forever — small per-day but pure dead weight after their operational window**  
  `low` · add · effort S · _data-lifecycle-retention-growth_
  - **Where:** `supabase/migrations/20260701000001_core_schema.sql:208`, `supabase/migrations/20260708000001_inventory.sql:127`, `supabase/migrations/20260706000001_ai_extractions.sql:7`, `supabase/migrations/20260706000002_import_menu_draft.sql:9`
  - **Problem:** Four append-only tables whose value expires quickly: waiter_calls (core_schema.sql:208-219, ~30/venue/day; only 'open' rows matter — the board queries status='open', use-live-orders.ts:90-95, and call-waiter's flood check looks back minutes); notifications (20260708000001_inventory.sql:127-139; only marked is_read, never deleted — the bell reads limit 30, apps/web/src/app/business/notifications-bell.tsx:34); ai_extractions (20260706000001_ai_extractions.sql:7-17; the rate limit reads a 10-minute window only — extract-menu/index.ts:34-35,246-251 — so audit rows older than months serve nobody); ai_menu_imports idempotency keys (20260706000002_import_menu_draft.sql:9-14; the import_ref replay window is realistically hours). All have suitable created_at indexes for cheap range deletes.
  - **Fix:** Fold into data_retention_tick(): delete waiter_calls where created_at < now()-interval '90 days' (keep acknowledged history for a quarter of service stats); delete notifications where created_at < now()-interval '90 days' or (is_read and read_at < now()-interval '30 days'); delete ai_extractions where created_at < now()-interval '180 days' (keeps a token-usage audit for two quarters); delete ai_menu_imports where created_at < now()-interval '180 days'.

- [ ] **278. stock_movements is the fastest-growing ledger (~100k+ rows/venue/yr) with no archival plan — fine for 2 years, then worth a window**  
  `low` · enhance · effort S · _data-lifecycle-retention-growth_
  - **Where:** `supabase/migrations/20260708000001_inventory.sql:89`
  - **Problem:** Every order auto-depletes each linked ingredient into stock_movements (20260708000001_inventory.sql:89-106): 150 orders/day x ~2 ingredients ≈ 300 rows/day ≈ 110k rows/yr per venue, plus receive/waste/count rows. Indexes (inventory_item_id, created_at desc) and (restaurant_id, created_at desc) keep reads healthy, and qty_after snapshots mean old rows aren't needed to reconstruct current stock. Unlike payments/orders this ledger is operational, not fiscal (costs live on 'receive' rows and inventory_items.unit_cost_millimes), so indefinite retention buys little. This is the one table where growth is high enough that at ~50 venues you'd add ~5M rows/yr.
  - **Fix:** Retention matrix entry: keep 24 months hot. In data_retention_tick() (or a monthly job): delete 'sale'/'cancel_return' movements older than 24 months, keeping 'receive'/'count'/'adjustment'/'waste' rows 5 years for cost/shrinkage history — or roll old months into a monthly aggregate table before deleting. No action needed before launch; codify the policy now so the cron exists when it matters.

- [ ] **279. Anonymous sign-in rate limit of 30/hour/IP can throttle a busy venue's shared Wi-Fi at peak**  
  `low` · enhance · effort S · _data-lifecycle-retention-growth_
  - **Where:** `supabase/config.toml:165`, `supabase/config.toml:180`, `apps/web/src/lib/supabase.ts:75`
  - **Problem:** supabase/config.toml:165 enables anonymous sign-ins and config.toml:180 caps them at 30/hour/IP (anonymous_users = 30). A busy café's guest Wi-Fi NATs every customer phone behind ONE public IP; 30+ new devices ordering in an hour on a Friday night is realistic for the exact venues Chehia targets. The 31st customer's ensureCustomerSession() (apps/web/src/lib/supabase.ts:75) fails and the cart errors. Because sessions persist, only first-ever devices count — but launches, events, and tourist locations hit this. Note config.toml governs local/branch config; verify the hosted projects' dashboard values match whatever is chosen here.
  - **Fix:** Raise anonymous_users to ~100/hour/IP on the hosted prod project (dashboard Auth rate limits) and mirror it in config.toml so the setting is codified. Pair with the anon-user cleanup finding so the higher mint rate doesn't worsen unbounded growth. Also surface a friendly 'réseau saturé, réessayez' message when signInAnonymously returns a 429 instead of the generic failure.


## P4 — Ideas & enhancements (deliberate roadmap choices)

_26 items._


### iOS/Android App Store compliance

- [ ] **280. Add an iOS simulator build profile to eas.json for iPad/device-matrix QA**  
  `idea` · add · effort S · _iOS/Android App Store compliance_
  - **Where:** `apps/mobile/eas.json:6`
  - **Problem:** There's no simulator profile, so QA-ing the production-config app on an iPad simulator (finding #5) requires a full internal-distribution device build. A `"simulator": { "extends": "production", "ios": { "simulator": true } }` profile makes the iPad compatibility check (and future regression checks) a 5-minute job.
  - **Fix:** Add the simulator profile extending production env; document `eas build -p ios --profile simulator` in mobile-submission.md.

- [ ] **281. iOS 18 icon variants (dark/tinted) and localized privacy policy page**  
  `idea` · enhance · effort M · _iOS/Android App Store compliance_
  - **Where:** `apps/mobile/app.json:7`, `apps/web/src/app/legal/privacy/page.tsx:1`, `apps/mobile/src/app/about.tsx:40`
  - **Problem:** Polish items for 'final form': (1) app.json uses a single ios icon; iOS 18 supports dark and tinted variants via ios.icon = { light, dark, tinted } — without them the system auto-generates a often-ugly tinted icon on themed home screens. (2) https://chehia.app/legal/privacy (linked from the in-app About screen, resolves 200) is French-only while the app ships ar/en localizations; Apple accepts this, but an Arabic/English version matches the app's trilingual promise.
  - **Fix:** Generate dark/tinted 1024px icon variants and reference them via ios.icon; add ar/en variants (or a language toggle) to the legal pages.


### Mobile app user flows, UX completeness & feature parity

- [ ] **282. Order-ready is foreground-only — no notification when the app is backgrounded**  
  `idea` · add · effort L · _Mobile app user flows, UX completeness & feature parity_
  - **Where:** `apps/mobile/src/components/venue/order-screen.tsx:143`
  - **Problem:** Order tracking is excellent while the screen is open (realtime updates, VoiceOver announcements, haptic on ready — order-screen.tsx:143-160), but the moment the customer locks the phone or switches apps, a "ready" transition is silent; there is no push (by design, anonymous) and no local notification. In a café the customer often pockets the phone after ordering.
  - **Fix:** Consider expo-notifications local notifications: while an order is active and the app backgrounds, schedule/emit a local notification on the realtime ready/served event (works while suspended briefly) or on next foreground diff. Weigh the added permission prompt against the UX win — it can be requested contextually only after the first order is placed.

- [ ] **283. Hardcoded ~8-minute ETA baseline in order tracking**  
  `idea` · enhance · effort M · _Mobile app user flows, UX completeness & feature parity_
  - **Where:** `apps/mobile/src/components/venue/order-screen.tsx:537`
  - **Problem:** remainingEstimate (order-screen.tsx:537-540) counts down from a fixed 8-minute constant regardless of venue, order size or time of day, then falls back to "soon". It's honestly labeled and defensively coded, but a busy Friday-night café will consistently blow through it, training customers to distrust the screen.
  - **Fix:** Compute a rolling median prep time per venue (created_at → ready_at over recent orders — data already exists) server-side or in the venue row, and use it as the baseline; keep 8 min as the cold-start default.


### mobile codebase quality

- [ ] **284. No OTA update channel configured (expo-updates absent)**  
  `idea` · add · effort S · _mobile codebase quality_
  - **Where:** `apps/mobile/package.json:5-37`, `apps/mobile/app.json:2-134`
  - **Problem:** package.json has no expo-updates and app.json has no updates/runtimeVersion config. Every fix — including trivial copy or i18n corrections of the kind App Review flags — requires a full store build + review cycle. For a v1.0 launch with an active rejection history, the ability to push JS-level hotfixes to approved binaries is disproportionately valuable.
  - **Fix:** Add expo-updates with runtimeVersion policy "appVersion" and an EAS Update channel per build profile before the resubmission build (it must be in the binary to be usable later). Keep it manual-publish only.

- [ ] **285. Fonts loaded at runtime via useFonts instead of embedded with the expo-font config plugin**  
  `idea` · enhance · effort S · _mobile codebase quality_
  - **Where:** `apps/mobile/src/app/_layout.tsx:27-53`, `apps/mobile/app.json:100-123`
  - **Problem:** _layout.tsx loads 9 font weights with useFonts and holds the splash screen until they resolve (app renders null at _layout.tsx:53). Embedding fonts natively via the expo-font config plugin makes them available at process start: faster time-to-interactive, no async gate, and one less state where the splash can hang. The three @expo-google-fonts packages remain the font source either way.
  - **Fix:** Add the expo-font plugin to app.json with the 9 font files listed, then drop the useFonts gate (keep a fallback for Expo Go dev if still used). Low urgency; pairs naturally with the next binary build.


### web customer app

- [ ] **286. Hardcoded ~8-minute ETA baseline for every venue**  
  `idea` · enhance · effort M · _web customer app_
  - **Where:** `apps/web/src/app/r/_venue/order-screen.tsx:489`
  - **Problem:** remainingEstimate counts down from a fixed 8 minutes regardless of venue, order size or kitchen load; once elapsed it falls back to 'Bientôt prête'. Honest, but a per-venue prep-time setting (or kitchen-set ETA from the business orders screen) would make tracking meaningfully more trustworthy.
  - **Fix:** Add an optional prep_time_minutes on restaurants (or per-order ETA set by the kitchen) and use it as the countdown baseline.

- [ ] **287. Venue browse pages are entirely de-indexed and share no per-venue OG data**  
  `idea` · add · effort S · _web customer app_
  - **Where:** `apps/web/src/app/robots.ts:8`, `apps/web/src/app/r/[slug]/(browse)/layout.tsx:13`
  - **Problem:** robots.ts disallows all of /r/, so public browse pages (/r/[slug] — venue name, menu, ratings) can't rank for 'menu <café> <ville>' searches, and venue layouts set only a title (no description/OG image), so venue links shared on WhatsApp render with the generic site card. Per-table /t/ URLs should stay blocked, but the slug-level pages are a free local-SEO and sharing surface.
  - **Fix:** Allow /r/[slug] (block only /r/*/t/), add description + OG image (cover_url) in generateMetadata, and consider Restaurant JSON-LD; also add FAQ/Organization JSON-LD on the landing.


### Business portal

- [ ] **288. Kitchen display: no screen wake lock or fullscreen mode**  
  `idea` · enhance · effort S · _Business portal_
  - **Where:** `apps/web/src/app/business/kitchen/page.tsx:14`
  - **Problem:** The kitchen page is designed as an always-on wall display (dark theme, big timers) but does nothing to keep the screen awake — a mounted tablet will sleep mid-service and miss orders (its realtime channel also drops while asleep, compounding the stale-board finding).
  - **Fix:** Request navigator.wakeLock when the kitchen page is visible (re-acquire on visibilitychange) and offer a fullscreen toggle.

- [ ] **289. Caisse ergonomics: no order/line notes, no reprint after next ticket, no mid-shift X report print**  
  `idea` · enhance · effort M · _Business portal_
  - **Where:** `apps/web/src/app/caisse/_register/ticket.tsx:9`, `apps/web/src/app/caisse/_register/cash-drawer.tsx:60`, `apps/web/src/app/caisse/caisse-provider.tsx:239`
  - **Problem:** The register cannot attach a note to an order or line ('sans sucre') — ticket.note is always '' and the modifier sheet has no note field, though the whole pipeline (register-order p_note, kitchen display) already renders notes. lastSale is overwritten by the next sale, so a customer returning for their receipt is out of luck. The cash drawer shows a running Z on screen but can't print an X report.
  - **Fix:** Add a note field on the ticket + modifier sheet, keep a small ring buffer of recent ReceiptData for reprints, and an 'Imprimer X' button in CashDrawer reusing the ESC/POS encoder.

- [ ] **290. Waiters cannot 86 items — availability toggle is owner/manager only**  
  `idea` · enhance · effort M · _Business portal_
  - **Where:** `apps/web/src/app/business/menu/page.tsx:43`, `apps/web/src/app/caisse/_register/product-grid.tsx:82`
  - **Problem:** Marking a dish sold-out mid-shift is a floor-staff task, but the menu page redirects non-managers away (menu/page.tsx:43-45) and RLS restricts item writes to owner/manager. The auto-86 inventory path helps only for recipe-linked items.
  - **Fix:** Add a narrow 'availability only' surface (or RLS column-scoped grant on items.is_available) for waiter/kitchen roles, e.g. from the register product grid via long-press.

- [ ] **291. Two different 'revenue today' definitions between orders header and Caisse reports**  
  `idea` · organize · effort M · _Business portal_
  - **Where:** `apps/web/src/app/business/use-live-orders.ts:122`, `apps/web/src/app/business/caisse/reports.tsx:33`
  - **Problem:** The orders top bar counts total_millimes of all non-cancelled orders created today (use-live-orders.ts:122-128, device-local midnight), while Caisse reports sum actual payments (reports.tsx:53-71) and stats_summary uses venue-timezone buckets. The same day can show three different numbers, which erodes trust in the dashboards.
  - **Fix:** Pick one canonical definition per label (e.g. 'commandes du jour' vs 'encaissé') and compute both in venue timezone via a shared RPC.


### Platform admin surface

- [ ] **292. No UI or runbook surface for managing platform admins (admin_allowlist)**  
  `idea` · add · effort M · _Platform admin surface_
  - **Where:** `supabase/migrations/20260705000006_admin_allowlist.sql:18`
  - **Problem:** Granting/revoking platform-admin access requires hand-written service-role SQL against admin_allowlist / platform_admins (per the admin-provisioning memory; the table is deliberately invisible to clients). For final form, the founder should not need SQL to add a teammate, and today's flow silently fails for existing users (see the allowlist sync finding).
  - **Fix:** A founder-only "Team" tab backed by a service-role edge function (list/add/remove allowlist entries + immediate platform_admins sync) — or at minimum a documented runbook script in docs/. Pairs with the audit-log finding.

- [ ] **293. Verified clean: provisioning flow, RLS gating of admin surface, Google auth wiring, menu import draft path**  
  `idea` · organize · effort S · _Platform admin surface_
  - **Where:** `supabase/functions/admin-provision-business/index.ts:27`, `supabase/functions/create-staff/index.ts:26`, `supabase/migrations/20260706000002_import_menu_draft.sql:40`, `apps/web/src/app/auth/callback/page.tsx:46`
  - **Problem:** For the synthesis doc, the following were checked and are sound: admin-provision-business gates on platform_admins, validates inputs, and rolls back restaurant/user on partial failure; create-staff enforces owner/manager and blocks manager→manager; every admin UI query is covered by an is_platform_admin() RLS policy or self-gated SECURITY DEFINER RPC (venue overview, leads, moderation, config, categories/items/storage); the hardened allowlist trigger's provider='google' + email_confirmed_at + non-anonymous gate is correct (raw_app_meta_data is GoTrue-set); /auth/callback resolves role server-side and signs out unlinked Google users; import_menu_draft re-verifies owner/manager despite SECURITY DEFINER and is idempotent per import_ref; extract-menu gates per-restaurant; must_change_password gate runs before onboarding; no signUp() surface exists in the web app.
  - **Fix:** No action — context for the audit synthesis so these areas aren't re-flagged.


### database schema & security

- [ ] **294. Leads table retains contact PII + IP indefinitely**  
  `idea` · enhance · effort S · _database schema & security_
  - **Where:** `supabase/migrations/20260705000003_leads.sql:8`, `supabase/migrations/20260705000004_leads_ip.sql:4`
  - **Problem:** leads stores name, email, phone, message and (since 20260705000004) the submitter's IP address with no retention or purge mechanism. For a product operating in Tunisia with EU-adjacent privacy expectations (and an App Store privacy questionnaire), unbounded retention of prospect PII + IPs is a liability with no product benefit once a lead is closed.
  - **Fix:** Add a scheduled cleanup (delete or null the ip column after 30 days; anonymize closed leads after 12 months) and mention lead handling in the privacy policy.


### Internationalization

- [ ] **295. French-only PWA manifest, OG metadata, and legal pages**  
  `idea` · enhance · effort M · _Internationalization_
  - **Where:** `apps/web/src/app/manifest.ts:7`, `apps/web/src/app/legal/terms/page.tsx:14`, `apps/web/src/app/layout.tsx:26`, `apps/mobile/src/app/about.tsx:55`
  - **Problem:** apps/web/src/app/manifest.ts:7-9, the root metadata (apps/web/src/app/layout.tsx:26-50, whose description mixes French and English in one string — fine for SEO but the same mixed-language habit), opengraph-image.tsx, and the legal pages (apps/web/src/app/legal/terms/page.tsx, privacy) are French-only. Web manifests can't be multi-language, and French legal text is acceptable for Tunisia, but the App Store privacy-policy link points here and the reviewer reads English; the mobile About screen (apps/mobile/src/app/about.tsx) links to these French-only pages from an English/Arabic UI.
  - **Fix:** Lowest-effort win: add an English section (or a short English summary header) to /legal/privacy since Apple reviewers follow that link; optionally render legal pages through the I18nProvider with translated copy later. Leave manifest.ts French (primary market) — it's a platform limitation, not a bug.


### testing & CI

- [ ] **296. No end-to-end browser smoke test for the two revenue-critical web flows (customer order + caisse sale)**  
  `idea` · add · effort L · _testing & CI_
  - **Where:** `apps/web/package.json`, `packages/integration/src/helpers.ts:20`
  - **Problem:** apps/web has no Playwright/e2e harness. The integration package tests the API layer well, but nothing exercises the actual Next.js pages: a rendering regression in the menu page, cart drawer, or caisse register ships undetected (React 19 + Next 16 are moving fast per apps/web/AGENTS.md's own warning). A repo-adjacent Playwright MCP plugin is already available in the dev environment, showing e2e is within reach.
  - **Fix:** Add a minimal Playwright suite (2-3 specs, chromium only) against `next dev` + local Supabase: (1) open /m/[qr-token] menu → add cappuccino with size L → place order → confirmation shows total 7,300 (or seeded price); (2) caisse: login, ring up an express, settle cash, receipt renders; (3) caisse offline: context.setOffline(true), complete a sale, go online, assert queue drains to 0. Run in CI nightly or on-PR-label rather than every push to keep CI fast.

- [ ] **297. Mobile app (the App Store deliverable) has zero automated checks beyond tsc — add expo-doctor and config assertions to CI**  
  `idea` · add · effort M · _testing & CI_
  - **Where:** `apps/mobile/package.json:47-54`, `apps/mobile/app.json`, `packages/shared/src/__tests__/deeplink.test.ts`
  - **Problem:** apps/mobile has no tests and no jest-expo; its business logic largely lives in @chehia/shared (tested), which is the right architecture, but the App-Store-rejection failure modes are config-level: permission strings/locales in app.json, supportsTablet, deep-link scheme. None of these are guarded — the exact class of error that already caused the Guideline 4 rejection could regress silently.
  - **Fix:** Add to CI's static job: `npx expo-doctor` in apps/mobile, plus a tiny vitest (runnable in shared or a scripts/ check) that reads apps/mobile/app.json and asserts: locales/InfoPlist entries exist for fr/ar/en once the localization fix lands, NSCameraUsageDescription (and every *UsageDescription) is a single-language string per locale, supportsTablet is true, and the URL scheme matches the shared deeplink module's expectations (deeplink.test.ts already tests the parser — extend it to pin the scheme constant).

- [ ] **298. No coverage reporting configured in either vitest package**  
  `idea` · add · effort S · _testing & CI_
  - **Where:** `packages/shared/package.json:14-17`
  - **Problem:** Neither packages/shared nor packages/integration configures vitest coverage, so there is no signal about which shared modules (e.g. menu-tree, parts of appearance/cart) are untested — this audit had to establish it by hand.
  - **Fix:** Add @vitest/coverage-v8 to packages/shared with a modest threshold (e.g. lines 80% on src, excluding database.types.ts and tokens.ts) and surface the summary in CI logs. Skip thresholds for the integration package (coverage there measures test code, not policies).


### repository hygiene & organization

- [ ] **299. Git history carries deleted template assets and old lockfiles — but is healthy; no rewrite needed**  
  `idea` · clean · effort S · _repository hygiene & organization_
  - **Where:** `apps/mobile/assets/images/icon.png`, `.playwright-mcp/`, `.DS_Store`
  - **Problem:** git count-objects reports 15.21 MB total. Largest historical blobs: apps/mobile/assets/images/icon.png (799 KB, still tracked — reasonable for the 1024px store icon), 4 revisions of pnpm-lock.yaml (~390 KB each), deleted Expo starter assets (logo-glow.png 331 KB, tutorial-web.png, expo.icon/, react logos, tab icons — removed in commit 2c21291), and the doubled design HTML. Nothing tracked under node_modules, no .DS_Store or .playwright-mcp ever committed (verified via git log --all), no secrets in tracked files (eas.json keys are Supabase publishable keys, safe by design).
  - **Fix:** No history rewrite — the bloat is trivial and a rewrite would break the merged PR history. Optionally losslessly recompress icon.png (oxipng/pngcrush typically halves 1024px icons). Delete the local-only junk: root .DS_Store and .playwright-mcp/ logs (both already ignored).


### dependency health & supply chain

- [ ] **300. No dependency-update or audit automation (no .github at all)**  
  `idea` · add · effort M · _dependency health & supply chain_
  - **Where:** `package.json:23`
  - **Problem:** There is no .github directory: no Renovate/Dependabot config and no CI job running `pnpm audit` / `pnpm outdated`. For a product handling venue orders, dependency drift and new advisories will only be noticed when someone manually runs an audit (as in this session). The repo also pins packageManager pnpm@10.6.1 (early 2025 vintage; latest is 11.12.0) — the package manager itself is part of the supply chain and 10.x has had subsequent fixes.
  - **Fix:** Add a minimal GitHub Actions workflow that runs `pnpm install --frozen-lockfile`, `pnpm -r typecheck`, and `pnpm audit --prod --audit-level high` on PRs, plus a Renovate config grouping Expo SDK packages (so it proposes `expo install`-compatible bumps) and patch-level auto-merges. Bump packageManager to the latest pnpm 10.x now; evaluate pnpm 11 later.

- [ ] **301. Leaflet integration is dependency-sound; OSM public tile server is the one external runtime dependency**  
  `idea` · enhance · effort S · _dependency health & supply chain_
  - **Where:** `apps/web/src/app/business/settings/location-picker.tsx:102`, `apps/web/src/app/business/settings/location-picker.tsx:114`, `apps/web/package.json:16`
  - **Problem:** Positive: the web app depends on leaflet ^1.9.4 (latest stable) directly, deliberately avoiding react-leaflet (whose React-19 peer story is messy). apps/web/src/app/business/settings/location-picker.tsx does it correctly — type-only top-level import, `await import("leaflet")` inside useEffect, static CSS import, self-rendered divIcon so no broken default-marker assets — so there is no SSR pitfall to fix. The only supply-chain-ish concern is that the map loads raster tiles from tile.openstreetmap.org (location-picker.tsx:114), a volunteer-run service whose usage policy requires attribution (present) but discourages heavy commercial use and offers no SLA; it is also a third-party endpoint the business-portal browser talks to.
  - **Fix:** No code change needed now. If the map ever appears on high-traffic customer surfaces (currently it is business-settings/onboarding only, so volume is trivial), switch the tile URL to a keyed commercial provider (MapTiler/Stadia free tiers) — it is a one-line change to the tileLayer URL.


### branch/environment divergence & ship-state

- [ ] **302. No CI at all — no typecheck/test/build gate, no migration drift check, no EAS automation**  
  `idea` · add · effort M · _branch/environment divergence & ship-state_
  - **Where:** `.gitignore:1`
  - **Problem:** There is no .github directory: pushes to origin/main deploy straight to Vercel production with zero automated verification (the repo relies on locally-run typecheck + 123 shared tests being remembered manually), and nothing detects supabase migration/edge-function drift (which has already occurred twice — generate-insights and the ledger divergence). For a repo where main IS production and money-handling code (Caisse) ships from it, this is the biggest process gap.
  - **Fix:** Add a minimal GitHub Actions workflow: pnpm typecheck across the 4 projects + vitest shared/integration on every push/PR to main and develop; a second job comparing supabase/migrations against `supabase migration list` (read-only) and edge-function shas. Optionally an eas build --non-interactive workflow triggered by an ios-build-* tag.


### observability-ops-readiness

- [ ] **303. Define the paging channel once — a single 'Chehia Ops' webhook consumed by every alert source**  
  `idea` · organize · effort S · _observability-ops-readiness_
  - **Where:** `docs/inventory.md:59`, `supabase/functions/_shared/cors.ts:1`
  - **Problem:** Findings above each need somewhere to send alerts, and today the answer to 'who gets paged?' is nobody/undefined. For a solo-founder operation the right shape is one Telegram (or Slack) group + one webhook URL stored as a secret in Supabase (ALERT_WEBHOOK_URL), Vercel, and GitHub, consumed by: edge-function 500 reporter, dead-lettered Caisse sales, stuck-pending-order check, cron dead-man switch, uptime monitor, and Sentry alert rules. One channel means one place to look during an incident and no alert fatigue from scattered emails.
  - **Fix:** Create the Telegram bot + group, store the webhook secret in all three platforms, and document it at the top of docs/ops/runbook.md as the canonical incident channel with expected response times (e.g., service-hours best-effort 15 min).


### web-http-security-headers-host-scoping

- [ ] **304. Centralize the per-host header policy in proxy.ts with an integration test asserting headers per surface**  
  `idea` · organize · effort M · _web-http-security-headers-host-scoping_
  - **Where:** `apps/web/src/proxy.ts:19`, `packages/integration`
  - **Problem:** proxy.ts is already the single place that knows which trust domain a request belongs to (apps/web/src/proxy.ts:20-22 derives the subdomain), which makes it the natural single source of truth for the whole HTTP policy: security headers, X-Robots-Tag, host scoping, Service-Worker-Allowed. Splitting policy between next.config headers(), vercel.json and proxy.ts is how per-host mistakes creep in (next.config headers() cannot vary by host without has-matchers, and vercel.json wouldn't see rewrites).
  - **Fix:** Implement one applyPolicy(hostKind, pathname, response) helper in proxy.ts covering all headers from the findings above, and add a packages/integration test (or a plain vitest against NextRequest fixtures) that asserts: customer host → CSP + Permissions-Policy(geolocation self) + no portal routes; business host → frame-ancestors 'none' + X-Robots-Tag noindex on /business,/caisse; preview host → everything reachable. This locks the policy against regressions as surfaces are added.


### data-lifecycle-retention-growth

- [ ] **305. Fiscal/financial tables are correctly keep-forever, but the 10-year retention obligation is nowhere documented — codify the matrix so future cleanup work doesn't touch them**  
  `idea` · organize · effort S · _data-lifecycle-retention-growth_
  - **Where:** `supabase/migrations/20260710000001_pos_money_fiscal.sql:178`, `supabase/migrations/20260710000003_staff_shifts.sql:8`
  - **Problem:** orders (with fiscal_number/fiscal_year), payments, refunds, order_discounts, cash_movements, cash_sessions, receipt_sequences and staff_shifts form the fiscal record (20260710000001_pos_money_fiscal.sql:21-183, 20260710000003_staff_shifts.sql:8). Tunisian commercial/fiscal practice requires ~10-year retention of accounting records, and the gap-free receipt_sequences design (pos_money_fiscal.sql:178-183, bounded at 1 row/venue/year) depends on settled orders never being deleted. Today nothing deletes them — good — but once a data_retention_tick() exists, the boundary between 'cleanable' and 'fiscal' tables must be explicit or a future edit will eventually violate it. Growth is acceptable: orders+order_items+payments ≈ 250k rows/venue/yr, all well-indexed on (restaurant_id, created_at desc).
  - **Fix:** Add the retention matrix as a comment block at the top of the proposed pg_cron migration (and/or docs/): KEEP >=10yr: orders, order_items, payments, refunds, order_discounts, cash_sessions, cash_movements, receipt_sequences, staff_shifts, restaurant_fiscal. CLEAN: everything in the other findings. If volume ever matters (years out), partition orders/order_items by year rather than deleting.


---

# Part 3 — Production & ops work (outside the app code)

These came from live checks against both Supabase projects and the deployed sites — they are not in any source file.

## 3.1 Database / Supabase (production `wpnouppukofzmvsieyeq`, dev `sxmbqwldtqkkmlfbjyzc`)

- [ ] **Apply the missing prod migration** — dev has `session_functions_search_path`; prod does not. Diff and apply so both ledgers match.
- [ ] **Security-advisor hardening migration** (both projects):
  - Pin `search_path` on `public.stock_level_of` and `public.stock_level_rank` (the only two flagged functions).
  - Revoke `EXECUTE` from `anon` on admin SECURITY DEFINER RPCs that gate internally but shouldn't even be callable: `admin_leads`, `admin_reviews_moderation`, `admin_venue_overview` (and review the other 9 anon-executable definer functions — most are legitimately anon-facing like `resolve_table`, but decide each one deliberately).
  - Decide on `pg_net` in the public schema (advisor wants it moved; low risk, low priority).
- [ ] **Dashboard toggles** (2 minutes, prod + dev): enable **leaked-password protection** (HaveIBeenPwned check); **disable public email signup** (keep email/password *login* — owners get provisioned credentials; keep Google sign-in) — this closes the last open item from the July security audit. Mirror in `supabase/config.toml` for local (currently: signup enabled, confirmations off, 6-char minimum — see P2 item 'config.toml: public email signup still enabled').
- [ ] **Performance migration** (one file, biggest DB win available):
  1. Wrap `auth.*()` in `(select auth.*())` in the 8 flagged RLS policies (orders, order_items, session_cart_lines ×3, staff, reviews, waiter_calls) — these re-evaluate per row on your hottest tables.
  2. Add `TO authenticated` (or the right role) to staff/platform/manager policies so anonymous menu readers stop evaluating "staff manage items"-type policies on every menu load — eliminates the bulk of 140 multiple-permissive-policy warnings on the hottest customer path.
  3. Index the hot-path FKs: `order_items(item_id)`, `orders(session_id)`, `orders(cash_session_id)`, `session_cart_lines(item_id)`, `session_cart_lines(participant_id)`, `items(category_id)`, `waiter_calls` FKs. (The audit-trail FKs — `*_created_by_staff` etc. — can wait.)
  4. Later, after a full traffic cycle: review the 17 "unused" indexes before dropping any (several are too young to judge, e.g. `payments_order_idx`).
- [ ] **Edge-function drift**: `generate-insights` differs between dev and prod — redeploy from the repo to prod; delete (or add repo source for) the orphan `diag-provision` function that exists only on prod.
- [ ] **Schedule the nightly functions** — `generate-insights` and `inventory-alerts` have no cron wiring anywhere; they are dead in practice. Add `pg_cron` schedules (or Supabase scheduled functions) and document them.
- [ ] **Migration ledger cleanup** — cloud version/name drift vs repo files (prod entry `20260703022559` is named `20260705000001_discovery_and_geo`, etc.), and one hot-applied migration exists in neither repo nor one ledger. Reconcile once, then adopt: every schema change is a repo migration applied via CLI to dev → prod (P2: 'Migration ledger drift').

## 3.2 Vercel / domains

- [ ] `APPLE_TEAM_ID=9KSK39WBM6` on production env (runbook R4). `ANDROID_CERT_SHA256` once Play credentials exist.
- [ ] Flip the primary domain to the apex `chehia.app` (www currently wins the 308) — aligns AASA, `SITE_URL`, sitemap canonicals.

## 3.3 Git / release process

- [ ] Local `main` is 4 commits behind `origin/main` — someone fast-forwarded origin with the unQA'd mobile work; sync local, and going forward: **nothing merges to main without the Part 4 QA pass** (develop = integration, main = released).
- [ ] Delete merged branch `feat/menu-customization-group-ordering` (local + origin).
- [ ] Add CI (no `.github/` exists at all): typecheck + lint + shared unit tests on every PR; integration suite against `supabase start` nightly; `expo-doctor` + prebuild Info.plist assertion (catches the English-default permission regression forever). See the P1 CI item and the observability gap section.

---

## 3.4 First sprint after approval (from the critic's gap round)

The four gap areas the completeness critic surfaced are your highest-leverage post-approval work, in this order:
1. **Observability** — crash reporting on mobile, error tracking on web/edge, an ops webhook, uptime checks, and backup/PITR documentation. Today every failure mode is discovered by a café owner phoning you.
2. **HTTP security headers & host scoping** — no CSP/frame-ancestors/nosniff anywhere; `/admin`, `/business`, `/caisse` are reachable on every host including preview URLs; POS/admin are clickjackable.
3. **Data lifecycle** — nothing is ever deleted (anonymous auth users, group sessions, photos, leads PII); one pg_cron migration fixes retention AND finally schedules the two dead nightly functions.
4. **Google Play readiness** — no Android build has ever been produced; Data Safety enumeration, closed-test requirement, and the false location claim (fixed in R5) all live in that backlog section.

---

# Part 4 — Pre-submission QA checklist (on-device)

Device matrix: **iPhone (any recent)** + **iPad (compatibility mode — Apple reviews here!)** + one **Android**. Language matrix: run the core loop once each in **FR**, **EN**, and **AR (RTL)**.

**Core loop (all devices, all languages)**
- [ ] Cold-start → scan the printed demo QR with the **in-app scanner** → menu loads with photos → add items (incl. one with required modifiers) → cart → place order → live status screen updates when staff accepts (drive staff side from the portal).
- [ ] Same via **camera-app scan** after R4: QR opens the native app directly (universal link), not Safari.
- [ ] Browse path: "Trouver un restaurant" → venue → table pick → order (this is Apple's Option B).
- [ ] Permission prompts appear **in the device language** (check EN and AR devices specifically — this is the rejection).
- [ ] Airplane-mode mid-flow: cart survives, order queues or fails with a clear message, no blank screens; reconnect → recovery.

**New-in-this-build features**
- [ ] Menu themes: a themed venue renders correctly on mobile (colors/typography/contrast, dark backgrounds legible).
- [ ] Group ordering: two devices join one table session; both see each other's items; host places; **non-host sees the placed order** (known P1 gap: 'Non-host group members never see the placed order' — verify current behavior and decide if it ships as-is).
- [ ] Location gating: at a gated venue (use dev), remote order blocked with a clear localized message + "order here" works within radius; demo venue (prod) NOT gated (R1).
- [ ] Ratings: submit a rating on mobile; verify it appears in portal moderation and publishes after approval.

**iPad specifics (compatibility mode)**
- [ ] Every screen renders without truncation/letterbox weirdness; sheets (rating/group/waiter) usable; keyboard doesn't cover inputs (P2: keyboard covers inputs in sheets); camera scanner works on iPad.

**Portal/Caisse smoke (web, before you demo to anyone)**
- [ ] Caisse: open session → sale → settle → Z-report math (millimes) checks out; kill the network mid-sale and confirm replay on reconnect (known P1 gaps: 'Caisse cannot cold-start offline' and 'Offline fallback keyed only on navigator.onLine' — verify severity for your launch call).
- [ ] Orders board receives the mobile order in realtime.

---

# Appendix — Area-by-area assessments

_The one-paragraph verdict each auditor gave its area, verbatim._

**iOS/Android App Store compliance & release engineering**

The resubmission package is close but has one landmine: the app.json "single French string" fix is incomplete because the expo-camera and expo-location config plugins inject DEFAULT ENGLISH usage strings for every permission option left undefined — the built Info.plist will contain English NSMicrophoneUsageDescription, NSLocationAlwaysUsageDescription, NSLocationAlwaysAndWhenInUseUsageDescription and NSMotionUsageDescription alongside the French camera/when-in-use strings, i.e. the exact Guideline 4 language-mismatch Apple rejected, plus declarations for permissions the app never uses. The robust per-device-language fix (expo top-level "locales" generating InfoPlist.strings for fr/ar/en) is not implemented — no locales/ dir exists. Universal links are currently dead in production: chehia.app 308-redirects to www (AASA can't be served without redirect), and both app.chehia.app and www return 404 "Not configured" because APPLE_TEAM_ID / ANDROID_CERT_SHA256 were never set on Vercel. The good news: the demo QR PNG verifiably decodes to https://app.chehia.app/r/cafe-el-marsa/t/demo-elmarsa-t12 (I decoded it with CoreImage), that URL returns 200 on the web app, the mobile expo-router routes and parseTableUrl handle the exact same shape, the review-reply doc is well-drafted, icons are correct (1024px, no alpha), ITSAppUsesNonExemptEncryption and the privacy manifest are present, and autoIncrement+local version source will correctly bump the rejected buildNumber 2 → 3 on the next EAS build. iPad compatibility mode is likely fine (portrait-locked, flex layouts, no Dimensions.get assumptions) but has never been QA'd on an actual iPad, which the rejection specifically calls out.

**Mobile app user flows, UX completeness & feature parity (apps/mobile/src)**

The mobile app is in strong shape: every core flow (QR scan → venue → menu → item customization → cart → order tracking → rating, plus discovery, group ordering, menu themes, location-gated ordering, offline cached menu + persisted order queue) is implemented, shared cleanly between scanned and browse flows, and mirrors the web customer app closely — including item photos, which are now displayed everywhere (discover covers, venue hero, item cards/sheet, category media), resolving the prior audit's finding. i18n is compile-enforced across fr/ar/en with per-language fonts and render-time RTL mirroring, and accessibility (labels, roles, live regions, VoiceOver status announcements, 44px targets) is unusually good. The gaps that remain cluster around: (1) the exact App Store rejection cause — permission strings are still French-only with no expo `locales` per-device-language localization, and iPad compatibility-mode has no QA evidence; (2) offline edge cases — the queued order has no expiry (a days-old queued order can auto-fire a phantom kitchen order), a partial menu fetch renders an empty "ready" menu and clobbers the good cache, a cached menu never refreshes on reconnect, and a network failure with no cache masquerades as "invalid QR"; (3) keyboard handling — three bottom-sheet modals with TextInputs lack KeyboardAvoidingView; and (4) two real web-parity gaps (no active-order banner on the venue landing, no pre-submit cart reconcile). For Apple review, note the demo path is dev-only in-app, so the reviewer depends entirely on the QR image in the review notes — that path works (scanned flow bypasses the location gate and needs no account), but nothing in the production build points a first-time reviewer at it.

**mobile codebase quality (apps/mobile)**

The mobile codebase is in unusually good shape for its size: strict TypeScript with zero `any`/`@ts-ignore`, zero console.log, zero TODO/FIXME, careful RTL + accessibility work, deliberate offline/idempotency design in the venue provider, and no committed secrets (all Supabase keys are publishable anon keys with RLS as the trust boundary — .env is gitignored via the root .gitignore, and apps/mobile/proxy.ts does not exist). The two things standing between this app and App Store approval are config-level, not code-level: permission strings are still a single French string with no expo `locales`/InfoPlist.strings per-language localization (the exact Guideline 4 rejection), and iPad behavior (supportsTablet:false) is unverified against Apple's explicit note. Code-level gaps are a misleading "invalid QR" screen on first-scan network failure, no production error boundary, un-cached/un-resized menu images, an experimental React Compiler flag backed by an undeclared babel plugin, and zero tests for the most complex mobile-only logic (offline queue + cart reconciliation). The rest is polish: duplicated randomUUID/fetch boilerplate that belongs in packages/shared, a handful of hardcoded strings, a leftover Expo-template LICENSE, and several unused native dependencies.

**web customer app (apps/web — chehia.app / app.chehia.app: landing, discovery, /r venue flows, cart, order tracking, ratings, group ordering, PWA, legal)**

The web customer surface is in strong shape overall: routes are coherent, error/empty states exist almost everywhere, realtime channels are cleaned up correctly, RTL/i18n is systematically handled via a typed trilingual dictionary, and the previously-flagged QR domain mismatch is now resolved (QRs encode app.chehia.app/r/..., legacy apex links still resolve, and mobile associatedDomains cover both hosts). The prior "web loses orders offline" bug is largely fixed — the cart survives refresh via localStorage — but the queued-order promise and the idempotency key are in-memory only, so a refresh mid-outage breaks auto-resubmit and can even permit a duplicate order. The biggest genuine gaps are: the just-shipped PWA install feature cannot fire Chrome's install prompt because the manifest lacks 192/512px icons; group ordering has two structural holes (stale sessions are silently reused by the next party at the table, and non-host members never learn the placed order's id so their order vanishes); and the privacy policy predates the geolocation and reviews features it should disclose. A pile of smaller polish items (no loading.tsx, empty-menu-as-skeleton, unoptimized images, dialog focus management, FR-only legal pages) rounds out the list. Nothing web-side is an App Store blocker per se, but the AASA route returning 404 until APPLE_TEAM_ID is set will silently keep universal links dead at launch.

**Business portal (apps/web — business.chehia.app: dashboard, menu mgmt, orders board, Caisse POS, inventory, ratings, settings, tables/QR, group ordering admin)**

The business portal is broadly well-built: money is integer millimes end-to-end with server-side repricing and SECURITY DEFINER _tx functions, idempotency refs on both order creation and settlement, gap-free fiscal numbering, solid inventory RPC guards, and mostly complete fr/ar/en dictionaries. The weakest area is the Caisse POS offline story: the "offline-first" register cannot cold-boot offline (menu/staff are never persisted locally), a stale client_ref can silently settle an outdated order after the ticket is edited, offline detection relies solely on navigator.onLine with no queue-fallback on request failure, dead-lettered sales have no reconciliation UI, and replayed offline sales lose their original timestamp (wrong fiscal year/Z-session attribution). Several whole capabilities are missing for "final form": order cancellation/refunds (schema exists, zero UI), staff deactivation/role change/password reset, table rename/deactivate, and a failed-sale screen. There is also a recurring silent-success pattern (settings/fiscal/appearance saves ignore errors) and a block of hardcoded-French surfaces (Caisse reports/fiscal, print page, portal error screens, ESC/POS receipts strip Arabic entirely). None of this blocks App Store approval (the portal is web-only), but the high items break real POS/cash flows.

**Platform admin surface (apps/web /admin) + onboarding/provisioning + signup surface**

The admin surface is small but soundly secured at the data layer: every admin read/write goes through RLS policies or SECURITY DEFINER RPCs gated on is_platform_admin(), the admin_allowlist escalation hole was properly fixed (Google-provider + confirmed-email + non-anonymous gate in 20260706000003), and provisioning (admin-provision-business, create-staff) correctly authorizes in-code with rollback on partial failure. No signUp() call exists anywhere in the web app, but the GoTrue email-signup endpoint is still open per config.toml and the prior security audit's pending action — closing it (email provider only, not global signup, which would break first-time Google admin sign-in) remains the top security item. The most significant new hole found: the "staff update own restaurant" RLS policy lets any owner/manager rewrite plan (free self-upgrade to pro), slug, and is_active with a direct PostgREST call. Functionally, the admin portal is an MVP: venue list + activate toggle + leads + review moderation + global review config, but it lacks the operational capabilities needed to actually run the platform — no owner password reset (the starter password is shown exactly once), no venue profile/plan editing, no per-venue item editing, no platform metrics or venue-health signals, no billing/subscription model beyond a bare plan text column, and zero audit logging of admin actions. Onboarding works end-to-end but has a save-per-keystroke bug in the Profile/Hours steps and lets a venue go live with zero tables.

**database schema & security (supabase/migrations, config.toml, seed.sql)**

The schema is in strong shape overall: all 33 tables have RLS enabled, tenant isolation is consistently keyed to staff_restaurant_id()/staff_has_role(), money-mutating writes go exclusively through SECURITY DEFINER _tx functions with search_path pinned, the July admin-escalation fix (Google-provider + confirmed-email + non-anonymous gate) is present in migrations, the POS money-column grant lockdown is in place, receipt_sequences is fully client-inaccessible, and seed.sql matches the App Store demo QR (slug cafe-el-marsa, token demo-elmarsa-t12). However, the audit found three high-severity regressions/holes introduced by the newest features: the final 11-arg place_order_tx silently dropped the inventory auto-depletion call (customer orders no longer deplete stock or trigger low-stock/auto-86), the group-ordering session path completely bypasses both require_qr and the server-enforced geofence (session orders are hardcoded as origin 'scan'), and staff.pin_hash is readable by every colleague, making the 4-6 digit register PIN offline-brute-forceable. A cluster of medium issues involves over-broad column exposure (restaurants.order_seq publicly readable, reviews internals readable by anon), WITH CHECK clauses that omit the role gate on INSERT, missing guards on session_cart_lines UPDATE, and schema-only POS tables (refunds/discounts/cash_movements) with no write path. None of these block App Store approval directly, but the two feature regressions break shipped functionality.

**Supabase edge functions (supabase/functions/*)**

The edge-function layer is in strong shape overall: every function authenticates in-code, prices are always recomputed server-side (client prices ignored except the deliberate offline-replay path), idempotency via client_ref exists on all money paths, rate limits are durable (backed by DB counts, not isolate memory), secrets are read from env only, and no PII or coordinates are logged. The location gate is genuinely enforced server-side in place-order. However, there is one significant enforcement hole: the group-ordering path lets any remote anonymous user bypass both the geofence and the venue's require_qr setting by starting a single-person session with a publicly-listable table_id, because start_session performs none of the location/QR checks and place-order classifies all session orders as "scan". Secondary issues cluster around trust gaps in the staff offline-replay path (unvalidated captured_subtotal, cross-venue item ids), robustness of the extract-menu rate-limit accounting (fire-and-forget audit insert, failures never counted), a spoofable per-IP limit in submit-lead, and unhandled 23505 races on client_ref. The two nightly functions (generate-insights, inventory-alerts) are correct but have no codified schedule anywhere in the repo, so they are effectively dead unless someone remembers a manual pg_cron step. None of these are App Store blockers (the functions are backend-only), but the geofence bypass undermines a shipped, marketed security feature and should be fixed before final form.

**Internationalization — packages/shared i18n + apps/web + apps/mobile (fr/ar/en)**

The i18n foundation is genuinely strong: a single canonical French catalog (983 keys) with TypeScript-enforced parity for ar/en (verified by actual diff — zero missing keys, zero placeholder mismatches, no lazy copy-paste translations), lang-aware money/date helpers, logical CSS on web, and manual-but-thorough RTL on mobile. The critical gap is the exact thing Apple rejected: iOS permission strings are a single French literal in app.json with no expo "locales"/InfoPlist.strings, so an English-language review device will see a French camera prompt inside an English UI — a near-certain repeat of the Guideline 4 rejection. Secondary issues: a bilingual "LANGUE · اللغة" label ships in the mobile app (the same mixed-language pattern Apple flagged), mobile never clamps the active language to a venue's supported languages (producing mixed-language menus), and the business-portal Caisse settings/reports pages plus portal/admin error screens are hardcoded French despite the catalog covering them. There are also ~30 dead catalog keys, a handful of RTL polish bugs (web star-fill anchored left, Arabic headings falling out of the Arabic typeface on web, one mobile label missing its lang prop), and deliberate trilingual web fallback screens that are fine for web but should never be mirrored into the mobile app.

**testing & CI**

Test inventory: packages/shared has a solid vitest unit suite (11 files, ~113 cases covering money formatting, cart/modifier validation, reconcile, i18n fr/ar/en key parity, status machine, deep links, geo/geofence math, inventory helpers, menu-import price parsing, appearance, menu-art, reviews helpers) and packages/integration has 46 real integration tests against the local Supabase stack (place-order validation+pricing, idempotency, RLS tenant isolation, storage RLS, inventory depletion/auto-86/alerts). But coverage stops at roughly the 2026-07-05 feature set: everything shipped since — group ordering RPCs, the entire Caisse POS money path (register_order_tx/settle_order_tx/cash sessions/PIN/shifts), server-side geofence enforcement, import_menu_draft, reviews RLS, and the caisse offline IndexedDB queue — has zero tests, and apps/web + apps/mobile have no test tooling at all. Worse, there is no CI whatsoever (no .github directory), and the integration suite has very likely been red since commit 2c21291: the per-table burst limit added to place-order (429 after 4 orders/90s per table) conflicts with hardening.test.ts which fires 6 orders at the same seeded table T12 seconds after earlier tests already created 4 — exactly the regression class a CI pipeline would have caught. Script wiring also has holes: shared has an eslint config but no lint script, integration has no tsconfig/typecheck/lint so its test files are never typechecked, and root `pnpm test` conflates unit and Supabase-dependent integration tests.

**Build health: does the repo build clean right now (typecheck, lint, unit tests, web production build)**

Typecheck is fully green (`pnpm -r typecheck` passes for @chehia/shared, @chehia/mobile, @chehia/web), the shared unit tests all pass (11 files, 132/132 tests), and the Next.js production build (`pnpm --filter @chehia/web build`) compiles clean and generates all 31 routes using the existing apps/web/.env.local — no missing env secrets. The one broken gate is lint: `pnpm -r lint` FAILS. apps/mobile has 7 eslint errors + 3 warnings (react-hooks compiler rules: static-components and set-state-in-effect), and because pnpm bails on the first failing package, apps/web lint never even runs under the recursive command — run directly it fails too, with 4 errors (react-hooks/purity and react-hooks/refs). None of these block the actual builds (Next 16 no longer lints during build, Expo doesn't either), but the repo's own `pnpm lint` quality gate is red, and several of the flagged patterns are real correctness/perf smells. Secondary hygiene: @chehia/integration has no typecheck or lint script so it is silently skipped by the recursive commands, and the build log is spammed with supabase-js "Node.js 20 deprecated" warnings because local Node is v20.19.5.

**repository hygiene & organization**

The repo is in decent shape for its age: no node_modules or secrets tracked, .git is a lean 15 MB, .playwright-mcp and .DS_Store were never committed and are now ignored, and play-service-account.json is properly ignored where the docs say to put it. The main problems are documentation rot, not tree rot: README.md predates the last four shipped epics (Caisse POS, location gating, group ordering, install prompts) and its deploy checklist omits 5 of the 11 edge functions, while docs/mobile-submission.md now actively contradicts the App-Store-rejection fixes it is supposed to guide (it still describes the trilingual permission strings Apple rejected). There is ~250 KB of triply-duplicated design/playbook artifacts tracked under "Chehia app UIUX design/", template cruft (create-next-app README, Expo-copyright LICENSE), a fully-merged feature branch left on local and origin, and packages/integration is silently excluded from `pnpm typecheck`. A small docs/ restructure (README as front door → docs/{deploy,google-auth,inventory,pos-caisse,location-gating,mobile-submission,app-store-review,design/}) would fix most of this.

**dependency health & supply chain**

Overall dependency health is good: Next.js 16.2.10 and Expo SDK 57 are both the current stable releases, leaflet 1.9.4 is latest and is used with a textbook SSR-safe pattern (type-only import + dynamic import in useEffect, no react-leaflet), and @supabase/supabase-js is consistently 2.110.0 across web/mobile/integration with a single lockfile resolution. pnpm audit (prod and full) reports only 2 moderate vulnerabilities, both in build-time transitive tooling (postcss 8.4.31 via next, uuid 7.0.3 via expo's xcode config tooling) — nothing high/critical and nothing that ships to users. The most real supply-chain gaps are: the Anthropic SDK imported completely unpinned in two deployed edge functions, an unused @supabase/ssr dependency in web, mobile packages drifted behind SDK 57 patch releases right before an App Store resubmission, and zero dependency-update/audit automation (no .github at all). A couple of majors (async-storage 3, gesture-handler 3, TS 7, eslint 10) are available but should be deliberately deferred until after App Store approval.

**branch/environment divergence & ship-state**

The premise "4 commits on develop not on main" is only true LOCALLY: origin/main == develop == ce1c36b, and Vercel production (dpl_HEa2kDHQ8jhQaBvXzM8g1vLvp5TH, READY) is built from ce1c36b — all four features' web code is live, all 6 new migrations (5 POS + location_gating) are applied on prod Supabase (wpnouppukofzmvsieyeq), and register-order/settle-order/place-order-v7 (with location enforcement) are deployed byte-identical on dev and prod. Working tree is clean, no stashes, and nothing exists on main that is not on develop. The real ship gap is therefore exclusively MOBILE: no EAS build has ever shipped the ratings system, near-me/audit fixes, menu themes + group ordering (e09b828), the mobile location gate (b5ccacf), or the Guideline-4 permission fix — the rejected build 2 is the last binary Apple saw. Cross-checking the freshly-shipped location gating against docs/app-store-review/review-reply.md surfaced a genuine resubmission blocker (demo venue is geofenced, so the documented browse-order fallback will reject Apple's reviewer with too_far), and several docs/memory claims are now stale (prod place-order enforcement, search_path backfill, subdomain DNS, mobile-submission.md). Ordered ship plan is given as a finding below.

**observability-ops-readiness**

Chehia has effectively zero production observability: no crash reporter, no error tracker, no log drain, no uptime monitor, no alerting channel, no cron watchdog, and no backup/restore or incident documentation anywhere in the repo. A crash on a customer's iPhone, a 500 in place-order, a dead-lettered Caisse cash sale, or a full outage of app.chehia.app would all be discovered the same way today — by a café owner phoning the founder. The Caisse offline queue is the sharpest edge: cash is physically collected, and permanent sync failures land only in a device-local IndexedDB store with a count badge and no server record, no reconciliation UI, and no page to anyone. The two cron-dependent features (generate-insights, inventory-alerts) have no schedule committed anywhere, so they may simply never run, silently. For the App Store resubmission specifically, shipping EAS build 3 without any crash telemetry means a reviewer-device crash (the exact iPad scenario Apple flagged) would be undiagnosable; adding @sentry/react-native is low-cost but requires updating the currently-empty NSPrivacyCollectedDataTypes and the "no third-party SDKs" App Privacy answers.

**web-http-security-headers-host-scoping**

The web app ships with zero application-set HTTP security headers: no vercel.json exists, next.config.ts has no headers() block, and proxy.ts (the only host-aware code) sets no response headers — so production serves the money-handling Caisse register, the business portal, and the platform admin with no CSP, no frame-ancestors/X-Frame-Options, no Permissions-Policy, no Referrer-Policy, and no nosniff. This is compounded by two design facts: proxy.ts remaps only the root path per host, so /admin, /business, /caisse and /auth resolve on the customer host, the apex, and every public Vercel preview; and supabase-js persists staff/admin access+refresh tokens in localStorage, so any XSS anywhere on a shared origin is full account takeover with nothing to contain it. SEO plumbing is mostly sane (robots disallows /admin, /business, /r/) but misses /caisse and /auth and relies on Disallow alone with no noindex signal. The AASA/assetlinks handlers have correct Content-Type but no explicit Cache-Control and gate on build-time env vars, so an unset APPLE_TEAM_ID silently publishes a 404 that Apple's CDN caches — directly relevant to the already-broken universal-link situation. The fix is one host-aware headers block in proxy.ts plus production host scoping for the sensitive prefixes.

**google-play-android-readiness**

Android is in materially worse shape than the configs suggest: no Android build has ever been produced (android.versionCode is still 1 while ios.buildNumber drifted to 2 under local autoIncrement), so the entire Android runtime — hardware back, RTL, edge-to-edge, QR scanning — is unverified. Worse, the drafted store-privacy answers in docs/mobile-submission.md are now factually false: since the location-gated-ordering feature, the app transmits precise lat/lng/accuracy to the place-order edge function, so answering "location not collected" on the Play Data Safety form would be a policy misdeclaration, and the public privacy policy omits location, reviews and nicknames entirely. Target API is fine (RN 0.86 / Expo SDK 57 targets SDK 36, satisfying Play's 2026 requirement, and the native deps are 16KB-aligned), but declaring CAMERA without a uses-feature required=false will silently filter camera-capable-only devices off Play despite a fully working no-camera browse flow. Process landmines: a personal Play account requires a 12-tester/14-day closed test before production, the first AAB must be uploaded manually before eas submit works, and there is zero Play-specific documentation (Data Safety walkthrough, IARC rating, App access reviewer notes, feature graphic). Positives: play-service-account.json is correctly gitignored with clean history, RECORD_AUDIO is blocked, adaptive+monochrome icons exist, and orders replace-navigate so back can't resubmit a cart.

**data-lifecycle-retention-growth**

The Chehia schema is well-indexed (every hot query path on orders/reviews/movements has a matching (restaurant_id|created_by|table_id, created_at desc) index, and portal reads are LIMIT-bounded), so query latency will hold up — but nothing is EVER deleted: grep for pg_cron/cron.schedule across supabase/ returns zero hits, so there is no scheduler for cleanup and the two nightly functions (generate-insights, inventory-alerts) never run in production. Every anonymous QR customer mints a permanent auth.users row (apps/web/src/lib/supabase.ts:75, apps/mobile/src/lib/supabase.ts:33) with no cleanup policy, inflating Supabase's billable MAU metric; group-ordering sessions never expire (an abandoned 'open' session is even re-served to the NEXT customers at that table, cart lines included); ai_insights appends up to 9 rows/venue/day each duplicating a fat metrics jsonb; leads holds PII forever; item-photos storage objects are orphaned on every photo replace (zero .remove() calls in the codebase); and the events analytics table has no writers at all. One pg_cron migration (outlined in the top finding) fixes scheduling of the dead nightlies plus all retention in a single data_retention_tick() function. FK behavior was verified for anon-user deletion: orders/waiter_calls.created_by are ON DELETE SET NULL (safe) but reviews.created_by is ON DELETE CASCADE — the safe delete criterion is "anonymous AND older than 30d AND zero orders" (a review always implies an order, so this also protects reviews).
