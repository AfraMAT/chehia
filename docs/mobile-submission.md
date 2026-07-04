# Chehia — App Store & Google Play submission guide

The customer app (`apps/mobile`, Expo SDK 57) is an **anonymous, order-only, pay-at-counter** app: no accounts, no in-app payment, and two **on-device** permissions (camera for QR scanning; optional when-in-use location to sort nearby venues — coordinates never leave the device). That keeps review simple — it sidesteps Sign in with Apple (no third-party login), IAP (physical goods/services), and most privacy obligations.

## What's already done in the repo
- **Branded assets** — Scan & Fork icon (teal QR frame + harissa fork on cream) at all sizes: `icon.png` (1024), Android adaptive `foreground`/`background`/`monochrome`, `splash-icon.png`, `favicon.png`. Expo starter cruft removed.
- **app.json** — `ios.buildNumber "1"`, `android.versionCode 1`, `ITSAppUsesNonExemptEncryption:false`, iOS **privacy manifest** (required-reason APIs for AsyncStorage/file-timestamp/boot-time/disk), trilingual camera **and** when-in-use location usage strings, light splash/adaptive backgrounds, universal links (`applinks:chehia.app` / Android `autoVerify` intent filter).
- **eas.json** — `development`/`preview` (dev Supabase) + `production` (prod Supabase) build profiles, `autoIncrement`, and a `submit.production` block (fill in the placeholders).
- **Backend selection** — a release build defaults to the **prod** Supabase project (never localhost); dev/preview builds use the dev project via eas.json env.
- **In-app privacy** — an About & Privacy screen linking to https://chehia.app/legal/privacy with the "anonymous, no account, pay at counter" statement and a data-request contact.
- **Reviewer path** — the home screen's "Find a restaurant" opens Discovery, so a reviewer can browse a venue, pick a table, and order **without a physical QR**.

## Prerequisites (your accounts — one-time)
1. **Apple Developer Program** — ✅ active (Team ID `9KSK39WBM6`, `abbesmoez22@gmail.com`). Still to do: create the App ID `tn.chehia.app` and an app record in App Store Connect.
2. **Google Play Console** — $25 one-time. Create the app `tn.chehia.app`; create a **service account** JSON for `eas submit` and save it as `apps/mobile/play-service-account.json` (gitignored).
3. **EAS / Expo account** — free; `npm i -g eas-cli && eas login`.

## Fill in before building
- `eas.json` → `submit.production.ios`: `appleId` (`abbesmoez22@gmail.com`) and `appleTeamId` (`9KSK39WBM6`) are **filled in**. `ascAppId` is intentionally omitted — with the Apple ID + Team ID present, `eas submit` resolves the App Store Connect app by bundle id (`tn.chehia.app`) and can create the record if it doesn't exist. Once the record exists you *may* add `"ascAppId": "<numeric id>"` for a fully non-interactive submit, but it isn't required.
- Deep-link verification env on the **web** app (Vercel), so the well-known files serve:
  - `APPLE_TEAM_ID` = your Apple Team ID → `https://chehia.app/.well-known/apple-app-site-association`
  - `ANDROID_CERT_SHA256` = EAS upload-key SHA-256 **and** Play app-signing SHA-256 (comma-separated) → `https://chehia.app/.well-known/assetlinks.json`

## Build & submit
```bash
cd apps/mobile
eas build --platform all --profile production      # cloud build (needs a Mac? no — EAS builds iOS in the cloud)
eas submit --platform ios --profile production      # uploads to App Store Connect
eas submit --platform android --profile production  # uploads to Play Console
```

## Store listing content (starter copy)
- **Name:** Chehia
- **Subtitle / short description:** Scan, order, enjoy — at your table.
- **Description:** Chehia lets you order from your table at cafés and restaurants — scan the QR code (or find a place nearby), browse the menu in French, Arabic or English, and send your order straight to the kitchen. No app account, no waiting for a waiter. You pay at the counter, as usual.
- **Keywords:** qr menu, order, restaurant, cafe, table, tunisia, menu, food
- **Category:** Food & Drink
- **Age rating:** 4+ / Everyone
- **Support URL:** https://chehia.app · **Privacy URL:** https://chehia.app/legal/privacy

## App Privacy (Apple) / Data Safety (Google) answers
- **Data collected:** order contents + table (linked to an anonymous session id, not to a person). No name, email, or phone.
- **Location:** used **only on-device** to sort nearby venues (the optional "Near me" button). Coordinates are never stored or transmitted, so location is **not "collected"** for App Privacy — answer "No" to collecting location. The when-in-use usage string is included because the app *accesses* location; that is not the same as collecting it.
- **Camera:** used **on-device** to read the QR — no images are stored or transmitted.
- **Tracking:** none. No ads, no third-party analytics/SDKs.
- **Account deletion:** the app creates no personal account; anonymous session data can be removed on request via contact@aframat.com (also stated in-app on the About screen and in the privacy policy).

## Reviewer notes (paste into App Store Connect / Play review notes)
> Chehia is a QR table-ordering app. Reviewers without a physical QR code: open the app, tap **"Find a restaurant"**, choose a venue, pick a table, add items and place an order — this exercises the full flow. Payment happens in person at the counter; there is no in-app payment.

## Security / abuse posture (for your reference)
Ordering is anonymous by design (frictionless), protected by: staff **accept-gate** (nothing is prepared until staff accept), **server-side price recompute** (clients can't alter prices), **RLS** tenant isolation, **rate limits** (per session + per table) in `place-order`, and a per-venue **`require_qr`** switch to disable remote ordering. Escalation path if a venue is targeted: enable `require_qr`, or add phone/OTP on the browse path only.
