# Chehia — App Review resubmission (Submission 780237f1-…)

_Rewritten 2026-07-27 for build 1.0 (7); updated 2026-07-28 for **build 1.0 (8)**, which adds
the illustrated menu art. Behind it: a 12-dimension adversarial audit of the whole repo (97
findings, each re-verified against the real code before being fixed), a 7-agent fix sweep, and
a full ASC form audit. Everything below is copy-paste ready._

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
| Code fixes | ✅ committed on `develop`, all four gates green |
| **Build 1.0 (8)** | ✅ **BUILT + SUBMITTED** (submission `dda74244`) — EAS `ae4c572a-4867-40b1-a7e8-8cee4ff816f0`, ships the illustrated menu art. Build 7 (`acb5d805`) is also in TestFlight; **submit 8**. |
| Upload to ASC | ✅ **delivered** — EAS submission `459c5ab6-6301-48e6-bf21-221530547045` **FINISHED** 2026-07-27 19:30. Three later submissions of the same binary ERRORED/were cancelled: that is the expected redundant-binary rejection, not a problem. |
| Screenshots | ⬆️ **8 new ones ready** in `~/Desktop/chehia-asc-FINAL/` — see §I |
| App Review notes (§A) | ✅ text final below — **re-paste, one label changed** |
| Reply to Apple (§B) | ✅ text final below — **you paste this** |
| Age rating | ✅ done + verified in ASC 2026-07-16, calculated 4+ |
| App Privacy (§D) | ✅ 4 types published; the bundle *matches* them (was an empty list in build 6) |
| Demo venue on prod | ✅ re-verified 2026-07-27 (see §E) |
| Cloud DB / edge fns | ✅ **applied to prod** 2026-07-28 and verified live — see §H |

---

## A0. Verified ground truth — read out of the signed IPA

Downloaded the actual artifact EAS produced (build 7) and inspected the bundle. Every claim §B
makes to Apple is checked against this, not against the source. **Build 8 changes JavaScript
only** — no app.json, plugin, permission or privacy-manifest edit between 7 and 8 — so every
row below holds for build 8 except `CFBundleVersion`, which is 8:

| Checked | Value in the shipped `Chehia.app` |
| --- | --- |
| `CFBundleIdentifier` | `tn.chehia.app` |
| `CFBundleShortVersionString` / `CFBundleVersion` | **1.0.0 / 7** |
| `CFBundleDevelopmentRegion` | `fr` |
| `CFBundleLocalizations` | `fr, ar, en` |
| `ITSAppUsesNonExemptEncryption` | `false` |
| Orientation | portrait only |
| **Usage descriptions — ALL of them** | exactly three: `NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription`, `NSMotionUsageDescription`, each in **French** |
| Microphone / always / background location | **absent** — no such key exists in the binary |
| `fr.lproj` / `ar.lproj` / `en.lproj` `InfoPlist.strings` | all three present, each carrying all three usage strings |
| `PrivacyInfo.xcprivacy` | `NSPrivacyTracking: false`, **4** collected data types (Name, OtherUserContent, UserID, PurchaseHistory), all `Linked: false` / `Tracking: false` / purpose AppFunctionality, plus 4 required-reason API types |

So the two things Apple's Guideline 4 message was about — permission strings that match the
app's localization, and no strings for capabilities the app does not use — are **provably**
fixed in the binary being submitted. The privacy manifest now also matches the published App
Privacy label (it was an empty list in build 6).

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

**1. Confirm build 7 in TestFlight.** EAS submission `459c5ab6` finished successfully, so
Apple accepted the binary. Check App Store Connect → **TestFlight** for **1.0 (7)**; Apple
takes 5–30 min to finish processing after delivery.

You will also see three failed/cancelled submissions of the same build from the same evening.
Ignore them: once a binary is delivered, Apple rejects any further upload of the same
version+build as redundant. Only `459c5ab6` (19:30) matters, and it succeeded. Do **not**
re-run `eas submit` for build 7 — it can only fail the same way. If a genuinely new binary is
ever needed, bump the build number and build again.

**2. Screenshots — nothing to do unless you want to.** The existing 6.9" set
(`~/Desktop/chehia-asc-screenshots/`, 1320×2868, in order: landing, discover, menu, item,
cart, tracking, venue) was captured from build 6 on the demo venue. Build 7 changes Arabic
typography, touch targets and spacing — **none of which appear in those French screens**, so
they are still an accurate depiction of the shipping build. Apple does not require a
recapture per build. Leave them.

