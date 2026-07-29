# Chehia — Google Play submission pack (field values)

> **How to use this.** `docs/play-store-submission.md` is the *procedure* — account
> creation through rollout. This file is the *data*: the exact value to type into every
> Play Console field, with the file:line evidence behind it.
>
> Produced 2026-07-28 by a 10-agent audit; every finding was then handed to a separate
> adversarial agent told to refute it, and only claims that survived are below.

## ⚠️ Corrections applied after this pack was written

The audit ran against commit `c4d1148`. Five of its findings have since been fixed or
were already stale. **Where this file and the list below disagree, the list below wins.**

| Pack says | Actual status now |
|---|---|
| 512×512 icon **MISSING** | ✅ **Exists** — `~/Desktop/chehia-play-graphics/play-icon-512.png` |
| 1024×500 feature graphic **MISSING** | ✅ **Exists** — `~/Desktop/chehia-play-graphics/play-feature-graphic-1024x500.png` |
| UGC has no in-app report path (**BLOCKER**) | ✅ **Fixed** in `d22bf22` — every review card now has a Signaler/إبلاغ/Report control. Answer Play's UGC questions accordingly. |
| `pathPrefix: "/r"` over-matches `/robots.txt` | ✅ **Fixed** in `d22bf22` → `"/r/"` |
| Android Auto Backup ships the QR token | ✅ **Fixed** in `d22bf22` → `allowBackup: false` |
| Directions opens Apple Maps on Android | ✅ **Fixed** in `d22bf22` → Google universal maps URL |
| Screenshots are iOS-only, wrong ratio | Being recaptured from the Android emulator (1080×2400) |

**Also verified directly from the built APK** (`aapt2 dump badging`), not inferred:

- `targetSdkVersion 36` / `compileSdkVersion 36` — so Play's **31 Aug 2026 API-36 deadline
  is a non-issue**. Section 10 of the procedure doc is closed.
- `versionCode 3`, `versionName 1.0.0`, package `tn.chehia.app`.
- Permissions in the shipped binary: `CAMERA`, `ACCESS_COARSE_LOCATION`,
  `ACCESS_FINE_LOCATION`, `INTERNET`, `VIBRATE`, `ACCESS_NETWORK_STATE`,
  `ACCESS_WIFI_STATE`, `SYSTEM_ALERT_WINDOW` (React Native), legacy storage capped at
  `maxSdkVersion 32`. **No `RECORD_AUDIO`**, no background location, no
  `QUERY_ALL_PACKAGES` — the negative declarations in `app.json` are working.

The remaining **UX items in §2 are not fixed** — items 1, 2 were, the rest (modal system-bar
insets, KeyboardAvoidingView, status-bar tint, location timeout) are open and are polish,
not policy.

---


Verified 2026-07-28 against the repo on `develop` + live prod (`wpnouppukofzmvsieyeq`), live HTTP, and `apps/mobile/app.json`. Claims that survived adversarial verification only; everything unproven is labelled **unverified**.

---

## 0. Verdict

**No — you cannot submit today, and the reason is not code.** The app itself is in good shape (permissions minimal and justified, no ads/analytics/crash SDKs, no payments, AAB output correct, versionCode 2 valid for a first upload). What stops you is (a) two mandatory Play listing graphics that **do not exist as files anywhere** — the 512×512 icon and the 1024×500 feature graphic — Play will not let you save the store listing without them; (b) one genuine policy blocker that needs a code change and therefore a new AAB — the app displays other customers' free text with **no in-app report mechanism**; and (c) if your Play developer account is a personal account created after 13 Nov 2023, **12 opted-in testers running a closed test for 14 continuous days** before production access is even unlocked — that is 2+ weeks of runway and it is the real schedule driver. Everything else (App Links 404, listing copy, Data safety answers) is either post-build or ready-to-paste below.

**HARD BLOCKERS**
1. `512×512` store icon — missing (§5).
2. `1024×500` feature graphic — missing, nothing at that ratio exists on disk (§5).
3. Phone screenshots at a Play-conforming aspect ratio — all 45 existing captures are 1:2.17, not 9:16, and every frame shows iOS chrome (§5).
4. In-app report/flag affordance for displayed UGC — code change, new AAB (§1 C1).
5. `play-service-account.json` — absent from disk; `eas submit -p android` cannot run (§6).
6. Closed-testing 12/14 requirement **if** the account is personal & post-Nov-2023 (§6). *Account type is unverified — I cannot see the console.*

**SHIPS AFTER (does not block the first upload)**
- `assetlinks.json` 404 → App Links dead → every table QR opens Chrome instead of the app. Chicken-and-egg: needs the Play app-signing SHA-256, which only exists after the first upload. Fix immediately after (§6 step 8).
- Android UX defects in §2 (back button, Apple Maps chip, modal insets, keyboard) — none are policy violations, but items 1–2 are reviewer-visible on the demo path.
- Tablet screenshots, promo video — optional.

---

## 1. Code blockers before the AAB is final

Four changes. Only **C1** is a policy blocker; C2–C3 are one-liners that ride the same rebuild for free.

### C1 — BLOCKER: displayed UGC has no in-app report mechanism
Play's *Inappropriate Content → User Generated Content* rule requires an in-app way to report objectionable content **in addition to** moderation. The app both posts and displays free text:
- Post: `apps/mobile/src/components/venue/rating-sheet.tsx:172` (comment, `maxLength 600`), `:195` (name, `maxLength 40`) → `:61-75` POST `submit-review`.
- Display: `apps/mobile/src/components/venue/item-sheet.tsx:52` (`rpc("item_reviews")`), rendered `:336` (`slice(0,6)`), `:352` name, `:355-357` comment.
- Second surface: group nicknames — `group/group-sheet.tsx:135-142` (input) → `group/group-cart.tsx:139` (rendered to everyone at the table).
- Report strings exist but have **zero consumers**: `packages/shared/src/i18n/fr.ts:509-510` (`portal.ratings.report` / `reported`).

