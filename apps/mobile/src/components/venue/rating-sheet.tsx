import { useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  SENTIMENT_EMOJI,
  sentimentToRating,
  tr,
  type OrderItem,
  type Sentiment,
} from "@chehia/shared";
import { CtaButton, FaceInput, Handle, SheetClose, StarInput, T } from "../ui";
import { useI18n } from "@/lib/i18n";
import { colors, rowDir, useTheme } from "@/lib/theme";
import { ensureCustomerSession, functionsUrl, supabase, supabaseAnonKey } from "@/lib/supabase";

function randomUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Post-order rating: 😍/🙂/😐 for the visit + optional per-dish stars + comment. */
export function RatingSheet({
  orderId,
  lines,
  onClose,
  onSubmitted,
}: {
  orderId: string;
  lines: OrderItem[];
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const { t, lang, isRtl } = useI18n();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [itemRatings, setItemRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [phase, setPhase] = useState<"idle" | "sending" | "done" | "error">("idle");
  const clientRef = useMemo(() => randomUUID(), []);

  const dishes = useMemo(() => {
    const seen = new Map<string, OrderItem>();
    for (const l of lines) if (l.item_id && !seen.has(l.item_id)) seen.set(l.item_id, l);
    return [...seen.values()];
  }, [lines]);

  const hasAnything = sentiment !== null || Object.keys(itemRatings).length > 0;

  const submit = async () => {
    if (!hasAnything || phase === "sending") return;
    setPhase("sending");
    try {
      await ensureCustomerSession();
      const { data: sessionData } = await supabase.auth.getSession();
      const items = Object.entries(itemRatings).map(([item_id, rating]) => ({ item_id, rating }));
      const response = await fetch(functionsUrl("submit-review"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session?.access_token}`,
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          order_id: orderId,
          venue: sentiment ? { rating: sentimentToRating(sentiment), sentiment, comment } : undefined,
          items,
          name,
          client_ref: clientRef,
        }),
      });
      if (!response.ok) throw new Error("submit failed");
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase("done");
      onSubmitted?.();
      setTimeout(onClose, 2200);
    } catch {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setPhase("error");
    }
  };

  const faceOptions = [
    { key: "love" as const, emoji: SENTIMENT_EMOJI.love, label: t.rating.faceLove },
    { key: "good" as const, emoji: SENTIMENT_EMOJI.good, label: t.rating.faceGood },
    { key: "meh" as const, emoji: SENTIMENT_EMOJI.meh, label: t.rating.faceMeh },
  ];
  const align = { textAlign: isRtl ? ("right" as const) : ("left" as const) };

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
            paddingTop: 12,
            paddingBottom: insets.bottom + 14,
            maxHeight: "88%",
          }}
        >
          <SheetClose onClose={onClose} isRtl={isRtl} />
          <Handle />
          {phase === "done" ? (
            <View style={{ alignItems: "center", gap: 12, paddingVertical: 40, paddingHorizontal: 24 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.successTint, alignItems: "center", justifyContent: "center" }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" }}>
                  <T weight="extrabold" size={18} color="#FFFFFF">✓</T>
                </View>
              </View>
              <T lang={lang} display size={24} style={{ textAlign: "center" }}>{t.rating.thanksTitle}</T>
              <T lang={lang} weight="semibold" size={13} color={theme.muted} style={{ textAlign: "center" }}>
                {t.rating.thanksBody}
              </T>
            </View>
          ) : (
            <>
              <View style={{ paddingHorizontal: 20, marginBottom: 4 }}>
                <T lang={lang} display size={22} style={align}>{t.rating.visitPrompt}</T>
                <T lang={lang} weight="semibold" size={13} color={theme.muted} style={[align, { marginTop: 2 }]}>
                  {t.rating.visitSub}
                </T>
              </View>

              <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 12, gap: 18 }} keyboardShouldPersistTaps="handled">
                <FaceInput value={sentiment} onChange={setSentiment} options={faceOptions} />

                {dishes.length > 0 && (
                  <View style={{ gap: 8 }}>
                    <T lang={lang} weight="extrabold" size={15} style={align}>{t.rating.itemsPrompt}</T>
                    <T lang={lang} weight="semibold" size={12.5} color={theme.mutedSoft} style={[align, { marginTop: -4 }]}>
                      {t.rating.itemsSub}
                    </T>
                    {dishes.map((d) => (
                      <View
                        key={d.item_id}
                        style={[
                          rowDir(lang),
                          {
                            alignItems: "center",
                            justifyContent: "space-between",
                            backgroundColor: theme.card,
                            borderWidth: 1,
                            borderColor: theme.border,
                            borderRadius: 14,
                            paddingHorizontal: 14,
                            paddingVertical: 6,
                          },
                        ]}
                      >
                        <T lang={lang} weight="bold" size={14} numberOfLines={1} style={{ flex: 1 }}>
                          {tr(d.name_snapshot, lang)}
                        </T>
                        <StarInput
                          size={24}
                          value={itemRatings[d.item_id!] ?? 0}
                          onChange={(n) => setItemRatings((prev) => ({ ...prev, [d.item_id!]: n }))}
                        />
                      </View>
                    ))}
                  </View>
                )}

                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder={t.rating.commentPlaceholder}
                  placeholderTextColor={theme.mutedSoft}
                  maxLength={600}
                  multiline
                  style={{
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: theme.borderStrong,
                    backgroundColor: theme.card,
                    paddingHorizontal: 15,
                    paddingVertical: 12,
                    minHeight: 64,
                    fontFamily: "Manrope_500Medium",
                    fontSize: 15,
                    color: theme.ink,
                    textAlign: isRtl ? "right" : "left",
                    textAlignVertical: "top",
                  }}
                />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder={t.rating.namePlaceholder}
                  placeholderTextColor={theme.mutedSoft}
                  maxLength={40}
                  style={{
                    borderRadius: 14,
                    borderWidth: 1.5,
                    borderColor: theme.borderStrong,
                    backgroundColor: theme.card,
                    paddingHorizontal: 15,
                    paddingVertical: 12,
                    fontFamily: "Manrope_500Medium",
                    fontSize: 15,
                    color: theme.ink,
                    textAlign: isRtl ? "right" : "left",
                  }}
                />
                {phase === "error" && (
                  <T lang={lang} weight="bold" size={13} color={colors.dangerText}>{t.rating.error}</T>
                )}
              </ScrollView>

              <View style={{ paddingHorizontal: 16, gap: 6 }}>
                {phase === "sending" ? (
                  <View style={{ height: 52, alignItems: "center", justifyContent: "center" }}>
                    <ActivityIndicator color={theme.harissa} />
                  </View>
                ) : (
                  <CtaButton
                    lang={lang}
                    height={52}
                    label={t.rating.submit}
                    disabled={!hasAnything}
                    onPress={() => void submit()}
                  />
                )}
                <Pressable onPress={onClose} accessibilityRole="button" style={{ height: 40, alignItems: "center", justifyContent: "center" }}>
                  <T lang={lang} weight="bold" size={14} color={theme.muted}>{t.rating.later}</T>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
    </Modal>
  );
}