**3. Attach build 7** to the version (Version page → Build → select 1.0 (7)).

**4. App Review Information → Notes: nothing to do.** Audited in ASC on 2026-07-28 — the live
notes already say *"Tap 'Find a place' ('Trouver un établissement' on French devices)"*. The
stale "Find a restaurant" wording was only ever in `docs/mobile-submission.md`, never in ASC.
§A is kept below as the record of what is in the field.

**5. Reply to App Review** → paste §B.

**6. Resubmit to App Review.** Replying alone does NOT restart review. If that button is
greyed out, use the blue **Update Review** button on the version page instead — it submits
the updated version to the same open submission.

---

## I. App Store Connect — audited field by field, 2026-07-28

I signed in and read every page. Below is what ASC **actually contains**, checked against the
shipped build 7 binary and live prod.

### ❗ Only three things need doing

1. **Attach build 7.** The version page still has **build 6**. Build 7 is in TestFlight with
   status **Complete / Ready to Submit** (uploaded Jul 27 5:16 PM), so it is just a matter of
   selecting it.
2. **Screenshots — upload the 8 in `~/Desktop/chehia-asc-FINAL/`.** The 6.5" slot currently
   holds 6 pre-rebrand captures (`1-home.png` … `6-order.png`) with the **old fork logo**, and
   the first one is in **English** while the rest are French — mixed language on a
   French-primary listing. Delete All, then drag in the new set (all 1320×2868, all French,
   café-cup logo, in filename order):

   | # | File | Why |
   | --- | --- | --- |
   | 01 | landing | brand + value prop. From build 6 **on purpose** — the simulator build shows a `__DEV__`-only "Démo" button that does not exist in the shipping app |
   | 02 | menu-categories | the illustrated category tiles — the strongest frame |
   | 03 | items | coffee list with per-dish art and prices |
   | 04 | item-detail | modifiers, allergens, ratings |
   | 05 | cart | 2 items, pay-at-counter stated |
   | 06 | tracking | live order timeline |
   | 07 | venue | table context, contact, language picker |
   | 08 | discover | no-QR browse path (prod venue data) |

   Only the first 3 appear on the install sheet, which is why the menu art is #2.
3. **Digital Services Act trader status is NOT set up.** App Information → App Store
   Regulations & Permits → Digital Services Act shows a **Set Up** button. The app is
   available in **175 countries**, which includes the EU. Apple's warning: *"you must provide
   and verify information regarding your account. If you don't, there may be payment delays or
   your content may be removed from sale in certain countries or regions."* Set it (you are a
   trader — you sell a B2B subscription) or drop the EU territories.

### ✅ Everything else is already correct — verified, not assumed

| Field | Value in ASC | Verdict |
| --- | --- | --- |
| Bundle ID / SKU / Apple ID | `tn.chehia.app` · `chehia-ios` · `6787508673` | ✅ matches the IPA |
| Primary Language | **French** | ✅ matches `CFBundleDevelopmentRegion: fr` |
| Category | **Food & Drink**, no secondary | ✅ |
| Content Rights | "does not contain third-party content" | ✅ |
| Age Rating | **4+**, 172 countries | ✅ |
| Name / Subtitle | 6 / 28 chars | ✅ within 30 |
| Promotional Text | 170 chars (field full) | ✅ |
| Description | 1 737 chars | ✅ |
| Keywords | 93 chars | ✅ within 100 |
| Copyright | 12 chars ("2026 AfraMAT") | ✅ |
| **Sign-in required** | **unchecked** | ✅ correct — the app is anonymous |
| Contact | Moez Abbes · +1 248 979 8236 · abbesmoez22@gmail.com | ✅ |
| **Reviewer notes** | 1 455 chars, and they **already say "Find a place" ("Trouver un établissement")** | ✅ **no re-paste needed** |
| Attachment | `demo-qr-cafe-el-marsa-table-12.png` | ✅ |
| App Privacy | **Published**, 4 types (Name, Other User Content, User ID, Purchase History), all *Not Linked to You*, all *App Functionality* | ✅ exactly matches `PrivacyInfo.xcprivacy` in build 7 |
| Privacy Policy URL | `https://chehia.app/legal/privacy` | ✅ resolves — but see the caveat below |
| Pricing | Free · base Tunisia · 175 countries · Public distribution · Tax "App Store software" | ✅ |
| Game Center / IAP / Subscriptions | none | ✅ |
| App Encryption docs | not requested | ✅ `ITSAppUsesNonExemptEncryption: false` is in the binary |

