# Chehia — App Review resubmission (Submission 780237f1-…)

_Rewritten 2026-07-27 for **build 1.0 (7)**, after a 12-dimension adversarial audit of the
whole repo (97 findings, each re-verified against the real code before being fixed) and a
7-agent fix sweep. Everything below is copy-paste ready._

> **Read this first.** Apple rejected under Guideline 4 (permission language), 2.1(a) (demo
> details) and 2.1(b) (business model). Build 6 already answered all three. Build 7 is not
> about the rejection reasons — it is about not shipping a reviewer a build with a
> reachable frozen-splash bug, a permanently-spinning group-order sheet and Arabic rendered
> in a Latin face. The reply text in §B is essentially unchanged because the *answers* have
> not changed.

---

## Status board

| Item | State |
| --- | --- |
| Code fixes | ✅ committed on `develop` (`8b41f5b`), all four gates green |
| Build 1.0 (7) | ⏳ **not built yet** — blocked on local disk, see §F |
| Screenshots | ⏳ regenerate from build 7 (§F step 2) |
| App Review notes (§A) | ✅ text final below — re-paste, one label changed |
| Reply to Apple (§B) | ✅ text final below — **you paste this** |
| Age rating | ✅ done + verified in ASC 2026-07-16, calculated 4+ |
| App Privacy (§D) | ✅ 4 types published; build 7 now *matches* them in the bundle |
| Demo venue on prod | ✅ re-verified 2026-07-27 (see §E) |

---

## A. App Review Information → Notes

**Sign-in required:** No — the customer app is used anonymously (no account, no login).

**Attachment:** `docs/app-store-review/demo-qr-cafe-el-marsa-table-12.png` (already uploaded).

⚠️ The only change from the build-6 notes is the Option B button label. The previous
`docs/mobile-submission.md` told reviewers to tap **"Find a restaurant"** — no build has had
a button with that label for months. The real label is **"Find a place"**. A reviewer
hunting for a control that does not exist is how a 2.1 "could not locate the feature"
rejection happens, so re-paste this block even though the rest is identical.

```
Chehia is a free QR-menu & ordering app for café/restaurant customers. A diner
scans the QR printed on their table, views that venue's menu, and sends their
food/drink order to the venue. Payment is made in person at the counter — there
is NO payment and NO in-app purchase inside the app.

HOW TO REACH THE FULL EXPERIENCE ON iPhone/iPad (no login needed):

Option A — Scan the attached demo QR code
1. Open Chehia.
2. Tap "Scan the QR code on your table" ("Scannez le code QR sur votre table"
   on French devices).
3. Point the camera at the attached QR image (demo-qr-cafe-el-marsa-table-12.png),
   e.g. displayed on another screen.
4. The demo venue "Café El Marsa — Table 12" opens. Tap "View the menu", add
   items, open the cart, and tap "Send the order". The order is confirmed on a
   live tracking screen (Received → Preparing → Ready → Served); the customer
   would then pay at the counter.
   (The QR encodes: https://app.chehia.app/r/cafe-el-marsa/t/demo-elmarsa-t12)

Option B — No scan needed (browse flow)
1. Open Chehia.
2. Tap "Find a place" ("Trouver un établissement" on French devices).
3. Select "Café El Marsa", tap "Choose your table" and pick any table, then
   browse the menu and order. Location permission is NOT required — the venue
   list and ordering both work without it.

The app's primary localization is French; it also supports Arabic and English
based on the device language. Permission prompts are localized to the device
language (fr/ar/en).
```

---

## B. Reply to Apple — paste this into the message thread