**Minimal fix:** one `Pressable` per review card in `item-sheet.tsx:336-356` opening `mailto:contact@aframat.com` with a prefilled subject — same channel already wired at `apps/mobile/src/app/about.tsx:69`. Add `t.rating.report` to **all three** dictionaries (`packages/shared/src/i18n/{fr,ar,en}.ts`) or `i18n.test.ts` goes red. Do the same on the group-cart nickname row (`group-cart.tsx:139`) — Play's checklist asks for reporting across *every* UGC surface.

**Mitigation to write into the Play UGC answer:** reviews are pending-by-default and pre-publication moderated — `supabase/migrations/20260707000001_reviews.sql:28` (`default 'pending'`), `:191-192` (public read only `status='approved'`), `supabase/functions/submit-review/index.ts:130`. Live prod re-queried today: `platform_reviews_config = {reviews_enabled: true, moderation_mode: "manual", allow_comments: true}`. **Do not word this as if it were enforced in code** — `moderation_mode` is a togglable single-row setting; flipping it to `"auto"` publishes free text with no filter.

### C2 — `pathPrefix: "/r"` over-matches
`apps/mobile/app.json:110`. Android `pathPrefix` is a raw string prefix, so it claims `/robots.txt` (`apps/web/src/app/robots.ts`, live 200) and any future `/r…` route. Real link shape is `/r/{slug}/t/{token}` (`packages/shared/src/deeplink.ts:16`).
**Fix:** `"pathPrefix": "/r/"`.

### C3 — Android Auto Backup ships the QR capability token to Google Drive
`apps/mobile/app.json:92-127` sets no `android.allowBackup`. The Supabase anonymous session is persisted in AsyncStorage (`apps/mobile/src/lib/supabase.ts:20-27`) under keys that embed the secret `qr_token` (`src/lib/session.tsx:84` → `chehia.session.${qrToken}`; `src/lib/venue.tsx:120-123`). Root `CLAUDE.md` states `tables.qr_token` is a secret capability.
**Fix:** `"allowBackup": false` in `expo.android`. (*Premise that Android defaults it to `true` is asserted, not readable from this repo — the fix is correct either way.*)

### C4 — decide before the build: apex-domain QRs
`app.json:106-112` names only `app.chehia.app`. Every QR the current code prints already targets that host — `qrOrigin()` returns `APP_URL = https://app.chehia.app` in production (`apps/web/src/lib/site.ts:23-32`), used by `apps/web/src/app/business/tables/page.tsx:78` and `.../tables/print/page.tsx:67`, and the demo QR encodes `https://app.chehia.app/r/cafe-el-marsa/t/demo-elmarsa-t12`. **No change needed** unless a QR was ever printed against the apex — Android App Links do not follow the apex→www 308.

*Not a code change:* `versionCode` will be rewritten to **3** on disk by the build itself (`eas.json:4` `appVersionSource: "local"` + `:28` `autoIncrement: true`). Commit that diff.

---

## 2. Android UX fixes (ship in the same AAB — you're rebuilding for C1 anyway)

1. **Hardware Back closes the app from the QR scanner** — the reviewer's very first screen. `apps/mobile/src/app/index.tsx:67-111`: `scanning` is component state, not a route, and `/` is the stack root; the only exit is the custom ✕ at `:88-108`. `BackHandler` appears in exactly one file repo-wide (`components/venue/menu-screen.tsx:73`). **Fix:** copy that pattern — `BackHandler.addEventListener("hardwareBackPress", …)` guarded on `scanning`, returning `true`. Keep `app.json:101 predictiveBackGestureEnabled: false`; it is what makes the handler work.
2. **"Directions" opens Apple Maps on Android** — `apps/mobile/src/components/venue/venue-home.tsx:396` builds `https://maps.apple.com/?daddr=…`, opened at `:409`. Verified live on prod: `cafe-el-marsa` has `phone=""`, `whatsapp=null`, `instagram=null`, `lat/lng = 36.8783/10.3247` — so **Directions is the only chip rendered on the demo venue**, the first screen after the QR. Minimum-functionality risk. **Fix:** `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` (works on both platforms).
3. **Six bottom sheets render under the system bars** — zero `statusBarTranslucent` / `navigationBarTranslucent` in the whole app (grep: 0 hits). `item-sheet.tsx:101`, `table-picker.tsx:26`, `waiter-sheet.tsx:44`, `rating-sheet.tsx:95`, `group/group-sheet.tsx:85`, `group/group-cart.tsx:96`. Un-dimmed band at the top, double-counted `insets.bottom` padding at the bottom on 3-button-nav devices. **Fix:** add both props to all six `<Modal>` tags.
4. **`KeyboardAvoidingView` is a no-op on Android in four screens** — `behavior={Platform.OS === "ios" ? "padding" : undefined}` at `cart-screen.tsx:116`, `waiter-sheet.tsx:46`, `rating-sheet.tsx:97`, `group-sheet.tsx:87`. The rating sheet auto-opens on `served` (`order-screen.tsx:170-182`), so it is unavoidable. **Fix:** `: "height"` for the three modal-hosted sheets; test together with #3 (`adjustResize` does not apply to a translucent window).
5. **Status-bar icons invisible on camera + venue hero** — `_layout.tsx:52` sets `<StatusBar style="dark" />` globally; `index.tsx:69` is full-bleed dark camera, `venue-home.tsx:98-102` runs a cover photo under the bar. **Fix:** `<StatusBar style="light" />` in the `scanning` branch and at the top of `VenueHome`. (Do **not** add `androidStatusBar`/`androidNavigationBar` to app.json — edge-to-edge is forced from SDK 54+ and Android 16 ignores them.)
6. **`getCurrentPositionAsync` has no timeout** — `discover.tsx:90`, `src/lib/location-gate.tsx:98`. If the fused provider never returns, `status` stays `"locating"`; `LocationGateCard` *replaces* the order button on a gated venue (`cart-screen.tsx:360-361`) → cannot order, no error, no retry. Absent timeout is code-certain; the Android hang is **unverified on device**. **Fix:** `Promise.race` with a 10s reject; the existing `catch` (`location-gate.tsx:107`) already degrades correctly.
7. **No purpose disclosure before the location prompt, on two surfaces.** Compliant: `LocationGateCard` (cart) renders `shareToOrder` + `shareBody` at `location-gate.tsx:103-110` before the CTA. **Not compliant:** the `LocationBanner` default case (`location-gate.tsx:174-182`) shows the label only, and `onPress` (`:218-221`) goes straight to the OS prompt; and `discover.tsx:221` fires `requestForegroundPermissionsAsync()` off the bare "Autour de moi" chip (`packages/shared/src/i18n/fr.ts:1023`) with no preceding data statement. **Fix:** one line of purpose copy in fr/ar/en on both.
8. **Back skips a level in the menu drill-down** — `menu-screen.tsx:71-78` handles `selectedRootId` only; `category-items.tsx:36` `activeSub` has no handler.
9. **RTL padding pinned LTR** — `menu-screen.tsx:440-441`, `category-items.tsx:81` use `paddingStart/End` under `supportsRTL: false`.

