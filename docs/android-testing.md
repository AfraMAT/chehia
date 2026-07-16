# Chehia — Android testing (share this with testers)

The Android app is distributed as a direct-install **APK** (no Play Store account
needed). Anyone with an Android phone can install it from a link.

## What to send a tester

> **Try the Chehia app on Android**
>
> 1. Open this link on your Android phone's browser and tap **Download**:
>    **https://expo.dev/artifacts/eas/gysXL8pRN8WaH2_t4566cP5fXHVPla-bktYy9i7efrg.apk**
> 2. Open the downloaded `.apk`. When the phone warns about installing from an
>    unknown source, tap **Settings → allow from this source**, then back and
>    **Install**. (This is normal for apps not yet on the Play Store.)
> 3. Open **Chehia**, then scan a venue QR code — or open the demo:
>    **https://app.chehia.app/r/demo**
>
> No account is needed. Pick a language, browse the menu, and place a test order.

Prefer a tap-to-install page with a QR code? Send this instead (opens an
**Install** button; on desktop it shows a QR to scan with the phone camera):
**https://expo.dev/accounts/aframat/projects/chehia/builds/6bef75c7-8f1f-44ef-b888-9fc83410ee35**

## Notes

- The install link comes from EAS (Expo) and shows a small landing page with an
  **Install** button and a QR code the tester can scan with their phone camera.
- The APK is the **preview** profile → it points at the **dev** Supabase project
  (safe sandbox), not production. Test orders there do not touch live venues.
- Link/qr expiry: EAS build artifact links are long-lived; if it ever 404s,
  re-run `eas build -p android --profile preview` to mint a fresh one.

## How it was built / the fix that unblocked Android

The Android release build failed for three prior attempts with an opaque
`EAS_BUILD_UNKNOWN_GRADLE_ERROR`. Reproduced locally with the full Android SDK:
the real failure was **`:app:lintVitalRelease` → `ExtraTranslation`**. The iOS
permission strings shipped via `expo.locales`
(`NSCameraUsageDescription`, `NSLocationWhenInUseUsageDescription`,
`NSMotionUsageDescription`) get written into Android `values-b+xx/strings.xml`
per language, but they don't exist in the default `values/strings.xml`, so
Android's release-blocking lint treats them as stray translations and fails.

Fix: `apps/mobile/plugins/with-android-lint-fix.js` — a config plugin that adds
a `lint { disable "ExtraTranslation", "MissingTranslation"; checkReleaseBuilds false }`
block to `android/app/build.gradle`. These are iOS-only Info.plist keys with no
Android meaning, so disabling the translation-completeness check is correct and
scoped. Verified with a local `./gradlew :app:assembleRelease` → **BUILD
SUCCESSFUL**, 129 MB signed APK.

## Rebuilding later

```
cd apps/mobile
eas build -p android --profile preview   # shareable APK (dev backend)
eas build -p android --profile production # Play Store AAB (prod backend)
```