```
Hello, and thank you for the detailed feedback.

Guideline 4 (Design) — permission-request language
You are right — the permission requests did not match the app's localization.
This is fixed:
- The only permissions the app ever requests are camera (to scan the table QR
  code) and when-in-use location (to show nearby cafés and confirm on-site
  presence). Both usage descriptions are written in the app's primary
  localization (French), and are additionally localized for every supported
  localization (French, Arabic, English) via InfoPlist.strings, so the system
  permission prompts always appear in the same language as the app's UI.
- We removed the usage strings for capabilities the app does not use
  (microphone, always-on/background location). For completeness: the build
  still declares a motion usage description (NSMotionUsageDescription,
  localized in French, Arabic and English) only because a system framework
  referenced by our location library requires the declaration to pass App
  Store validation (ITMS-90683). The app itself never requests motion
  permission and never reads motion data — no motion prompt is ever shown to
  the user.
- We also went further than the report: this build fixes the Arabic text
  rendering throughout (Arabic was falling back to a Latin typeface in text
  fields and several labels), restores Reduce Motion support on the ordering
  screens, and raises every control to the 44pt minimum touch target.
Chehia is designed as an iPhone app (a portrait, on-the-go tool used at a café
table); it also runs and functions fully on iPad in iPhone-compatibility mode.

Guideline 2.1(a) — demo details
No login is required (the customer app is anonymous). We have added a demo QR
code as an attachment and step-by-step instructions in App Review Information →
Notes. There is also a no-scan path: tap "Find a place" ("Trouver un
établissement" on a French device), select the demo venue "Café El Marsa", pick
a table, and browse/order without scanning. The demo venue accepts orders at any
hour and from any location, so neither the time of day nor your location can
block the flow.

Guideline 2.1(b) — business model
1) Does your app access any paid content or services?
   No. The app has no in-app purchases and no paid digital content or services.
2) What are the paid content or services, and what are the costs?
   None in the app. The only thing a customer pays for is the physical food and
   drinks they order, which are prepared and consumed in person at the café/
   restaurant. These are physical goods/services and are not digital content.
3) Do individual customers pay for the content or services?
   Customers pay the café/restaurant directly, in person at the counter, for
   their food and drinks. No payment ever happens inside the app — the app does
   not process or collect any money.
4) If no, does a company or organization pay for the content or services?
   The cafés/restaurants (our B2B clients) subscribe to Chehia's service. That
   subscription is handled entirely outside this iOS app, on our separate web
   portal (business.chehia.app), and is billed by us directly. It is not
   accessible or purchasable from the iOS customer app under review.
5) Where do they pay, and what's the payment method?
   Customers: at the venue's counter, in person (cash or card) — outside the app.
   Businesses: on our web portal, billed directly by us — outside the app.
6) If users create an account to use your app, are there fees involved?
   Customers do not create an account; the app is used anonymously with no fees.
7) Steps for locating in-app purchases:
   There are no in-app purchases. The app contains no purchase, subscription or
   paywall screens, and none are configured in App Store Connect. The customer
   flow is: view menu → add items → send order → pay at the counter in person.

We are happy to provide anything else you need. Thank you.
```

---

## C. Age rating — ✅ DONE (verified in ASC 2026-07-16)

All 7 steps walked; every saved answer verified against the build and prod:

- In-App Controls (parental controls, age assurance): **No**.
- Capabilities: Unrestricted Web Access **No** · User-Generated Content **Yes**
  (reviews are admin-approved server-side before publication — RLS-verified) ·
  Social Media **No** · Messaging & Chat **No** · Advertising **No**.
- Mature themes / medical / sexuality / violence / gambling / contests /
  loot boxes: **all None/No** (demo menu verified alcohol-free in all 3 languages).
- Calculated rating: **4+**, override "Not Applicable".

Nothing to redo — build 7 adds no new capability in any of these categories.

## D. App Privacy — ✅ published, and the bundle now agrees

Four data types, all **Data Not Linked to You**, purpose **App Functionality**,
tracking **No**:

| Type | What it is |
| --- | --- |
| Contact Info → Name | optional first name on a review |
| User Content → Other User Content | order notes, review comments, group-order nicknames |
| Identifiers → User ID | anonymous session UUID (no account/email/phone) |
| Purchases → Purchase History | ordered items/prices/table for order tracking |

**Fixed in build 7:** the shipped privacy manifest declared
`NSPrivacyCollectedDataTypes: []` — an empty list — while the ASC label declared these four.
Build 7's manifest declares the same four (not linked, no tracking, App Functionality), so
the bundle and the label no longer contradict each other.

Location is **not** declared: precise coordinates are sent only for location-gated remote
orders, used in memory for the geofence check and never persisted or logged (verified in
`supabase/functions/place-order`); Apple's definition excludes such ephemeral use. The demo
venue has location gating **off**, so a reviewer never triggers it. Camera is on-device QR
decode only. Zero analytics/ads/crash SDKs.

