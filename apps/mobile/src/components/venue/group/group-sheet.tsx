import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CtaButton, Handle, SheetClose, T } from "../../ui";
import { useI18n } from "@/lib/i18n";
import { colors, rowDir, useTheme } from "@/lib/theme";
import { useSession } from "@/lib/session";

const NICK_KEY = "chehia.nickname";

/** Start a new group order, or join an existing one by code (Epic 2). */
export function GroupSheet({
  initialCode,
  onClose,
  onJoined,
}: {
  initialCode?: string;
  onClose: () => void;
  onJoined: () => void;
}) {
  const { t, lang, isRtl } = useI18n();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { start, join } = useSession();
  const [mode, setMode] = useState<"start" | "join">(initialCode ? "join" : "start");
  const [nickname, setNickname] = useState("");
  const [code, setCode] = useState(initialCode ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Remember the last name used locally (mirrors the web localStorage default).
  useEffect(() => {
    void AsyncStorage.getItem(NICK_KEY).then((v) => {
      if (v) setNickname(v);
    });
  }, []);

  const errMsg = (e: string) =>
    e.includes("full")
      ? t.group.errorFull
      : e.includes("closed")
        ? t.group.errorClosed
        : e.includes("not_found")
          ? t.group.errorNotFound
          : t.errors.generic;

  const go = async () => {
    if (mode === "join" && !code.trim()) return;
    setBusy(true);
    setError(null);
    const nick = nickname.trim() || t.rating.anon;
    void AsyncStorage.setItem(NICK_KEY, nick);
    try {
      const err = mode === "start" ? await start(nick) : await join(code.trim(), nick);
      if (err) {
        setError(errMsg(err));
        return;
      }
      onJoined();
    } catch {
      // A thrown failure (e.g. anonymous sign-in refused) must not leave the
      // spinner stuck — surface it like any other error.
      setError(t.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  const inputStyle = {
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: theme.borderStrong,
    backgroundColor: theme.card,
    paddingHorizontal: 14,
    fontFamily: "Manrope_700Bold",
    fontSize: 14,
    color: theme.ink,
  } as const;

  return (
    <Modal animationType="slide" transparent onRequestClose={onClose}>
      {/* Lift the sheet above the keyboard so its inputs stay visible. */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: "rgba(34,26,19,0.45)", justifyContent: "flex-end" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close} />
        <View
          style={{
            backgroundColor: theme.cream,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: insets.bottom + 18,
            gap: 14,
          }}
        >
          <SheetClose onClose={onClose} isRtl={isRtl} />
          <Handle />

          <View style={[rowDir(lang), { alignItems: "center", gap: 8 }]}>
            <T size={20}>👥</T>
            <T lang={lang} display size={21} style={{ flex: 1, textAlign: isRtl ? "right" : "left" }}>
              {t.group.orderTogether}
            </T>
          </View>

          {/* Mode switch */}
          <View style={[rowDir(lang), { gap: 4, backgroundColor: theme.sandDeep, borderRadius: 14, padding: 4 }]}>
            {(["start", "join"] as const).map((m) => {
              const active = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={{ flex: 1, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: active ? theme.card : "transparent" }}
                >
                  <T lang={lang} weight="extrabold" size={13} color={active ? theme.ink : theme.muted}>
                    {m === "start" ? t.group.startCta : t.group.join}
                  </T>
                </Pressable>
              );
            })}
          </View>

          <View style={{ gap: 6 }}>
            <T lang={lang} weight="extrabold" size={12} color={theme.mutedSoft} style={{ textAlign: isRtl ? "right" : "left" }}>
              {t.group.yourName}
            </T>
            <TextInput
              value={nickname}
              onChangeText={setNickname}
              placeholder={t.group.namePlaceholder}
              placeholderTextColor={theme.mutedSoft}
              maxLength={40}
              style={[inputStyle, { textAlign: isRtl ? "right" : "left" }]}
            />
          </View>

          {mode === "join" && (
            <View style={{ gap: 6 }}>
              <T lang={lang} weight="extrabold" size={12} color={theme.mutedSoft} style={{ textAlign: isRtl ? "right" : "left" }}>
                {t.group.code}
              </T>
              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.toUpperCase())}
                placeholder={t.group.enterCode}
                placeholderTextColor={theme.mutedSoft}
                maxLength={8}
                autoCapitalize="characters"
                autoCorrect={false}
                style={[inputStyle, { textAlign: "left", letterSpacing: 3 }]}
              />
            </View>
          )}

          {error && (
            <T lang={lang} weight="bold" size={13} color={colors.dangerText} style={{ textAlign: isRtl ? "right" : "left" }}>
              {error}
            </T>
          )}

          {busy ? (
            <View style={{ height: 52, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={theme.sidiBou} />
            </View>
          ) : (
            <CtaButton
              lang={lang}
              variant="dark"
              height={52}
              disabled={mode === "join" && !code.trim()}
              label={mode === "start" ? t.group.start : t.group.joinCta}
              onPress={() => void go()}
            />
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
    </Modal>
  );
}