**Clean, do not touch:** shadows all pair `elevation` (`theme.ts:164-186`); all six Modals set `onRequestClose`; mic doubly disabled (`app.json:124-126`, `:153-154`); `plugins/with-android-lint-fix.js` load-bearing (`app.json:134`); `Share.share` passes `message` (`group-cart.tsx:63`); all nine fonts bundled (`_layout.tsx:1-38`).

---

## 3. Play Console — field by field

### App details (create app)
| Field | Value |
|---|---|
| App name | `Chehia` |
| Default language | **French (France) – fr-FR** |
| App or game | App |
| Free or paid | **Free** (irreversible) |
| Declarations | Developer Program Policies ✔ · US export laws ✔ |

Package name `tn.chehia.app` is fixed by the AAB (`app.json:93`).

### Store listing — French (fr-FR, default)
| Field | Value | Count |
|---|---|---|
| App name | `Chehia – Menu et commande` | 25/30 |
| Short description | `Scannez le QR de votre table, commandez. Sans compte, paiement au comptoir.` | 75/80 |
| Full description | §4 FR block | 2646/4000 |

### Store listing — العربية (ar)
| Field | Value | Count |
|---|---|---|
| App name | `Chehia شهية — القائمة والطلب` | 28/30 |
| Short description | `امسح رمز QR على طاولتك واطلب. بلا حساب، والدفع عند الصندوق.` | 59/80 |
| Full description | §4 AR block | 1795/4000 |

### Store listing — English (United States) (en-US)
| Field | Value | Count |
|---|---|---|
| App name | `Chehia – Menu & Table Order` | 27/30 |
| Short description | `Scan the QR on your table and order. No account, you pay at the counter.` | 72/80 |
| Full description | §4 EN block | 2205/4000 |

Launcher label is `Chehia` (`app.json:3`) — every variant leads with it deliberately.

### Graphics
| Slot | Value |
|---|---|
| App icon | 512×512 PNG 32-bit — **MISSING**, see §5 |
| Feature graphic | 1024×500 PNG — **MISSING**, see §5 |
| Phone screenshots | 2–8, min 320 max 3840 per side, **16:9 or 9:16** — existing sets are 1:2.17 → §5 |
| 7" / 10" tablet | optional; none exist. `supportsTablet: false` (`app.json:14`) is **iOS-only** and has no Android effect — leaving these empty is allowed |
| Promo video | leave empty |

### Categorization
| Field | Value |
|---|---|
| App category | **Food & Drink** (matches ASC, `review-reply.md` §I) |
| Tags | **DECIDE:** pick ≤5 from Play's fixed list; there is no repo evidence for a specific set |

### Contact details (store listing)
| Field | Value |
|---|---|
| Email | `contact@aframat.com` — the address surfaced in-app (`apps/mobile/src/app/about.tsx:69`) and in the privacy policy (`apps/web/src/app/legal/privacy/page.tsx:74,80`) |
| Website | `https://chehia.app` |
| Phone | **DECIDE:** optional. ASC carries `+1 248 979 8236` (US) — a Tunisian number reads better on a Tunisian listing |

### App access
**Select: "All functionality is available without special access."**
Grounded: no login/signup UI anywhere in `apps/mobile/src` (grep for `signInWithPassword|signInWithOAuth|signup|verifyOtp`: zero hits — only `signInAnonymously` at `src/lib/supabase.ts:30-36`); `review-reply.md:63`, `:329`.

If a free-text box appears, paste:
```
Chehia is fully anonymous. There is no account, no sign-in and no paid or
gated tier: every screen and every feature is reachable from a cold install.
Ordering uses an anonymous session, and payment happens in person at the
venue counter, outside the app.
```