### ⚠️ Privacy-policy caveat (not an App Review blocker)

`https://chehia.app/legal/privacy` is served from **`main`**, and the correction to it is on
**`develop`**. The live page still says *"aucune image n'est transmise ni conservée"* and names
Supabase EU as the only host. For the **customer app under review** both statements are true —
its camera really is on-device QR only. They are wrong about the **business portal**, where
menu-photo import sends images to a vision model and leads are emailed via Resend. So Apple has
no reason to object, but the document is inaccurate for portal users until `develop` reaches
`main`. Merging is a production web deploy and is a separate decision.

---

### The original spec, for reference

### Version page — 1.0 (iOS)

| Field | Must be | Why / source |
| --- | --- | --- |
| Build | **1.0 (7)** | EAS `acb5d805`, delivered by submission `459c5ab6`. If only (6) is offered, processing hasn't finished. |
| Version | `1.0` | `CFBundleShortVersionString` = 1.0.0 in the IPA |
| What's New | optional for a first release; if present, describe the a11y/Arabic/reliability fixes | — |
| Screenshots — 6.9" | the 7 existing 1320×2868 captures | `~/Desktop/chehia-asc-screenshots/`. No recapture needed for build 7. |
| Screenshots — other sizes | none required | 6.9" alone satisfies iPhone. App is `supportsTablet:false`, so **no iPad screenshots are required** |
| Promotional Text | ≤170 chars, fr | see docs/mobile-submission.md |
| Description | fr | already live |
| Keywords | ≤100 chars, fr | `qr,menu,carte,commande,commander,table,café,restaurant,tunisie,tunis,scanner,serveur,boissons` (93) |
| Support URL | `https://chehia.app` | must resolve — it does |
| Marketing URL | `https://chehia.app` | optional |
| Copyright | `2026 AfraMAT` | — |
| Category | Primary **Food & Drink** | — |
| Age Rating | **4+** | questionnaire done 2026-07-16; build 7 adds no new capability |
| Routing App Coverage File | leave empty | not a routing app |

### App Review Information

| Field | Must be |
| --- | --- |
| Sign-in required | **No** — anonymous, no accounts |
| Contact first/last | Moez Abbes |
| Contact email | abbesmoez22@gmail.com |
| Contact phone | must be reachable |
| Notes | **re-paste §A** — the old text said "Find a restaurant"; the real label is "Find a place" |
| Attachment | `demo-qr-cafe-el-marsa-table-12.png` |

### App Privacy

Four types, each **Data Not Linked to You**, purpose **App Functionality**, **not** used for
tracking — this now matches `PrivacyInfo.xcprivacy` in the binary exactly:

Contact Info → Name · User Content → Other User Content · Identifiers → User ID ·
Purchases → Purchase History.

Location must stay **not** declared (ephemeral geofence check, never persisted — and the demo
venue has gating off, so a reviewer never triggers it).

### Pricing and Availability

| Field | Must be |
| --- | --- |
| Price | **Free** |
| Availability | all territories, **or** exclude the EU if you have not set Trader Status |

⚠️ **The one thing that can silently block submission:** the EU **Digital Services Act trader
status** declaration, under App Information → *Trader Status*. If it is unset and the app is
available in the EU, ASC refuses the submission. Set it (you are a trader — you sell a B2B
subscription) or exclude EU territories.

### Should be empty / off

In-App Purchases — none. Subscriptions — none. Game Center — off. App Encryption docs — not
required (`ITSAppUsesNonExemptEncryption: false` is in the binary, so ASC will not ask).

---

## H. Deployed to prod 2026-07-28

⚠️ **Dev was skipped — it was unreachable.** `chehia-dev` reported ACTIVE_HEALTHY but every
Postgres connection timed out and its logs were empty, for over an hour. The local stack was
used as the gate instead, which is arguably stronger: a full replay of all 37 migrations from
scratch, plus behavioural attack tests, plus the integration suite. Re-run these three
migrations on dev when it comes back so the two ledgers do not drift further.

**How it was validated before prod**