---

## E. Demo venue — re-verified on PROD 2026-07-27

Queried live against `wpnouppukofzmvsieyeq`:

- `cafe-el-marsa` — `is_active: true`.
- `require_location`, `require_qr`, `require_table_confirmation`, `ordering_paused`,
  `enforce_opening_hours` — **all false**. The reviewer can order at any hour, from
  anywhere, with or without scanning.
- 14 tables across Terrasse / Salle / Bar, all active. **Table 12 (`demo-elmarsa-t12`)
  intact** — this is the token in the attached QR.

Do not gate this venue. Apple's reviewer re-tests this exact path after every update.

---

## F. What YOU still have to do

**1. Build and upload 1.0 (7)** — blocked right now on local disk (the Mac is at
100%; free ~10GB and this unblocks). Then:

```bash
cd apps/mobile
eas build --platform ios --profile production   # autoIncrement bumps 6 → 7
eas submit --platform ios --profile production  # uploads to ASC (ascAppId is set)
```

`production.autoIncrement` **rewrites `app.json`** on disk (`ios.buildNumber`,
`android.versionCode`) — commit that diff or the number gets reused.

**2. Screenshots** — Version page → Previews and Screenshots → **Delete All** on the
existing 6.9" set, then drag the 7 files from `~/Desktop/chehia-asc-screenshots/`
(1320×2868, numbered in order: landing, discover, menu, item, cart, tracking, venue).
⚠️ Those captures are of **build 6**. Build 7 changes Arabic typography and some spacing
but nothing in the French screens they depict, so they remain accurate — recapture only if
you want the polish visible.

**3. Attach build 7** to the version, then **Reply to App Review** → paste §B.

**4. Resubmit to App Review.** Replying alone does NOT restart review. If that button is
greyed out, use the blue **Update Review** button on the version page instead — it submits
the updated version to the same open submission.

---

## G. What changed in the app since build 6

Build 6 was cut from `8e00359`. Everything below landed after it, so **none of it is in the
build Apple currently has**.

Reviewer-reachable defects:
- A font-load failure left the app **frozen on the splash screen forever** — the loader
  discarded the error and never hid the splash. Now fails open to system fonts.
- Placing a group order awaited anonymous sign-in *outside* its try block, so a flaky
  network rejected out of the handler and left the host on a **permanent spinner**.
- Reduce Motion was honoured by the root layout but overridden by both nested venue
  stacks, so the whole ordering flow ignored the accessibility setting.
- Arabic rendered through the **Latin typeface** in every text field and several labels,
  and `letterSpacing` was breaking Arabic cursive joining.
- Modifier chips, contact chips and the discovery footer link were **under 44pt**.
- The star-rating row announced **ten stars** to VoiceOver instead of five.
- Deep-link cold starts left the back control a dead tap.
- The cart's send button was disabled exactly when the offline queue would fire, making
  the entire offline-order feature unreachable by the gesture meant to trigger it.
- A second offline order silently **destroyed the first**.
- A cached menu never refreshed once connectivity returned.
- Entering an Arabic-only venue **permanently rewrote** the customer's saved app language.
- The web/mobile group-session realtime channel was torn down and resubscribed on every
  incoming message, losing anything that arrived in the gap.

Compliance:
- Privacy manifest now declares the four data types (§D).
- The privacy policy claimed no image is ever transmitted and that Supabase EU is the only
  host. Both were false — menu-photo import sends photos to a vision model and leads are
  emailed via Resend. Corrected against the actual edge functions.
- Deleted a stray `{"expo":{}}` at the repo root that shadowed `apps/mobile/app.json` for
  any root-run `expo`/`eas` command — i.e. it could have produced a build with no name,
  bundle id or permission strings.

Not reviewer-facing but shipped in the same commit: several POS/money fixes (a 0-millimes
offline-sale hole, a settle-order lockup that took cash without marking the order paid, a
blank price field saving a dish at 0) and a staff-credential migration. **The migration and
the two edge-function fixes are deliberately NOT applied to any cloud project** — they are
repo-only pending review.