**Reviewer instructions** (put in the release notes / any reviewer-facing field — **unverified** where Play surfaces this when "no special access" is selected; do **not** select "restricted access" just to get a text box, that answer would be false):
```
Chehia is a free QR-menu & ordering app for cafe/restaurant customers. A diner
scans the QR printed on their table, views that venue's menu, and sends their
food/drink order to the venue. Payment is made in person at the counter - there
is NO payment and NO in-app purchase inside the app.

HOW TO REACH THE FULL EXPERIENCE ON ANDROID (no login needed):

Option A - Scan the demo QR code
1. Open Chehia.
2. Tap "Scan the QR code on your table" ("Scannez le code QR sur votre table"
   on French devices).
3. Point the camera at the QR image demo-qr-cafe-el-marsa-table-12.png,
   e.g. displayed on another screen.
4. The demo venue "Cafe El Marsa - Table 12" opens. Tap "View the menu", add
   items, open the cart, and tap "Send the order". The order is confirmed on a
   live tracking screen (Received -> Preparing -> Ready -> Served); the customer
   would then pay at the counter.
   (The QR encodes: https://app.chehia.app/r/cafe-el-marsa/t/demo-elmarsa-t12)

Option B - No scan needed (browse flow)
1. Open Chehia.
2. Tap "Find a place" ("Trouver un etablissement" on French devices).
3. Select "Cafe El Marsa", tap "Choose your table" and pick any table, then
   browse the menu and order. Location permission is NOT required.

The app's primary localization is French; it also supports Arabic and English
based on the device language.
```
QR image: `/Users/abbesmoe/Desktop/code/chehia/docs/app-store-review/demo-qr-cafe-el-marsa-table-12.png` (700×700). Every button label above is the shipping label. **Re-verified live on prod today:** `cafe-el-marsa` → `require_location=false, require_qr=false, require_table_confirmation=false, ordering_paused=false, enforce_opening_hours=false`. Do not gate this venue.

### Ads
**"No, my app does not contain ads."** — grep of `apps/mobile/package.json`, `app.json`, `eas.json`, root `package.json` and all of `apps/mobile/src` for `admob|appsflyer|adjust|segment|posthog|firebase|analytics|sentry|crashlytics|bugsnag|mixpanel|amplitude|tracking-transparency|expo-application|expo-updates`: **zero hits**. 31 runtime deps, all Expo/RN core + `@supabase/supabase-js` + `@expo-google-fonts/*` + `@react-native-community/netinfo`.

### Content rating questionnaire (IARC)
Email: `contact@aframat.com`. *Exact IARC wording varies by revision — these are the answers by topic.*

| Question topic | Answer |
|---|---|
| App category | **Utility, Productivity, Communication or Other** (not "Social") |
| Violence (realistic/fantasy/gore) | No |
| Sexuality / nudity | No |
| Bad language | No |
| Controlled substances — drugs, tobacco | No |
| **Controlled substances — alcohol references** | **DECIDE.** Zero alcohol in shipped or seeded data (grep of `supabase/seed.sql`, `packages/shared/src`, `apps/mobile/src` for `biere\|bière\|beer\|vin\|wine\|alcoo\|alcohol\|cocktail\|whisky\|vodka\|rhum\|champagne\|liqueur\|celtia\|boukha`: zero hits; `review-reply.md:196` agrees). But menus are **venue-supplied at runtime** — a partner café can add alcohol any day. Recommend answering **Yes** ("references may appear in partner menus") and accepting the higher band rather than risking a misrepresentation strike |
| Gambling / simulated gambling | No |
| Horror / fear | No |
| Crude humour | No |
| **Users can interact / communicate with other users** | **Yes** — reviews (`item-sheet.tsx:52,352,355`) and group-order nicknames (`group-cart.tsx:139`) |
| Users can share their location with other users | **No** — the geofence coordinate goes to the server for one in-memory comparison and is never shown to anyone (`supabase/functions/place-order/index.ts:35-38, 302-312`); discovery coordinates never leave the device (`discover.tsx:90-131`) |
| Users can share personal information with third parties | No |
| App contains digital purchases | **No** |
| App is a store/marketplace for physical goods | Physical food/drink ordered in person, paid at the counter — no in-app transaction |
| Miscellaneous (unrestricted internet, user-shared media) | No |

### Target audience and content
| Field | Value |
|---|---|
| Target age groups | **DECIDE: 18 and over** (recommended), or 13+ minimum. **Never a Families band.** Two reasons: the app declares Precise location (Data safety below) — Google's Families policy restricts collecting precise location from children, and a Families band would additionally trigger the Designed-for-Families requirements. Note this is a deliberate divergence from the ASC 4+ rating, which is fine |
| Appeals to children (store listing/assets) | No |
| Ads shown to children | N/A (no ads) |

### Data safety
Global answers: **Encrypted in transit = Yes** (all HTTPS, `apps/mobile/src/lib/supabase.ts:14`). **Users can request data deletion = Yes** — email `contact@aframat.com` (`about.tsx:69`; policy `legal/privacy/page.tsx:74,80`). **No in-app deletion control** — say "request via email/web", not "in-app". Account-deletion policy does **not** apply (no account creation). **Nothing is Shared** with third parties.

