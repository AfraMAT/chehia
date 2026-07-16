# Chehia — App Store & Google Play submission guide

The customer app (`apps/mobile`, Expo SDK 57) is an **anonymous, order-only, pay-at-counter** app: no accounts, no in-app payment, and two when-in-use permissions (camera for QR scanning — processed on-device, no image leaves the phone; optional location to sort nearby venues **and**, when ordering remotely from a venue that requires presence, to verify you are on-site — see the geofence note below). That keeps review simple — it sidesteps Sign in with Apple (no third-party login), IAP (physical goods/services), and most privacy obligations.

## What's already done in the repo
- **Branded assets** — steaming-cup icon (harissa cup on cream, café-shaped) at all sizes: `icon.png` (1024), Android adaptive `foreground`/`background`/`monochrome`, `splash-icon.png`, `favicon.png`. Expo starter cruft removed.
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

## Store listing content (LIVE in ASC as of 2026-07-16 — French primary locale)
- **Name:** Chehia
- **Subtitle (fr, 28 chars ≤30):** Scannez, commandez, savourez
  - en-US option if an English localization is added later: "Scan & order at your table" (26)
- **Promotional text (fr, 170):** Nouveau : commande de groupe, personnalisation des articles, avis clients et « ma commande habituelle ». Scannez le QR de la table et payez au comptoir, comme d'habitude.
- **Description (fr):** the full feature description now in ASC (scan QR → menu fr/ar/en →
  order to staff → pay at counter; group ordering, reorder-my-usual, moderated reviews,
  contact chips, privacy-by-design). English translation available in the 2026-07-16 audit
  (copy/final-description-en) for a future en-US localization.
- **Keywords (fr, 93 ≤100):** `qr,menu,carte,commande,commander,table,café,restaurant,tunisie,tunis,scanner,serveur,boissons`
  - en-US option: `qr,menu,order,table,cafe,coffee,restaurant,tunisia,tunis,scan,waiter,drinks,carte`
- **Category:** Food & Drink
- **Age rating:** 4+ (new 7-step questionnaire completed 2026-07-16; UGC=Yes moderated, everything else None/No)
- **Support URL:** https://chehia.app · **Marketing URL:** https://chehia.app · **Privacy URL:** https://chehia.app/legal/privacy
- **Copyright:** 2026 AfraMAT

## App Privacy (Apple) / Data Safety (Google) answers
- **Data collected:** order contents + table + optional free-text note (linked to an anonymous session id, not to a person). No account, email, or phone. Optional **reviews** (rating, optional comment, optional first name — moderated before publishing) and optional **group-order nicknames** (visible to others at the table) are user-provided and stored.
- **Location — read the geofence note carefully (this changed when location-gated ordering shipped):** the app uses when-in-use location for two things: (a) sorting nearby venues, which happens **on-device**; and (b) when you order **remotely** from a venue that requires presence, the app sends your precise coordinates **once** to the `place-order` function to check you are within the venue's radius. That coordinate is used **in memory only for the distance check and is never written to the database** (verified in `supabase/functions/place-order/index.ts`).
  - **Apple App Privacy:** location may still be answered **"Not Collected."** Apple's definition excludes data transmitted and used only for the current request and not retained; this ephemeral geofence check qualifies. Do **not** claim in prose that "coordinates never leave the device" — that is now false; the correct framing is "not stored / not linked to identity."
  - **Google Play Data Safety:** declare **Location (approximate + precise) = Collected**, purpose "App functionality," mark **"Processed ephemerally"** and **Optional** (only for gated remote orders). Google treats any transmission to a server as "collected," ephemeral flag or not.
- **Camera:** used **on-device** to read the QR — no images are stored or transmitted. Not "collected" on either store.
- **Tracking:** none. No ads, no third-party analytics/SDKs.
- **Account deletion:** the app creates no personal account; anonymous session data (orders, reviews, nicknames) can be removed on request via contact@aframat.com (also stated in-app on the About screen and in the privacy policy).

## Reviewer notes (paste into App Store Connect / Play review notes)
> Chehia is a QR table-ordering app. Reviewers without a physical QR code: open the app, tap **"Find a restaurant"**, choose a venue, pick a table, add items and place an order — this exercises the full flow. Payment happens in person at the counter; there is no in-app payment.

## Security / abuse posture (for your reference)
Ordering is anonymous by design (frictionless), protected by: staff **accept-gate** (nothing is prepared until staff accept), **server-side price recompute** (clients can't alter prices), **RLS** tenant isolation, **rate limits** (per session + per table) in `place-order`, and a per-venue **`require_qr`** switch to disable remote ordering. Escalation path if a venue is targeted: enable `require_qr`, or add phone/OTP on the browse path only.
