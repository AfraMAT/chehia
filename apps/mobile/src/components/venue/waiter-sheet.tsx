import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { WaiterCallReason } from "@chehia/shared";
import { CtaButton, Handle, SheetClose, T } from "../ui";
import { useI18n } from "@/lib/i18n";
import { colors, rowDir, useTheme } from "@/lib/theme";
import { useVenueState } from "@/lib/venue";

/** P6 · Call waiter — bottom sheet with reason presets. */
export function WaiterSheet({ onClose }: { onClose: () => void }) {
  const { callWaiter } = useVenueState();
  const { t, lang, isRtl } = useI18n();
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  const [reason, setReason] = useState<WaiterCallReason>("bill");
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const options: { value: WaiterCallReason; label: string }[] = [
    { value: "bill", label: t.waiter.bill },
    { value: "water", label: t.waiter.water },
    { value: "cutlery", label: t.waiter.cutlery },
    { value: "other", label: t.waiter.other },
  ];

  const send = async () => {
    if (state === "sending") return;
    setState("sending");
    const ok = await callWaiter(reason, note);
    if (ok) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setState("sent");
      setTimeout(onClose, 1600);
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setState("error");
    }
  };

  return (
    <Modal animationType="slide" transparent onRequestClose={onClose}>
      {/* Lift the sheet above the keyboard so its inputs stay visible. */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <View style={{ flex: 1, backgroundColor: "rgba(34,26,19,0.45)", justifyContent: "flex-end" }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityRole="button" accessibilityLabel={t.common.close} />
        <View
          style={{
            backgroundColor: theme.card,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: insets.bottom + 18,
          }}
        >
          <SheetClose onClose={onClose} isRtl={isRtl} />
          <Handle />

          {state === "sent" ? (
            <View style={{ alignItems: "center", gap: 12, paddingVertical: 32 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.successTint, alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" }}>
                  <T weight="extrabold" size={18} color="#FFFFFF">
                    ✓
                  </T>
                </View>
              </View>
              <T lang={lang} display size={20}>
                {t.waiter.sent}
              </T>
              <T lang={lang} weight="semibold" size={13} color={theme.muted}>
                {t.waiter.sentBody}
              </T>
            </View>
          ) : (
            <>
              <View style={{ gap: 3, marginBottom: 16 }}>
                <T lang={lang} display size={23} style={{ textAlign: isRtl ? "right" : "left" }}>
                  {t.waiter.callTitle}
                </T>
                <T lang={lang} weight="semibold" size={13} color={theme.muted} style={{ textAlign: isRtl ? "right" : "left" }}>
                  {t.waiter.callBody}
                </T>
              </View>

              <View style={{ gap: 8, marginBottom: 16 }}>
                {options.map((opt) => {
                  const active = reason === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setReason(opt.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={opt.label}
                      style={[
                        rowDir(lang),
                        {
                          alignItems: "center",
                          gap: 12,
                          borderWidth: active ? 2 : 1.5,
                          borderColor: active ? theme.harissa : theme.borderStrong,
                          backgroundColor: active ? theme.harissaTint : theme.card,
                          borderRadius: 14,
                          paddingVertical: 13,
                          paddingHorizontal: 15,
                        },
                      ]}
                    >
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          borderWidth: active ? 6 : 2,
                          borderColor: active ? theme.harissa : theme.disabled,
                          backgroundColor: theme.card,
                        }}
                      />
                      <T lang={lang} weight={active ? "extrabold" : "bold"} size={14.5} color={active ? theme.harissaPressed : theme.ink}>
                        {opt.label}
                      </T>
                    </Pressable>
                  );
                })}
                {reason === "other" && (
                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    maxLength={300}
                    placeholder="…"
                    placeholderTextColor={theme.mutedSoft}
                    style={{
                      borderRadius: 14,
                      borderWidth: 1.5,
                      borderColor: theme.borderStrong,
                      backgroundColor: theme.card,
                      paddingHorizontal: 15,
                      paddingVertical: 12,
                      fontFamily: "Manrope_500Medium",
                      fontSize: 14,
                      color: theme.ink,
                      textAlign: isRtl ? "right" : "left",
                    }}
                  />
                )}
              </View>

              {state === "error" && (
                <T lang={lang} weight="bold" size={13} color={colors.dangerText} style={{ marginBottom: 8 }}>
                  {t.errors.generic}
                </T>
              )}

              {state === "sending" ? (
                <View style={{ height: 54, alignItems: "center", justifyContent: "center" }}>
                  <ActivityIndicator color={theme.harissa} />
                </View>
              ) : (
                <CtaButton lang={lang} variant="dark" height={54} label={t.waiter.send} onPress={() => void send()} />
              )}
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
    </Modal>
  );
}