| Play data type | Collected | Shared | Req/Opt | Ephemeral | Purpose | Evidence |
|---|---|---|---|---|---|---|
| Location → **Approximate** | **Yes** | No | Optional | **Yes** | App functionality; Fraud prevention & security | `ACCESS_COARSE_LOCATION` at `app.json:121`; both reads use `Location.Accuracy.Balanced` (`src/lib/location-gate.tsx:98`, `discover.tsx:90`) — coarse-grade, and Android 12+ lets the user grant Approximate-only |
| Location → **Precise** | **Yes** | No | Optional | **Yes** | App functionality; Fraud prevention & security | `ACCESS_FINE_LOCATION` `app.json:122`; venue geofence radius floor is **20 m** (`packages/shared/src/geo.ts:36-37`, clamp at `place-order/index.ts:307`), which coarse cannot serve. Transmitted `venue.tsx:603-609` → `place-order/index.ts:35-38`, used `:302-312`, **never persisted** (no coordinate param at `:455-467`; no `orders` coordinate column exists — verified by content-grep of all migrations) and never logged (`:349`, `:475` log errors only) |
| Personal info → **User IDs** | **Yes** | No | **DECIDE: Required** | No | App functionality | `supabase.ts:30-36` anonymous uid; stored `orders.created_by` (`20260701000001_core_schema.sql:178`), `reviews.created_by` (`20260707000001_reviews.sql:21`), `session_participants.auth_uid` (`20260709000002:230`). *Arguably Optional: `ensureCustomerSession()` is called only on order / waiter-call / review / group actions, never on launch, discovery or menu browse. "Required" is the safe answer* |
| Personal info → **Name** | **Yes** | No | Optional | No | App functionality | Optional first name on a review: `rating-sheet.tsx:195` → `submit-review/index.ts:19,129` → `reviews.customer_name` ≤40 (`20260707000001:27`) |
| Personal info → Email / Phone / Address / Race / Beliefs / Orientation / Other | No | — | — | — | — | No such input in `apps/mobile/src`; no login UI |
| Financial info → **Purchase history** | **Yes** | No | **DECIDE: Required** | No | App functionality | `orders` (`20260701000001:169-184`) + `order_items` (`:190-200`), written by `place_order_tx` (`place-order/index.ts:455-467`), prices recomputed server-side (`:434-450`) |
| Financial info → payment info / credit score / other | No | — | — | — | — | No payment SDK; pay at counter |
| App activity → **Other user-generated content** | **Yes** | No | Optional | No | App functionality | `orders.note` (`20260701000001:175`), `order_items.note` (`:199`), review comment ≤600 (`20260707000001:25`), waiter-call note ≤300 (`call-waiter/index.ts:75`), group nickname (`20260709000002:42`, `:68`), and **`session_cart_lines.note` (`20260709000002:58`)** — written by a direct client PostgREST insert (`src/lib/session.tsx:234-241`) and persisted even if the group order is never placed |
| App activity → interactions / search history / installed apps / other | No | — | — | — | — | No analytics SDK; discovery search is a client-side filter (`discover.tsx:117-121`) |
| App info & performance → crash logs / diagnostics | No | — | — | — | — | No Sentry/Firebase/Crashlytics/Bugsnag/expo-updates |
| Device or other IDs | No | — | — | — | — | No ad ID, no device-ID library. The only identifier is the anonymous uid, declared under User IDs |
| Photos and videos | No | — | — | — | — | Camera decodes QR on device only: `src/app/index.tsx:32-49, 70-75`. No `expo-image-picker`, no `expo-media-library`, no upload path. (Menu-photo → vision-model import is the **web** business portal, not in this APK) |
| Audio / Messages / Contacts / Calendar / Files / Health / Web browsing | No | — | — | — | — | No permission, dependency or code path |

**Three things to know when filling this in:**
- **Do NOT reuse Apple's answer.** ASC leaves location undeclared (`review-reply.md:218-222`, `:391-392`) under Apple's ephemeral-use exclusion. Play's automated audit cross-references the manifest, and both COARSE and FINE are in it. `docs/mobile-submission.md:64` and `docs/ROAD-TO-LAUNCH.md:308` both already prescribe **approximate + precise = Collected**.
- **Location is the default remote-order path, not an edge case** — `require_location` defaults to `true` (`supabase/migrations/20260711000001_location_gating.sql:17`). "Optional" is justified by "the customer can scan the table QR instead"; write that down.
- **Keep nicknames under App activity → Other UGC**, matching Apple (`review-reply.md:209`), not under Personal info → Name.
- *Open item, not a blocker:* `docs/ROAD-TO-LAUNCH.md:308` says the shipped **iOS** privacy manifest (`app.json:28-63`, four types, no location) should be updated to match. Unresolved either way.
- **Third-party native SDKs are unverified.** The zero-SDK proof is a JS-package grep. `expo-location` pulls Google Play services FusedLocationProvider and `expo-camera`'s barcode path pulls MLKit transitively. Conclusion is almost certainly still "no collection", but it is not provable from `package.json`.

### Remaining App content declarations
| Section | Answer |
|---|---|
| Government apps | **No** |
| Financial features | **"My app doesn't provide any financial features."** No payment instrument is taken; prices are server-recomputed (`supabase/functions/place-order`); the fiscal/POS money code (Caisse, `register-order`, `settle-order`) is `apps/web` only and not in the Play bundle |
| Health apps | **No** — no Health Connect, no health permission or dependency |
| News apps | **No** |
| COVID-19 contact tracing / status | **No** |
| Data deletion | Yes — request channel `contact@aframat.com`. **DECIDE:** Play's form has a *web* deletion-URL field. A deletion-request anchor/form on `chehia.app/legal/privacy` is the cheap hedge; none exists today |
| Privacy policy URL | `https://chehia.app/legal/privacy` — **verified live 200 today**. Its location and deletion prose are byte-identical on `main` and `develop` (the develop-only delta is the business-portal photo/sub-processor text, which is not in the Play APK). **No merge is required before submitting** |

---

## 4. Store listing copy

