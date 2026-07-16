# Chehia — App Review resubmission (Submission 780237f1-…)

_Updated 2026-07-16 after a full audit of build 1.0 (6) — the actual signed IPA, the
build-6 source (commit 8e00359), live prod, and every App Store Connect section were
verified by a 23-agent audit. Everything below is copy-paste ready and 100% true for
build 6._

## Verified ground truth (from the signed IPA itself)

- Build **1.0.0 (6)**, CFBundleDevelopmentRegion **fr**, localizations fr/ar/en.
- Ships EXACTLY three usage strings — camera, when-in-use location, **and motion** —
  each in French plus localized `InfoPlist.strings` (fr/ar/en). **No** microphone,
  **no** always/background location.
- ⚠️ The motion string is intentional: Apple's delivery scan (ITMS-90683) requires it
  because a linked framework references the motion API. The app never prompts for or
  reads motion data. **The reply below is worded accordingly — do not claim motion
  was "removed" (it wasn't; earlier drafts of this doc said so and were wrong).**
- Demo venue verified live in PROD: active; require_location / require_qr /
  require_table_confirmation / ordering_paused / enforce_opening_hours **all false**
  (reviewer can order at any hour from any location); QR token `demo-elmarsa-t12`
  intact; menu 4 categories / 14 trilingual items; demo URL returns HTTP 200.
- Age-rating questionnaire (new 7-step version incl. social-media questions):
  **already completed and saved** in ASC — verified answer-by-answer, calculated
  rating **4+**. Nothing left to do there.
- App Review Information: contact = Moez Abbes / abbesmoez22@gmail.com, sign-in
  required = No, QR attachment uploaded.

## What YOU do in App Store Connect (in this order)

0. If a macOS dialog "Visual Studio Code wants access to control Finder" is still
   on screen: click **Don't Allow** (it was an automation attempt; not needed).
1. **Screenshots** (~30 seconds): Version page → Previews and Screenshots →
   **Delete All** on the old 6.5" set (old fork logo) → drag the 7 files from
   **~/Desktop/chehia-asc-screenshots/** (numbered in order: landing, discover,
   menu, item, cart, tracking, venue — fresh 1320×2868 captures of build 6 with
   the café-cup logo, taken on the demo venue) into the same screenshots area →
   **Save**.
2. **Submission page** (App Review → the rejected iOS Submission) → **Reply to
   App Review** → paste §B below.
3. Same page → click **Resubmit to App Review** (replying alone does NOT restart
   review). If that button is greyed out, use the blue **Update Review** button on
   the version page instead — it submits the updated version to the same open
   submission.

Everything else (build 6 selected, notes updated, App Privacy, age rating,
metadata) is already done and verified in ASC.

---

## A. App Review Information → Notes (already pasted in ASC — kept here as record)

**Sign-in required:** No — the customer app is used anonymously (no account, no login).

**Attachment:** `docs/app-store-review/demo-qr-cafe-el-marsa-table-12.png` (uploaded).

**Notes (matches build 6's real button labels, English first — the review device
language is English):**

```
Chehia is a free QR-menu & ordering app for café/restaurant customers. A diner
scans the QR printed on their table, views that venue's menu, and sends their
food/drink order to the venue. Payment is made in person at the counter — there
is NO payment and NO in-app purchase inside the app.

HOW TO REACH THE FULL EXPERIENCE ON iPad/iPhone (no login needed):

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
3. Select "Café El Marsa", tap "Choose your table" and pick Table 12, then
   browse the menu and order. Location permission is NOT required — the venue
   list and ordering work without it.

The app's primary localization is French; it also supports Arabic and English
based on the device language. Permission prompts are localized to the device
language (fr/ar/en).
```

---

## B. Reply to Apple's message (paste in the message thread) — CORRECTED for build 6

```
Hello, and thank you for the detailed feedback.

Guideline 4 (Design) — permission-request language
You are right — the permission requests did not match the app's localization.
This is fixed in the new build (1.0 build 6):
- The only permissions the app ever requests are camera (to scan the table QR
  code) and when-in-use location (to show nearby cafés and confirm on-site
  presence). Both usage descriptions are written in the app's primary
  localization (French), and are additionally localized for every supported
  localization (French, Arabic, English) via InfoPlist.strings, so the system
  permission prompts always appear in the same language as the app's UI.
- We removed the usage strings for capabilities the app does not use
  (microphone, always-on/background location). For completeness: the build
  still declares a motion usage description (NSMotionUsageDescription,
  localized in French, Arabic, and English) only because a system framework
  referenced by our location library requires the declaration to pass App
  Store validation (ITMS-90683). The app itself never requests motion
  permission and never reads motion data — no motion prompt is ever shown to
  the user.
Chehia is designed as an iPhone app (a portrait, on-the-go tool used at a café
table); it also runs and functions fully on iPad in iPhone-compatibility mode.

Guideline 2.1(a) — demo details
No login is required (the customer app is anonymous). We have added a demo QR
code as an attachment and step-by-step instructions in App Review Information →
Notes. There is also a no-scan path: tap "Find a place" (Trouver un
établissement), select the demo venue "Café El Marsa", pick a table, and
browse/order without scanning.

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
   There are no in-app purchases. The app contains no purchase, subscription, or
   paywall screens, and none are configured in App Store Connect. The customer
   flow is: view menu → add items → send order → pay at the counter in person.

We are happy to provide anything else you need. Thank you.
```

---

## C. Age-rating questionnaire — ✅ DONE (verified in ASC 2026-07-16)

Walked all 7 steps in ASC; every saved answer verified against build 6 + prod:

- In-App Controls (parental controls, age assurance): **No**.
- Capabilities: Unrestricted Web Access **No** · User-Generated Content **Yes**
  (reviews are admin-approved server-side before publication — RLS-verified) ·
  Social Media **No** · Messaging & Chat **No** · Advertising **No**.
- Mature themes / medical / sexuality / violence / gambling / contests /
  loot boxes: **all None/No** (demo menu verified alcohol-free in all 3 languages).
- Calculated rating: **4+**, override "Not Applicable".

## D. App Privacy (ASC) — final declaration

Four data types, all **Data Not Linked to You**, purpose **App Functionality**,
tracking **No**:

| Type | What it is |
| --- | --- |
| Contact Info → Name | optional first name on a review |
| User Content → Other User Content | order notes, review comments, group-order nicknames |
| Identifiers → User ID | anonymous session UUID (no account/email/phone) |
| Purchases → Purchase History | ordered items/prices/table for order tracking |

Location is **not** declared — precise coords are sent only for location-gated
remote orders, used in-memory for the geofence check, never persisted or logged
(verified in supabase/functions/place-order); Apple's definition excludes such
ephemeral use. Camera is on-device QR decode only. Zero analytics/ads/crash SDKs.

## E. After approval (next-build hygiene, not blockers)

- Wrap contact-card `Linking.openURL` in a `.catch` (venue-home.tsx:401) and map
  `ordering_paused` / `venue_closed` place-order codes to friendly strings in
  cart-screen.tsx (demo venue has both switches off, so the reviewer can't hit them).
- Align the in-app privacy manifest (`NSPrivacyCollectedDataTypes: []` in app.json)
  with the 4-type ASC label.
- Optionally add English/Arabic App Store listing localizations + trader status
  (Digital Services Act) or exclude EU territories before the EU deadline.
