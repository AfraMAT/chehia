import { router } from "expo-router";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cartCount, cartHasTable, cartTotal, currencyLabel, millimesToDisplay, orderErrorMessage } from "@chehia/shared";
import { BackButton, CtaButton, Line, Stepper, T } from "../ui";
import { useI18n } from "@/lib/i18n";
import { useLocationGate } from "@/lib/location-gate";
import { go } from "@/lib/nav";
import { colors, faceFor, rowDir, sizeFor, useTheme } from "@/lib/theme";
import { useVenue } from "@/lib/venue";
import { LocationGateCard } from "./location-gate";
import { OfflineBanner } from "./offline-banner";
import { TablePicker } from "./table-picker";

/**
 * P4 · Cart — table context re-confirmed, kitchen note, pay-at-counter stated
 * twice. Shared by the scanned and browse flows. In browse, the customer must
 * pick a table (via the picker) before the order can be placed. Render only
 * under a "ready" venue guard.
 */
export function CartScreen() {
  const {
    restaurant,
    table,
    cart,
    basePath,
    browse,
    updateQty,
    setCartNote,
    placeOrder,
    retryQueued,
    queuedOrder,
    queuedPlacedOrderId,
    clearQueuedPlaced,
    online,
  } = useVenue();
  const { t, tr, lang, isRtl } = useI18n();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const gate = useLocationGate();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // A queued order that the auto-retry just placed → jump to live tracking.
  // Consume the one-shot first so re-opening the cart later doesn't re-eject
  // the customer back to this already-placed order (they could never reorder).
  useEffect(() => {
    if (queuedPlacedOrderId) {
      const id = queuedPlacedOrderId;
      clearQueuedPlaced();
      go(`${basePath}/order/${id}`, "replace");
    }
  }, [queuedPlacedOrderId, basePath, clearQueuedPlaced]);

  const count = cartCount(cart);
  const total = cartTotal(cart);
  const hasTable = cartHasTable(cart);

  // Server error codes → actionable copy. The table lives in @chehia/shared so
  // the web cart maps exactly the same set (it used to map only five of them).
  const errorMessage = (code?: string): string => orderErrorMessage(code, t);

  const submit = async () => {
    if (submitting || count === 0) return;
    // Browse flow: a table must be chosen before an order can be placed.
    if (!hasTable) {
      setPickerOpen(true);
      return;
    }
    // Location gate (browse + venue requires it): must be within the geofence.
    // While not yet confirmed on-site, the gate CARD (not this button) is shown,
    // so this is a belt-and-braces guard — kick off a location read and stop.
    if (gate.applies && gate.status !== "ok") {
      void gate.request();
      return;
    }
    setSubmitting(true);
    setError(null);
    // Send the coords captured by the gate so the server can verify presence.
    const geo =
      gate.applies && gate.coords
        ? { lat: gate.coords.latitude, lng: gate.coords.longitude, accuracyM: gate.accuracy }
        : null;
    const result = await placeOrder(lang, geo);
    setSubmitting(false);
    if (result.ok && result.orderId) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      go(`${basePath}/order/${result.orderId}`, "replace");
      return;
    }
    if (result.queued) return; // queued banner takes over
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setError(errorMessage(result.errorCode));
  };

  // Manual retry of a queued order. Success → the queuedPlacedOrderId effect
  // jumps to tracking; a transient failure keeps it queued (banner stays, no
  // error). Only a genuine server rejection hands the lines back to the cart —
  // surface WHY so the customer knows it was not sent and can fix it.
  const retryNow = async () => {
    setError(null);
    const result = await retryQueued(lang);
    if (!result.ok && !result.queued) {
      setError(errorMessage(result.errorCode));
    }
  };

  const align = { textAlign: (isRtl ? "right" : "left") as "left" | "right" };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: theme.cream }}
    >
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <OfflineBanner />

        {/* Header */}
        <View style={[rowDir(lang), { alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 12 }]}>
          {/* Deep links (group invites) can land here with an empty history —
              fall back to the menu instead of a dead tap. */}
          <BackButton isRtl={isRtl} onPress={() => (router.canGoBack() ? router.back() : go(`${basePath}/menu`, "replace"))} />
          <T lang={lang} display size={22}>
            {t.cart.title}
          </T>
        </View>

        {count === 0 && !queuedOrder ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 32 }}>
            <T lang={lang} display size={22}>
              {t.cart.empty}
            </T>
            <T lang={lang} weight="semibold" size={13} color={theme.muted} style={{ textAlign: "center" }}>
              {t.cart.emptyBody}
            </T>
            <CtaButton
              lang={lang}
              height={48}
              style={{ marginTop: 14, alignSelf: "stretch", marginHorizontal: 24 }}
              label={t.cart.browseMenu}
              onPress={() => (router.canGoBack() ? router.back() : go(`${basePath}/menu`, "replace"))}
            />
          </View>
        ) : (
          <>
            {/* Table context — chosen (scanned/picked) or a prompt to pick (browse) */}
            {table ? (
              <View
                style={[
                  rowDir(lang),
                  {
                    marginHorizontal: 20,
                    marginTop: 14,
                    backgroundColor: theme.sidiBouTint,
                    borderRadius: 14,
                    paddingVertical: 12,
                    paddingHorizontal: 15,
                    alignItems: "center",
                    gap: 10,
                  },
                ]}
              >
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.sidiBou }} />
                <T lang={lang} weight="bold" size={13} color={theme.sidiBouPressed} style={{ flex: 1, ...align }}>
                  {t.common.table} {table.label}
                  {table.zone ? ` · ${table.zone}` : ""} — {restaurant.name}
                </T>
                {browse && (
                  <CtaButton
                    lang={lang}
                    variant="secondary"
                    height={34}
                    style={{ paddingHorizontal: 14 }}
                    label={t.landing.changeTable}
                    onPress={() => setPickerOpen(true)}
                  />
                )}
              </View>
            ) : (
              browse && (
                <View style={{ marginHorizontal: 20, marginTop: 14 }}>
                  <CtaButton
                    lang={lang}
                    variant="outline"
                    height={48}
                    label={t.landing.chooseTable}
                    onPress={() => setPickerOpen(true)}
                  />
                </View>
              )
            )}

            {/* Queued order banner (P8) */}
            {queuedOrder && (
              <View
                style={{
                  marginHorizontal: 16,
                  marginTop: 12,
                  backgroundColor: theme.ink,
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
                    <T size={13} color={theme.harissaSoft}>
                      •••
                    </T>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T lang={lang} weight="extrabold" size={15} color={theme.cream} style={align}>
                      {t.offline.queued}
                    </T>
                    <T lang={lang} weight="semibold" size={12.5} color="rgba(250,246,239,0.65)" style={align}>
                      {queuedOrder.count} {t.common.items} · {millimesToDisplay(queuedOrder.totalMillimes, lang)}{" "}
                      {currencyLabel(lang)} — {t.offline.queuedBody}
                    </T>
                  </View>
                </View>
                <CtaButton lang={lang} height={42} label={t.offline.retryNow} onPress={() => void retryNow()} />
              </View>
            )}

            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, gap: 10, paddingBottom: 12 }}>
              {cart.lines.map((line) => (
                <View
                  key={line.key}
                  style={{
                    backgroundColor: theme.card,
                    borderWidth: 1,
                    borderColor: theme.border,
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
                    <T lang={lang} size={12} color={theme.muted} style={align}>
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
                  <T lang={lang} weight="bold" size={12} color={theme.muted} style={align}>
                    {t.cart.kitchenNote}
                  </T>
                  <TextInput
                    value={cart.note}
                    onChangeText={setCartNote}
                    placeholder={t.cart.kitchenNotePlaceholder}
                    placeholderTextColor={theme.mutedSoft}
                    maxLength={500}
                    multiline
                    style={{
                      minHeight: 46,
                      borderRadius: 12,
                      borderWidth: 1.5,
                      borderColor: theme.borderStrong,
                      backgroundColor: theme.card,
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      fontFamily: faceFor(lang, "regular"),
                      fontSize: sizeFor(lang, 13.5),
                      color: theme.ink,
                      textAlign: isRtl ? "right" : "left",
                      writingDirection: isRtl ? "rtl" : "ltr",
                    }}
                  />
                </View>
              )}

              {/* Totals */}
              {count > 0 && (
                <View style={{ gap: 6, marginTop: 6 }}>
                  <Line dashed />
                  <View style={[rowDir(lang), { justifyContent: "space-between", marginTop: 6 }]}>
                    <T lang={lang} weight="semibold" size={13} color={theme.muted}>
                      {t.common.subtotal} · {count} {count > 1 ? t.common.items : t.common.item}
                    </T>
                    <T weight="bold" size={13}>
                      {millimesToDisplay(total, lang)}{" "}
                      <T weight="bold" size={13} lang={lang}>
                        {currencyLabel(lang)}
                      </T>
                    </T>
                  </View>
                  <View style={[rowDir(lang), { justifyContent: "space-between", alignItems: "baseline" }]}>
                    <T lang={lang} weight="extrabold" size={16}>
                      {t.common.total}
                    </T>
                    <T display size={24}>
                      {millimesToDisplay(total, lang)}{" "}
                      <T weight="bold" size={12} color={theme.mutedSoft} lang={lang}>
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
                  backgroundColor: theme.card,
                  borderTopWidth: 1,
                  borderColor: theme.border,
                  gap: 9,
                }}
              >
                {error && (
                  <T lang={lang} weight="bold" size={13} color={colors.dangerText} style={{ textAlign: "center" }}>
                    {error}
                  </T>
                )}
                <View style={[rowDir(lang), { alignItems: "center", justifyContent: "center", gap: 8 }]}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: theme.sidiBou }} />
                  <T lang={lang} weight="semibold" size={12.5} color={theme.sidiBouPressed}>
                    {t.cart.payAtCounter}
                  </T>
                </View>
                {/* Location gate: once a table is chosen but the customer isn't
                    confirmed on-site, the gate card (with its own CTA) replaces
                    the place-order button until they're within the geofence. */}
                {hasTable && gate.applies && gate.status !== "ok" ? (
                  <LocationGateCard venueName={restaurant.name} />
                ) : (
                  <CtaButton
                    lang={lang}
                    height={54}
                    // Deliberately NOT disabled while offline. The whole P8 queue
                    // — the banner, the 3h TTL, the auto-retry on reconnect — is
                    // entered from placeOrder's network catch, so disabling the
                    // button offline made the offline path unreachable by the one
                    // gesture meant to trigger it: the customer just saw a dead
                    // button on a café's flaky wifi. Tapping now queues the order
                    // and the banner explains it will send itself.
                    disabled={submitting}
                    label={
                      !hasTable
                        ? t.landing.chooseTable
                        : submitting
                          ? t.cart.submitting
                          : online
                            ? t.cart.submit
                            : t.offline.sendWhenOnline
                    }
                    onPress={() => void submit()}
                  />
                )}
              </View>
            )}
          </>
        )}
      </View>

      {pickerOpen && <TablePicker onClose={() => setPickerOpen(false)} />}
    </KeyboardAvoidingView>
  );
}