### French — name 25/30 · short 75/80 · full 2646/4000
```
Chehia – Menu et commande
```
```
Scannez le QR de votre table, commandez. Sans compte, paiement au comptoir.
```
```
Chehia, c'est la carte de votre café ou restaurant sur votre téléphone — et la commande qui va avec.

Vous vous installez, vous scannez le code QR posé sur la table, le menu de l'établissement s'ouvre. Vous choisissez, vous envoyez votre commande au personnel, et vous payez au comptoir, comme d'habitude.

COMMENT ÇA MARCHE — 3 ÉTAPES

1. Scannez le code QR sur votre table. Le menu et la commande s'ouvrent automatiquement. Pas de QR sous la main ? Touchez « Trouver un établissement », choisissez le lieu, puis votre table.

2. Parcourez le menu, ajoutez ce qui vous fait envie, choisissez les tailles et les options, et laissez une note à la cuisine si besoin.

3. Envoyez la commande. Vous suivez son avancement en direct : Reçue, En préparation, Prête, Servie. Puis vous réglez au comptoir.

DANS L'APPLICATION

• Le menu complet du lieu, par catégories, avec recherche
• Tailles, suppléments et options sur chaque article
• Allergènes et repères végétarien, végan, sans gluten, épicé
• Une note pour la cuisine (« sans coriandre, svp »)
• Le suivi de la commande en direct, jusqu'à « Servie »
• Appeler le serveur : l'addition, de l'eau, des couverts
• Commander à plusieurs autour de la même table, une seule addition
• « Recommander mon habituel » pour retrouver votre commande favorite
• Vos avis et vos notes sur le lieu et sur les plats, publiés après vérification
• Trouvez les cafés et restaurants autour de vous qui prennent la commande par QR
• Connexion instable : le menu reste consultable, et la commande part dès le retour du réseau

TROIS LANGUES

Français, العربية et English. L'application suit la langue de votre téléphone, et l'arabe est entièrement mis en page de droite à gauche.

SANS COMPTE, SANS PAIEMENT DANS L'APPLICATION

Chehia ne demande ni inscription, ni e-mail, ni mot de passe : vous ouvrez, vous scannez, vous commandez. Il n'y a aucun paiement, aucun achat intégré et aucun abonnement dans l'application. Vous réglez votre café ou votre repas en personne, au comptoir de l'établissement, comme vous l'avez toujours fait.

AUTORISATIONS

• Appareil photo — uniquement pour lire le code QR de votre table. La lecture se fait sur l'appareil ; aucune image n'est enregistrée ni transmise.
• Localisation (facultative) — pour classer les établissements les plus proches et, lorsqu'un établissement l'exige, confirmer que vous êtes sur place au moment de commander. L'application fonctionne sans.

VOUS TENEZ UN CAFÉ OU UN RESTAURANT ?

Chehia est conçu en Tunisie pour les cafés et restaurants tunisiens. Pour recevoir les commandes de vos clients sur vos écrans : chehia.app

Scannez. Commandez. Régalez-vous.
```

### العربية — name 28/30 · short 59/80 · full 1795/4000
```
Chehia شهية — القائمة والطلب
```
```
امسح رمز QR على طاولتك واطلب. بلا حساب، والدفع عند الصندوق.
```
```
شهية تضع قائمة مقهاك أو مطعمك في هاتفك — ومعها الطلب.

تجلس، تمسح رمز QR الموجود على الطاولة، فتفتح قائمة المكان. تختار، ترسل طلبك إلى الموظفين، وتدفع عند الصندوق كالعادة.

كيف يعمل — 3 خطوات

1. امسح رمز QR على طاولتك. تفتح القائمة والطلب تلقائياً. ليس لديك رمز QR؟ انقر «اعثر على مكان»، اختر المكان ثم طاولتك.

2. تصفّح القائمة، أضف ما يعجبك، اختر الأحجام والخيارات، واترك ملاحظة للمطبخ عند الحاجة.

3. أرسل الطلب. تتابع تقدّمه مباشرة: تم الاستلام، قيد التحضير، جاهز، تم التقديم. ثم تدفع عند الصندوق.

في التطبيق

• قائمة المكان كاملة، مرتّبة حسب الفئات، مع بحث
• أحجام وإضافات وخيارات لكل صنف
• مسببات الحساسية وإشارات نباتي، نباتي صرف، خالٍ من الغلوتين، حار
• ملاحظة للمطبخ («بدون كزبرة، من فضلك»)
• تتبّع الطلب مباشرة حتى «تم التقديم»
• نادِ النادل: الحساب من فضلك، ماء، أدوات ومناديل
• اطلبوا معًا على الطاولة نفسها، بفاتورة واحدة
• «أعد طلب المعتاد» لاستعادة طلبك المفضّل
• آراؤك وتقييماتك للمكان وللأطباق، تُنشر بعد المراجعة
• اعثر على المقاهي والمطاعم القريبة منك التي تستقبل الطلبات عبر رمز QR
• اتصال غير مستقر؟ تبقى القائمة متاحة، ويُرسل الطلب تلقائياً عند عودة الشبكة

ثلاث لغات

العربية والفرنسية والإنجليزية. يتبع التطبيق لغة هاتفك، والعربية مُهيّأة بالكامل من اليمين إلى اليسار.

بلا حساب، وبلا دفع داخل التطبيق

شهية لا تطلب تسجيلاً ولا بريداً إلكترونياً ولا كلمة مرور: تفتح، تمسح، تطلب. لا يوجد أي دفع ولا شراء داخل التطبيق ولا اشتراك. تدفع ثمن قهوتك أو وجبتك شخصياً عند صندوق المكان، كما تفعل دائماً.

الأذونات

• الكاميرا — لقراءة رمز QR الخاص بطاولتك فقط. تتم القراءة على الجهاز، ولا تُحفظ أي صورة ولا تُرسل.
• الموقع (اختياري) — لترتيب الأماكن الأقرب إليك، ولتأكيد وجودك في المكان عند الطلب إذا اشترط المكان ذلك. التطبيق يعمل من دونه.

هل تدير مقهى أو مطعماً؟

شهية صُمّمت في تونس للمقاهي والمطاعم التونسية. لاستقبال طلبات حرفائك على شاشاتك: chehia.app

امسح. اطلب. استمتع.
```
Vocabulary lifted from `packages/shared/src/i18n/ar.ts` so the listing and the app agree (`:44-45`, `:66`, `:72`, `:124-128`, `:142-145`, `:155-166`, `:184-190`, `:200`, `:207-212`; tagline `:7`).

