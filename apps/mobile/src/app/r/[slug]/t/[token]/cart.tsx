import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cartCount, cartTotal, currencyLabel, millimesToDisplay } from "@chehia/shared";
import { BackButton, CtaButton, Line, Stepper, T } from "@/components/ui";
import { useI18n } from "@/lib/i18n";
import { colors, rowDir } from "@/lib/theme";
import { useVenueState } from "@/lib/venue";
import { OfflineBanner } from "@/components/venue/offline-banner";

/** P4 · Cart — table context re-confirmed, kitchen note, pay-at-counter stated twice. */
export default function CartScreen() {
  const { state, cart, updateQty, setCartNote, placeOrder, retryQueued, queuedOrder, queuedPlacedOrderId, online } =
    useVenueState();
  const { t, tr, lang, isRtl } = useI18n();
  const insets = useSafeAreaInsets();
  const { slug, token } = useLocalSearchParams<{ slug: string; token: string }>();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A queued order that the auto-retry just placed → jump to live tracking.
  useEffect(() => {
    if (queuedPlacedOrderId) {
      router.replace(`/r/${slug}/t/${token}/order/${queuedPlacedOrderId}`);
    }
  }, [queuedPlacedOrderId, slug, token]);

  if (state.status === "invalid") {
    return <Redirect href={`/r/${slug}/t/${token}`} />;
  }
  if (state.status !== "ready") return null;
  const { restaurant, table } = state.bundle;

  const count = cartCount(cart);
  const total = cartTotal(cart);

  const submit = async () => {
    if (submitting || count === 0) return;
    setSubmitting(true);
    setError(null);
    const result = await placeOrder(lang);
    setSubmitting(false);
    if (result.ok && result.orderId) {
      router.replace(`/r/${slug}/t/${token}/order/${result.orderId}`);
      return;
    }
    if (result.queued) return; // queued banner takes over
    if (result.errorCode === "item_unavailable" || result.errorCode === "unknown_item") {
      setError(t.cart.itemUnavailable);
    } else if (result.errorCode === "unknown_table") {
      setError(t.errors.unknownTable);
    } else {
      setError(t.errors.orderFailed);
    }
  };

  const align = { textAlign: (isRtl ? "right" : "left") as "left" | "right" };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.cream }}
    >
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <OfflineBanner />

        {/* Header */}
        <View style={[rowDir(lang), { alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 12 }]}>
          <BackButton isRtl={isRtl} onPress={() => router.back()} />
          <T lang={lang} display size={22}>
            {t.cart.title}
          </T>
        </View>

        {count === 0 && !queuedOrder ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 32 }}>
            <T lang={lang} display size={22}>
              {t.cart.empty}
            </T>
            <T lang={lang} weight="semibold" size={13} color={colors.muted} style={{ textAlign: "center" }}>
              {t.cart.emptyBody}
            </T>
            <CtaButton
              lang={lang}
              height={48}
              style={{ marginTop: 14, alignSelf: "stretch", marginHorizontal: 24 }}
              label={t.cart.browseMenu}
              onPress={() => router.back()}
            />
          </View>
        ) : (
          <>
            {/* Table context */}
            <View
              style={[
                rowDir(lang),
                {
                  marginHorizontal: 20,
                  marginTop: 14,
                  backgroundColor: colors.sidiBouTint,
                  borderRadius: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 15,
                  alignItems: "center",
                  gap: 10,
                },
              ]}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.sidiBou }} />
              <T lang={lang} weight="bold" size={13} color={colors.sidiBouPressed}>
                {t.common.table} {table.label}
                {table.zone ? ` · ${table.zone}` : ""} — {restaurant.name}
              </T>
            </View>

            {/* Queued order banner (P8) */}
            {queuedOrder && (
              <View
                style={{
                  marginHorizontal: 16,
                  marginTop: 12,
                  backgroundColor: colors.ink,
                  borderRadius: 18,
                  padding: 16,
                  gap: 12,
                }}
              >
                <View style={[rowDir(lang), { alignItems: "center", gap: 12 }]}>
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      backgroundColor: "rgba(255,255,255,0.08)",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <T size={13} color={colors.harissaSoft}>
                      •••
                    </T>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T lang={lang} weight="extrabold" size={15} color={colors.cream} style={align}>
                      {t.offline.queued}
                    </T>
                    <T lang={lang} weight="semibold" size={12.5} color="rgba(250,246,239,0.65)" style={align}>
                      {queuedOrder.count} {t.common.items} · {millimesToDisplay(queuedOrder.totalMillimes, lang)}{" "}
                      {currencyLabel(lang)} — {t.offline.queuedBody}
                    </T>
                  </View>
                </View>
                <CtaButton lang={lang} height={42} label={t.offline.retryNow} onPress={() => void retryQueued(lang)} />
              </View>
            )}

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, gap: 10, paddingBottom: 12 }}>
              {cart.lines.map((line) => (
                <View
                  key={line.key}
                  style={{
                    backgroundColor: "#FFFFFF",
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 16,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    gap: 4,
                  }}
                >
                  <View style={[rowDir(lang), { justifyContent: "space-between", gap: 8 }]}>
                    <T lang={lang} weight="extrabold" size={15} style={{ flexShrink: 1 }}>
                      {tr(line.name)}
                    </T>
                    <T weight="extrabold" size={15}>
                      {millimesToDisplay(line.unitPriceMillimes * line.qty, lang)}
                    </T>
                  </View>
                  {(line.modifierLabels.length > 0 || line.note) && (
                    <T lang={lang} size={12} color={colors.muted} style={align}>
                      {line.modifierLabels.map((m) => tr(m.choice)).join(" · ")}
                      {line.note ? `${line.modifierLabels.length ? " · " : ""}${line.note}` : ""}
                    </T>
                  )}
                  <View style={[rowDir(lang), { marginTop: 6 }]}>
                    <Stepper compact value={line.qty} onChange={(q) => updateQty(line.key, q)} />
                  </View>
                </View>
              ))}

              {/* Kitchen note */}
              {count > 0 && (
                <View style={{ gap: 6, marginTop: 4 }}>
                  <T lang={lang} weight="bold" size={12} color={colors.muted} style={align}>
                    {t.cart.kitchenNote}
                  </T>
                  <TextInput
                    value={cart.note}
                    onChangeText={setCartNote}
                    placeholder={t.cart.kitchenNotePlaceholder}
                    placeholderTextColor={colors.mutedSoft}
                    maxLength={500}
                    multiline
                    style={{
                      minHeight: 46,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: colors.borderStrong,
                      backgroundColor: "#FFFFFF",
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      fontFamily: "Manrope_500Medium",
                      fontSize: 13.5,
                      color: colors.ink,
                      textAlign: isRtl ? "right" : "left",
                    }}
                  />
                </View>
              )}

              {/* Totals */}
              {count > 0 && (
                <View style={{ gap: 6, marginTop: 6 }}>
                  <Line dashed />
                  <View style={[rowDir(lang), { justifyContent: "space-between", marginTop: 6 }]}>
                    <T lang={lang} weight="semibold" size={13} color={colors.muted}>
                      {t.common.subtotal} · {count} {count > 1 ? t.common.items : t.common.item}
                    </T>
                    <T weight="bold" size={13}>
                      {millimesToDisplay(total, lang)} {currencyLabel(lang)}
                    </T>
                  </View>
                  <View style={[rowDir(lang), { justifyContent: "space-between", alignItems: "baseline" }]}>
                    <T lang={lang} weight="extrabold" size={16}>
                      {t.common.total}
                    </T>
                    <T display size={24}>
                      {millimesToDisplay(total, lang)}{" "}
                      <T weight="bold" size={12} color={colors.mutedSoft} lang={lang}>
                        {currencyLabel(lang)}
                      </T>
                    </T>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Submit */}
            {count > 0 && (
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingTop: 10,
                  paddingBottom: insets.bottom + 14,
                  backgroundColor: colors.card,
                  borderTopWidth: 1,
                  borderColor: colors.border,
                  gap: 9,
                }}
              >
                {error && (
                  <T lang={lang} weight="bold" size={13} color={colors.dangerText} style={{ textAlign: "center" }}>
                    {error}
                  </T>
                )}
                <View style={[rowDir(lang), { alignItems: "center", justifyContent: "center", gap: 8 }]}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.sidiBou }} />
                  <T lang={lang} weight="semibold" size={12.5} color={colors.sidiBouPressed}>
                    {t.cart.payAtCounter}
                  </T>
                </View>
                <CtaButton
                  lang={lang}
                  height={54}
                  disabled={submitting || !online}
                  label={submitting ? t.cart.submitting : t.cart.submit}
                  onPress={() => void submit()}
                />
              </View>
            )}
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
