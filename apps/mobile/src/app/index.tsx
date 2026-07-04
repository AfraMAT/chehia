import { CameraView, useCameraPermissions } from "expo-camera";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Linking, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parseTableUrl } from "@chehia/shared";
import { T, CtaButton, Wordmark, ZelligeMark } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { colors } from "@/lib/theme";

/**
 * Scan home — the app's front door when opened without a deep link.
 * Scanning a Chehia table QR routes straight to the venue's landing.
 */
export default function ScanHome() {
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [cameraBlocked, setCameraBlocked] = useState(false);
  const [unknownCode, setUnknownCode] = useState(false);
  const handledRef = useRef(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    },
    [],
  );

  const onScanned = useCallback(({ data }: { data: string }) => {
    if (handledRef.current) return;
    const link = parseTableUrl(data);
    if (link) {
      handledRef.current = true;
      setScanning(false);
      router.push(`/r/${link.slug}/t/${link.qrToken}`);
      setTimeout(() => {
        handledRef.current = false;
      }, 1500);
    } else {
      // Acknowledge an unrecognized code so the scanner never looks frozen
      // (debounced — onBarcodeScanned fires on every camera frame).
      setUnknownCode(true);
      if (hintTimer.current) clearTimeout(hintTimer.current);
      hintTimer.current = setTimeout(() => setUnknownCode(false), 2500);
    }
  }, []);

  const startScan = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        // A permanent iOS denial (canAskAgain=false) no longer shows the system
        // prompt, so guide the user to Settings instead of a silent no-op.
        if (!result.canAskAgain) setCameraBlocked(true);
        return;
      }
    }
    setCameraBlocked(false);
    setUnknownCode(false);
    setScanning(true);
  };

  if (scanning) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink }}>
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={onScanned}
        />
        {/* Scan frame overlay */}
        <View pointerEvents="none" style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 240, height: 240, borderWidth: 3, borderColor: colors.cream, borderRadius: 24, opacity: 0.9 }} />
          <T lang={lang} weight="bold" size={14} color={colors.cream} style={{ marginTop: 20, textAlign: "center" }}>
            {t.landing.scanPrompt}
          </T>
          {unknownCode && (
            <T lang={lang} weight="bold" size={13} color={colors.cream} style={{ marginTop: 10, textAlign: "center", opacity: 0.85 }}>
              {t.landing.notChehiaCode}
            </T>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.common.close}
          hitSlop={8}
          onPress={() => setScanning(false)}
          style={{
            position: "absolute",
            top: insets.top + 12,
            left: 16,
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: "rgba(34,26,19,0.82)",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <T weight="extrabold" size={16} color={colors.cream}>
            ✕
          </T>
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.cream,
        paddingTop: insets.top + 40,
        paddingBottom: insets.bottom + 20,
        paddingHorizontal: 28,
        alignItems: "center",
      }}
    >
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18 }}>
        <ZelligeMark size={84} radius={22} />
        <View style={{ alignItems: "center", gap: 6 }}>
          <Wordmark size={44} />
          <T lang={lang} weight="semibold" size={16} color={colors.muted}>
            {t.common.tagline}
          </T>
        </View>
        <T lang={lang} weight="semibold" size={13} color={colors.mutedSoft} style={{ textAlign: "center", maxWidth: 280, marginTop: 10 }}>
          {t.landing.scanHint}
        </T>
      </View>

      <View style={{ alignSelf: "stretch", gap: 10 }}>
        <CtaButton lang={lang} label={t.landing.scanPrompt} onPress={() => void startScan()} height={56} />
        {cameraBlocked && (
          <>
            <T lang={lang} weight="semibold" size={12.5} color={colors.mutedSoft} style={{ textAlign: "center", paddingHorizontal: 8 }}>
              {t.landing.cameraDenied}
            </T>
            <CtaButton
              lang={lang}
              variant="outline"
              height={44}
              label={t.landing.openSettings}
              onPress={() => void Linking.openSettings()}
            />
          </>
        )}
        <CtaButton
          lang={lang}
          variant="outline"
          height={48}
          label={t.home.findRestaurant}
          onPress={() => router.push("/app")}
        />
        {__DEV__ && (
          <CtaButton
            lang={lang}
            variant="outline"
            height={48}
            label="Démo — Café El Marsa · Table 12"
            onPress={() => router.push("/r/cafe-el-marsa/t/demo-elmarsa-t12")}
          />
        )}
        <Pressable
          accessibilityRole="link"
          onPress={() => router.push("/about")}
          hitSlop={8}
          style={{ alignSelf: "center", paddingVertical: 8 }}
        >
          <T lang={lang} weight="semibold" size={12} color={colors.mutedSoft}>
            {t.about.link}
          </T>
        </Pressable>
      </View>
    </View>
  );
}