### English — name 27/30 · short 72/80 · full 2205/4000
```
Chehia – Menu & Table Order
```
```
Scan the QR on your table and order. No account, you pay at the counter.
```
```
Chehia puts your café or restaurant's menu on your phone — and lets you order from it.

Sit down, scan the QR code on your table, and the venue's menu opens. Choose what you want, send the order to the staff, and pay at the counter, as usual.

HOW IT WORKS — 3 STEPS

1. Scan the QR code on your table. The menu and ordering open automatically. No QR code to hand? Tap "Find a place", choose the venue, then your table.

2. Browse the menu, add what you fancy, pick sizes and options, and leave a note for the kitchen if you need to.

3. Send the order. Follow it live: Received, Preparing, Ready, Served. Then settle up at the counter.

IN THE APP

• The venue's full menu, by category, with search
• Sizes, extras and options on every item
• Allergens and vegetarian, vegan, gluten-free and spicy markers
• A note for the kitchen ("no coriander, please")
• Live order tracking, all the way to "Served"
• Call the waiter: the bill, water, cutlery
• Order together around the same table, on one single bill
• "Order my usual again" to bring back your favourite order
• Your ratings and reviews of the venue and the dishes, published after moderation
• Find cafés and restaurants near you that take orders by QR
• Weak signal? The menu stays readable, and your order is sent as soon as the network is back

THREE LANGUAGES

French, Arabic and English. The app follows your phone's language, and Arabic is fully laid out right to left.

NO ACCOUNT, NO PAYMENT IN THE APP

Chehia asks for no sign-up, no email and no password: you open it, you scan, you order. There is no payment, no in-app purchase and no subscription inside the app. You pay for your coffee or your meal in person, at the venue's counter, exactly as you always have.

PERMISSIONS

• Camera — only to read the QR code on your table. It is decoded on the device; no image is stored or transmitted.
• Location (optional) — to sort the venues closest to you and, when a venue requires it, to confirm you are on site as you order. The app works without it.

DO YOU RUN A CAFÉ OR A RESTAURANT?

Chehia is built in Tunisia for Tunisian cafés and restaurants. To receive your customers' orders on your own screens: chehia.app

Scan. Order. Enjoy.
```

---

## 5. Graphics checklist

**HAVE (in-APK, nothing to do):** `apps/mobile/assets/images/android-icon-{foreground,background,monochrome}.png`, all 1024×1024 32-bit with alpha, wired at `app.json:97-99`. Monochrome present → Android 13+ themed icons work. *Unverified: whether the foreground art sits inside the central 66% safe zone — check the launcher preview on a device.*

**HAVE (reviewer attachment):** `docs/app-store-review/demo-qr-cafe-el-marsa-table-12.png`, 700×700.

**MISSING — 512×512 store icon** (mandatory)
```bash
mkdir -p ~/Desktop/chehia-play
sips -z 512 512 \
  /Users/abbesmoe/Desktop/code/chehia/apps/mobile/assets/images/icon.png \
  --out ~/Desktop/chehia-play/icon-512.png
```
Source `icon.png` is 1024×1024 but **24-bit, no alpha**; Play's spec asks for 32-bit PNG. `sips` cannot add an alpha channel and ImageMagick is not installed on this machine (`which magick`/`convert`: absent). Either `brew install imagemagick` then `magick icon.png -resize 512x512 -alpha set PNG32:icon-512.png`, or re-export once from Preview/Figma with alpha on. Keep it fully opaque — Play applies its own mask.

**MISSING — 1024×500 feature graphic** (mandatory, blocks listing save)
Nothing at that size or ratio exists anywhere on disk. Only landscape brand art available is the live OG card (`apps/web/src/app/opengraph-image.tsx:5`, 1200×630, fetched today: 200 / image/png / 41 816 B):
```bash
curl -sL https://chehia.app/opengraph-image -o /tmp/og.png
sips -c 586 1200 /tmp/og.png --out /tmp/og-crop.png          # 1200/586 = 2.048 = 1024/500
sips -z 500 1024 /tmp/og-crop.png --out ~/Desktop/chehia-play/feature-graphic-1024x500.png
```
**Do not ship that unmodified** — the OG card carries the **pre-rebrand rosette mark**, not the steaming-cup app icon (`opengraph-image.tsx:26-30`, confirmed in the rendered PNG). A feature graphic whose logo differs from the icon is a quality problem. Best: author a new 1024×500 from `android-icon-foreground.png` (1024×1024 **with** alpha, composites cleanly) over `#FBF2E4`, plus the tagline already in the copy — *"Scannez. Commandez. Régalez-vous."*

