# Chehia — App Review resubmission (Submission 780237f1-…)

Everything below is copy-paste ready. Three things to do in App Store Connect:
1. Upload a **new iOS build** that contains the Guideline 4 permission fix (rebuild via EAS — see "Build" at the bottom).
2. Fill **App Review Information → Notes** (and the Attachment) — see §A.
3. **Reply to Apple's message** with the text in §B, then **Resubmit to App Review**.

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
2. Tap "Trouver un restaurant" (Find a restaurant).
3. Select "Café El Marsa", choose a table, then browse the menu and order.

The app's primary localization is French; it also supports Arabic and English
based on the device language.
```

> Action for you before submitting: confirm the demo venue **Café El Marsa** and table **demo-elmarsa-t12** exist and are **active with a menu in the PRODUCTION Supabase project**. If not, either run the seed / create a demo venue+table in the admin portal, or tell me and I'll give you a one-off SQL insert to paste into the prod SQL editor. (Option B works with any active prod venue, so it's the safe fallback.)

---

## B. Reply to Apple's message (paste in the message thread)

```
Hello, and thank you for the detailed feedback.

Guideline 4 (Design) — permission language
You are right. The camera and location permission prompts previously combined
three languages (French, Arabic, English) in a single string. We have fixed this:
the usage descriptions are now written in the app's primary localization (French),
and the app declares its supported localizations (French, Arabic, English) via
CFBundleLocalizations. This fix is included in the new build we have just uploaded.
Chehia is designed as an iPhone app (a portrait, on-the-go tool used at a café
table); it also runs and functions on iPad in iPhone-compatibility mode.

Guideline 2.1(a) — demo details
No login is required (the customer app is anonymous). We have added a demo QR code
as an attachment and step-by-step instructions in the App Review Information → Notes.
There is also a no-scan path: tap "Find a restaurant", select the demo venue, and
browse/order without scanning.

Guideline 2.1(b) — business model
1) Does your app access any paid content or services?
   No. The app has no in-app purchases and no paid digital content or services.
2) What are the paid content or services, and what are the costs?
   None in the app. The only thing a customer pays for is the physical food and
   drinks they order, which are prepared and consumed in person at the café/
   restaurant. These are physical goods/services (Guideline 3.1.3(e)) and are not
   digital content.
3) Do individual customers pay for the content or services?
   Customers pay the café/restaurant directly, in person at the counter, for their
   food and drinks. No payment ever happens inside the app — the app does not
   process or collect any money.
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

## Build (Guideline 4 fix ships in the binary)

The fix is in `apps/mobile/app.json` (permission strings are now single-language
French; `CFBundleLocalizations` declared). It requires a **new build**:

```
cd apps/mobile
eas build --platform ios --profile production
# then, once built:
eas submit --platform ios --profile production   # or upload the build in ASC
```

Then in App Store Connect: select the new build for version 1.0, save §A, post §B,
and click **Resubmit to App Review**.

> Tip: to sanity-check the localized permission strings before the cloud build,
> run `npx expo prebuild -p ios --clean` locally and inspect
> `ios/Chehia/Info.plist` — the NSCameraUsageDescription / NSLocationWhenInUse…
> values should be the clean French sentences.
