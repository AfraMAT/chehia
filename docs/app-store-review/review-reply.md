# Chehia — App Review resubmission (Submission 780237f1-…)

_Updated 2026-07-15. Everything below is copy-paste ready._

## Already done for you (verified live)

- ✅ **Build 1.0 (6)** with the Guideline 4 fix built via EAS and uploaded to App Store Connect.
- ✅ Guideline 4 fix **verified in the built Info.plist**: only camera + when-in-use location
  usage strings ship, in French, plus per-device-language `InfoPlist.strings` (fr/ar/en).
  No microphone / always-location / motion strings.
- ✅ Demo venue **Café El Marsa** verified in PROD: active, `require_location=false`
  (reviewer is not geo-blocked), 4 categories / 14 trilingual menu items.
- ✅ Demo QR (`demo-qr-cafe-el-marsa-table-12.png`) decodes to
  `https://app.chehia.app/r/cafe-el-marsa/t/demo-elmarsa-t12` → live, HTTP 200.
- ✅ Universal links fixed: `APPLE_TEAM_ID` set on Vercel prod; AASA serves 200 and
  Apple's CDN has ingested it (`9KSK39WBM6.tn.chehia.app`).

## What YOU do in App Store Connect (in this order)

1. Wait for build **1.0 (6)** to finish processing (TestFlight tab).
2. **Version page** (iOS App 1.0) → Build section → select build **6**.
3. Same page → **App Review Information** → paste §A notes + upload the QR attachment.
   Sign-in required: **No**. Save.
4. **App Information** → complete the **age-rating questionnaire** incl. the new
   social-media questions (due Sept 7) — answers in §C.
5. **Submission page** → Reply to Apple's message with §B.
6. Click **Resubmit to App Review** (replying alone does NOT restart review).

---

## A. App Review Information (Version → scroll to "App Review Information")

**Sign-in required:** No — the customer app is used anonymously (no account, no login).

**Attachment:** upload `docs/app-store-review/demo-qr-cafe-el-marsa-table-12.png` (the demo QR code).

**Notes:**

```
Chehia is a free QR-menu & ordering app for café/restaurant customers. A diner
scans the QR printed on their table, views that venue's menu, and sends their
food/drink order to the venue. Payment is made in person at the counter — there
is NO payment and NO in-app purchase inside the app.

HOW TO REACH THE FULL EXPERIENCE ON iPad/iPhone (no login needed):

Option A — Scan the attached demo QR code
1. Open Chehia.
2. Tap "Scanner le code QR" (Scan QR code).
3. Point the camera at the attached QR image (demo-qr-cafe-el-marsa-table-12.png),
   e.g. displayed on another screen.
4. The menu for the demo venue "Café El Marsa — Table 12" opens. Add items,
   open the cart, and place the order. The order is confirmed on screen; the
   customer would then pay at the counter.
   (The QR encodes: https://app.chehia.app/r/cafe-el-marsa/t/demo-elmarsa-t12)

Option B — No scan needed (browse flow)
1. Open Chehia.
2. Tap "Trouver un établissement" (Find a place).
3. Select "Café El Marsa", choose a table, then browse the menu and order.

The app's primary localization is French; it also supports Arabic and English
based on the device language. Permission prompts are localized to the device
language (fr/ar/en).
```

---

## B. Reply to Apple's message (paste in the message thread)

```
Hello, and thank you for the detailed feedback.

Guideline 4 (Design) — permission-request language
You are right — the permission requests did not match the app's localization.
This is fixed in the new build (1.0 build 6):
- The camera and location usage descriptions are written in the app's primary
  localization (French), and are additionally localized for every supported
  localization (French, Arabic, English) via InfoPlist.strings, so the system
  permission prompts always appear in the same language as the app's UI.
- We also removed usage strings for capabilities the app does not use
  (microphone, always-on location, motion).
Chehia is designed as an iPhone app (a portrait, on-the-go tool used at a café
table); it also runs and functions fully on iPad in iPhone-compatibility mode.

Guideline 2.1(a) — demo details
No login is required (the customer app is anonymous). We have added a demo QR
code as an attachment and step-by-step instructions in App Review Information →
Notes. There is also a no-scan path: tap "Find a place" (Trouver un établissement), select the demo venue "Café El Marsa", pick a table, and
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

## C. Age-rating questionnaire (incl. the new social-media questions, due Sept 7 2026)

Facts about the app (what the answers must reflect):

- **No** violence, horror, mature/suggestive themes, profanity, drugs*, gambling,
  contests, or unrestricted web access. (*The app shows café menus — coffee/tea/food.
  If asked about alcohol/tobacco/drug **references**: venues could theoretically list
  such items; today's demo content has none. "None" is accurate for the app itself.)
- **No** social-media features: no user profiles, no follower/friend systems, no
  feeds, no photo/video sharing, no user-to-user messaging or chat.
- **Limited, moderated user-generated content only:**
  - Venue **reviews** (rating + optional comment + optional first name) — **pre-moderated**:
    an admin approves every review before it is published.
  - **Group-order nicknames** — visible only to the handful of people sharing one
    table's ordering session, never public.
  - Free-text **order notes** go to the venue's kitchen (customer→business), not to
    other users.
- **No** account creation, no age-gated content, no ads.

Recommended answers:
- All content-descriptor questions (violence, sexual content, profanity, drugs,
  gambling, horror…): **None**.
- "Unrestricted web access": **No**.
- Social-media / communication questions: users **cannot** communicate freely with
  other users; **no** user profiles; **no** content feeds.
- User-generated content questions: **Yes, with restrictions** — UGC (reviews) is
  reviewed/approved by the operator **before publication** (pre-moderation); there
  is a way to contact us (privacy page / About screen) to report or request removal.
- Expected resulting rating: **4+** (unchanged).

---

## D. After approval / optional

- TestFlight-install build 6 on a real iPhone AND an iPad (reviewer used an
  iPad Air 11" M3) and run one full order on the demo venue before resubmitting —
  15 minutes well spent.
- Android: `ANDROID_CERT_SHA256` on Vercel + `assetlinks.json` only matter for the
  Play submission later; not needed for Apple.