**PARTIAL — phone screenshots**
Have 8 PNG frames × 3 languages at `~/Desktop/chehia-asc-FINAL{,-ar,-en}/`, 1320×2868. Count, format, side lengths and file size all pass. **Aspect ratio 1:2.173 fails Play's stated 16:9 / 9:16 rule** (9:16 = 1:1.7778); the 6.5" fallback set (`-65/`, 1284×2778, 1:2.164) fails equally.
```bash
# pad to exact 9:16 with the brand cream (1620/2880 = 0.5625)
sips -p 2880 1620 --padColor FAF6EF in.png --out out.png
# for the 1284×2778 set:
sips -p 2784 1566 --padColor FAF6EF in.png --out out.png
```
Padding fixes the ratio but **leaves the iPhone Dynamic Island and iOS status bar visible** in an Android listing — a listing-accuracy risk (`review-reply.md:305` confirms these were captured on a 6.9" iOS simulator). **Recommended: recapture on an Android emulator at 1080×1920 or 1440×2560**, which also gives you the device QA you have never done. Do **not** use `~/Desktop/chehia-screenshots/6.5-*` or `6.9-*` — pre-rebrand art.

**MISSING — 7"/10" tablet screenshots, promo video:** optional. Leave empty for v1.

---

## 6. What only the human can do

1. **Create the app in Play Console** (`tn.chehia.app`, French default). The Play Developer API cannot create a listing, and the first artifact for a fresh package generally has to go up through the Console UI. *(Exact current API behaviour: unverified — plan for a manual first upload.)*
2. **Confirm your developer account type and start the closed test if required.** Personal accounts created after 13 Nov 2023 need **≥12 opted-in testers, continuously, for 14 days** before production access unlocks. `eas.json:44-47` targets `track: "internal"` and internal-track time does **not** count. Already logged at `docs/ROAD-TO-LAUNCH.md:567-572`. **This is the real schedule blocker — start recruiting testers today.** Account type is unverified; I cannot see the console.
3. **Delete or verify `/Users/abbesmoe/Desktop/code/chehia/app.json`** — it exists again, untracked, containing `{"expo": {}}`. `review-reply.md:514-516` records that this exact file previously shadowed `apps/mobile/app.json` for any root-run `expo`/`eas` command and could produce a build with no name, package or permission strings. Run every build from `apps/mobile/`.
4. **Delete the stale prebuild dirs** `apps/mobile/android/` and `apps/mobile/ios/` before any local prebuild (both gitignored; `expo prebuild` without `--clean` merges into stale state).
5. **Run the manifest pre-flight** (the ritual `apps/mobile/CLAUDE.md:44` already prescribes for iOS):
   ```bash
   cd apps/mobile && npx expo prebuild -p android --clean
   grep -n "uses-permission\|foregroundServiceType\|targetSdkVersion\|android.hardware.camera" \
     android/app/src/main/AndroidManifest.xml android/app/build.gradle
   rm -rf android
   ```
   Three things to read off it, all currently **unverified**: (a) any `FOREGROUND_SERVICE*` from `expo-location` → Play Console forces the Foreground-service declaration form; (b) `targetSdkVersion` — Play requires API 35 today, **API 36 from 2026-08-31**; (c) whether `expo-camera` emits `<uses-feature android:name="android.hardware.camera" android:required="true">`, which silently narrows device distribution. *Do not blindly add anything to `blockedPermissions` — stripping a `<uses-permission>` while a `<service android:foregroundServiceType>` element survives produces an inconsistent manifest.*
6. **Build the production AAB.** `eas build -p android --profile production` from `apps/mobile/`. Production has no `android.buildType`, so it defaults to app-bundle (correct); it points at **prod** Supabase (`eas.json:32`). Note: **no production-profile Android build has ever run** — the only Android artifact ever produced was `preview` → APK against **dev**. `plugins/with-android-lint-fix.js` is proven for `assembleRelease` (commit `0cee578`) but **unproven for `bundleRelease`**; three builds were burned on this exact `ExtraTranslation` failure. Then commit the `versionCode 2 → 3` diff the build writes back into `app.json`.
7. **Download `play-service-account.json`** from Google Cloud IAM (Play Console → Setup → API access) into `apps/mobile/` — it is absent and correctly gitignored (`apps/mobile/.gitignore:37-38`). Also change `eas.json` `submit.production.android.track` from `"internal"` to `"production"` when you actually want production, or `eas submit` will keep landing on the internal track.
8. **After the first upload: fix App Links.** Copy the SHA-256 from Play Console → Setup → App integrity → **App signing key certificate** *and* the upload-key SHA-256 (`eas credentials -p android`). Set both, comma-separated, as `ANDROID_CERT_SHA256` on the Vercel **production** project serving `app.chehia.app` (`apps/web/src/app/.well-known/assetlinks.json/route.ts:11` splits on `,`). Then **trigger a rebuild, not just a redeploy** — `route.ts:5` is a request-independent `export function GET()` with no `dynamic` export, so Next may prerender it (*whether Next 16 actually does: unverified*). Verify:
   ```bash
   curl -i https://app.chehia.app/.well-known/assetlinks.json   # must be 200, currently 404
   adb shell pm get-app-links tn.chehia.app                     # must say "verified"
   ```
   Until this is done, every table QR scanned with the Android system camera opens Chrome, not the app — including every group invite (`group-cart.tsx:14`). This is the product's entire acquisition flow.
9. **QA the AAB on a real Android 15/16 device, in Arabic.** Nothing in the Android runtime has ever been verified on hardware (`docs/PRODUCT-AUDIT-2026-07-15.md:177`, `docs/ROAD-TO-LAUNCH.md:2429`). Check, in order: hardware back from the scanner (§2.1), the Directions chip (§2.2), bottom-sheet insets and keyboard (§2.3–2.4), Arabic RTL with an `ar-*` system locale (`supportsRTL: false` at `app.json:146` means direction is JS-side — a double-flip would be silent), cold-start deep link, and the location gate with GPS denied indoors (§2.6). Read Play's pre-launch report for the **16 KB page size** verdict — every native dep is on the Expo SDK 57 canonical pin, but 16 KB alignment for this exact toolchain is **unverified**.
10. **DECIDE, before you fill the forms:** target age band (recommend 18+, never Families — §3); the IARC alcohol answer (§3); Req/Opt for User IDs and Purchase history (§3); whether to add a web deletion-request form on `chehia.app/legal/privacy`; store tags; listing contact phone number.