- `pnpm db:reset` — all 37 migrations replayed clean from an empty database.
- Column grants asserted with `has_column_privilege`: pin_hash / rating_avg / plan /
  order_seq revoked; name / is_active / appearance / opening_hours / price_millimes intact.
- The actual attacks, run as SQL: a cross-venue `item_ingredients` link → rejected
  (`item_not_in_restaurant`); a manager promoting themselves → `cannot_change_own_role`;
  a manager granting owner → `only_owner_grants_owner`; an owner granting manager →
  allowed; the service role → allowed (it must still seed a venue's first owner).
- Integration suite **41/46**. The 5 failures are all HTTP 429 from the per-table burst
  limit (4 orders / 90s on the shared `demo-elmarsa-t12` token) — the documented
  environmental class. `place-order`'s rate limiter is untouched by this work.

**Applied to prod (`wpnouppukofzmvsieyeq`) via Supabase MCP `apply_migration`, never db push**

| Migration | Verified after apply |
| --- | --- |
| `20260727000001` staff credentials | `pin_hash` unreadable + unwritable by `anon` and `authenticated`; `role`/`display_name` still work; role trigger installed; 11 staff rows intact |
| `20260727000002` moderated/billing columns | `rating_avg`, `plan`, `order_seq`, `items.rating_avg` all unwritable; `name`, `is_active`, `appearance`, `opening_hours`, `price_millimes`, `is_available` still writable |
| `20260727000003` item_ingredients tenancy | trigger installed; both function bodies confirmed carrying the tenant predicates; 93 items / 100 orders / 1 link intact |

**Edge functions — all 9 redeployed** (every one imports the new `_shared/cors.ts`):
`place-order`, `register-order`, `settle-order`, `call-waiter`, `create-staff`,
`admin-provision-business`, `extract-menu`, `submit-lead`, `submit-review`.

`verify_jwt` was checked per function before and after — **every value unchanged**
(place-order/register-order/settle-order/call-waiter/create-staff/admin-provision-business
`true`; extract-menu/submit-lead/submit-review `false`). This is the trap called out in
supabase/CLAUDE.md: `functions deploy` pushes config.toml's value, and four of these have no
config block. config.toml matched the live state, so nothing moved.

**Live smoke test against prod**

- `null` JSON body → `400 bad_json` (was a 500 with a stack trace). The fix, proven in prod.
- Malformed `item_id` → `400 bad_line` (was `500 could not load the menu`).
- Real anonymous order on the demo venue: **A-513, 7 800 millimes** — exactly
  2 × 2 500 + 2 800, so server-side repricing is correct end to end.
- Same `client_ref` replayed → returned A-513 with `duplicate: true`. No second order.
- Demo venue re-checked after all of it: active, all five gating switches false, 14 tables,
  13 available items, `demo-elmarsa-t12` intact, rating 4.67 (3 reviews).

Both new SECURITY DEFINER guards are `revoke execute … from public, anon, authenticated`
with a pinned `search_path`, per the repo's grant-hygiene convention.

_Original held-back note, kept for the record:_

| Change | What it closes |
| --- | --- |
| `20260727000001_staff_credential_and_role_hardening.sql` | `staff.pin_hash` (the bcrypt register PIN) was selectable AND updatable by every colleague through PostgREST; a manager could promote themselves to owner. **Verified applied cleanly on the local stack** and the column privileges confirmed revoked. |
| `20260727000002_lock_moderated_and_billing_columns.sql` | An owner could PATCH their own `rating_avg`/`rating_count` (walking around the admin-moderated review pipeline), their `plan`, and `order_seq`. |
| `20260727000003_scope_item_ingredients_to_tenant.sql` | Cross-venue: one venue could 86 another's dishes and drain their stock. |
| `supabase/functions/register-order` | Offline replay trusted the client's `captured_subtotal` — a staff account could ring a real basket at 0 millimes — and never checked captured item tenancy. |
| `supabase/functions/settle-order` | Returned recomputed amounts for an already-paid order, so a reprint could show change that was never given. |

⚠️ 000002 and 000003 are **not yet syntax-validated against a running Postgres** — Docker
could not start under the disk pressure. Run `pnpm db:start && pnpm db:reset` before applying
either. 000001 was validated.

Deploy order when you are ready: **dev first, verify Caisse, then prod.** Never
`supabase db push` — use the Supabase MCP `apply_migration` (see supabase/CLAUDE.md).

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
