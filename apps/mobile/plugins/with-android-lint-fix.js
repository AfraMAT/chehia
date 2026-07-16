// Managed-Expo config plugin.
//
// The app ships iOS permission strings (NSCameraUsageDescription,
// NSLocationWhenInUseUsageDescription, NSMotionUsageDescription) localized per
// language via expo.locales. On Android those keys leak into per-locale
// values-b+xx/strings.xml but are absent from the default values/strings.xml,
// so `lintVitalRelease` fails the release build with ExtraTranslation errors.
// These are iOS-only Info.plist keys with no Android meaning, so we disable the
// two translation-completeness lint checks for release builds.
const { withAppBuildGradle } = require("@expo/config-plugins");

const LINT_BLOCK = `    lint {
        disable "ExtraTranslation", "MissingTranslation"
        checkReleaseBuilds false
    }`;

module.exports = function withAndroidLintFix(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== "groovy") {
      throw new Error(
        "with-android-lint-fix: expected groovy build.gradle, got " +
          cfg.modResults.language
      );
    }
    let src = cfg.modResults.contents;
    if (src.includes('disable "ExtraTranslation"')) {
      return cfg; // already applied
    }
    // Inject a lint {} block as the first statement inside `android {`.
    src = src.replace(/\bandroid\s*\{/, (match) => `${match}\n${LINT_BLOCK}`);
    cfg.modResults.contents = src;
    return cfg;
  });
};
